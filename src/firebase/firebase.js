// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  memoryLocalCache,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration with optional Vite environment variable support
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyDiUUCM57IRmiBDbJxkSTZSRWQEHvbg8BI",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "scholasticbase-63086.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "scholasticbase-63086",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "scholasticbase-63086.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "350798346819",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:350798346819:web:7ba5e56e03542157aa72f6",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-554NGYYFK0"
};

// Validate Firebase configuration keys
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.error(`[Firebase Config Error] Missing required configuration keys: ${missingKeys.join(', ')}`);
}

// Singleton guard: reuse existing app if already initialized (prevents Vite HMR re-init crash)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with persistent offline IndexedDB cache enabled by default.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache(),
  });
} catch {
  // Safe fallback if Firestore was already initialized (e.g. during Vite HMR hot reload)
  db = getFirestore(app);
}
export { db };

export const storage = getStorage(app);
export const auth = getAuth(app);

// Initialize & Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Analytics (optional support check)
isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch((err) => {
    console.warn('Firebase Analytics is not available in this browser:', err);
  });

export default app;