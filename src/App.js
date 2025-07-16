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
  doc
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
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});

  // Auth & fetch user data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        await fetchPOCs(u.uid);
      } else {
        setUser(null);
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

  const extractTextFromPDF = async (file) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const arr = new Uint8Array(reader.result);
    const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;

    console.log('🔍 Number of pages:', pdfDoc.numPages);
    let full = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const text = await page.getTextContent();
      console.log(`Page ${i} text items count:`, text.items.length);
      full += text.items.map(item => item.str).join(' ') + '\n';
    }

    const tags = [...new Set((full.match(/F\d{3}/g) || []))].join(', ');
    setInputText(full.trim().slice(0, 3000));
    setFTags(tags);
  };
  reader.readAsArrayBuffer(file);
};


  // POC generation
  const generatePOC = async () => {
  setLoading(true);
  try {
    const res = await fetch('/api/generatePOC', {/* ... */});
    const text = await res.text();
    console.log('📥 Server responded with:', text);

    const data = JSON.parse(text); // handle unexpected formats
    if (data.result) {
      // process result…
    } else {
      alert('No result from GPT');
      console.error('Payload:', data);
    }
  } catch (err) {
    alert('Error generating POC: ' + err.message);
  } finally {
    setLoading(false);
  }
};


  // Care plan generator
  const generateCarePlan = async (id, text) => {
    setCarePlanLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/generateCarePlan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pocText: text })
      });
      const data = await res.json();
      if (data.carePlan) {
        await updateDoc(doc(db, 'users', user.uid, 'pocs', id), { carePlan: data.carePlan });
        setResults(results.map(r => r.id === id ? { ...r, carePlan: data.carePlan } : r));
      } else alert('No care plan returned.');
    } catch (err) {
      alert('Error generating care plan: ' + err.message);
    } finally {
      setCarePlanLoading(prev => ({ ...prev, [id]: false }));
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
    let y = 0, left = h - pdf.internal.pageSize.getHeight();
    pdf.addImage(img, 'PNG', 0, y, w, h);
    while (left > 0) {
      y = -left;
      pdf.addPage();
      pdf.addImage(img, 'PNG', 0, y, w, h);
      left -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`POC-${id}.pdf`);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { 'application/pdf': ['.pdf'] },
  multiple: false,
  onDrop: accepted => {
    if (accepted && accepted.length > 0) {
      console.log('📎 Dropped file:', accepted[0]);
      extractTextFromPDF(accepted[0]);
    } else {
      console.warn('❌ No PDF accepted');
    }
  },
});


  return (
    <div style={{ padding:40, maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <h2>SNIFFY 🧠</h2><button onClick={handleLogout}>Logout</button>
      </div>

      {/* Upload PDF */}
      <h3>📎 Upload CMS‑2567 PDF</h3>
      <div {...getRootProps()} style={{ border:'2px dashed #0077cc',padding:40,textAlign:'center',background:'#eef7ff',marginBottom:20,borderRadius:8 }}>
        <input {...getInputProps()} />
        {isDragActive ? <p><strong>Drop PDF here...</strong></p> : <p>Click or drag your <strong>2567 PDF</strong> here</p>}
      </div>

      {/* State selector & manual input */}
      <h3>📍 Select Your State</h3>
      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{width:'100%',padding:10,marginBottom:20}}>
        <option value="">— Select a State (Optional) —</option>
        {Object.keys(StateRegulations).sort().map(state => <option key={state} value={state}>{state}</option>)}
      </select>

      <textarea rows={5} style={{ width:'100%', padding:10 }} placeholder="Paste deficiency text..." value={inputText} onChange={e=>setInputText(e.target.value)} />
      <input placeholder="F‑Tags (e.g. F684, F689)" value={fTags} onChange={e=>setFTags(e.target.value)} style={{ width:'100%', padding:10, margin:'10px 0'}} />

      <button onClick={generatePOC} disabled={loading} style={{ padding:10 }}>
        {loading ? 'Generating...' : '🧠 Generate POC'}
      </button>

      {/* Saved POCs */}
      <hr style={{ margin:'40px 0'}} />
      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border:'1px solid #ccc', padding:20, borderRadius:8, marginBottom:20 }}>
          <div ref={el => (exportRefs.current[r.id] = el)}>
            <p><strong>F‑Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p><pre>{r.inputText}</pre>
            <p><strong>Plan of Correction:</strong></p><pre>{r.result}</pre>
            {r.carePlan && (
              <>
                <p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre>
              </>
            )}
            {r.selectedState && (
              <>
                <p><strong>State‑Specific Regulations for {r.selectedState}:</strong></p>
                {r.fTags.split(',').map(tag => {
                  const clean = tag.trim();
                  const reg = StateRegulations[r.selectedState]?.[clean];
                  return reg ? <p key={clean}><strong>{clean}:</strong> {reg}</p> : null;
                })}
              </>
            )}
            <small>Generated for: {user.email}</small>
          </div>

          {!r.carePlan && (
            <button onClick={() => generateCarePlan(r.id, r.result)} disabled={carePlanLoading[r.id]} style={{ marginTop:10 }}>
              {carePlanLoading[r.id] ? 'Generating...' : '🧠 Generate Care Plan'}
            </button>
          )}
          <br/><br/>
          <button onClick={() => exportAsPDF(r.id)}>📄 Export PDF</button>
          <button onClick={() => deletePOC(r.id)} style={{ marginLeft:10, color:'red' }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default App;
