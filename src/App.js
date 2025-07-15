import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
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
        const snap = await getDoc(doc(db, 'users', u.uid));
        setUserData(snap.exists() ? snap.data() : { pro: false });
        const pocSnap = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(pocSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return unsub;
  }, []);
  const handleLogin = async () => {
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch (err) { alert('Login failed: ' + err.message); }
  };
  const handleLogout = () => signOut(auth);
  const extractTextFromPDF = async (file) => { /* same as before */ };
  const exportAsPDF = async (id) => { /* same as before */ };

  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ inputText, fTags: fTags.split(',').map(f=>f.trim()), selectedState })
      });
      const { result } = await res.json();
      if (!result) return alert('No result from GPT');
      const ref = await addDoc(collection(db, 'users', user.uid, 'pocs'),
        { inputText, fTags, result, selectedState, timestamp: new Date() });
      setResults([{ id: ref.id, inputText, fTags, result, selectedState }, ...results]);
      setInputText(''); setFTags('');
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const generateCarePlan = async (id, text) => { /* same*/ };
  const deletePOC = async (id) => { /* same*/ };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    onDrop: files => files[0] && extractTextFromPDF(files[0]),
  });
  if (user === undefined) return <div style={{padding:40}}>🔄 Checking login...</div>;
  if (user === null) return (
    <div style={{padding:40,maxWidth:400,margin:'0 auto'}}>
      <h2>Login to SNIFFY 🧠</h2>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );

  return (
    <div style={{padding:40,maxWidth:900,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between'}}>
        <h2>SNIFFY 🧠</h2><button onClick={handleLogout}>Logout</button>
      </header>

      <section>
        <h3>📎 Upload CMS‑2567 PDF</h3>
        <div {...getRootProps()} style={{border:'2px dashed #0077cc',padding:40,textAlign:'center',background:'#eef7ff',marginBottom:20,borderRadius:8}}>
          <input {...getInputProps()} />
          {isDragActive ? <p><strong>Drop PDF here...</strong></p> : <p>Drag or click to upload your CMS‑2567 PDF</p>}
        </div>

        <h3>📍 Select State (optional)</h3>
        <select value={selectedState} onChange={e => setSelectedState(e.target.value)}>
          <option value="">-- None --</option>
          {Object.keys(StateRegulations).sort().map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <textarea rows="5" placeholder="Or paste deficiency text..." value={inputText} onChange={e=>setInputText(e.target.value)} />
        <input placeholder="F‑Tags (e.g. F684, F689)" value={fTags} onChange={e=>setFTags(e.target.value)} />
        <button onClick={generatePOC} disabled={loading}>{loading ? '…Generating' : '🧠 Generate POC'}</button>
      </section>

      <section>
        <hr />
        <h3>📂 Saved POCs</h3>
        {results.map(r => (
          <div key={r.id} style={{border:'1px solid #ccc',padding:20,marginBottom:20,borderRadius:8}}>
            <div ref={el=>exportRefs.current[r.id]=el}>
              <p><strong>F‑Tags:</strong> {r.fTags}</p>
              <pre><strong>Deficiency:</strong><br />{r.inputText}</pre>
              <pre><strong>POC:</strong><br />{r.result}</pre>
              {r.carePlan && <pre><strong>Care Plan:</strong><br />{r.carePlan}</pre>}
              {r.selectedState && <div><strong>State Regs:</strong>{r.fTags.split(',').map(tag=>{
                const clean=tag.trim(), reg=StateRegulations[r.selectedState][clean];
                return reg ? <p key={clean}><strong>{clean}:</strong> {reg}</p> : null;
              })}</div>}
            </div>
            {!r.carePlan && <button onClick={()=>generateCarePlan(r.id,r.result)} disabled={carePlanLoading[r.id]}>{carePlanLoading[r.id]?'…':'🧠 Care Plan'}</button>}
            <br/><button onClick={()=>exportAsPDF(r.id)}>📄 Export PDF</button>
            <button onClick={()=>deletePOC(r.id)} style={{color:'red'}}>Delete</button>
          </div>
        ))}
      </section>
    </div>
  );
}

export default App;
