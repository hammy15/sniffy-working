import React, { useState, useEffect } from 'react';
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

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});

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
        <div key={r.id} style={{ border: '1px solid #ccc', padding: 15, marginBottom: 20 }}>
          <b>F-Tags:</b> {r.fTags}<br /><br />
          <b>Deficiency:</b><br />
          <pre>{r.inputText}</pre>
          <b>Plan of Correction:</b><br />
          <pre>{r.result}</pre>

          {r.carePlan ? (
            <>
              <b>Care Plan:</b>
              <pre>{r.carePlan}</pre>
            </>
          ) : (
            <button
              onClick={() => generateCarePlan(r.id, r.result)}
              disabled={carePlanLoading[r.id]}
            >
              {carePlanLoading[r.id] ? 'Generating Care Plan...' : '🧠 Generate Care Plan'}
            </button>
          )}

          <br /><br />
          <button onClick={() => deletePOC(r.id)} style={{ color: 'red' }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;
