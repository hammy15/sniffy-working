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
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const [selectedState, setSelectedState] = useState('');
  const exportRefs = useRef({});

  // Auth listener + fetch user + POCs
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // fetch POCs
        const snapshot = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        // fetch pro status
        const udoc = await getDoc(doc(db, 'users', u.uid));
        setUserData(udoc.exists() ? udoc.data() : { pro: false });
      } else {
        setUser(null);
        setUserData({ pro: false });
      }
    });
    return unsubscribe;
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
          fTags: fTags.split(',').map(f => f.trim()),
          selectedState
        })
      });
      const data = await res.json();
      if (data.result) {
        const docRef = await addDoc(
          collection(db, 'users', user.uid, 'pocs'),
          { inputText, fTags, result: data.result, selectedState, timestamp: new Date() }
        );
        setResults(prev => [{ id: docRef.id, inputText, fTags, result: data.result, selectedState }, ...prev]);
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

  // Other handlers (generateCarePlan, deletePOC, exportAsPDF, extractTextFromPDF)
  // [Truncated here for brevity—will include full code when sending sections.]

  // DROPZONE & AUTH UI
  if (user === undefined) {
    return <div style={{ padding: 40 }}>🔄 Checking login...</div>;
  }
  if (user === null) {
    return (
      <div style={{ padding: 40, maxWidth: 400, margin: '0 auto' }}>
        <h2>Login to SNIFFY 🧠</h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{width:'100%', marginBottom:10}} />
        <input type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} style={{width:'100%', marginBottom:10}} />
        <button onClick={handleLogin} style={{width:'100%'}}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      {/* ... rest of main interface including PDF dropzone,
            generatePOC button (unlocked all the time now),
            and list of saved POCs */}
    </div>
  );
}

export default App;
