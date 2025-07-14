import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; // make sure this matches your file path

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function App() {
  const [user, setUser] = useState(undefined); // undefined = loading

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const exportRefs = useRef({});

useEffect(() => {
  console.log("👀 Checking auth...");

  const unsubscribe = onAuthStateChanged(auth, (u) => {
    console.log("✅ Auth result:", u);

    if (u) {
      setUser(u);         // user is logged in
      fetchPOCs(u.uid);   // load their saved data
    } else {
      setUser(null);      // not logged in
    }
  });

  return unsubscribe;
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
if (user === undefined) {
  return <div style={{ padding: 40 }}>🔄 Loading...</div>;
}
  if (user === undefined) {
  return <div style={{ padding: 40 }}>🔄 Loading...</div>;
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
      <button onClick={handleLogin} style={{ width: '100%', padding: 10 }}>Login</button>
    </div>
  );
}
  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText,
          fTags: fTags.split(',').map(f => f.trim())
        })
      });
      const data = await res.json();
      if (data.result) {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
          inputText,
          fTags,
          result: data.result,
          timestamp: new Date()
        });
        setResults([{ id: docRef.id, inputText, fTags, result: data.result }, ...results]);
        setInputText('');
        setFTags('');
      } else {
        alert('No result from GPT');
      }
    } catch (err) {
      alert('Error generating POC: ' + err.message);
    }
    setLoading(false);
  };

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
    }
    setCarePlanLoading(prev => ({ ...prev, [pocId]: false }));
  };

  const deletePOC = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(results.filter(r => r.id !== id));
  };

  const exportAsPDF = async (id) => {
    const element = exportRefs.current[id];
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    pdf.save(`POC-${id}.pdf`);
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
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
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
  return (
    <div style={{ padding: '40px 20px', maxWidth: 900, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>SNIFFY 🧠</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <h3>📎 Upload CMS-2567 PDF</h3>
      <div {...getRootProps()} style={{
        border: '3px dashed #0077cc',
        backgroundColor: '#eef7ff',
        padding: '40px',
        textAlign: 'center',
        marginBottom: '30px',
        cursor: 'pointer',
        borderRadius: '12px'
      }}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p><strong>Drop your CMS-2567 PDF here...</strong></p>
        ) : (
          <p>Click or drag your <strong>2567 PDF</strong> here to extract deficiencies and F-Tags.</p>
        )}
      </div>

      <h3>📝 Generate Plan of Correction</h3>
      <textarea
        rows="5"
        style={{ width: '100%', padding: 10 }}
        placeholder="Paste deficiency text here or use uploaded PDF"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
      />
      <input
        placeholder="F-Tags (e.g. F684, F686)"
        value={fTags}
        onChange={e => setFTags(e.target.value)}
        style={{ width: '100%', padding: 8, margin: '10px 0' }}
      />
      <button onClick={generatePOC} disabled={loading} style={{ padding: '10px 20px' }}>
        {loading ? 'Generating...' : '🧠 Generate POC'}
      </button>

      <hr style={{ margin: '40px 0' }} />

      <h3>📂 Saved POCs</h3>
      {results.map(r => (
        <div
          key={r.id}
          style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}
        >
          <div ref={(el) => exportRefs.current[r.id] = el}>
            <p><strong>F-Tags:</strong> {r.fTags}</p>
            <p><strong>Deficiency:</strong></p>
            <pre>{r.inputText}</pre>
            <p><strong>Plan of Correction:</strong></p>
            <pre>{r.result}</pre>
            {r.carePlan && (
              <>
                <p><strong>Care Plan:</strong></p>
                <pre>{r.carePlan}</pre>
              </>
            )}
            <small>Generated for: {user.email}</small>
          </div>
          {!r.carePlan && (
            <button
              onClick={() => generateCarePlan(r.id, r.result)}
              disabled={carePlanLoading[r.id]}
              style={{ marginTop: 10 }}
            >
              {carePlanLoading[r.id] ? 'Loading...' : '🧠 Generate Care Plan'}
            </button>
          )}
          <br /><br />
          <button onClick={() => exportAsPDF(r.id)}>📄 Export PDF</button>{' '}
          <button onClick={() => deletePOC(r.id)} style={{ color: 'red', marginLeft: 10 }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;
