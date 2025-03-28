"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Navbar from "../../components/Navbar"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, updateDoc, addDoc, Timestamp } from "firebase/firestore"
import { Ban, AlertCircle, CheckCircle, ArrowLeft, Loader2, User, Hash, FileX } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-red-50 to-rose-50">
            <Navbar />
            <main className="flex-grow p-6">
                <Card className="max-w-2xl mx-auto shadow-xl border border-red-200">
                    <CardHeader className="bg-gradient-to-r from-red-600 to-rose-700 text-white">
                        <CardTitle className="text-xl font-bold flex items-center">
                            <Ban className="h-6 w-6 mr-2" />
                            Anular Jugada
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {mensaje.texto && (
                            <Alert
                                variant={mensaje.tipo === "error" ? "destructive" : "default"}
                                className={`mb-6 ${mensaje.tipo === "error"
                                        ? "bg-red-100 border-red-400 text-red-700"
                                        : "bg-green-100 border-green-400 text-green-700"
                                    } flex items-start`}
                            >
                                {mensaje.tipo === "error" ? (
                                    <AlertCircle className="h-5 w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <CheckCircle className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                )}
                                <AlertDescription>{mensaje.texto}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-3">
                                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-2 rounded-md flex items-center shadow-sm">
                                    <User className="h-4 w-4 mr-2" />
                                    <span className="font-medium">Seleccione el Pasador</span>
                                </div>
                                <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                    <SelectTrigger className="w-full border-red-300 focus:ring-red-500 focus:border-red-500">
                                        <SelectValue placeholder="Seleccionar pasador" />
                                    </SelectTrigger>
                                    <SelectContent className="border-red-200">
                                        {pasadores.map((pasador) => (
                                            <SelectItem key={pasador.id} value={pasador.id}>
                                                <div className="flex items-center">
                                                    <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center mr-2 text-xs">
                                                        {(pasador.nombreFantasia || pasador.nombre).charAt(0).toUpperCase()}
                                                    </div>
                                                    {pasador.nombreFantasia || pasador.nombre}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-2 rounded-md flex items-center shadow-sm">
                                    <Hash className="h-4 w-4 mr-2" />
                                    <span className="font-medium">Ingrese el Número de Secuencia</span>
                                </div>
                                <Input
                                    type="text"
                                    className="w-full border-red-300 focus:ring-red-500 focus:border-red-500"
                                    required
                                    value={secuencia}
                                    onChange={(e) => setSecuencia(e.target.value)}
                                    placeholder="Ej: 123456789"
                                />
                            </div>

                            <div className="bg-red-50 p-4 rounded-md border border-red-200 shadow-sm">
                                <div className="flex items-start">
                                    <AlertCircle className="h-5 w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-700">
                                        <p className="font-semibold">Importante:</p>
                                        <p>
                                            Una vez anulada la jugada, esta acción no se puede deshacer. Verifique cuidadosamente la
                                            información antes de continuar.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="bg-gray-50 border-t border-red-200 p-4 flex justify-center gap-4">
                        <Button
                            type="submit"
                            onClick={handleSubmit}
                            className="bg-gradient-to-r from-red-600 to-rose-700 text-white hover:from-red-700 hover:to-rose-800 shadow-md transition-all duration-200 transform hover:scale-105"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Anular Jugada
                                </>
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500"
                            onClick={() => window.history.back()}
                            disabled={isLoading}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Cancelar
                        </Button>
                    </CardFooter>
                </Card>

                <div className="max-w-2xl mx-auto mt-6 p-4 bg-white rounded-lg shadow-md border border-red-200">
                    <div className="flex items-center mb-3">
                        <FileX className="h-5 w-5 mr-2 text-red-600" />
                        <h3 className="font-semibold text-red-800">Instrucciones para anular jugadas</h3>
                    </div>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                        <li>Seleccione el pasador que realizó la jugada original.</li>
                        <li>Ingrese el número de secuencia exacto de la jugada que desea anular.</li>
                        <li>Verifique que la información sea correcta antes de confirmar.</li>
                        <li>Una vez anulada, la jugada aparecerá en el listado de jugadas anuladas.</li>
                    </ol>
                </div>
            </main>
        </div>
    )
}

