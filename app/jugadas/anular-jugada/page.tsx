"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Navbar from "../../components/Navbar"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, updateDoc, addDoc, Timestamp } from "firebase/firestore"

interface Pasador {
    id: string
    nombre: string
    nombreFantasia: string
}

export default function AnularJugadaPage() {
    const [secuencia, setSecuencia] = useState("")
    const [selectedPasador, setSelectedPasador] = useState("")
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [mensaje, setMensaje] = useState({ texto: "", tipo: "" })

    useEffect(() => {
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs.map((doc) => ({
                id: doc.id,
                nombre: doc.data().nombre,
                nombreFantasia: doc.data().nombreFantasia,
            }))
            setPasadores(pasadoresList)
        } catch (error) {
            console.error("Error al obtener pasadores:", error)
            setMensaje({ texto: "Error al cargar los pasadores. Por favor, intente nuevamente.", tipo: "error" })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setMensaje({ texto: "", tipo: "" })

        if (!selectedPasador) {
            setMensaje({ texto: "Por favor, seleccione un pasador.", tipo: "error" })
            setIsLoading(false)
            return
        }

        try {
            const pasador = pasadores.find((p) => p.id === selectedPasador)
            if (!pasador) {
                setMensaje({ texto: "Pasador no encontrado.", tipo: "error" })
                setIsLoading(false)
                return
            }

            const jugadasCollection = collection(db, `JUGADAS DE ${pasador.nombre}`)
            const jugadasQuery = query(jugadasCollection, where("secuencia", "==", secuencia))
            const jugadasSnapshot = await getDocs(jugadasQuery)

            if (jugadasSnapshot.empty) {
                setMensaje({
                    texto: "No se encontró ninguna jugada con el número de secuencia proporcionado para este pasador.",
                    tipo: "error",
                })
            } else {
                const jugadaDoc = jugadasSnapshot.docs[0]
                const jugadaData = jugadaDoc.data()

                if (jugadaData.anulada) {
                    setMensaje({ texto: "Esta jugada ya ha sido anulada anteriormente.", tipo: "error" })
                } else {
                    // Actualizar la jugada original
                    await updateDoc(jugadaDoc.ref, {
                        anulada: true,
                        fechaAnulacion: Timestamp.now(),
                        pasadorIdQueAnulo: selectedPasador,
                        pasadorQueAnulo: pasador.nombre,
                    })

                    // Crear una nueva entrada en la colección de jugadas anuladas
                    const jugadasAnuladasCollection = collection(db, "jugadas_anuladas")
                    await addDoc(jugadasAnuladasCollection, {
                        ...jugadaData,
                        anulada: true,
                        fechaAnulacion: Timestamp.now(),
                        pasadorIdQueAnulo: selectedPasador,
                        pasadorQueAnulo: pasador.nombre,
                        pasadorOriginal: pasador.nombre,
                        jugadaOriginalId: jugadaDoc.id,
                    })

                    setMensaje({
                        texto: "La jugada ha sido anulada correctamente y movida a la sección de anuladas.",
                        tipo: "exito",
                    })
                    setSecuencia("")
                }
            }
        } catch (error) {
            console.error("Error al anular la jugada:", error)
            setMensaje({
                texto: "Ocurrió un error al intentar anular la jugada. Por favor, inténtelo de nuevo.",
                tipo: "error",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <Navbar />
            <main className="flex-grow p-4">
                <Card className="max-w-2xl mx-auto border border-black">
                    <CardHeader className="bg-black text-white">
                        <CardTitle className="text-xl">Anular Jugada</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {mensaje.texto && (
                            <div
                                className={`mb-4 p-2 ${mensaje.tipo === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                            >
                                {mensaje.texto}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <div className="bg-black text-white p-2">Seleccione el Pasador</div>
                                <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                    <SelectTrigger className="w-full border-black">
                                        <SelectValue placeholder="Seleccionar pasador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pasadores.map((pasador) => (
                                            <SelectItem key={pasador.id} value={pasador.id}>
                                                {pasador.nombreFantasia || pasador.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="bg-black text-white p-2">Ingrese el Número de Secuencia</div>
                                <Input
                                    type="text"
                                    className="w-full border-black"
                                    required
                                    value={secuencia}
                                    onChange={(e) => setSecuencia(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-center gap-4">
                                <Button type="submit" className="bg-black text-white hover:bg-gray-800" disabled={isLoading}>
                                    {isLoading ? "Procesando..." : "Aceptar"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-black text-black hover:bg-gray-100"
                                    onClick={() => window.history.back()}
                                    disabled={isLoading}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

