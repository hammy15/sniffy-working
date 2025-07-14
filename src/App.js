// App.js - SNIFFY
// Import core
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
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      if (u) fetchPOCs(u.uid);
    });
    return unsub;
  }, []);

  const fetchPOCs = async (uid) => {
    const snapshot = await getDocs(collection(db, 'users', uid, 'pocs'));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setResults(data);
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
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Checkout session failed.');
      }
    } catch (err) {
      alert('Stripe checkout error: ' + err.message);
    }
  };

  const extractTextFromPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async function () {
      const typedArray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      const fTagMatches = fullText.match(/F\d{3}/g) || [];
      const fTagList = [...new Set(fTagMatches)].join(', ');
      setInputText(fullText.trim().slice(0, 3000));
      setFTags(fTagList);
    };
    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) extractTextFromPDF(acceptedFiles[0]);
    }
  });
  ifif (user === undefined) {
  return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
}

if (user === null) {
  return (
    <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
      <h2>Login to <span style={{ color: '#0077cc' }}>SNIFFY</span> 🧠</h2>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>SNIFFY 🧠</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {!user.pro && (
        <div style={{ marginTop: 20, padding: 20, background: '#fff0f0', border: '1px solid red' }}>
          <h3>💳 Unlock POC Generator</h3>
          <p>To generate a Plan of Correction, please complete a one-time payment.</p>
          <button
            onClick={handleStripeCheckout}
            style={{ padding: 10, backgroundColor: '#0077cc', color: '#fff', border: 'none' }}
          >
            Pay $5 to Unlock
          </button>
        </div>
      )}
      <h3>📎 Upload CMS-2567 PDF</h3>
      <div {...getRootProps()} style={{ border: '2px dashed #0077cc', padding: 40, textAlign: 'center', background: '#eef7ff', marginBottom: 20, borderRadius: 8 }}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p><strong>Drop PDF here...</strong></p>
        ) : (
          <p>Click or drag your <strong>2567 PDF</strong> here to extract deficiency tags.</p>
        )}
      </div>

      <h3>📍 Select Your State</h3>
      <select value={selectedState} onChange={e => setSelectedState(e.target.value)} style={{ width: '100%', padding: 10, marginBottom: 20 }}>
        <option value="">-- Select a State (Optional) --</option>
        {Object.keys(StateRegulations).sort().map(state => (
          <option key={state} value={state}>{state}</option>
        ))}
      </select>

      <textarea
        rows="5"
        style={{ width: '100%', padding: 10 }}
        placeholder="Paste deficiency text here..."
        value={inputText}
        onChange={e => setInputText(e.target.value)}
      />
      <input
        placeholder="F-Tags (e.g. F684, F689)"
        value={fTags}
        onChange={e => setFTags(e.target.value)}
        style={{ width: '100%', padding: 10, margin: '10px 0' }}
      />
      <button onClick={generatePOC} disabled={loading || !user.pro} style={{ padding: 10 }}>
        {loading ? 'Generating...' : '🧠 Generate POC'}
      </button>

      <hr style={{ margin: '40px 0' }} />
      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <div ref={el => exportRefs.current[r.id] = el}>
            <p><strong>F-Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p><pre>{r.inputText}</pre>
            <p><strong>Plan of Correction:</strong></p><pre>{r.result}</pre>
            {r.carePlan && (<><p><strong>Care Plan:</strong></p><pre>{r.carePlan}</pre></>)}

            {r.selectedState && (
              <div>
                <p><strong>State-Specific Regulations for {r.selectedState}:</strong></p>
                {r.fTags.split(',').map(tag => {
                  const cleanTag = tag.trim();
                  const reg = StateRegulations[r.selectedState]?.[cleanTag];
                  return reg ? <p key={tag}><strong>{cleanTag}:</strong> {reg}</p> : null;
                })}
              </div>
            )}

            <small>Generated for: {user.email}</small>
          </div>
          {!r.carePlan && (
            <button
              onClick={() => generateCarePlan(r.id, r.result)}
              disabled={carePlanLoading[r.id]}
              style={{ marginTop: 10 }}
            >
              {carePlanLoading[r.id] ? 'Generating...' : '🧠 Generate Care Plan'}
            </button>
          )}
          <br /><br />
          <button onClick={() => exportAsPDF(r.id)}>📄 Export PDF</button>
          <button onClick={() => deletePOC(r.id)} style={{ marginLeft: 10, color: 'red' }}>Delete</button>
        </div>
      ))}
    </div>
  );
}

export default App;
