// src/App.js - SNIFFY
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

pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // fetch existing POCs
        const snap = await getDocs(
          collection(db, 'users', u.uid, 'pocs')
        );
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        // fetch user data for 'pro' field
        const ud = await getDoc(doc(db, 'users', u.uid));
        setUserData(ud.exists() ? ud.data() : { pro: false });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        full += tc.items.map(it => it.str).join(' ') + '\n';
      }
      setInputText(full.trim().slice(0, 3000));
      setFTags([...new Set(full.match(/F\d{3}/g) || [])].join(', '));
    };
    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: files => files[0] && extractTextFromPDF(files[0]),
  });

  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          fTags: fTags.split(',').map(f => f.trim()),
          selectedState
        }),
      });
      const data = await res.json();
      if (!data.result) throw new Error(data.error || 'No result');
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'pocs'),
        {
          inputText,
          fTags,
          result: data.result,
          selectedState,
          timestamp: new Date(),
        }
      );
      setResults([{ id: docRef.id, ...data, selectedState }, ...results]);
      setInputText(''); setFTags('');
    } catch (err) {
      console.error(err);
      alert('Error generating POC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCarePlan = async (id, txt) => {
    setCarePlanLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocText: txt }),
      });
      const data = await res.json();
      if (!data.carePlan) throw new Error(data.error || 'no careplan');
      await updateDoc(doc(db, 'users', user.uid, 'pocs', id), { carePlan: data.carePlan });
      setResults(r => r.map(x => x.id === id ? { ...x, carePlan: data.carePlan } : x));
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCarePlanLoading(p => ({ ...p, [id]: false }));
    }
  };

  const exportAsPDF = async (id) => {
    const el = exportRefs.current[id];
    if (!el) return alert('Nothing to export');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL('png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, w, h);
    let left = h - pdf.internal.pageSize.getHeight();
    while (left > 0) {
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, -left, w, h);
      left -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`POC-${id}.pdf`);
  };

  const deletePOC = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(r => r.filter(x => x.id !== id));
  };

  if (user === undefined) {
    return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
  }
  if (user === null) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <h2>Login to SNIFFY</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 10 }}
        />
        <button onClick={handleLogin} style={{ width: '100%', padding: 10 }}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>SNIFFY</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <h3>Upload CMS‑2567 PDF</h3>
      <div
        {...getRootProps()}
        style={{
          border: '2px dashed #0077cc',
          padding: 40,
          textAlign: 'center',
          background: '#eef7ff',
          marginBottom: 20,
          borderRadius: 8,
        }}>
        <input {...getInputProps()} />
        {isDragActive
          ? <p><strong>Drop PDF here...</strong></p>
          : <p>Click or drag your <strong>2567 PDF</strong> here.</p>}
      </div>

      <h3>Select State (optional)</h3>
      <select
        value={selectedState}
        onChange={e => setSelectedState(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20 }}>
        <option value="">-- None --</option>
        {Object.keys(StateRegulations).sort().map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <textarea
        rows="5"
        style={{ width: '100%', padding: 10 }}
        placeholder="Paste deficiency text..."
        value={inputText}
        onChange={e => setInputText(e.target.value)}
      />

      <input
        placeholder="F‑Tags (comma separated)"
        value={fTags}
        onChange={e => setFTags(e.target.value)}
        style={{ width: '100%', padding: 10, margin: '10px 0' }}
      />

      <button onClick={generatePOC} disabled={loading} style={{ padding: 10 }}>
        {loading ? 'Generating…' : 'Generate POC'}
      </button>

      <hr style={{ margin: '40px 0' }} />
      <h3>Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <div ref={el => (exportRefs.current[r.id] = el)}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency Text:</strong></p><pre>{r.inputText}</pre>
            <p><strong>POC:</strong></p><pre>{r.result}</pre>
            {r.carePlan && (
              <>
                <p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre>
              </>
            )}
            {r.selectedState && (
              <>
                <p><strong>State: {r.selectedState}</strong></p>
                {r.fTags.split(',').map(tag => {
                  const clean = tag.trim();
                  const reg = StateRegulations[r.selectedState]?.[clean];
                  return reg ? <p key={clean}><strong>{clean}:</strong> {reg}</p> : null;
                })}
              </>
            )}
          </div>

          {!r.carePlan && (
            <button
              onClick={() => generateCarePlan(r.id, r.result)}
              disabled={carePlanLoading[r.id]}
              style={{ marginTop: 10 }}
            >
              {carePlanLoading[r.id] ? 'Generating Care Plan…' : 'Generate Care Plan'}
            </button>
          )}
          <br /><br />

          <button onClick={() => exportAsPDF(r.id)}>Export PDF</button>
          <button onClick={() => deletePOC(r.id)} style={{ marginLeft: 10, color: 'red' }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;
