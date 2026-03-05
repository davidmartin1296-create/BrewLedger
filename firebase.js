// firebase.js — shared Firebase initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnim98A7mUADrS3nXUursocYecwWEm9BY",
  authDomain: "brews-database.firebaseapp.com",
  projectId: "brews-database",
  storageBucket: "brews-database.firebasestorage.app",
  messagingSenderId: "710180285845",
  appId: "1:710180285845:web:e22ce8da0a83da06195a9c",
  measurementId: "G-LX4CSX6NQT"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Analytics is best-effort: only initializes in supported browser contexts.
export let analytics = null;
analyticsSupported()
  .then((ok) => {
    if (ok) analytics = getAnalytics(app);
  })
  .catch(() => {
    analytics = null;
  });
