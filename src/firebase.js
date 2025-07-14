// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDl6Hitkmws_aPWBX4yF_uYrnN8CpHgS2k",
  authDomain: "sniffy-app-be555.firebaseapp.com",
  projectId: "sniffy-app-be555",
  storageBucket: "sniffy-app-be555.appspot.com",
  messagingSenderId: "219824031376",
  appId: "1:219824031376:web:428056bea4fdf638117a15"
};
{
  uid: "user_id",
  email: "email@example.com",;
  pro: true, // controlled by webhook
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
