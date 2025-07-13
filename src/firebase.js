import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDl6Hitkmws_aPWBX4yF_uYrnN8CpHgS2k",
  authDomain: "sniffy-app-be555.firebaseapp.com",
  projectId: "sniffy-app-be555",
  storageBucket: "sniffy-app-be555.firebasestorage.app",
  messagingSenderId: "219824031376",
  appId: "1:219824031376:web:428056bea4fdf638117a15"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
