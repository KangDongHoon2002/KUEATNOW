// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBoF_eP3WjHPSjjmgRGK8RSzBhEExJvhqA",
  authDomain: "what2eat-25c8c.firebaseapp.com",
  projectId: "what2eat-25c8c",
  storageBucket: "what2eat-25c8c.appspot.com",
  messagingSenderId: "247604990964",
  appId: "1:247604990964:web:f8066a55ad5ea9db185fa1",
  measurementId: "G-4X26SZV6RD"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const analytics = getAnalytics(app);

