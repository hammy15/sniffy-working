// App.js – Main component for SNIFFY
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
  // --- Auth & Data State ---
  const [user, setUser] = useState(undefined);
  const [userData, setUserData] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [results, setResults] = useState([]);

  // --- Input State ---
  const [inputText, setInputText] = useState('');
  const [fTags, setFTags] = useState('');
  const [selectedState, setSelectedState] = useState('');

  // --- Loading Flags ---
  const [loading, setLoading] = use
