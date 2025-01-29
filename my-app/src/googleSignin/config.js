
import { initializeApp } from "firebase/app";
import {getAuth,GoogleAuthProvider} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA30prz2wwqbdu6ZtrwHC-rLSg74cyRZ8s",
  authDomain: "bteam-6f36c.firebaseapp.com",
  projectId: "bteam-6f36c",
  storageBucket: "bteam-6f36c.firebasestorage.app",
  messagingSenderId: "633356132951",
  appId: "1:633356132951:web:9ea56334d7669db56c3912"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app)
const provider = new GoogleAuthProvider();
export {auth,provider};