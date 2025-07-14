// App.js - SNIFFY
// App.js – SNIFFY
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
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        await fetchPOCs(u.uid);
        const ud = await getDoc(doc(db, 'users', u.uid));
        setUserData(ud.exists() ? ud.data() : { pro: false });
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

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = () => signOut(auth);
  const handleStripeCheckout = async () => {
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, uid: user.uid })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert('Checkout session failed.');
    } catch (err) {
      alert('Stripe checkout error: ' + err.message);
    }
  };
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
        })
      });
      const { result } = await res.json();
      if (result) {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
          inputText, fTags, result, selectedState, timestamp: new Date()
        });
        setResults([{ id: docRef.id, inputText, fTags, result, selectedState }, ...results]);
        setInputText(''); setFTags('');
      } else alert('No result from GPT');
    } catch (err) {
      alert('Error generating POC: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCarePlan = async (pocId, pocText) => {
    setCarePlanLoading(p => ({ ...p, [pocId]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocText })
      });
      const { carePlan } = await res.json();
      if (carePlan) {
        await updateDoc(doc(db, 'users', user.uid, 'pocs', pocId), { carePlan });
        setResults(results.map(r => r.id === pocId ? { ...r, carePlan } : r));
      } else alert('No care plan returned.');
    } catch (err) {
      alert('Error generating care plan: ' + err.message);
    } finally {
      setCarePlanLoading(p => ({ ...p, [pocId]: false }));
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
    let y = 0;
    pdf.addImage(img, 'PNG', 0, y, w, h);
    let left = h - pdf.internal.pageSize.getHeight();
    while (left > 0) {
      pdf.addPage();
      y = -left;
      pdf.addImage(img, 'PNG', 0, y, w, h);
      left -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`POC-${id}.pdf`);
  };

  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
      let full = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const txt = await pg.getTextContent();
        full += txt.items.map(it => it.str).join(' ') + '\n';
      }
      const tags = [...new Set(full.match(/F\d{3}/g) || [])].join(', ');
      setInputText(full.slice(0, 3000));
      setFTags(tags);
    };
    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: files => files[0] && extractTextFromPDF(files[0])
  });
  if (user === undefined) {
    return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
  }

  if (user === null) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <h2>Login to <span style={{ color: '#0077cc' }}>SNIFFY</span></h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width:'100%',padding:8,marginBottom:10 }} />
        <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} style={{ width:'100%',padding:8,marginBottom:10 }} />
        <button onClick={handleLogin} style={{ width:'100%',padding:10 }}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display:'flex',justifyContent:'space-between' }}>
        <h2>SNIFFY 🧠</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* PDF Upload */}
      <h3>📎 Upload CMS‑2567 PDF</h3>
      <div {...getRootProps()} style={{ border:'2px dashed #0077cc',padding:40,textAlign:'center',background:'#eef7ff',marginBottom:20,borderRadius:8 }}>
        <input {...getInputProps()} />
        {isDragActive ? <p><strong>Drop PDF here...</strong></p>
                      : <p>Click or drag your <strong>2567 PDF</strong> here...</p>}
      </div>

      {/* State Selector */}
      <h3>📍 Select Your State</h3>
      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{ width:'100%',padding:10,marginBottom:20 }}>
        <option value="">-- Select a State (Optional) --</option>
        {Object.keys(StateRegulations).sort().map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Input & Generate */}
      <textarea rows="5" style={{ width:'100%',padding:10 }} placeholder="Paste deficiency text..." value={inputText} onChange={e => setInputText(e.target.value)} />
      <input placeholder="F‑Tags (e.g. F684, F689)" value={fTags} onChange={e => setFTags(e.target.value)} style={{ width:'100%',padding:10,margin:'10px 0' }} />
      <button onClick={generatePOC} disabled={loading} style={{ padding: 10 }}>
        {loading ? 'Generating...' : '🧠 Generate POC'}
      </button>

      <hr style={{ margin: '40px 0' }} />

      {/* Saved POCs */}
      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border:'1px solid #ccc',padding:20,borderRadius:8,marginBottom:20 }}>
          <div ref={el => (exportRefs.current[r.id] = el)}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p><pre>{r.inputText}</pre>
            <p><strong>Plan of Correction:</strong></p><pre>{r.result}</pre>
            {r.carePlan && <>
              <p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre>
            </>}
            {r.selectedState && (
              <div>
                <p><strong>State‑Specific Regulations for {r.selectedState}:</strong></p>
                {r.fTags.split(',').map(tag => {
                  const clean = tag.trim();
                  const reg = StateRegulations[r.selectedState]?.[clean];
                  return reg ? <p key={clean}><strong>{clean}:</strong> {reg}</p> : null;
                })}
              </div>
            )}
            <small>Generated for: {user.email}</small>
          </div>

          {!r.carePlan && (
            <button onClick={() => generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]} style={{ marginTop:10 }}>
              {carePlanLoading[r.id] ? 'Generating...' : '🧠 Generate Care Plan'}
            </button>
          )}
          <br /><br />
          <button onClick={() => exportAsPDF(r.id)}>📄 Export PDF</button>
          <button onClick={() => deletePOC(r.id)} style={{ marginLeft:10, color:'red' }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default App;

);

