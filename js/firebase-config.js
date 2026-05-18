import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, addDoc, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOT-0d8sKzcq3OUliJ4LR7oQG2ylF9gQ4",
  authDomain: "steel-plant-demo.firebaseapp.com",
  projectId: "steel-plant-demo",
  storageBucket: "steel-plant-demo.firebasestorage.app",
  messagingSenderId: "216753648242",
  appId: "1:216753648242:web:ff00110b3fa6403f2b08eb",
  measurementId: "G-DKT2BJ7P40"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Bridge for non-module scripts (engine-local.js)
window._lsFirestore = { db, getDocs, collection };

export { 
  app, auth, db, googleProvider,
  setPersistence, browserLocalPersistence, onAuthStateChanged, 
  signInWithPopup, signOut,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, addDoc, deleteDoc, query, where, orderBy
};
