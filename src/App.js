import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';
import { auth, db } from './firebase';
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

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const exportRefs = useRef({});

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchPOCs(u.uid);
    });
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

  const handleLogout = () => {
    signOut(auth);
  };

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

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true
    });

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

      // Very basic F-Tag extract
      const fTagMatches = fullText.match(/F\d{3}/g) || [];
      const fTagList = [...new Set(fTagMatches)].join(', ');

      setInputText(fullText.trim().slice(0, 3000)); // Limit to 3k chars
      setFTags(fTagList);
    };

    reader.readAsArrayBuffer(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        extractTextFromPDF(acceptedFiles[0]);
      }
    }
  });

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Login to SNIFFY 🧠</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        /><br />
        <input
          type="password"
          placeholder="Password"
          value={pass}
          onChange={e => setPass(e.target.value)}
        /><br />
        <button onClick={handleLogin}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Welcome to SNIFFY 🧠</h2>
      <button onClick={handleLogout}>Logout</button>

      <h4>Upload 2567 PDF</h4>
      <div {...getRootProps()} style={{
        border: '2px dashed #aaa', padding: 20,
        marginBottom: 20, cursor: 'pointer'
      }}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the PDF here...</p>
        ) : (
          <p>Click or drag your 2567 PDF file here</p>
        )}
      </div>

      <h4>New Deficiency</h4>
      <textarea
        rows="5"
        style={{ width: '100%' }}
        placeholder="Paste 2567 deficiency text"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
      /><br />
      <input
        placeholder="F-Tags (e.g. F684, F686)"
        value={fTags}
        onChange={e => setFTags(e.target.value)}
      /><br />
      <button onClick={generatePOC} disabled={loading}>
        {loading ? 'Generating POC...' : '🧠 Generate Plan of Correction'}
      </button>

      <hr />

      <h3>Saved POCs</h3>
      {results.map((r) => (
        <div
          key={r.id}
          style={{ border: '1px solid #ccc', padding: 15, marginBottom: 20 }}
        >
          <div ref={(el) => (exportRefs.current[r.id] = el)}>
            <b>F-Tags:</b> {r.fTags}<br /><br />
            <b>Deficiency:</b><br />
            <pre>{r.inputText}</pre>
            <b>Plan of Correction:</b><br />
            <pre>{r.result}</pre>
            {r.carePlan && (
              <>
                <b>Care Plan:</b><br />
                <pre>{r.carePlan}</pre>
              </>
            )}
            <small>Generated for: {user.email}</small><br />
          </div>

          {!r.carePlan && (
            <button
              onClick={() => generateCarePlan(r.id, r.result)}
              disabled={carePlanLoading[r.id]}
            >
              {carePlanLoading[r.id] ? 'Generating Care Plan...' : '🧠 Generate Care Plan'}
            </button>
          )}
          <br /><br />
          <button onClick={() => exportAsPDF(r.id)}>📄 Export as PDF</button>{' '}
          <button onClick={() => deletePOC(r.id)} style={{ color: 'red' }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;
