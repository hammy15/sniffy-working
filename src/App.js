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
    setEdit
