// Inizializzazione Firebase: tutti gli altri moduli importano da qui.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

export {
    collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where,
    orderBy, getDocs, runTransaction, writeBatch
} from 'firebase/firestore';
export { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
export { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
export { httpsCallable } from 'firebase/functions';

// Questa configurazione è pubblica per natura (identifica solo il progetto):
// la protezione dei dati sta nelle regole di sicurezza (firestore.rules / storage.rules).
const firebaseConfig = {
    apiKey: "AIzaSyC-DVzvJlHO81N8TihmT7siFvprQ1fGCxE",
    authDomain: "leopardi-open-7242c.firebaseapp.com",
    projectId: "leopardi-open-7242c",
    storageBucket: "leopardi-open-7242c.firebasestorage.app",
    messagingSenderId: "767838807994",
    appId: "1:767838807994:web:51490d8124b417a4269f83"
};

// Deve coincidere con REGION in functions/index.js
const FUNCTIONS_REGION = 'europe-west1';

const appInstance = initializeApp(firebaseConfig);
export const db = getFirestore(appInstance);
export const storage = getStorage(appInstance);
export const auth = getAuth(appInstance);
export const functions = getFunctions(appInstance, FUNCTIONS_REGION);
