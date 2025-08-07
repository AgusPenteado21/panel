'use client'

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Navbar from "@/app/components/Navbar"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { Loader2, RefreshCw, DollarSign, AlertCircle, CalendarIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale" // Importar el locale español
import { cn } from "@/lib/utils"

interface Pasador {
    id: string
    displayId: string
    codigo: string
    nombre: string
    modulo: string
    numero: string
    posicionEnModulo: number
}

interface ModuloInfo {
    modulo: string
    cantidad: number
}

export default function IngresarPagosYCobros() {
    const [modulo, setModulo] = useState<string>("")
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [modulosDisponibles, setModulosDisponibles] = useState<ModuloInfo[]>([])
    const [importes, setImportes] = useState<{ [key: string]: string }>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date()) // Nuevo estado para la fecha

    useEffect(() => {
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
        setIsLoading(true)
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList: Pasador[] = pasadoresSnapshot.docs
                .map((docSnapshot) => {
                    const data = docSnapshot.data()
                    const moduloValue = data.modulo ? String(data.modulo) : "70"
                    const posicionEnModuloValue = data.posicionEnModulo ? Number(data.posicionEnModulo) : 1
                    return {
                        id: docSnapshot.id,
                        displayId: data.displayId || `${moduloValue}-${String(posicionEnModuloValue).padStart(4, "0")}`,
                        codigo: data.codigo || `${moduloValue}-${String(posicionEnModuloValue).padStart(4, "0")}`,
                        nombre: data.nombre,
                        modulo: moduloValue,
                        numero: data.numero || String(posicionEnModuloValue).padStart(4, "0"),
                        posicionEnModulo: posicionEnModuloValue,
                    }
                })
                .sort((a, b) => {
                    if (a.modulo !== b.modulo) {
                        return Number.parseInt(a.modulo) - Number.parseInt(b.modulo)
                    }
                    return a.posicionEnModulo - b.posicionEnModulo
                })
            setPasadores(pasadoresList)
            // Calcular la cantidad de pasadores por módulo
            const modulosMap = new Map<string, number>()
            pasadoresList.forEach((p) => {
                modulosMap.set(p.modulo, (modulosMap.get(p.modulo) || 0) + 1)
            })
            const uniqueModulosInfo: ModuloInfo[] = Array.from(modulosMap.entries())
                .map(([mod, count]) => ({ modulo: mod, cantidad: count }))
                .sort((a, b) => Number.parseInt(a.modulo) - Number.parseInt(b.modulo))
            setModulosDisponibles(uniqueModulosInfo)
            if (uniqueModulosInfo.length > 0 && !uniqueModulosInfo.some((m) => m.modulo === modulo)) {
                setModulo(uniqueModulosInfo[0].modulo)
            } else if (uniqueModulosInfo.length === 0) {
                setModulo("")
            }
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

            // Usar la fecha seleccionada en lugar de la fecha actual
            const fecha = selectedDate
            const year = fecha.getFullYear()
            const month = String(fecha.getMonth() + 1).padStart(2, "0")
            const day = String(fecha.getDate()).padStart(2, "0")
            const fechaFormateada = `${year}-${month}-${day}`

            console.log("Fecha que se guardará:", fechaFormateada)

            for (const [pasadorId, importe] of Object.entries(importes)) {
                if (importe && Number.parseFloat(importe) !== 0) {
                    const pasador = pasadores.find((p) => p.id === pasadorId)
                    const monto = Number.parseFloat(importe)

                    if (monto > 0) {
                        const data = {
                            pasadorId: pasadorId,
                            monto: monto,
                            fecha: fechaFormateada, // Usar la fecha seleccionada
                            observaciones: `Módulo: ${pasador?.modulo}`,
                            usuario: auth.currentUser?.email || "admin@example.com",
                            createdAt: serverTimestamp(),
                        }
                        console.log("Guardando pago en colección pagos:", data)
                        await addDoc(pagosCollection, data)
                        console.log("Pago procesado correctamente")
                    } else {
                        const data = {
                            pasadorId: pasadorId,
                            monto: Math.abs(monto), // Guardamos el valor absoluto para mantener consistencia
                            fecha: fechaFormateada, // Usar la fecha seleccionada
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

    const pasadoresFiltrados = useMemo(() => {
        return pasadores.filter((p) => p.modulo === modulo)
    }, [pasadores, modulo])

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
                        <div className="flex flex-col md:flex-row items-center gap-4 mb-6 justify-center bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-blue-800 font-medium">Seleccione el módulo:</span>
                                <Select value={modulo} onValueChange={setModulo}>
                                    <SelectTrigger className="w-[180px] border-blue-300 focus:ring-blue-500">
                                        <SelectValue placeholder="Módulo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modulosDisponibles.map((mInfo) => (
                                            <SelectItem key={mInfo.modulo} value={mInfo.modulo}>
                                                Módulo {mInfo.modulo} ({mInfo.cantidad} pasadores)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-blue-800 font-medium">Fecha:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[180px] justify-start text-left font-normal border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 bg-transparent",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={(date) => setSelectedDate(date || new Date())}
                                            initialFocus
                                            locale={es} // Establecer el idioma español
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleActualizar}
                                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 bg-transparent"
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
                            <div className="border border-blue-200 rounded-lg shadow-md overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                            <TableHead className="font-bold text-white text-base py-3">Nº</TableHead>
                                            <TableHead className="font-bold text-white text-base py-3">Nombre</TableHead>
                                            <TableHead className="font-bold text-white text-base py-3">Módulo</TableHead>
                                            <TableHead className="font-bold text-white text-base py-3">Importe</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pasadoresFiltrados.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                    No se encontraron pasadores para el módulo seleccionado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pasadoresFiltrados.map((pasador, index) => (
                                                <TableRow
                                                    key={pasador.id}
                                                    className={`${index % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}
                                                >
                                                    <TableCell className="font-medium text-blue-800 text-base py-2">
                                                        {pasador.displayId}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex items-center">
                                                            <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3 text-base font-bold">
                                                                {pasador.nombre.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="text-base">
                                                                {pasador.numero} - {pasador.nombre}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-indigo-600 font-semibold text-base py-2">
                                                        {pasador.modulo}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <Input
                                                            type="number"
                                                            value={importes[pasador.id]}
                                                            onChange={(e) => handleImporteChange(pasador.id, e.target.value)}
                                                            placeholder="0.00"
                                                            className={`w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-base py-2 ${importes[pasador.id] && Number.parseFloat(importes[pasador.id]) < 0
                                                                ? "text-red-600 font-medium"
                                                                : importes[pasador.id] && Number.parseFloat(importes[pasador.id]) > 0
                                                                    ? "text-green-600 font-medium"
                                                                    : ""
                                                                }`}
                                                            step="0.01"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
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
