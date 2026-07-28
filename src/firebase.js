import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCO_DoHtb5aKFCj7Xq_7WKMuznQ5WGQSOE",
  authDomain: "da-tieng-trung-reels-35b02.firebaseapp.com",
  projectId: "da-tieng-trung-reels-35b02",
  storageBucket: "da-tieng-trung-reels-35b02.firebasestorage.app",
  messagingSenderId: "360030797229",
  appId: "1:360030797229:web:a779a06d7ca9360580f524"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
