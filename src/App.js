import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { generatePOC } from './openai';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [ftags, setFtags] = useState([]);
  const [history, setHistory] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        const q = query(collection(db, 'pocs'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(docs);
      }
    };
    fetchHistory();
  }, [user]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSuccess = () => {
    setUser(auth.currentUser);
  };

  const handleGeneratePOC = async () => {
    const tags = input.match(/F\d{3,4}/g) || [];
    setFtags(tags);
    setOutput("🧠 Generating Plan of Correction... please wait...");

    try {
      const result = await generatePOC(input, tags);
      setOutput(result);

      await addDoc(collection(db, 'pocs'), {
        uid: user.uid,
        email: user.email,
        timestamp: new Date(),
        input,
        fTags: tags,
        poc: result
      });

      const q = query(collection(db, 'pocs'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(docs);
    } catch (err) {
      setOutput("❌ Error generating POC: " + err.message);
    }
  };

  const handleDelete = async (docId) => {
    await deleteDoc(doc(db, 'pocs', docId));
    setHistory(history.filter((item) => item.id !== docId));
  };

  const handleSaveEdit = async (docId) => {
    await updateDoc(doc(db, 'pocs', docId), { poc: editedText });
    setHistory(history.map(item =>
      item.id === docId ? { ...item, poc: editedText } : item
    ));
    setEditId(null);
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem' }}>
        {view === 'login' ? (
          <>
            <Login onLogin={handleSuccess} />
            <p>Need an account? <button onClick={() => setView('register')}>Register</button></p>
          </>
        ) : (
          <>
            <Register onRegister={handleSuccess} />
            <p>Already have an account? <button onClick={() => setView('login')}>Login</button></p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Welcome to SNIFFY 🧠</h1>
      <p>You are logged in as <strong>{user.email}</strong></p>
      <button onClick={handleLogout}>Log Out</button>

      <hr style={{ margin: '2rem 0' }} />
      <h2>Paste Your 2567 Text</h2>
      <textarea
        rows={10}
        style={{ width: '100%', padding: '1rem', fontFamily: 'monospace' }}
        placeholder="Paste full 2567 deficiency narrative here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      ></textarea>

      <button style={{ marginTop: '1rem' }} onClick={handleGeneratePOC}>
        🧠 Generate Plan of Correction
      </button>

      {output && (
        <div style={{ marginTop: '2rem', background: '#f9f9f9', padding: '1rem' }}>
          <h3>Detected F-tags:</h3>
          <p>{ftags.join(', ') || 'None found'}</p>
          <h3>Suggested Plan of Correction:</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3>Your Previous Plans of Correction</h3>
          <ul>
            {history.map((item, i) => (
              <li key={i} style={{ marginBottom: '1.5rem' }}>
                <strong>{new Date(item.timestamp.seconds * 1000).toLocaleString()}</strong><br />
                <em>F-tags: {item.fTags?.join(', ')}</em><br />
                {editId === item.id ? (
                  <>
                    <textarea
                      rows={6}
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                    />
                    <button onClick={() => handleSaveEdit(item.id)}>💾 Save</button>
                    <button onClick={() => setEditId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <pre style={{ background: '#eee', padding: '1rem' }}>{item.poc}</pre>
                    <button onClick={() => {
                      setEditId(item.id);
                      setEditedText(item.poc);
                    }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(item.id)} style={{ marginLeft: '0.5rem' }}>🗑 Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
