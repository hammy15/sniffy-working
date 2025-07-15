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

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
function App() {
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [careLoading, setCareLoading] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docSnap = await getDoc(doc(db, 'users', u.uid));
        setUserData(docSnap.exists() ? docSnap.data() : { pro: false });
        const snap = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setUser(null);
        setUserData(null);
      }
    });
  }, []);
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      alert('Login failed: ' + e.message);
    }
  };

  const handleLogout = () => signOut(auth);
  const generatePOC = async () => {
    setLoading(true);
    // fetch /api/generatePOC ...
    // store in Firestore
    setLoading(false);
  };

  const generateCare = async (id, text) => {
    setCareLoading(prev => ({ ...prev, [id]: true }));
    // fetch /api/generateCarePlan ...
    setCareLoading(prev => ({ ...prev, [id]: false }));
  };

  const deletePOC = async id => {
    await deleteDoc(doc(db, 'users', user.uid, 'pocs', id));
    setResults(r => r.filter(x => x.id !== id));
  };

  const exportAsPDF = async id => {
    const el = exportRefs.current[id];
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, w, h);
    pdf.save(`POC-${id}.pdf`);
  };
  const extractText = async file => {
    const reader = new FileReader();
    reader.onload = async () => {
      const arr = new Uint8Array(reader.result);
      const doc = await pdfjsLib.getDocument({ data: arr }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
      }
      const tags = [...new Set(text.match(/F\d{3}/g) || [])].join(', ');
      setInputText(text.slice(0, 3000));
      setFTags(tags);
    };
    reader.readAsArrayBuffer(file);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': [] },
    onDrop: files => files[0] && extractText(files[0]),
  });

  if (user === undefined)
    return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
  if (user === null)
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: 'auto' }}>
        <h2>Login to SNIFFY</h2>
        {/* email/password inputs + login button */}
      </div>
    );
  return (
    <div style={{ padding: 40, maxWidth: 900, margin: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>SNIFFY</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* PDF DropZone */}
      <div {...getRootProps()} style={{ border: '2px dashed #0077cc', padding: 40 }}>
        <input {...getInputProps()} />
        {isDragActive ? <p>Drop PDF...</p> : <p>Click or drag PDF</p>}
      </div>

      {/* State & Text Inputs */}
      {/* Generate POC button */}
      {/* Saved POCs list: care plan, export, delete buttons */}
    </div>
  );
}
export default App;
