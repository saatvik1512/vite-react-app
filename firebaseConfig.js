// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBMQ067y9zyX9kQpbAC1RyI6gH-3BJQMFw",
  authDomain: "height-detection.firebaseapp.com",
  projectId: "height-detection",
  storageBucket: "height-detection.firebasestorage.app",
  messagingSenderId: "916977525651",
  appId: "1:916977525651:web:a27b556b4fa6878e677e66",
  measurementId: "G-XB3X4XVN80"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };