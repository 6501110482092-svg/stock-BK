import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, getDocFromServer, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7LYNFGuyFUHL0J5StLLTq4hXnN8YokxA",
  authDomain: "gen-lang-client-0736833511.firebaseapp.com",
  projectId: "gen-lang-client-0736833511",
  storageBucket: "gen-lang-client-0736833511.firebasestorage.app",
  messagingSenderId: "231494143590",
  appId: "1:231494143590:web:4b452ddef21f3632d827a7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID
export const db = getFirestore(app, "ai-studio-85b250a7-ba04-4977-a7e9-eba5a67d0cdb");

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Please check your Firebase configuration or network status.");
    } else {
      console.log("Firebase connection test complete.");
    }
  }
}

testConnection();
