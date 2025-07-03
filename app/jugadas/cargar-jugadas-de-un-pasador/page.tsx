"use client"

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore"
import { format } from "date-fns"
import toast from "react-hot-toast"
import Navbar from "@/app/components/Navbar"
import { Loader2, Save, Printer, X, Calculator, RotateCcw, Search } from "lucide-react"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    nombreFantasia: string
}

interface Jugada {
    numero: string
    posicion: string
    importe: string
}

interface JugadaFirebase {
    id: string
    tipo?: string
    observacion?: string
    fechaHora?: any
    fechaFormateada?: Date
    loteria?: string
    provincias?: string[]
    secuencia?: string
    totalMonto?: number
    monto?: string
    numeros?: string[]
    jugadas?: any[]
    pasadorId?: string
    [key: string]: any
}

const lotteryAbbreviations: { [key: string]: string } = {
    LAPREVIA: "PRE",
    PRIMERA: "PR",
    MATUTINA: "MA",
    VESPERTINA: "VE",
    NOCTURNA: "NO",
}

const provinceAbbreviations: { [key: string]: string } = {
    NACION: "N",
    PROVIN: "P",
    SANTA: "SF",
    CORDOB: "C",
    URUGUA: "U",
    ENTRE: "E",
    MENDOZ: "M",
    CORRIE: "CR",
    CHACO: "CH",
    RIONEG: "RN",
    SANTIA: "SG",
    TUCUMA: "TU",
    NEUQUE: "NEU",
    MISION: "MIS",
}

// Número total de filas de jugadas
const TOTAL_FILAS = 100

// Crear un array de 100 jugadas vacías para inicializar el estado
const createEmptyJugadas = () => {
    return Array(TOTAL_FILAS)
        .fill(null)
        .map(() => ({ numero: "", posicion: "", importe: "" }))
}

