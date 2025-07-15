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
  const [userData, setUserData] = useState({ pro: false });
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
        const snap = await getDoc(doc(db, 'users', u.uid));
        setUserData(snap.exists() ? snap.data() : { pro: false });
        const q = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(q.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setUser(null);
        setUserData({ pro: false });
        setResults([]);
      }
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };
  const handleLogout = () => signOut(auth);

  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          fTags: fTags.split(',').map(t => t.trim()),
          selectedState,
        }),
      });
      const data = await res.json();
      if (data.result) {
        const ref = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
          inputText, fTags, selectedState,
          result: data.result, timestamp: new Date(),
        });
        setResults([{ id: ref.id, inputText, fTags, selectedState, result: data.result }, ...results]);
        setInputText('');
        setFTags('');
      } else alert('GPT returned no result');
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ... (generateCarePlan, deletePOC, exportAsPDF, extractTextFromPDF remain unchanged)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: files => files[0] && extractTextFromPDF(files[0]),
  });

  if (user === undefined) return <div style={{padding:40}}>🔄 Checking login...</div>;
  if (user === null) return (
    <div style={{padding:40, maxWidth:400, margin:'0 auto'}}>
      <h2>Login to SNIFFY</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',marginBottom:10}}/>
      <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" style={{width:'100%',marginBottom:10}}/>
      <button onClick={handleLogin} style={{width:'100%'}}>Login</button>
    </div>
  );

  return (
    <div style={{padding:40, maxWidth:900, margin:'0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between'}}><h2>SNIFFY 🧠</h2>
      <button onClick={handleLogout}>Logout</button></div>

      {/* PDF Upload */}
      <h3>📎 Upload CMS‑2567 PDF</h3>
      <div {...getRootProps()} style={{border:'2px dashed #0077cc',padding:40,textAlign:'center',background:'#eef7ff',marginBottom:20,borderRadius:8}}>
        <input {...getInputProps()} />
        {isDragActive ? <p><strong>Drop PDF here...</strong></p> :
          <p>Click or drag your <strong>2567 PDF</strong> here to extract f‑tags.</p>}
      </div>

      {/* State */}
      <select value={selectedState} onChange={e=>setSelectedState(e.target.value)} style={{width:'100%',padding:10,marginBottom:20}}>
        <option value="">-- Select a State --</option>
        {Object.keys(StateRegulations).sort().map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* POC generation */}
      <textarea rows="5" value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="Deficiency details..." style={{width:'100%',padding:10}}/>
      <input value={fTags} onChange={e=>setFTags(e.target.value)} placeholder="F‑Tags (e.g. F684, F689)" style={{width:'100%',padding:10,margin:'10px 0'}}/>
      <button onClick={generatePOC} disabled={loading} style={{padding:10}}>
        {loading ? 'Generating...' : '🧠 Generate POC'}
      </button>

      {/* Saved POCs */}
      <hr style={{margin:'40px 0'}}/>
      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{border:'1px solid #ccc',padding:20,borderRadius:8,marginBottom:20}}>
          <div ref={el => exportRefs.current[r.id] = el}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p><pre>{r.inputText}</pre>
            <p><strong>POC:</strong></p><pre>{r.result}</pre>
            {r.selectedState && (
              <div>
                <p><strong>State Rules for {r.selectedState}:</strong></p>
                {r.fTags.split(',').map(tag => {
                  const t = tag.trim();
                  const reg = StateRegulations[r.selectedState]?.find(x => x.tag === t);
                  return reg ? <p key={t}><strong>{t}:</strong> {reg.regulation}</p> : null;
                })}
              </div>
            )}
            {r.carePlan && (<><p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre></>)}
            <small>By: {user.email}</small>
          </div>
          {!r.carePlan && <button onClick={()=>generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]}>
            {carePlanLoading[r.id] ? 'Generating...' : '🧠 Generate Care Plan'}
          </button>}
          <br/><br/>
          <button onClick={()=>exportAsPDF(r.id)}>📄 Export PDF</button>
          <button onClick={()=>deletePOC(r.id)} style={{marginLeft:10,color:'red'}}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default App;
