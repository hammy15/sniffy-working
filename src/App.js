// src/scoring.js
export const SCOPE_LABELS = ['Isolated', 'Pattern', 'Widespread'];
export const SEVERITY_LABELS = ['A–C', 'D–F', 'G–I', 'J–L'];

export const SCORE_MAP = {
  D: [4, 8, 16],
  E: [8, 16, 32],
  F: [16, 32, 48],
  G: [20, 35, 45],
  H: [35, 50, 65],
  I: [45, 60, 80],
  J: [50, 75, 100],
  K: [100, 125, 150],
  L: [150, 175, 200],
};

/**
 * Parses tags like "F684D" → { tag: "F684", severity: "D" }
 */
export function parseTagSeverity(rawTag) {
  const match = rawTag.match(/(F\d{3})([A-L])/);
  if (!match) return null;
  return { tag: match[1], severity: match[2] };
}

/**
 * Given severity and scope index, returns point value
 */
export function computePoints(severity, scopeIndex) {
  const arr = SCORE_MAP[severity];
  return arr ? arr[scopeIndex] : 0;
}
// pages/api/generatePOC.js
import { parseTagSeverity, computePoints, SCOPE_LABELS } from '../../src/scoring';
import { Configuration, OpenAIApi } from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  const { fullText, tags = [], selectedState } = req.body;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing API key' });

  const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));
  const analysis = [];

  tags.forEach(tagRaw => {
    const ps = parseTagSeverity(tagRaw);
    if (!ps) return;

    const scopeIndex = 1; // Simplified default = Pattern
    const pts = computePoints(ps.severity, scopeIndex);
    analysis.push({
      tag: ps.tag,
      severity: ps.severity,
      scope: SCOPE_LABELS[scopeIndex],
      points: pts,
      recommendation: `Provide correction for ${ps.tag} severity ${ps.severity}`
    });
  });

  const totalPoints = analysis.reduce((s, a) => s + a.points, 0);
  analysis.sort((a, b) => a.tag.localeCompare(b.tag));

  // Call GPT to generate unified POC text
  const aiResponse = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Craft a professional POC covering each tag.' },
      { role: 'user', content: `
Tags: ${analysis.map(a => a.tag).join(', ')}
Recommendations:
${analysis.map(a => `${a.tag}: ${a.recommendation}`).join('\n')}
State: ${selectedState}
` }
    ],
    max_tokens: 800,
  });

  const poctext = aiResponse.data.choices[0].message.content;
  res.status(200).json({ analysis, totalPoints, poctext });
}
// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { auth, db } from './firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import StateRegulations from './StateRegulations';
import { parseTagSeverity } from './scoring';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function App() {
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        const snapshot = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));

        const ud = await getDoc(doc(db, 'users', u.uid));
        setUserData(ud.exists() ? ud.data() : { pro: false });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (e) { alert(e.message); }
  };

  const handleLogout = () => signOut(auth);
  const extractPDF = async file => {
    const fr = new FileReader();
    fr.onload = async () => {
      const arr = new Uint8Array(fr.result);
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const tc = await pg.getTextContent();
        text += tc.items.map(x => x.str).join(' ') + '\n';
      }
      setInputText(text);
      const tags = Array.from(new Set(text.match(/F\d{3}[A-L]/g) || []));
      setFTags(tags.join(', '));
    };
    fr.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: 'application/pdf',
    multiple: false,
    onDrop: files => extractPDF(files[0])
  });
  const generatePOC = async () => {
    setLoading(true);
    const tags = fTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ fullText: inputText, tags, selectedState })
      });
      const jd = await res.json();
      if (jd.error) throw new Error(jd.error);

      const ref = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
        inputText, fTags, selectedState,
        analysis: jd.analysis, totalPoints: jd.totalPoints,
        poctext: jd.poctext, timestamp: new Date()
      });
      setResults([{ id: ref.id, inputText, fTags, selectedState, ...jd }, ...results]);
      
      setAnalysis(jd.analysis);
      setTotalPoints(jd.totalPoints);
    } catch (e) { alert(e.message); }
    setLoading(false);
  };
  const exportAsPDF = async () => {
    const el = exportRefs.current['output'];
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    let y = 0;
    pdf.addImage(img, 'PNG', 0, y, w, h);
    let left = h - pdf.internal.pageSize.getHeight();
    while (left > 0) {
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, -left, w, h);
      left -= pdf.internal.pageSize.getHeight();
    }
    pdf.save('POC_full.pdf');
  };
  if (user === undefined) return <div>🔄 Checking login…</div>;
  if (!user) return (
    <LoginForm 
      email={email} pass={pass}
      onLogin={handleLogin}
      setEmail={setEmail} setPass={setPass}
    />
  );

  return (
    <div style={{ padding:40, maxWidth:900, margin:'0 auto' }}>
      <div style={{display:'flex', justifyContent:'space-between'}}>
        <h2>SNIFFY</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div {...getRootProps()} style={dropzoneStyle}>
        <input {...getInputProps()} />
        {isDragActive 
          ? <p>Drop your 2567 PDF here</p> 
          : <p>Click or drag PDF</p>}
      </div>

      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{ width:'100%', padding:10 }}>
        <option value=''>-- Select State --</option>
        {Object.keys(StateRegulations).sort().map(st => (
          <option key={st} value={st}>{st}</option>
        ))}
      </select>

      <textarea rows={5} value={inputText} onChange={e => setInputText(e.target.value)} style={{width:'100%', padding:10}} />
      <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="F‑Tags" style={{width:'100%', padding:10, margin:'10px 0'}} />
      <button onClick={generatePOC} disabled={loading} style={{ padding:10 }}>
        {loading ? 'Generating…' : 'Generate POC'}
      </button>

      {analysis.length > 0 && (
        <div ref={el => exportRefs.current['output'] = el} style={{ marginTop:40 }}>
          <h3>POC Recommendations</h3>
          <table style={tableStyle}>
            <thead><tr><th>Tag</th><th>Scope</th><th>Severity</th><th>Points</th><th>Recommendation</th></tr></thead>
            <tbody>
              {analysis.map(a => (
                <tr key={a.tag}>
                  <td>{a.tag}</td>
                  <td>{a.scope}</td>
                  <td>{a.severity}</td>
                  <td>{a.points}</td>
                  <td>{a.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Total Score: <strong>{totalPoints}</strong></p>
          <button onClick={exportAsPDF} style={{ padding:10 }}>Download POC PDF</button>
        </div>
      )}
    </div>
  );
}

export default App;
