import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDtRNqep3BD1nI1gDhOBaFT6ps-txWsiNM",
    authDomain: "tennis-driveapp.firebaseapp.com",
    projectId: "tennis-driveapp",
    storageBucket: "tennis-driveapp.firebasestorage.app",
    messagingSenderId: "109946831008",
    appId: "1:109946831008:web:0999f7a234ad3ca44649c5",
    measurementId: "G-KR022E89PB"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
