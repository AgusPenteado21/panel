// Este es un archivo de configuración de Firebase de ejemplo.
// DEBES REEMPLAZAR ESTO CON LA CONFIGURACIÓN REAL DE TU PROYECTO DE FIREBASE.

import { initializeApp, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getAnalytics, type Analytics } from "firebase/analytics"

if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.error("Firebase API key is not set. Please check your environment variables.")
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let app: FirebaseApp
let auth: Auth
let db: Firestore
let analytics: Analytics | null = null

try {
    app = getApp()
} catch {
    app = initializeApp(firebaseConfig)
}

auth = getAuth(app)
db = getFirestore(app)

if (typeof window !== "undefined" && process.env.NODE_ENV !== "development") {
    analytics = getAnalytics(app)
}

export { app, auth, db, analytics }

export type FirebaseInstance = {
    app: FirebaseApp
    auth: Auth
    db: Firestore
    analytics: Analytics | null
}
