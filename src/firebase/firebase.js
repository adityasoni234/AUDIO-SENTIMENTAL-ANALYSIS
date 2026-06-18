import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDYdu7fveRbxJ3WiD6Sf8y2ysBy3-8JHok",
  authDomain: "audio-sentiment-analysis-28836.firebaseapp.com",
  projectId: "audio-sentiment-analysis-28836",
  storageBucket: "audio-sentiment-analysis-28836.firebasestorage.app",
  messagingSenderId: "378611758844",
  appId: "1:378611758844:web:33db57c9d046b828d7c979",
  measurementId: "G-B1YYX5CJ8M",
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db }
