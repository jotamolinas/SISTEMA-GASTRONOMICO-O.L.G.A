import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "saas-gastronomico.firebaseapp.com",
  projectId: "saas-gastronomico",
  storageBucket: "saas-gastronomico.firebasestorage.app",
  messagingSenderId: "703617792936",
  appId: "1:703617792936:web:05f18caa98a879362bfb9d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
export default db;