export default function CargarJugadas() {
    const [selectedLotteries, setSelectedLotteries] = useState<string[]>([])
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [selectedSorteo, setSelectedSorteo] = useState<string>("")
    const [jugadas, setJugadas] = useState<Jugada[]>(createEmptyJugadas())
    const [totalMonto, setTotalMonto] = useState(0)
    const [ticketContent, setTicketContent] = useState<string>("")
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
    const [secuenciaCounter, setSecuenciaCounter] = useState(10000)
    const [isLoading, setIsLoading] = useState(false)

    // Estados para repetir jugada
    const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false)
    const [secuenciaBuscar, setSecuenciaBuscar] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [jugadasPasador, setJugadasPasador] = useState<JugadaFirebase[]>([])
    const [isLoadingJugadas, setIsLoadingJugadas] = useState(false)
    const [jugadaSeleccionada, setJugadaSeleccionada] = useState<JugadaFirebase | null>(null)

    // Crear un array para almacenar las referencias a los inputs
    const inputRefs = useRef<HTMLInputElement[][]>([])

    // Inicializar el array de referencias
    useEffect(() => {
        // Asegurarse de que tenemos 100 filas de jugadas
        if (jugadas.length < TOTAL_FILAS) {
            setJugadas(createEmptyJugadas())
        }
        // Inicializar las referencias
        inputRefs.current = Array(TOTAL_FILAS)
            .fill(0)
            .map(() => Array(3).fill(null))
    }, [jugadas.length])

    const horarios = [
        { id: "LAPREVIA", label: "La Previa (10:15)" },
        { id: "PRIMERA", label: "Primera (12:00)" },
        { id: "MATUTINA", label: "Matutina (15:00)" },
        { id: "VESPERTINA", label: "Vespertina (18:00)" },
        { id: "NOCTURNA", label: "Nocturna (21:00)" },
    ]

    const loterias = [
        { id: "NACION", label: "Nacional" },
        { id: "PROVIN", label: "Provincia" },
        { id: "SANTA", label: "Santa Fe" },
        { id: "CORDOB", label: "Córdoba" },
        { id: "URUGUA", label: "Uruguay" },
        { id: "ENTRE", label: "Entre Ríos" },
        { id: "MENDOZ", label: "Mendoza" },
        { id: "CORRIE", label: "Corrientes" },
        { id: "CHACO", label: "Chaco" },
        { id: "RIONEG", label: "Rio Negro" },
        { id: "SANTIA", label: "Santiago" },
        { id: "TUCUMA", label: "Tucumán" },
        { id: "NEUQUE", label: "Neuquén" },
        { id: "MISION", label: "Misiones" },
    ]

    useEffect(() => {
        fetchPasadores()
        loadSecuenciaCounter()
    }, [])

    const fetchPasadores = async () => {
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs.map((doc) => ({
                id: doc.id,
                displayId: doc.data().displayId,
                nombre: doc.data().nombre,
                nombreFantasia: doc.data().nombreFantasia,
            }))
            setPasadores(pasadoresList)
        } catch (error) {
            console.error("Error fetching pasadores:", error)
            toast.error("Error al cargar los pasadores")
        }
    }

    const loadSecuenciaCounter = () => {
        const storedCounter = localStorage.getItem("secuenciaCounter")
        if (storedCounter) {
            setSecuenciaCounter(Number.parseInt(storedCounter))
        }
    }

    const incrementSecuenciaCounter = useCallback(() => {
        setSecuenciaCounter((prevCounter) => {
            const newCounter = prevCounter + 1
            localStorage.setItem("secuenciaCounter", newCounter.toString())
            return newCounter
        })
    }, [])

    const calcularTotalMonto = useCallback(() => {
        const total = jugadas.reduce((sum, jugada) => {
            const importe = Number.parseFloat(jugada.importe) || 0
            return sum + importe * selectedLotteries.length
        }, 0)
        setTotalMonto(total)
    }, [jugadas, selectedLotteries])

    useEffect(() => {
        calcularTotalMonto()
    }, [calcularTotalMonto])

    const handleJugadaChange = (index: number, field: keyof Jugada, value: string) => {
        const newJugadas = [...jugadas]
        newJugadas[index] = { ...newJugadas[index], [field]: value }
        setJugadas(newJugadas)
    }

    const handleLotteryChange = (lotteryId: string, checked: boolean) => {
        setSelectedLotteries((prev) => (checked ? [...prev, lotteryId] : prev.filter((id) => id !== lotteryId)))
    }

    const formatDate = (date: Date) => {
        return date.toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })
    }

    const formatearFecha = (fecha: Date) => {
        return format(fecha, "dd/MM/yy HH:mm")
    }

    const generarSecuencia = () => {
        const secuencia = secuenciaCounter.toString().padStart(9, "0")
        incrementSecuenciaCounter()
        return secuencia
    }

    const generarTicket = (jugadasParaTicket: Jugada[]) => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            toast.error("Pasador no encontrado")
            return
        }

        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005"
        const secuencia = generarSecuencia()

        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"

        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo
        ticketContent += `${loteriaAbreviada}\n`
        ticketContent += `SECUENCIA  ${secuencia}\n`

        const provinciasSet = new Set(selectedLotteries.map((l) => provinceAbbreviations[l] || l))
        ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
        ticketContent += "NUMERO UBIC   IMPORTE\n"

        jugadasParaTicket.forEach((jugada) => {
            const numero = jugada.numero.padStart(4, " ")
            const posicion = jugada.posicion.padStart(2, " ")
            const importe = Number.parseFloat(jugada.importe) || 0
            ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`
        })

        ticketContent += "-".repeat(32) + "\n"
        ticketContent += `TOTAL: $${totalMonto.toFixed(2)}`.padStart(32) + "\n"

        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)
        return secuencia
    }

    const obtenerJugadasDelPasador = async () => {
        if (!selectedPasador) {
            toast.error("Por favor, seleccione un pasador primero.")
            return
        }

        setIsLoadingJugadas(true)
        try {
            const pasadorDoc = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorDoc) {
                toast.error("Pasador no encontrado.")
                return
            }

            console.log("🔍 Obteniendo jugadas del pasador:", pasadorDoc.nombre)

            const nombreColeccion = `JUGADAS DE ${pasadorDoc.nombre}`
            const jugadasCollection = collection(db, nombreColeccion)
            const jugadasSnapshot = await getDocs(jugadasCollection)

            const jugadasList: JugadaFirebase[] = jugadasSnapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                    id: doc.id,
                    ...data,
                    fechaFormateada: data.fechaHora
                        ? data.fechaHora.toDate
                            ? data.fechaHora.toDate()
                            : new Date(data.fechaHora)
                        : new Date(),
                } as JugadaFirebase
            })

            // Filtrar solo jugadas de tipo "NUEVA JUGADA"
            const tiposPermitidos = ["NUEVA JUGADA"]
            const jugadasFiltradas = jugadasList.filter((jugada) => jugada.tipo && tiposPermitidos.includes(jugada.tipo))

            // Ordenar por fecha más reciente primero
            jugadasFiltradas.sort((a, b) => {
                const fechaA = a.fechaFormateada || new Date(0)
                const fechaB = b.fechaFormateada || new Date(0)
                return fechaB.getTime() - fechaA.getTime()
            })

            console.log("📋 Jugadas encontradas:", jugadasList.length)
            console.log("📋 Jugadas filtradas:", jugadasFiltradas.length)
            setJugadasPasador(jugadasFiltradas)

            if (jugadasFiltradas.length === 0) {
                toast.error(`No se encontraron jugadas anteriores de tipo "NUEVA JUGADA" para ${pasadorDoc.nombre}.`)
            }
        } catch (error) {
            console.error("❌ Error al obtener jugadas:", error)
            toast.error("Error al obtener las jugadas del pasador.")
        } finally {
            setIsLoadingJugadas(false)
        }
    }

    const buscarJugadaAnterior = async () => {
        if (!secuenciaBuscar.trim()) {
            toast.error("Por favor, ingrese un número de secuencia.")
            return
        }

        setIsSearching(true)
        try {
            console.log("🔍 Iniciando búsqueda de secuencia:", secuenciaBuscar)

            let jugadasEncontradas: any[] = []
            let pasadorEncontrado = null
            let coleccionesRevisadas = 0

            for (const pasador of pasadores) {
                const nombreColeccion = `JUGADAS DE ${pasador.nombre}`
                console.log(`🔎 Buscando en colección: "${nombreColeccion}"`)

                try {
                    const jugadasCollection = collection(db, nombreColeccion)
                    const q = query(jugadasCollection, where("secuencia", "==", secuenciaBuscar))
                    const querySnapshot = await getDocs(q)

                    coleccionesRevisadas++

                    if (!querySnapshot.empty) {
                        const docs = querySnapshot.docs.map((doc) => {
                            const data = doc.data()
                            return { id: doc.id, ...data }
                        })
                        jugadasEncontradas = docs
                        pasadorEncontrado = pasador
                        break
                    }
                } catch (error) {
                    console.error(`❌ Error al buscar en colección "${nombreColeccion}":`, error)
                }
            }

            if (jugadasEncontradas.length === 0 || !pasadorEncontrado) {
                toast.error(
                    `No se encontró ninguna jugada con la secuencia "${secuenciaBuscar}". Se revisaron ${coleccionesRevisadas} colecciones.`,
                )
                return
            }

            // Filtrar solo los tipos permitidos
            const tiposPermitidos = ["NUEVA JUGADA"]
            const jugadasFiltradas = jugadasEncontradas.filter((jugada) => tiposPermitidos.includes(jugada.tipo))

            if (jugadasFiltradas.length === 0) {
                toast.error(`La jugada con secuencia "${secuenciaBuscar}" no es de tipo "NUEVA JUGADA".`)
                return
            }

            // Limpiar jugadas actuales
            limpiarFormulario()

            // Configurar pasador
            setSelectedPasador(pasadorEncontrado.id)

            // Procesar la jugada encontrada
            const jugada = jugadasFiltradas[0]

            // Configurar sorteo y provincias
            if (jugada.loteria) {
                setSelectedSorteo(jugada.loteria)
            }

            if (jugada.provincias && jugada.provincias.length > 0) {
                setSelectedLotteries(jugada.provincias)
            }

            // Cargar las jugadas individuales
            if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                const nuevasJugadas = createEmptyJugadas()

                jugada.jugadas.forEach((jugadaItem: any, index: number) => {
                    if (index < TOTAL_FILAS) {
                        nuevasJugadas[index] = {
                            numero: jugadaItem.numero || jugadaItem.originalNumero || "",
                            posicion: jugadaItem.posicion || jugadaItem.originalPosicion || "",
                            importe: jugadaItem.monto || jugadaItem.montoTotal?.toString() || "",
                        }
                    }
                })

                setJugadas(nuevasJugadas)
            }

            toast.success(`Jugada con secuencia "${secuenciaBuscar}" cargada exitosamente.`)
            setIsRepeatDialogOpen(false)
            setSecuenciaBuscar("")
        } catch (error) {
            console.error("❌ Error al buscar jugada:", error)
            toast.error("Error al buscar la jugada. Por favor, intente nuevamente.")
        } finally {
            setIsSearching(false)
        }
    }

    const cargarJugadaSeleccionada = async () => {
        if (!jugadaSeleccionada) {
            toast.error("Por favor, seleccione una jugada para repetir.")
            return
        }

        try {
            console.log("🎯 Cargando jugada seleccionada:", jugadaSeleccionada.secuencia)

            // Limpiar formulario
            limpiarFormulario()

            // Configurar sorteo y provincias
            if (jugadaSeleccionada.loteria) {
                setSelectedSorteo(jugadaSeleccionada.loteria)
            }

            if (jugadaSeleccionada.provincias && jugadaSeleccionada.provincias.length > 0) {
                setSelectedLotteries(jugadaSeleccionada.provincias)
            }

            // Cargar las jugadas individuales
            if (jugadaSeleccionada.jugadas && Array.isArray(jugadaSeleccionada.jugadas)) {
                const nuevasJugadas = createEmptyJugadas()

                jugadaSeleccionada.jugadas.forEach((jugadaItem: any, index: number) => {
                    if (index < TOTAL_FILAS) {
                        nuevasJugadas[index] = {
                            numero: jugadaItem.numero || jugadaItem.originalNumero || "",
                            posicion: jugadaItem.posicion || jugadaItem.originalPosicion || "",
                            importe: jugadaItem.monto || jugadaItem.montoTotal?.toString() || "",
                        }
                    }
                })

                setJugadas(nuevasJugadas)
            }

            // Cerrar el diálogo
            setIsRepeatDialogOpen(false)
            setJugadaSeleccionada(null)
            setJugadasPasador([])

            toast.success("Jugada cargada exitosamente. Puede modificarla y guardarla nuevamente.")
        } catch (error) {
            console.error("❌ Error al cargar jugada:", error)
            toast.error("Error al cargar la jugada seleccionada.")
        }
    }

    const obtenerResumenJugada = (jugada: JugadaFirebase) => {
        let resumen = ""
        let total = 0

        if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
            const cantidad = jugada.jugadas.length
            resumen = `${cantidad} Jugada(s)`
            total = jugada.totalMonto || Number.parseFloat(jugada.monto || "0") || 0
        } else {
            resumen = "Jugada"
            total = jugada.totalMonto || Number.parseFloat(jugada.monto || "0") || 0
        }

        return { resumen, total: Number(total) || 0 }
    }

    const guardarJugadas = async () => {
        if (jugadas.length === 0 || !selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Faltan datos para guardar las jugadas")
            return
        }

        try {
            setIsLoading(true)
            const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorSeleccionado) {
                toast.error("Pasador no encontrado")
                return
            }

            const jugadasValidas = jugadas.filter((j) => j.numero && j.posicion && j.importe)
            if (jugadasValidas.length === 0) {
                toast.error("No hay jugadas válidas para guardar")
                return
            }

            const secuencia = generarTicket(jugadasValidas)
            const jugadasPasadorCollection = collection(db, `JUGADAS DE ${pasadorSeleccionado.nombre}`)

            const nuevaJugada = {
                fechaHora: serverTimestamp(),
                id: secuencia,
                jugadas: jugadasValidas.map((jugada) => ({
                    decompositionStep: 0,
                    fechaHora: new Date().toISOString(),
                    loteria: selectedSorteo,
                    monto: jugada.importe,
                    montoTotal: Number.parseFloat(jugada.importe),
                    numero: jugada.numero,
                    numeros: [jugada.numero],
                    originalNumero: jugada.numero,
                    originalPosicion: jugada.posicion,
                    posicion: jugada.posicion,
                    provincias: selectedLotteries,
                    secuencia: secuencia,
                    tipo: "NUEVA JUGADA",
                })),
                loteria: selectedSorteo,
                monto: totalMonto.toFixed(2),
                numero: jugadasValidas[0].numero,
                numeros: jugadasValidas.map((j) => j.numero),
                pasadorId: selectedPasador,
                provincias: selectedLotteries,
                secuencia: secuencia,
                tipo: "NUEVA JUGADA",
                totalMonto: totalMonto,
            }

            await addDoc(jugadasPasadorCollection, nuevaJugada)
            toast.success("Jugadas guardadas exitosamente")
            limpiarFormulario()
        } catch (error) {
            console.error("Error al guardar las jugadas:", error)
            toast.error("Error al guardar las jugadas")
        } finally {
            setIsLoading(false)
        }
    }

    const limpiarFormulario = () => {
        setJugadas(createEmptyJugadas())
        setSelectedLotteries([])
        setSelectedSorteo("")
        setTotalMonto(0)
    }

    // Función para manejar la navegación con Enter
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault()
            // Determinar el siguiente campo para enfocar
            let nextRow = rowIndex
            let nextCol = colIndex + 1

            // Si estamos en la última columna, pasar a la primera columna de la siguiente fila
            if (nextCol > 2) {
                nextCol = 0
                nextRow = rowIndex + 1
            }

            // Si llegamos al final de todas las filas, volver al primer campo
            if (nextRow >= jugadas.length) {
                nextRow = 0
                nextCol = 0
            }

            // Enfocar el siguiente campo
            const nextInput = inputRefs.current[nextRow]?.[nextCol]
            if (nextInput) {
                nextInput.focus()
            }
        }
    }

    // Función para guardar la referencia del input
    const setInputRef = (el: HTMLInputElement | null, rowIndex: number, colIndex: number) => {
        if (el && inputRefs.current[rowIndex]) {
            inputRefs.current[rowIndex][colIndex] = el
        }
    }

    // Generar las filas de jugadas para asegurar que siempre haya 100
    const renderJugadasRows = () => {
        // Asegurarse de que tenemos 100 filas
        const filasJugadas = jugadas.length < TOTAL_FILAS ? createEmptyJugadas() : jugadas

        return filasJugadas.map((jugada, rowIndex) => (
            <TableRow
                key={rowIndex}
                className={`${rowIndex % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}
            >
                <TableCell className="font-medium text-blue-800">{(rowIndex + 1).toString().padStart(3, "0")}</TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.numero}
                        onChange={(e) => handleJugadaChange(rowIndex, "numero", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                        ref={(el) => setInputRef(el, rowIndex, 0)}
                    />
                </TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.posicion}
                        onChange={(e) => handleJugadaChange(rowIndex, "posicion", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                        ref={(el) => setInputRef(el, rowIndex, 1)}
                    />
                </TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.importe}
                        onChange={(e) => handleJugadaChange(rowIndex, "importe", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                        ref={(el) => setInputRef(el, rowIndex, 2)}
                    />
                </TableCell>
            </TableRow>
        ))
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <div className="container mx-auto p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold text-center">PASAR JUGADAS QUINIELA</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <Label htmlFor="sorteo" className="min-w-[80px] text-blue-800 font-semibold">
                                        SORTEO:
                                    </Label>
                                    <Select value={selectedSorteo} onValueChange={setSelectedSorteo}>
                                        <SelectTrigger id="sorteo" className="w-[200px] border-blue-300 focus:ring-blue-500">
                                            <SelectValue placeholder="Seleccionar horario" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {horarios.map((horario) => (
                                                <SelectItem key={horario.id} value={horario.id}>
                                                    {horario.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Label htmlFor="pasador" className="min-w-[80px] text-blue-800 font-semibold">
                                        PASADOR:
                                    </Label>
                                    <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                        <SelectTrigger id="pasador" className="w-[200px] border-blue-300 focus:ring-blue-500">
                                            <SelectValue placeholder="Seleccionar pasador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pasadores.map((pasador) => (
                                                <SelectItem key={pasador.id} value={pasador.id}>
                                                    {`${pasador.displayId} - ${pasador.nombreFantasia || pasador.nombre}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm">
                                <Label className="mb-3 block text-indigo-800 font-semibold">LOTERÍAS:</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {loterias.map((loteria) => (
                                        <div key={loteria.id} className="flex items-center space-x-2 bg-white p-2 rounded-md shadow-sm">
                                            <Checkbox
                                                id={loteria.id}
                                                checked={selectedLotteries.includes(loteria.id)}
                                                onCheckedChange={(checked) => handleLotteryChange(loteria.id, checked === true)}
                                                className="border-indigo-400 text-indigo-600"
                                            />
                                            <Label htmlFor={loteria.id} className="text-gray-700">
                                                {loteria.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-2 text-blue-800 border-b-2 border-blue-300 pb-2 flex items-center">
                                    <Calculator className="h-5 w-5 mr-2 text-blue-600" />
                                    DATOS DE LA JUGADA
                                </h3>
                                <div className="border border-blue-200 rounded-md overflow-auto max-h-[600px] shadow-md">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 z-10">
                                            <TableRow>
                                                <TableHead className="w-[60px] text-white font-bold">Nº</TableHead>
                                                <TableHead className="text-white font-bold">NÚMERO</TableHead>
                                                <TableHead className="text-white font-bold">POSICIÓN</TableHead>
                                                <TableHead className="text-white font-bold">IMPORTE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>{renderJugadasRows()}</TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="text-xl font-bold text-blue-800">
                                    Total: <span className="text-green-600">${totalMonto.toFixed(2)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (!selectedPasador) {
                                                toast.error("Por favor, seleccione un pasador primero.")
                                                return
                                            }
                                            setIsRepeatDialogOpen(true)
                                            obtenerJugadasDelPasador()
                                        }}
                                        className="border-purple-500 text-purple-600 hover:bg-purple-50 bg-transparent"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" /> Repetir Jugada
                                    </Button>
                                    <Button
                                        onClick={guardarJugadas}
                                        className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Cargar Jugadas
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Diálogo de ticket */}
                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800 text-center">Ticket de Jugada</DialogTitle>
                        </DialogHeader>
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                            <pre className="whitespace-pre-wrap font-mono text-sm">{ticketContent}</pre>
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                onClick={() => setIsTicketDialogOpen(false)}
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cerrar
                            </Button>
                            <Button
                                onClick={() => {
                                    const printWindow = window.open("", "", "width=300,height=600")
                                    if (printWindow) {
                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>Ticket de Jugada</title>
                                                    <style>
                                                        body {
                                                            font-family: 'Courier New', monospace;
                                                            font-size: 12px;
                                                            width: 80mm;
                                                            margin: 0;
                                                            padding: 10px;
                                                        }
                                                        pre {
                                                            white-space: pre-wrap;
                                                            margin: 0;
                                                        }
                                                    </style>
                                                </head>
                                                <body>
                                                    <pre>${ticketContent}</pre>
                                                </body>
                                            </html>
                                        `)
                                        printWindow.document.close()
                                        printWindow.focus()
                                        printWindow.print()
                                        printWindow.close()
                                    }
                                }}
                                className="bg-gradient-to-r from-green-600 to-teal-700 hover:from-green-700 hover:to-teal-800 text-white"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Diálogo para repetir jugada anterior */}
                <Dialog open={isRepeatDialogOpen} onOpenChange={setIsRepeatDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <RotateCcw className="h-5 w-5 mr-2 text-purple-600" />
                                Repetir Jugada Anterior
                                {selectedPasador && (
                                    <Badge className="ml-2 bg-blue-100 text-blue-800">
                                        {pasadores.find((p) => p.id === selectedPasador)?.nombre}
                                    </Badge>
                                )}
                            </DialogTitle>

                            {/* Buscador por número de secuencia */}
                            <div className="mb-4">
                                <Label className="text-sm font-medium mb-2 block">Buscar por número de secuencia:</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={secuenciaBuscar}
                                        onChange={(e) => setSecuenciaBuscar(e.target.value)}
                                        placeholder="Ingrese el número de secuencia"
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={buscarJugadaAnterior}
                                        disabled={isSearching || !secuenciaBuscar.trim()}
                                        variant="outline"
                                        className="border-blue-500 text-blue-600 bg-transparent"
                                    >
                                        {isSearching ? (
                                            <svg
                                                className="animate-spin h-4 w-4"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                        ) : (
                                            <Search className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-4">
                            {isLoadingJugadas ? (
                                <div className="flex items-center justify-center py-8">
                                    <svg
                                        className="animate-spin h-8 w-8 text-purple-600"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    <span className="ml-2">Cargando jugadas...</span>
                                </div>
                            ) : jugadasPasador.length > 0 ? (
                                <div>
                                    <Label className="text-sm font-medium mb-2 block">Seleccione la jugada que desea repetir:</Label>
                                    <ScrollArea className="h-[400px] rounded-md border p-2">
                                        <div className="space-y-2">
                                            {jugadasPasador.map((jugada, index) => {
                                                const { resumen, total } = obtenerResumenJugada(jugada)
                                                const isSelected = jugadaSeleccionada?.id === jugada.id

                                                return (
                                                    <div
                                                        key={jugada.id}
                                                        onClick={() => setJugadaSeleccionada(jugada)}
                                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                                                ? "border-purple-500 bg-purple-50"
                                                                : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs bg-blue-100 text-blue-800 border-blue-300"
                                                                    >
                                                                        {jugada.tipo?.replace("NUEVA ", "")}
                                                                    </Badge>
                                                                    <span className="text-sm font-medium">{resumen}</span>
                                                                </div>

                                                                <div className="text-xs text-gray-500 space-y-1">
                                                                    <div>📅 {formatearFecha(jugada.fechaFormateada || new Date())}</div>
                                                                    <div>🎯 {jugada.loteria || "N/A"}</div>
                                                                    {jugada.provincias && jugada.provincias.length > 0 && (
                                                                        <div>🌍 {jugada.provincias.join(", ")}</div>
                                                                    )}
                                                                    <div>🔢 Secuencia: {jugada.secuencia}</div>
                                                                </div>
                                                            </div>

                                                            <div className="text-right">
                                                                <div className="text-lg font-bold text-green-600">${total.toFixed(2)}</div>
                                                                {isSelected && (
                                                                    <div className="text-xs text-purple-600 font-medium">✓ Seleccionada</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">📋</div>
                                    <p>No se encontraron jugadas anteriores para este pasador.</p>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsRepeatDialogOpen(false)
                                    setJugadaSeleccionada(null)
                                    setJugadasPasador([])
                                    setSecuenciaBuscar("")
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    if (jugadaSeleccionada) {
                                        cargarJugadaSeleccionada()
                                    }
                                }}
                                disabled={!jugadaSeleccionada}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <Save className="h-4 w-4 mr-2" /> Cargar Jugada
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
