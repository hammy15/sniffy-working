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
  doc, getDoc,
  collection, getDocs, addDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import StateRegulations from './StateRegulations';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function App() {
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});
  // Auth and fetch user + POCs
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        // fetch POCs
        const snap = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));

        const userDoc = await getDoc(doc(db, 'users', u.uid));
        setUserData(userDoc.exists() ? userDoc.data() : { pro: false });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return unsubscribe;
  }, []);
  const handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch (err) { alert('Login failed: ' + err.message); }
  };

  const handleLogout = () => signOut(auth);
  // Extract text and F-tags from PDF
  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const txt = await page.getTextContent();
        full += txt.items.map(item => item.str).join(' ') + '\n';
      }
      const tags = [...new Set((full.match(/F\d{3}/g) || []))].join(', ');
      setInputText(full.slice(0, 3000).trim());
      setFTags(tags);
    };
    reader.readAsArrayBuffer(file);
  };
  // Extract text and F-tags from PDF
  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const txt = await page.getTextContent();
        full += txt.items.map(item => item.str).join(' ') + '\n';
      }
      const tags = [...new Set((full.match(/F\d{3}/g) || []))].join(', ');
      setInputText(full.slice(0, 3000).trim());
      setFTags(tags);
    };
    reader.readAsArrayBuffer(file);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: files => files[0] && extractTextFromPDF(files[0]),
  });
  // Generate POC
  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText, fTags: fTags.split(',').map(f => f.trim()), selectedState }),
      });
      const data = await res.json();
      if (data.result) {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
          inputText, fTags, result: data.result, selectedState, timestamp: new Date()
        });
        setResults([{ id: docRef.id, inputText, fTags, result: data.result, selectedState }, ...results]);
        setInputText(''); setFTags('');
      } else alert('No result from GPT');
    } catch (err) {
      alert('Error generating POC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  // Care plan generation
  const generateCarePlan = async (pocId, pocText) => {
    setCarePlanLoading(prev => ({ ...prev, [pocId]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocText })
      });
      const data = await res.json();
      if (data.carePlan) {
        await updateDoc(doc(db, 'users', user.uid, 'pocs', pocId), { carePlan: data.carePlan });
        setResults(results.map(r => r.id === pocId ? { ...r, carePlan: data.carePlan } : r));
      } else alert('No care plan returned.');
    } catch (err) {
      alert('Error generating care plan: ' + err.message);
    } finally {
      setCarePlanLoading(prev => ({ ...prev, [pocId]: false }));
    }
  };
  const deletePOC = async id => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(results.filter(r => r.id !== id));
  };

  const exportAsPDF = async id => {
    const el = exportRefs.current[id];
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL('image/png');
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
  if (user === undefined) return <div style={{ padding: 40 }}>🔄 Checking login…</div>;
  if (user === null) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <h2>Login to SNIFFY</h2>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={{ width: '100%', padding: 8, marginBottom: 10 }} />
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" style={{ width: '100%', padding: 8, marginBottom: 10 }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: 10 }}>Login</button>
      </div>
    );
  }
  // Main UI
  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2>SNIFFY</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <h3>📎 Upload CMS‑2567 PDF</h3>
      <div {...getRootProps()} style={{
        border: '2px dashed #0077cc', background: '#eef7ff', padding: 40, textAlign: 'center', marginBottom: 20, borderRadius: 8
      }}>
        <input {...getInputProps()} />
        {isDragActive ? <p><strong>Drop PDF here...</strong></p> : <p>Click or drag your <strong>2567 PDF</strong> here...</p>}
      </div>
      <h3>📍 Select Your State</h3>
      <select
        value={selectedState}
        onChange={e => setSelectedState(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20 }}
      >
        <option value="">-- Select a State (Optional) --</option>
        {Object.keys(StateRegulations).sort().map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <textarea rows={5} value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste deficiency text here…" style={{ width: '100%', padding: 10 }} />
      <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="F‑Tags (e.g. F684)" style={{ width: '100%', padding: 10, margin: '10px 0' }} />

      <button onClick={generatePOC} disabled={loading} style={{ padding: 10 }}>
        {loading ? 'Generating…' : '🧠 Generate POC'}
      </button>

      <hr style={{ margin: '40px 0' }} />

      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <div ref={el => exportRefs.current[r.id] = el}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p><pre>{r.inputText}</pre>
            <p><strong>Plan of Correction:</strong></p><pre>{r.result}</pre>

            {r.carePlan && <>
              <p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre>
            </>}

            {r.selectedState && <>
              <p><strong>State-Specific Regulations for {r.selectedState}:</strong></p>
              {r.fTags.split(',').map(t => {
                const tag = t.trim();
                const reg = StateRegulations[r.selectedState]?.[tag];
                return reg ? <p key={tag}><strong>{tag}:</strong> {reg}</p> : null;
              })}
            </>}

            <small>By: {user.email}</small>
          </div>

          {!r.carePlan && (
            <button onClick={() => generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]} style={{ marginTop: 10 }}>
              {carePlanLoading[r.id] ? 'Generating…' : '🧠 Care Plan'}
            </button>
          )}
          <br /><br />
          <button onClick={() => exportAsPDF(r.id)}>📄 Export PDF</button>
          <button style={{ marginLeft: 10, color: 'red' }} onClick={() => deletePOC(r.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
