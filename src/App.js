// App.js - SNIFFY
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
const [userData, setUserData] = useState(null);

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (u) => {
    if (u) {
      setUser(u);
      await fetchPOCs(u.uid);
      const userDoc = await getDoc(doc(db, 'users', u.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        setUserData({ pro: false });
      }
    } else {
      setUser(null);
      setUserData(null);
    }
  });
  return unsub;
}, []);

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
// — Inside your App() component —

// Generate POC
const generatePOC = async () => {
  setLoading(true);
  try {
    const res = await fetch('/api/generatePOC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputText,
        fTags: fTags.split(',').map(f => f.trim()),
        selectedState, // include if needed by backend
      }),
    });
    const data = await res.json();
    if (data.result) {
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
      setResults([
        {
          id: docRef.id,
          inputText,
          fTags,
          result: data.result,
          selectedState,
        },
        ...results,
      ]);
      setInputText('');
      setFTags('');
    } else {
      alert('No result from GPT');
    }
  } catch (err) {
    alert('Error generating POC: ' + err.message);
  } finally {
    setLoading(false);
  }
};

// Generate Care Plan
const generateCarePlan = async (pocId, pocText) => {
  setCarePlanLoading(prev => ({ ...prev, [pocId]: true }));
  try {
    const res = await fetch('/api/generateCarePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pocText }),
    });
    const data = await res.json();
    if (data.carePlan) {
      const docRef = doc(db, 'users', user.uid, 'pocs', pocId);
      await updateDoc(docRef, { carePlan: data.carePlan });
      setResults(results.map(r =>
        r.id === pocId ? { ...r, carePlan: data.carePlan } : r
      ));
    } else {
      alert('No care plan returned.');
    }
  } catch (err) {
    alert('Error generating care plan: ' + err.message);
  } finally {
    setCarePlanLoading(prev => ({ ...prev, [pocId]: false }));
  }
};

// Delete POC
const deletePOC = async (id) => {
  await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
  setResults(results.filter(r => r.id !== id));
};

// Export as PDF
const exportAsPDF = async (id) => {
  const el = exportRefs.current[id];
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = pdf.internal.pageSize.getWidth();
  const h = (canvas.height * w) / canvas.width;
  let yPos = 0;
  pdf.addImage(img, 'PNG', 0, yPos, w, h);
  let left = h - pdf.internal.pageSize.getHeight();
  while (left > 0) {
    yPos = -left;
    pdf.addPage();
    pdf.addImage(img, 'PNG', 0, yPos, w, h);
    left -= pdf.internal.pageSize.getHeight();
  }
  pdf.save(`POC-${id}.pdf`);
};

// Extract text from PDF
const extractTextFromPDF = async (file) => {
  const reader = new FileReader();
  reader.onload = async () => {
    const arr = new Uint8Array(reader.result);
    const pdfDoc = await pdfjsLib.getDocument({ data: arr }).promise;
    let full = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const text = await page.getTextContent();
      full += text.items.map(item => item.str).join(' ') + '\n';
    }
    const tags = [...new Set((full.match(/F\d{3}/g) || []))].join(', ');
    setInputText(full.trim().slice(0, 3000));
    setFTags(tags);
  };
  reader.readAsArrayBuffer(file);
};

// Dropzone setup
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { 'application/pdf': [] },
  multiple: false,
  onDrop: files => files[0] && extractTextFromPDF(files[0]),
});
// — Below, the render conditional section —

// Loading / auth checks
if (user === undefined) {
  return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
}
if (user === null) {
  return (
    <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
      <h2>Login to <span style={{ color: '#0077cc' }}>SNIFFY</span> 🧠</h2>
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

// Main interface
return (
  <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <h2>SNIFFY 🧠</h2>
      <button onClick={handleLogout}>Logout</button>
    </div>

    {/* PDF Upload */}
    <h3>📎 Upload CMS‑2567 PDF</h3>
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed #0077cc',
        padding: 40,
        textAlign: 'center',
        background: '#eef7ff',
        marginBottom: 20,
        borderRadius: 8,
      }}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p><strong>Drop PDF here...</strong></p>
      ) : (
        <p>Click or drag your <strong>2567 PDF</strong> here to extract deficiency tags.</p>
      )}
    </div>

    {/* State Selection */}
    <h3>📍 Select Your State</h3>
    <select
      value={selectedState}
      onChange={e => setSelectedState(e.target.value)}
      style={{ width: '100%', padding: 10, marginBottom: 20 }}
    >
      <option value="">-- Select a State (Optional) --</option>
      {Object.keys(StateRegulations).sort().map(state => (
        <option key={state} value={state}>{state}</option>
      ))}
    </select>

    {/* Input & Generate */}
    <textarea
      rows="5"
      style={{ width: '100%', padding: 10 }}
      placeholder="Paste deficiency text here..."
      value={inputText}
      onChange={e => setInputText(e.target.value)}
    />
    <input
      placeholder="F‑Tags (e.g. F684, F689)"
      value={fTags}
      onChange={e => setFTags(e.target.value)}
      style={{ width: '100%', padding: 10, margin: '10px 0' }}
    />
    <button onClick={generatePOC} disabled={loading} style={{ padding: 10 }}>
      {loading ? 'Generating...' : '🧠 Generate POC'}
    </button>

    {/* Saved POCs */}
    <hr style={{ margin: '40px 0' }} />
    <h3>📂 Saved POCs</h3>
    {results.map(r => (
      <div key={r.id} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <div ref={el => (exportRefs.current[r.id] = el)}>
          {/* ... POC content ... */}
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
        <button onClick={() => deletePOC(r.id)} style={{ marginLeft: 10, color: 'red' }}>
          Delete
        </button>
      </div>
    ))}
  </div>
);

