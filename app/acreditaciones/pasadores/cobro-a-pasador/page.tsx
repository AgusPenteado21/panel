"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Navbar from "@/app/components/Navbar"
import { collection, query, where, orderBy, getDocs, type Query, type DocumentData } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { CalendarIcon, Search, AlertCircle, Loader2, DollarSign, User, FileText } from "lucide-react"

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

    const getPasadorInfo = (pasadorId: string): { nombre: string; numero: string } => {
        const pasador = pasadores.find((p) => p.id === pasadorId)
        return pasador
            ? { nombre: pasador.nombre, numero: pasador.numero || "" }
            : { nombre: "Pasador no encontrado", numero: "" }
    }

    const formatDate = (dateString: string): string => {
        const [year, month, day] = dateString.split("-")
        return `${day}/${month}/${year}`
    }

    const totalMonto = cobros.reduce((sum, cobro) => sum + cobro.monto, 0)

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-teal-50">
            <Navbar />
            <div className="container mx-auto p-6">
                <Card className="shadow-xl border border-green-200">
                    <CardHeader className="bg-gradient-to-r from-green-600 to-teal-700 text-white">
                        <CardTitle className="text-2xl font-bold flex items-center">
                            <DollarSign className="h-6 w-6 mr-2" />
                            Cobro a Pasador
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="mb-6 bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm">
                            <h3 className="text-green-800 font-semibold mb-3 flex items-center">
                                <CalendarIcon className="h-5 w-5 mr-2 text-green-600" />
                                Filtrar por fecha
                            </h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm mb-1 text-green-700">Desde:</label>
                                    <Input
                                        type="date"
                                        value={fechaInicio}
                                        onChange={(e) => setFechaInicio(e.target.value)}
                                        className="border-green-200 focus:border-green-500 focus:ring-green-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm mb-1 text-green-700">Hasta:</label>
                                    <Input
                                        type="date"
                                        value={fechaFin}
                                        onChange={(e) => setFechaFin(e.target.value)}
                                        className="border-green-200 focus:border-green-500 focus:ring-green-500"
                                    />
                                </div>
                                <Button
                                    onClick={handleConsultar}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-green-600 to-teal-700 hover:from-green-700 hover:to-teal-800 text-white shadow-md transition-all duration-200 transform hover:scale-105"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Cargando...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 h-4 w-4" />
                                            Consultar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-sm flex items-start">
                                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {loading && (
                            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg shadow-sm flex items-center">
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                <span>Cargando los cobros...</span>
                            </div>
                        )}

                        <div className="overflow-x-auto border border-green-200 rounded-lg shadow-md">
                            <Table>
                                <TableHeader className="bg-gradient-to-r from-green-600 to-teal-700">
                                    <TableRow>
                                        <TableHead className="text-white font-bold">Id</TableHead>
                                        <TableHead className="text-white font-bold">Fecha</TableHead>
                                        <TableHead className="text-white font-bold">Pasador</TableHead>
                                        <TableHead className="text-white font-bold">Monto</TableHead>
                                        <TableHead className="text-white font-bold">Observaciones</TableHead>
                                        <TableHead className="text-white font-bold">Usuario</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cobros.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No se encontraron cobros para el período seleccionado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        cobros.map((cobro, index) => (
                                            <TableRow
                                                key={cobro.id}
                                                className={`${index % 2 === 0 ? "bg-green-50" : "bg-white"} hover:bg-green-100 transition-colors`}
                                            >
                                                <TableCell className="font-medium text-xs text-gray-500">
                                                    {cobro.id.substring(0, 8)}...
                                                </TableCell>
                                                <TableCell className="font-medium text-teal-800">
                                                    <div className="flex items-center">
                                                        <CalendarIcon className="h-4 w-4 mr-2 text-teal-600" />
                                                        {formatDate(cobro.fecha)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center mr-2">
                                                            {getPasadorInfo(cobro.pasadorId).nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                        {getPasadorInfo(cobro.pasadorId).numero} - {getPasadorInfo(cobro.pasadorId).nombre}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-green-600 font-semibold">$ {cobro.monto.toFixed(2)}</TableCell>
                                                <TableCell className="text-gray-600">
                                                    <div className="flex items-center">
                                                        <FileText className="h-4 w-4 mr-2 text-gray-400" />
                                                        {cobro.observaciones}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-teal-600">
                                                    <div className="flex items-center">
                                                        <User className="h-4 w-4 mr-2 text-teal-400" />
                                                        {cobro.usuario}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-green-50 border-t border-green-200 p-4">
                        <div className="w-full flex justify-end">
                            <div className="bg-white p-4 rounded-lg shadow-md border border-green-200 flex items-center">
                                <span className="text-green-800 font-semibold mr-3">Total:</span>
                                <span className="text-green-600 text-xl font-bold">$ {totalMonto.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}

