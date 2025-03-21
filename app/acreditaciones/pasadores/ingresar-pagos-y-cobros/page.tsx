"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Navbar from "@/app/components/Navbar"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"

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

    useEffect(() => {
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
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
        } catch (error) {
            console.error("Error al cargar pasadores:", error)
            setError("Hubo un problema al cargar los pasadores. Por favor, intente de nuevo.")
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

                    if (monto < 0) {
                        // Los pagos son valores negativos - guardamos con signo negativo
                        const data = {
                            pasadorId: pasadorId,
                            monto: monto, // Guardamos con signo negativo
                            fecha: fechaFormateada,
                            observaciones: `Módulo: ${pasador?.modulo}`,
                            usuario: auth.currentUser?.email || "admin@example.com",
                            createdAt: serverTimestamp(),
                        }
                        console.log("Guardando pago:", data)
                        await addDoc(pagosCollection, data)
                        console.log("Pago procesado:", data)
                    } else {
                        // Los cobros son valores positivos
                        const data = {
                            pasadorId: pasadorId,
                            monto: monto, // Guardamos con signo positivo
                            fecha: fechaFormateada,
                            observaciones: `Módulo: ${pasador?.modulo}`,
                            usuario: auth.currentUser?.email || "admin@example.com",
                            createdAt: serverTimestamp(),
                        }
                        console.log("Guardando cobro:", data)
                        await addDoc(cobrosCollection, data)
                        console.log("Cobro procesado:", data)
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
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="p-4">
                <div className="bg-black text-white p-2">
                    <h1 className="text-lg text-center">INGRESAR PAGOS Y COBROS</h1>
                </div>

                <div className="max-w-4xl mx-auto mt-4">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center gap-4 mb-6 justify-center">
                            <span>Seleccione el módulo:</span>
                            <Select value={modulo} onValueChange={setModulo}>
                                <SelectTrigger className="w-24">
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
                            <Button variant="secondary" onClick={handleActualizar}>
                                Actualizar
                            </Button>
                        </div>

                        {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100">
                                        <TableHead className="font-bold">Nº</TableHead>
                                        <TableHead className="font-bold">Nombre</TableHead>
                                        <TableHead className="font-bold">Módulo</TableHead>
                                        <TableHead className="font-bold">Importe</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pasadoresFiltrados.map((pasador) => (
                                        <TableRow key={pasador.id}>
                                            <TableCell className="font-medium">{pasador.displayId}</TableCell>
                                            <TableCell>
                                                {pasador.numero} - {pasador.nombre}
                                            </TableCell>
                                            <TableCell>{pasador.modulo}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={importes[pasador.id]}
                                                    onChange={(e) => handleImporteChange(pasador.id, e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full"
                                                    step="0.01"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <Button onClick={handleProcesar} disabled={loading}>
                                {loading ? "Procesando..." : "Procesar"}
                            </Button>
                        </div>

                        <div className="mt-4 text-center text-sm text-gray-600">
                            <p>Ingrese valores negativos para pagos (ej: -50000) y valores positivos para cobros (ej: 50000)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

