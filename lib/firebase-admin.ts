import * as admin from "firebase-admin"

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY
                    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
                    : undefined,
            }),
        })
        console.log("Firebase Admin inicializado correctamente")
    } catch (error) {
        console.error("Error al inicializar Firebase Admin:", error)
    }
}

export const db = admin.firestore()

