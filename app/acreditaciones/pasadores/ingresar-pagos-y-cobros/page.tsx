"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Navbar from "@/app/components/Navbar"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { Loader2, RefreshCw, DollarSign, AlertCircle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"

interface Pasador {
    id: string
    displayId: number
    codigo: string
    nombre: string
    modulo: string
    numero: string
}

export default function IngresarPagosYCobros() {
    const [modulo, setModulo] = useState("71")
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [importes, setImportes] = useState<{ [key: string]: string }>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
        setIsLoading(true)
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs
                .map((doc, index) => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        displayId: index + 1,
                        codigo: data.codigo || `${Math.floor(index / 30) + 71}-${String((index % 30) + 1).padStart(4, "0")}`,
                        nombre: data.nombre,
                        modulo: `${Math.floor(index / 30) + 71}`,
                        numero: data.numero || String((index % 30) + 1).padStart(4, "0"),
                    }
                })
                .sort((a, b) => a.codigo.localeCompare(b.codigo))
            setPasadores(pasadoresList)

            const nuevosImportes: { [key: string]: string } = {}
            pasadoresList.forEach((pasador) => {
                nuevosImportes[pasador.id] = ""
            })
            setImportes(nuevosImportes)
            setError(null)
        } catch (error) {
            console.error("Error al cargar pasadores:", error)
            setError("Hubo un problema al cargar los pasadores. Por favor, intente de nuevo.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleImporteChange = (pasadorId: string, valor: string) => {
        setImportes((prev) => ({
            ...prev,
            [pasadorId]: valor,
        }))
    }

    const handleActualizar = () => {
        fetchPasadores()
    }

    const handleProcesar = async () => {
        setLoading(true)
        setError(null)
        try {
            const pagosCollection = collection(db, "pagos")
            const cobrosCollection = collection(db, "cobros")

            // Obtener la fecha actual en la zona horaria local
            const fecha = new Date()

            // Formatear la fecha en formato YYYY-MM-DD usando la zona horaria local
            const year = fecha.getFullYear()
            const month = String(fecha.getMonth() + 1).padStart(2, "0")
            const day = String(fecha.getDate()).padStart(2, "0")
            const fechaFormateada = `${year}-${month}-${day}`

            console.log("Fecha que se guardará:", fechaFormateada)

            for (const [pasadorId, importe] of Object.entries(importes)) {
                if (importe && Number.parseFloat(importe) !== 0) {
                    const pasador = pasadores.find((p) => p.id === pasadorId)
                    const monto = Number.parseFloat(importe)

                    // SOLUCIÓN CORREGIDA: Guardar en las colecciones correctas
                    if (monto > 0) {
                        // Los pagos son valores positivos - guardamos en la colección de pagos
                        const data = {
                            pasadorId: pasadorId,
                            monto: monto,
                            fecha: fechaFormateada,
                            observaciones: `Módulo: ${pasador?.modulo}`,
                            usuario: auth.currentUser?.email || "admin@example.com",
                            createdAt: serverTimestamp(),
                        }
                        console.log("Guardando pago en colección pagos:", data)
                        await addDoc(pagosCollection, data)
                        console.log("Pago procesado correctamente")
                    } else {
                        // Los cobros son valores negativos - guardamos en la colección de cobros
                        const data = {
                            pasadorId: pasadorId,
                            monto: Math.abs(monto), // Guardamos el valor absoluto para mantener consistencia
                            fecha: fechaFormateada,
                            observaciones: `Módulo: ${pasador?.modulo}`,
                            usuario: auth.currentUser?.email || "admin@example.com",
                            createdAt: serverTimestamp(),
                        }
                        console.log("Guardando cobro en colección cobros:", data)
                        await addDoc(cobrosCollection, data)
                        console.log("Cobro procesado correctamente")
                    }
                }
            }

            const nuevosImportes: { [key: string]: string } = {}
            pasadores.forEach((pasador) => {
                nuevosImportes[pasador.id] = ""
            })
            setImportes(nuevosImportes)

            alert("Pagos y cobros procesados correctamente")
        } catch (error) {
            console.error("Error al procesar pagos y cobros:", error)
            setError(`Error al procesar los pagos y cobros: ${error instanceof Error ? error.message : "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    const pasadoresFiltrados = pasadores.filter((p) => p.modulo === modulo)

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <div className="container mx-auto p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold text-center flex items-center justify-center">
                            <DollarSign className="h-6 w-6 mr-2" />
                            INGRESAR PAGOS Y COBROS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4 mb-6 justify-center bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                            <span className="text-blue-800 font-medium">Seleccione el módulo:</span>
                            <Select value={modulo} onValueChange={setModulo}>
                                <SelectTrigger className="w-24 border-blue-300 focus:ring-blue-500">
                                    <SelectValue placeholder="Módulo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from(new Set(pasadores.map((p) => p.modulo))).map((m) => (
                                        <SelectItem key={m} value={m}>
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                onClick={handleActualizar}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Actualizar
                            </Button>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-sm flex items-start">
                                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="flex justify-center items-center p-12">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="border border-blue-200 rounded-lg shadow-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                            <TableHead className="font-bold text-white">Nº</TableHead>
                                            <TableHead className="font-bold text-white">Nombre</TableHead>
                                            <TableHead className="font-bold text-white">Módulo</TableHead>
                                            <TableHead className="font-bold text-white">Importe</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pasadoresFiltrados.map((pasador, index) => (
                                            <TableRow
                                                key={pasador.id}
                                                className={`${index % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}
                                            >
                                                <TableCell className="font-medium text-blue-800">{pasador.displayId}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">
                                                            {pasador.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span>
                                                            {pasador.numero} - {pasador.nombre}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-indigo-600 font-semibold">{pasador.modulo}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={importes[pasador.id]}
                                                        onChange={(e) => handleImporteChange(pasador.id, e.target.value)}
                                                        placeholder="0.00"
                                                        className={`w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500 ${importes[pasador.id] && Number.parseFloat(importes[pasador.id]) < 0
                                                                ? "text-red-600 font-medium"
                                                                : importes[pasador.id] && Number.parseFloat(importes[pasador.id]) > 0
                                                                    ? "text-green-600 font-medium"
                                                                    : ""
                                                            }`}
                                                        step="0.01"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <CardFooter className="flex flex-col items-center mt-6 pt-4 border-t border-blue-200">
                            <Button
                                onClick={handleProcesar}
                                disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105 mb-4"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <DollarSign className="mr-2 h-4 w-4" />
                                        Procesar
                                    </>
                                )}
                            </Button>

                            <div className="text-center text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200 w-full">
                                <p className="font-medium text-yellow-800">
                                    Ingrese valores positivos para pagos (ej: 50000) y valores negativos para cobros (ej: -50000)
                                </p>
                            </div>
                        </CardFooter>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
