// apps/patient/src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Si tú quieres probar con el emulator localmente, descomenta:
// import { connectAuthEmulator } from "firebase/auth";
// import { connectFirestoreEmulator } from "firebase/firestore";
// connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
// connectFirestoreEmulator(db, "localhost", 8080);

export { app, auth, db };
