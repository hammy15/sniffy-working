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
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import StateRegulations from './StateRegulations';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
function App() {
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const exportRefs = useRef({});
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        await fetchPOCs(u.uid);
        const docSnap = await getDoc(doc(db, 'users', u.uid));
        setUserData(docSnap.exists() ? docSnap.data() : { pro: false });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return unsub;
  }, []);
  const fetchPOCs = async (uid) => {
    const snap = await getDocs(collection(db, 'users', uid, 'pocs'));
    setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const generatePOC = async () => {
    if (!inputText || !fTags) return alert('Missing text or tags');
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inputText, fTags: fTags.split(',').map(t=>t.trim()), selectedState })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) return alert(data?.error || `Server Error ${res.status}`);
      const docRef = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
        inputText, fTags, result: data.result, selectedState, timestamp: new Date()
      });
      setResults([{ id: docRef.id, inputText, fTags, result: data.result, selectedState }, ...results]);
      setInputText(''); setFTags('');
    } catch (e) {
      alert('POC generation failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCarePlan = async (id, pocText) => {
    setCarePlanLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pocText })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.carePlan) return alert(data?.error || `Server Error ${res.status}`);
      await updateDoc(doc(db, 'users', user.uid, 'pocs', id), { carePlan: data.carePlan });
      setResults(r => r.map(d => d.id === id ? { ...d, carePlan: data.carePlan } : d));
    } catch (e) {
      alert('Care plan failed: ' + e.message);
    } finally {
      setCarePlanLoading(p => ({ ...p, [id]: false }));
    }
  };

  const deletePOC = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(r => r.filter(d => d.id !== id));
  };

  const exportAsPDF = async (id) => {
    const el = exportRefs.current[id];
    if (!el) return alert('Nothing to export.');
    const canvas = await html2canvas(el, { scale:2, useCORS:true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    let y = 0;
    pdf.addImage(img, 'PNG', 0, y, width, height);
    let leftover = height - pdf.internal.pageSize.getHeight();
    while (leftover > 0) {
      y = -leftover;
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, y, width, height);
      leftover -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`POC-${id}.pdf`);
  };

  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const doc = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        full += tc.items.map(i => i.str).join(' ') + '\n';
      }
      setInputText(full.slice(0, 3000));
      setFTags([...new Set((full.match(/F\d{3}/g) || []))].join(', '));
    };
    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: f => f[0] && extractTextFromPDF(f[0]),
  });
  if (user === undefined) return <div style={{ padding:40 }}>🔄 Checking login...</div>;

  if (!user) {
    return (
      <div style={{ padding:40, maxWidth:400, margin:'0 auto' }}>
        <h2>Login to SNIFFY</h2>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:'100%', padding:8, marginBottom:10 }} />
        <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} style={{ width:'100%', padding:8, marginBottom:10 }} />
        <button onClick={handleLogin} style={{ width:'100%', padding:10 }}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding:40, maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <h2>SNIFFY</h2>
        <button onClick={() => signOut(auth)}>Logout</button>
      </div>

      <h3>📎 Upload CMS‑2567 PDF</h3>
      <div {...getRootProps()} style={{ border:'2px dashed #0077cc', padding:40, textAlign:'center', background:'#eef7ff', borderRadius:8, marginBottom:20 }}>
        <input {...getInputProps()} />
        {isDragActive ? <p><strong>Drop PDF here…</strong></p> : <p>Click or drag your 2567 PDF here</p>}
      </div>

      <h3>📍 Select State (optional)</h3>
      <select value={selectedState} onChange={e=>setSelectedState(e.target.value)} style={{ width:'100%', padding:10, marginBottom:20 }}>
        <option value=''>-- None --</option>
        {Object.keys(StateRegulations).sort().map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <textarea rows={5} placeholder="Deficiency text..." value={inputText} onChange={e=>setInputText(e.target.value)} style={{ width:'100%', padding:10 }} />
      <input placeholder="F‑Tags e.g. F684" value={fTags} onChange={e=>setFTags(e.target.value)} style={{ width:'100%', padding:10, margin:'10px 0' }} />
      <button onClick={generatePOC} disabled={loading} style={{ padding:10 }}>
        {loading ? 'Generating…' : 'Generate POC'}
      </button>

      <hr style={{ margin:'40px 0' }} />
      <h3>Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border:'1px solid #ccc', padding:20, borderRadius:8, marginBottom:20 }}>
          <div ref={el => exportRefs.current[r.id] = el}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <pre>{r.result}</pre>
            {r.carePlan && <pre>{r.carePlan}</pre>}
            {r.selectedState && (
              <div>
                <p><strong>State regs for {r.selectedState}:</strong></p>
                {r.fTags.split(',').map(t => {
                  const reg = StateRegulations[r.selectedState]?.[t.trim()];
                  return reg && <p key={t}><strong>{t.trim()}:</strong> {reg}</p>;
                })}
              </div>
            )}
            <small>By: {user.email}</small>
          </div>
          {!r.carePlan && (
            <button onClick={() => generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]}>
              {carePlanLoading[r.id] ? '...' : 'Generate Care Plan'}
            </button>
          )}
          <br/><br/>
          <button onClick={() => exportAsPDF(r.id)}>Export PDF</button>
          <button onClick={() => deletePOC(r.id)} style={{ color:'red', marginLeft:10 }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default App;
