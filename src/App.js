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
  collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc, getDoc
} from 'firebase/firestore';
import StateRegulations from './StateRegulations';
import { calculatePoints, pointsGrid, severityScopeGrid } from './scoring';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

function App() {
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState(''), [pass, setPass] = useState('');
  const [inputText, setInputText] = useState(''), [fTags, setFTags] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carePlanLoading, setCarePlanLoading] = useState({});
  const exportRefs = useRef({});
  
  // Auth and user load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        // load pro status
        const docSnap = await getDoc(doc(db, 'users', u.uid));
        setUserData(docSnap.exists() ? docSnap.data() : { pro: false });
        // load saved POCs
        const snap = await getDocs(collection(db, 'users', u.uid, 'pocs'));
        setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    return unsub;
  }, []);
  if (user === undefined) return <div>🔄 Checking login...</div>;
  if (user === null) return (
    <div> {/* login form... */} </div>
  );

  const generatePOC = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generatePOC', {
        method: 'POST',
        body: JSON.stringify({ inputText, fTags: fTags.split(',').map(f => f.trim()), selectedState })
      });
      const { result } = await res.json();
      if (!result) throw new Error('No result from GPT');
      const docRef = await addDoc(collection(db, 'users', user.uid, 'pocs'), {
        inputText, fTags, result, selectedState, timestamp: new Date()
      });
      setResults([{ id: docRef.id, inputText, fTags, result, selectedState }, ...results]);
      setInputText(''); setFTags('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Care Plan, delete, PDF and extract functions here (same as before)...

  return (
    <div>
      <div>Header + logout</div>
      {/* PDF Upload, state select, input and generate button... */}
      <button onClick={generatePOC} disabled={loading || !userData?.pro}>
        {loading ? 'Generating...' : 'Generate POC'}
      </button>

      <hr />
      <h3>Saved POCs</h3>
      {results.map(r => {
        // compute scoring
        const tagArray = r.fTags.split(',').map(t => t.trim());
        const scored = tagArray.map(tag => calculatePoints(tag, /* example scope='D', severity='F' */));
        const totalPoints = scored.reduce((a,c)=>a+c.points,0);
        return (
          <div key={r.id}>
            <div ref={el=>exportRefs.current[r.id]=el}>
              <h4>Tag-wise POC:</h4>
              {tagArray.map((tag,i)=>(
                <div key={tag}>
                  <b>{tag}</b>: {r.result[tag]} { /* assumes result is object mapping */ }
                  – points: {scored[i].points}
                </div>
              ))}
              <div>Total Points: {totalPoints}</div>
              <h4>Severity/Scope Grid:</h4>
              <pre>{severityScopeGrid()}</pre>
              <h4>State Regs:</h4>
              {r.selectedState && tagArray.map(tag => (
                StateRegulations[r.selectedState]?.[tag] &&
                  <div key={tag}><b>{tag}</b>: {StateRegulations[r.selectedState][tag]}</div>
              ))}
            </div>
            {/* buttons: care plan, export PDF, delete */}
          </div>
        );
      })}
    </div>
  );
}
export default App;
// CMS scope/severity to points grid from CMS SFF methodology 
export const pointsGrid = {
  A:0,B:0,C:0,
  D:2,E:4,F:6,   // non‑SQC
  G:10,H:20,I:30,
  J:50,K:100,L:150
};

// For SQC tags (substandard quality care), F→10, H→25, K→125 
const sqcTags = new Set([
  /* list F‑tags under CFR 483.13, .15, .25 e.g. 'F550','F684' etc from turn0search5 */ 
]);

export function calculatePoints(tag, { scope='F', severity='F' }) {
  const key = severity;
  let pts = pointsGrid[key] || 0;
  if (key === 'F' && sqcTags.has(tag)) pts = 10;
  return { tag, points: pts };
}

export function severityScopeGrid() {
  return `
        | Isolated | Pattern | Widespread
--------|----------|---------|-----------
J/K/L   | IJ to resident → high pts
G/H/I   | Actual harm
D/E/F   | Pot’l > minimal
A/B/C   | Min harm
  `;
}
import openai from 'openai';
export default async function handler(req, res) {
  const { inputText, fTags, selectedState } = req.body;
  const prompt = `Generate a professional POC. Include: each F‑tag separately; scope/severity; state regs ${selectedState}. Data: ${inputText}. Tags: ${fTags.join(',')}.`;
  const completion = await openai.chat.completions.create({ model:'gpt-4', ... });
  res.status(200).json({ result: completion.choices[0].message.content });
}
