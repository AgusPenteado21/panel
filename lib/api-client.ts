import { db } from "./firebase"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"
import type { Extracto } from "@/app/types/extracto"

export async function obtenerDatosProxy() {
    try {
        const response = await fetch("https://vivitusuerte.com/cabezas", {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept-Language": "es-ES,es;q=0.9",
            },
        })

        if (!response.ok) {
            throw new Error(`Error en la respuesta del servidor: ${response.status} ${response.statusText}`)
        }

        return await response.text()
    } catch (error) {
        console.error("Error en el proxy:", error)
        throw new Error("Error al obtener los datos")
    }
}

export async function confirmarExtractos(extractos: Extracto[]) {
    try {
        const extractosRef = collection(db, "extractos")
        const batch = await Promise.all(
            extractos.map((extracto) =>
                addDoc(extractosRef, {
                    ...extracto,
                    confirmado: true,
                    fechaConfirmacion: new Date().toISOString(),
                }),
            ),
        )

        console.log("Extractos confirmados:", batch.length)
        return { message: "Resultados confirmados exitosamente", count: batch.length }
    } catch (error) {
        console.error("Error al confirmar los resultados:", error)
        throw new Error("Error al confirmar los resultados")
    }
}

export async function obtenerExtractosConfirmados() {
    try {
        const extractosRef = collection(db, "extractos")
        const q = query(extractosRef, where("confirmado", "==", true))
        const querySnapshot = await getDocs(q)
        const extractosConfirmados = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }))
        return { extractosConfirmados }
    } catch (error) {
        console.error("Error al obtener extractos confirmados:", error)
        throw new Error("Error al obtener extractos confirmados")
    }
}

