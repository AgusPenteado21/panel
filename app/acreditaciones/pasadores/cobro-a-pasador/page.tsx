"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Navbar from "@/app/components/Navbar"
import { collection, query, where, orderBy, getDocs, type Query, type DocumentData } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Pasador {
    id: string
    nombre: string
    numero: string
}

interface Cobro {
    id: string
    fecha: string
    pasadorId: string
    monto: number
    observaciones: string
    usuario: string
}

export default function CobrosAPasadorPage() {
    const router = useRouter()
    const [fechaInicio, setFechaInicio] = useState("")
    const [fechaFin, setFechaFin] = useState("")
    const [cobros, setCobros] = useState<Cobro[]>([])
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchPasadores()
        fetchCobros()
    }, [])

    const fetchPasadores = async () => {
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                    id: doc.id,
                    nombre: data.nombre,
                    numero: data.numero || "",
                }
            })
            setPasadores(pasadoresList)
        } catch (error) {
            console.error("Error al cargar pasadores:", error)
        }
    }

    const fetchCobros = async () => {
        setLoading(true)
        setError(null)
        try {
            const cobrosCollection = collection(db, "cobros")
            let cobrosQuery: Query<DocumentData>

            try {
                cobrosQuery = query(cobrosCollection, orderBy("fecha", "desc"))
                const cobrosSnapshot = await getDocs(cobrosQuery)
                const cobrosList = cobrosSnapshot.docs.map((doc) => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        fecha: data.fecha,
                        pasadorId: data.pasadorId,
                        monto: data.monto,
                        observaciones: data.observaciones,
                        usuario: data.usuario,
                    }
                })
                setCobros(cobrosList)
            } catch (indexError) {
                console.warn("Índice no disponible, usando consulta alternativa:", indexError)
                cobrosQuery = query(cobrosCollection)
                const cobrosSnapshot = await getDocs(cobrosQuery)
                const cobrosList = cobrosSnapshot.docs
                    .map((doc) => {
                        const data = doc.data()
                        return {
                            id: doc.id,
                            fecha: data.fecha,
                            pasadorId: data.pasadorId,
                            monto: data.monto,
                            observaciones: data.observaciones,
                            usuario: data.usuario,
                        }
                    })
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                setCobros(cobrosList)
            }

            if (cobros.length === 0) {
                console.log("No se encontraron cobros")
            }
        } catch (error) {
            console.error("Error al cargar cobros:", error)
            setError(`Hubo un problema al cargar los cobros: ${error instanceof Error ? error.message : "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    const handleConsultar = async () => {
        setLoading(true)
        setError(null)
        try {
            const cobrosCollection = collection(db, "cobros")
            let cobrosQuery: Query<DocumentData> = query(cobrosCollection)

            if (fechaInicio) {
                cobrosQuery = query(cobrosQuery, where("fecha", ">=", fechaInicio))
            }
            if (fechaFin) {
                cobrosQuery = query(cobrosQuery, where("fecha", "<=", fechaFin))
            }

            const cobrosSnapshot = await getDocs(cobrosQuery)
            const cobrosList = cobrosSnapshot.docs
                .map((doc) => {
                    const data = doc.data()
                    return {
                        id: doc.id,
                        fecha: data.fecha,
                        pasadorId: data.pasadorId,
                        monto: data.monto,
                        observaciones: data.observaciones,
                        usuario: data.usuario,
                    }
                })
                .sort((a, b) => b.fecha.localeCompare(a.fecha))

            setCobros(cobrosList)
        } catch (error) {
            console.error("Error al consultar cobros:", error)
            setError(
                `Hubo un problema al consultar los cobros: ${error instanceof Error ? error.message : "Error desconocido"}`,
            )
        } finally {
            setLoading(false)
        }
    }

    const getPasadorNombre = (pasadorId: string): string => {
        const pasador = pasadores.find((p) => p.id === pasadorId)
        return pasador ? `${pasador.numero} - ${pasador.nombre}` : "Pasador no encontrado"
    }

    const formatDate = (dateString: string): string => {
        const [year, month, day] = dateString.split("-")
        return `${day}/${month}/${year}`
    }

    const totalMonto = cobros.reduce((sum, cobro) => sum + cobro.monto, 0)

    return (
        <>
            <Navbar />
            <div className="container mx-auto p-6">
                <Card className="p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold">Cobro a Pasador</h2>
                    </div>
                    <div className="mb-6">
                        <div className="flex gap-4 items-end">
                            <div>
                                <label className="block text-sm mb-1">Desde:</label>
                                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Hasta:</label>
                                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                            </div>
                            <Button variant="secondary" onClick={handleConsultar} disabled={loading}>
                                {loading ? "Cargando..." : "Consultar"}
                            </Button>
                        </div>
                    </div>
                    {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}
                    {loading && (
                        <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">Cargando cobros...</div>
                    )}
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Id</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Pasador</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Observaciones</TableHead>
                                    <TableHead>Usuario</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cobros.map((cobro) => (
                                    <TableRow key={cobro.id}>
                                        <TableCell>{cobro.id}</TableCell>
                                        <TableCell>{formatDate(cobro.fecha)}</TableCell>
                                        <TableCell>{getPasadorNombre(cobro.pasadorId)}</TableCell>
                                        <TableCell className="text-green-500">$ {cobro.monto.toFixed(2)}</TableCell>
                                        <TableCell>{cobro.observaciones}</TableCell>
                                        <TableCell>{cobro.usuario}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold">
                                    <TableCell colSpan={3} className="text-right">
                                        Total:
                                    </TableCell>
                                    <TableCell className="text-green-500">$ {totalMonto.toFixed(2)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </>
    )
}

