import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [ftags, setFtags] = useState([]);

  const handleGeneratePOC = () => {
    const tags = input.match(/F\d{3,4}/g) || [];
    setFtags(tags);

    // 👇 TEMP fake output — we’ll replace this with OpenAI in the next step
    const fakePOC = `Based on tags: ${tags.join(', ')}, here is your sample Plan of Correction...\n\n(We will generate this with AI in the next step.)`;
    setOutput(fakePOC);
  };

  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');

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
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to SNIFFY 🧠</h1>
      <p>You are logged in as <strong>{user.email}</strong></p>
      <button onClick={handleLogout}>Log Out</button>
          <hr style={{ margin: '2rem 0' }} />
            <hr style={{ margin: '2rem 0' }} />
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
        Generate Plan of Correction
      </button>

      {output && (
        <div style={{ marginTop: '2rem', background: '#f5f5f5', padding: '1rem' }}>
          <h3>Detected F-tags:</h3>
          <p>{ftags.join(', ')}</p>
          <h3>Suggested Plan of Correction:</h3>
          <pre>{output}</pre>
        </div>
      )}

        style={{ width: '100%', padding: '1rem', fontFamily: 'monospace' }}
        placeholder="Paste full 2567 deficiency narrative here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      ></textarea>

      <button style={{ marginTop: '1rem' }} onClick={handleGeneratePOC}>
        Generate Plan of Correction
      </button>

      {output && (
        <div style={{ marginTop: '2rem', background: '#f5f5f5', padding: '1rem' }}>
          <h3>Detected F-tags:</h3>
          <p>{ftags.join(', ')}</p>
          <h3>Suggested Plan of Correction:</h3>
          <pre>{output}</pre>
        </div>
      )}

        style={{ width: '100%', padding: '1rem', fontFamily: 'monospace' }}
        placeholder="Paste full 2567 deficiency narrative here..."
      ></textarea>
      <button style={{ marginTop: '1rem' }}>
        Generate Plan of Correction
      </button>

       </div>  // 
  );
}
  );
}

export default App;
