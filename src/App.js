import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { generatePOC } from './openai';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [ftags, setFtags] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

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
    } catch (err) {
      setOutput("❌ Error generating POC: " + err.message);
    }
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
    </div>
  );
}

export default App;
