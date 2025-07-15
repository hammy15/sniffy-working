// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import StateRegulations from './StateRegulations';
import { calcDeficiencyPoints } from './scoring'; // if used elsewhere

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

  // Auth and fetch POCs + user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        setUserData(userDoc.exists() ? userDoc.data() : { pro: false });
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  // Dropzone + PDF extraction
  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const txt = await page.getTextContent();
        full += txt.items.map(it => it.str).join(' ') + '\n';
      }
      const tags = [...new Set(...[full.match(/F\d{3}/g) || []])].join(', ');
      setInputText(full.trim().slice(0, 3000));
      setFTags(tags);
    };
    reader.readAsArrayBuffer(file);
  };

  const dz = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: acceptedFiles => acceptedFiles.length && extractTextFromPDF(acceptedFiles[0]),
  });

  // Button functions
  const generatePOC = async () => {
    if (!inputText || !fTags) {
      alert('Please provide both deficiency text and F-Tags.');
      return;
    }

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
          inputText, fTags, result: data.result, selectedState, timestamp: new Date(),
        });
        setResults([{ id: docRef.id, inputText, fTags, result: data.result, selectedState }, ...results]);
        setInputText('');
        setFTags('');
      } else alert('No POC returned.');
    } catch (err) {
      alert('Error generating POC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCarePlan = async (id, pocText) => {
    setCarePlanLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocText }),
      });
      const { carePlan } = await res.json();
      if (carePlan) {
        const docRef = doc(db, 'users', user.uid, 'pocs', id);
        await updateDoc(docRef, { carePlan });
        setResults(results.map(r => r.id === id ? { ...r, carePlan } : r));
      } else alert('No care plan returned.');
    } catch (err) {
      alert('Error generating care plan: ' + err.message);
    } finally {
      setCarePlanLoading(p => ({ ...p, [id]: false }));
    }
  };

  const deletePOC = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(results.filter(r => r.id !== id));
  };

  const exportAsPDF = async (id) => {
    const el = exportRefs.current[id];
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    let y = 0, rem = h - pdf.internal.pageSize.getHeight();
    pdf.addImage(img, 'PNG', 0, y, w, h);
    while (rem > 0) {
      y = -rem;
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, y, w, h);
      rem -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`POC-${id}.pdf`);
  };

  // Render
  if (user === undefined) {
    return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
  }

  if (user === null) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <h2>Login to SNIFFY</h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{width:'100%',padding:8,marginBottom:10}}/>
        <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} style={{width:'100%',padding:8,marginBottom:10}}/>
        <button onClick={handleLogin} style={{width:'100%',padding:10}}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>SNIFFY</h2>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <section {...dz.getRootProps()} style={{border:'2px dashed #0077cc',padding:40,textAlign:'center',marginTop:20,cursor:'pointer'}}>
        <input {...dz.getInputProps()} />
        {dz.isDragActive ? 'Drop PDF here...' : 'Click or drag your 2567 PDF here'}
      </section>

      <h3>📍 Select State</h3>
      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{width:'100%',padding:10,marginBottom:20}}>
        <option value="">None</option>
        {Object.keys(StateRegulations).map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <textarea placeholder="Deficiency text" rows={5} value={inputText} onChange={e => setInputText(e.target.value)} style={{width:'100%',padding:10}}/>
      <input placeholder="F-Tags (comma-separated)" value={fTags} onChange={e => setFTags(e.target.value)} style={{width:'100%',padding:10,margin:'10px 0'}}/>

      <button onClick={generatePOC} disabled={loading} style={{padding:10,marginBottom:20}}>
        {loading ? 'Generating...' : 'Generate POC'}
      </button>

      <hr/>

      <h3>Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{border:'1px solid #ccc',padding:20,marginBottom:20,position:'relative'}} ref={el => (exportRefs.current[r.id] = el)}>
          <strong>F‑Tags:</strong> {r.fTags}<br/>
          <strong>Deficiency:</strong><pre>{r.inputText}</pre>
          <strong>POC:</strong><pre>{r.result}</pre>
          {r.carePlan && <><strong>Care Plan:</strong><pre>{r.carePlan}</pre></>}
          {r.selectedState && <strong>State Regs for {r.selectedState}</strong>}
          <div style={{marginTop:10}}>
            {!r.carePlan && <button onClick={() => generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]}>Gen Care Plan</button>}
            <button onClick={() => exportAsPDF(r.id)} style={{marginLeft:10}}>Export PDF</button>
            <button onClick={() => deletePOC(r.id)} style={{marginLeft:10,color:'red'}}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
