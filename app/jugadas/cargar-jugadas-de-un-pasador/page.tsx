"use client"

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore"
import { format } from "date-fns"
import toast from "react-hot-toast"
import Navbar from "@/app/components/Navbar"
import { Loader2, Save, Printer, Calculator, RotateCcw, Search, AlertTriangle, CheckCircle } from "lucide-react"

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
    fechaHora?: any // Firebase Timestamp object
    fechaFormateada?: Date // Converted Date object for client-side use
    loteria?: string
    provincias?: string[]
    secuencia?: string
    totalMonto?: number
    monto?: string // Top-level monto (string)
    numero?: string // Top-level numero (from first jugada)
    numeros?: string[] // Top-level array of all numbers
    jugadas?: Array<{
        decompositionStep?: number // Added for Flutter compatibility
        fechaHora?: string // ISO string for Flutter compatibility
        loteria?: string
        monto?: string // From Flutter saves
        montoTotal?: number // From Next.js saves (individual jugada total)
        numero: string
        numeros?: string[] // Array containing just this jugada's number
        originalNumero?: string
        originalPosicion?: string
        posicion: string
        provincias?: string[]
        redoblonas?: Array<{
            numero: string
            posicion: string
            importe?: string
            monto?: string
        }>
        secuencia?: string
        tipo?: string
    }>
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

const TOTAL_FILAS = 100

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
    const [isLoading, setIsLoading] = useState(false)
    const [secuenciaActual, setSecuenciaActual] = useState<string>("")
    const [debugInfo, setDebugInfo] = useState<string>("")
    // Estados para repetir jugada
    const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false)
    const [secuenciaBuscar, setSecuenciaBuscar] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [jugadasPasador, setJugadasPasador] = useState<JugadaFirebase[]>([])
    const [isLoadingJugadas, setIsLoadingJugadas] = useState(false)
    const [jugadaSeleccionada, setJugadaSeleccionada] = useState<JugadaFirebase | null>(null)

    const inputRefs = useRef<HTMLInputElement[][]>([])

    useEffect(() => {
        if (jugadas.length < TOTAL_FILAS) {
            setJugadas(createEmptyJugadas())
        }
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
        console.log("🚀 INICIANDO APLICACIÓN - CARGAR JUGADAS")
        setDebugInfo("Iniciando aplicación...")
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
        try {
            console.log("🔄 Iniciando carga de pasadores...")
            setDebugInfo("Cargando pasadores desde Firebase...")
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                    id: doc.id,
                    displayId: data.displayId,
                    nombre: data.nombre,
                    nombreFantasia: data.nombreFantasia,
                }
            })
            setPasadores(pasadoresList)
            setDebugInfo(`✅ ${pasadoresList.length} pasadores cargados`)
            console.log(`✅ ${pasadoresList.length} pasadores cargados exitosamente`)
        } catch (error) {
            console.error("❌ ERROR al cargar pasadores:", error)
            setDebugInfo(`❌ Error al cargar pasadores: ${error instanceof Error ? error.message : String(error)}`)
            toast.error(`Error al cargar los pasadores: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    // ✅ FUNCIÓN SIMPLIFICADA: Generar secuencia única
    const generarSecuenciaUnica = (): string => {
        const ahora = new Date()
        const timestamp = ahora.getTime()
        const random = Math.floor(Math.random() * 999)
        const secuencia = `${timestamp}${random.toString().padStart(3, "0")}`
        console.log("🔢 Secuencia generada:", secuencia)
        setDebugInfo(`✅ Secuencia generada: ${secuencia}`)
        return secuencia
    }

    const calcularTotalMonto = useCallback(() => {
        const total = jugadas.reduce((sum, jugada) => {
            const importe = Number.parseFloat(jugada.importe) || 0
            return sum + importe * selectedLotteries.length
        }, 0)
        setTotalMonto(total)
        console.log("💰 Total monto calculado:", total)
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

    const validarDatosParaGuardar = () => {
        console.log("🔍 === INICIANDO VALIDACIÓN DE DATOS ===")
        setDebugInfo("Validando datos...")
        if (!selectedPasador) {
            console.log("❌ Validación falló: No hay pasador seleccionado")
            setDebugInfo("❌ Error: No hay pasador seleccionado")
            toast.error("❌ Debe seleccionar un pasador")
            return false
        }
        if (!selectedSorteo) {
            console.log("❌ Validación falló: No hay sorteo seleccionado")
            setDebugInfo("❌ Error: No hay sorteo seleccionado")
            toast.error("❌ Debe seleccionar un sorteo")
            return false
        }
        if (selectedLotteries.length === 0) {
            console.log("❌ Validación falló: No hay loterías seleccionadas")
            setDebugInfo("❌ Error: No hay loterías seleccionadas")
            toast.error("❌ Debe seleccionar al menos una lotería")
            return false
        }
        const jugadasValidas = jugadas.filter((j) => j.numero && j.posicion && j.importe)
        if (jugadasValidas.length === 0) {
            console.log("❌ Validación falló: No hay jugadas válidas")
            setDebugInfo("❌ Error: No hay jugadas válidas")
            toast.error("❌ No hay jugadas válidas para guardar")
            return false
        }
        if (totalMonto <= 0) {
            console.log("❌ Validación falló: Monto total inválido")
            setDebugInfo("❌ Error: Monto total inválido")
            toast.error("❌ El monto total debe ser mayor a 0")
            return false
        }
        console.log("✅ Validación exitosa - Todos los datos son correctos")
        setDebugInfo("✅ Validación exitosa")
        return true
    }

    // ✅ FUNCIÓN SIMPLIFICADA: Generar ticket
    const generarTicket = (jugadasParaTicket: Jugada[], secuenciaUnica: string) => {
        console.log("🎫 === GENERANDO TICKET ===")
        setDebugInfo("Generando ticket...")
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            console.log("❌ Error: Pasador no encontrado")
            setDebugInfo("❌ Error: Pasador no encontrado")
            return ""
        }
        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005" // Hardcoded as per Flutter example
        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"
        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo
        ticketContent += `${loteriaAbreviada}\n`
        ticketContent += `SECUENCIA  ${secuenciaUnica}\n`
        const provinciasSet = new Set(selectedLotteries.map((l) => provinceAbbreviations[l] || l))
        ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
        ticketContent += "NUMERO UBIC   IMPORTE\n"
        jugadasParaTicket.forEach((jugada) => {
            const numero = jugada.numero.padStart(4, " ")
            const posicion = jugada.posicion.padStart(2, " ")
            const importe = Number.parseFloat(jugada.importe) || 0
            const linea = `${numero}  ${posicion}   $${importe.toFixed(2)}`
            ticketContent += linea + "\n"
        })
        ticketContent += "-".repeat(32) + "\n"
        ticketContent += `TOTAL: $${totalMonto.toFixed(2)}`.padStart(32) + "\n"
        console.log("✅ Ticket generado exitosamente")
        setDebugInfo(`✅ Ticket generado - Secuencia: ${secuenciaUnica}`)
        return ticketContent
    }

    // ✅ FUNCIÓN PRINCIPAL SIMPLIFICADA: Guardar jugadas
    const guardarJugadas = async () => {
        console.log("🚀 === INICIANDO PROCESO DE GUARDADO SIMPLIFICADO ===")
        setDebugInfo("🚀 Iniciando guardado...")
        try {
            setIsLoading(true)
            // Paso 1: Validar datos
            if (!validarDatosParaGuardar()) {
                setIsLoading(false)
                return
            }
            // Paso 2: Obtener datos necesarios
            const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorSeleccionado) {
                throw new Error("Pasador no encontrado")
            }
            const jugadasValidas = jugadas.filter((j) => j.numero && j.posicion && j.importe)
            console.log("📋 Jugadas válidas para procesar:", jugadasValidas.length)

            // Paso 3: Generar secuencia única
            const secuenciaUnica = generarSecuenciaUnica()
            setSecuenciaActual(secuenciaUnica)

            // Paso 4: Generar ticket
            const ticketGenerado = generarTicket(jugadasValidas, secuenciaUnica)
            setTicketContent(ticketGenerado)

            // Paso 5: Preparar datos para Firebase con la estructura detallada
            const now = new Date()
            const isoFechaHora = now.toISOString() // Formato ISO para fechaHora anidada
            const tipoJugada = "NUEVA JUGADA"

            const jugadasAnidadas = jugadasValidas.map((jugadaItem) => ({
                decompositionStep: 1, // Hardcoded as per example, adjust if logic exists
                fechaHora: isoFechaHora,
                loteria: selectedSorteo,
                monto: jugadaItem.importe, // Monto de la jugada individual como string
                montoTotal: Number.parseFloat(jugadaItem.importe) * selectedLotteries.length, // Monto total de esta jugada individual por loterías
                numero: jugadaItem.numero,
                numeros: [jugadaItem.numero], // Array con el número de la jugada individual
                originalNumero: jugadaItem.numero, // Asumiendo que es el mismo por ahora
                originalPosicion: jugadaItem.posicion, // Asumiendo que es el mismo por ahora
                posicion: jugadaItem.posicion,
                provincias: selectedLotteries,
                redoblonas: [], // Vacío si no hay UI para redoblonas
                secuencia: secuenciaUnica,
                tipo: tipoJugada,
            }))

            const nuevaJugada = {
                fechaHora: serverTimestamp(), // Timestamp de Firebase para el nivel superior
                id: secuenciaUnica, // Usar secuencia como ID para facilitar búsqueda
                jugadas: jugadasAnidadas, // Array de jugadas con la estructura detallada
                loteria: selectedSorteo,
                monto: totalMonto.toFixed(2), // Monto total de la transacción como string
                numero: jugadasValidas.length > 0 ? jugadasValidas[0].numero : "", // Número de la primera jugada válida
                numeros: jugadasValidas.map((j) => j.numero), // Array de todos los números de las jugadas
                pasadorId: selectedPasador,
                provincias: selectedLotteries, // Loterías seleccionadas
                secuencia: secuenciaUnica,
                tipo: tipoJugada, // Tipo de jugada
                totalMonto: totalMonto, // Monto total de la transacción como number
            }
            console.log("📤 Objeto para Firebase:")
            console.log(JSON.stringify(nuevaJugada, null, 2))

            // Paso 6: Guardar en Firebase
            const nombreColeccion = `JUGADAS DE ${pasadorSeleccionado.nombre}`
            console.log("📁 Guardando en colección:", nombreColeccion)
            setDebugInfo(`💾 Guardando en: ${nombreColeccion}`)
            const jugadasPasadorCollection = collection(db, nombreColeccion)
            const docRef = await addDoc(jugadasPasadorCollection, nuevaJugada)
            console.log("✅ === DOCUMENTO CREADO EXITOSAMENTE ===")
            console.log("🆔 ID del documento:", docRef.id)
            console.log("📍 Path completo:", docRef.path)

            // Paso 7: Mostrar ticket y limpiar
            setDebugInfo(`✅ ¡GUARDADO EXITOSO! Secuencia: ${secuenciaUnica}`)
            toast.success(`🎉 ¡Jugada guardada exitosamente!\nSecuencia: ${secuenciaUnica}\nID: ${docRef.id}`)
            setIsTicketDialogOpen(true)
        } catch (error) {
            console.error("❌ === ERROR CRÍTICO AL GUARDAR ===")
            console.error("Error:", error)
            let mensajeError = "Error desconocido al guardar"
            if (error instanceof Error) {
                mensajeError = error.message
                if (error.message.includes("permission-denied")) {
                    mensajeError = "Sin permisos para escribir en Firebase"
                } else if (error.message.includes("network")) {
                    mensajeError = "Error de conexión a Firebase"
                }
            }
            setDebugInfo(`❌ ERROR: ${mensajeError}`)
            toast.error(`❌ Error al guardar: ${mensajeError}`)
        } finally {
            console.log("🔄 Finalizando proceso de guardado...")
            setIsLoading(false)
        }
    }

    const limpiarFormulario = () => {
        console.log("🧹 Limpiando formulario...")
        setJugadas(createEmptyJugadas())
        setSelectedLotteries([])
        setSelectedSorteo("")
        setTotalMonto(0)
        setSecuenciaActual("")
        setDebugInfo("🧹 Formulario limpiado")
        setIsTicketDialogOpen(false)
        console.log("✅ Formulario limpiado")
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
                    // Convertir Timestamp de Firebase a Date de forma robusta
                    fechaFormateada:
                        data.fechaHora && typeof data.fechaHora.toDate === "function" ? data.fechaHora.toDate() : new Date(), // Fallback si no es un Timestamp válido
                } as JugadaFirebase
            })

            // Incluir todos los tipos de jugada para la carga (si se guardan desde Flutter o Next.js)
            const tiposPermitidos = [
                "NUEVA JUGADA",
                "Jugada con redoblona",
                "NUEVA EXACTA",
                "NUEVA TRIPLONA",
                "NUEVA QUINTINA",
                "NUEVA BORRATINA",
            ]
            const jugadasFiltradas = jugadasList.filter((jugada) => jugada.tipo && tiposPermitidos.includes(jugada.tipo))

            jugadasFiltradas.sort((a, b) => {
                const fechaA = a.fechaFormateada || new Date(0)
                const fechaB = b.fechaFormateada || new Date(0)
                return fechaB.getTime() - fechaA.getTime()
            })
            console.log("📋 Jugadas encontradas (total):", jugadasList.length)
            console.log("📋 Jugadas filtradas (tipos permitidos):", jugadasFiltradas.length)
            setJugadasPasador(jugadasFiltradas)
            if (jugadasFiltradas.length === 0) {
                toast.error(`No se encontraron jugadas anteriores de tipos permitidos para ${pasadorDoc.nombre}.`)
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
            let jugadasEncontradas: JugadaFirebase[] = []
            let pasadorEncontrado = null

            // Si ya hay un pasador seleccionado, buscar solo en su colección
            if (selectedPasador) {
                const currentPasador = pasadores.find((p) => p.id === selectedPasador)
                if (currentPasador) {
                    const nombreColeccion = `JUGADAS DE ${currentPasador.nombre}`
                    try {
                        const jugadasCollection = collection(db, nombreColeccion)
                        const q = query(jugadasCollection, where("secuencia", "==", secuenciaBuscar))
                        const querySnapshot = await getDocs(q)
                        if (!querySnapshot.empty) {
                            jugadasEncontradas = querySnapshot.docs.map((doc) => {
                                const data = doc.data()
                                return {
                                    id: doc.id,
                                    ...data,
                                    fechaFormateada:
                                        data.fechaHora && typeof data.fechaHora.toDate === "function"
                                            ? data.fechaHora.toDate()
                                            : new Date(),
                                } as JugadaFirebase
                            })
                            pasadorEncontrado = currentPasador
                        }
                    } catch (error) {
                        console.error(`❌ Error al buscar en colección "${nombreColeccion}":`, error)
                    }
                }
            } else {
                // Si no hay pasador seleccionado, buscar en todas las colecciones de pasadores
                for (const pasador of pasadores) {
                    const nombreColeccion = `JUGADAS DE ${pasador.nombre}`
                    try {
                        const jugadasCollection = collection(db, nombreColeccion)
                        const q = query(jugadasCollection, where("secuencia", "==", secuenciaBuscar))
                        const querySnapshot = await getDocs(q)
                        if (!querySnapshot.empty) {
                            jugadasEncontradas = querySnapshot.docs.map((doc) => {
                                const data = doc.data()
                                return {
                                    id: doc.id,
                                    ...data,
                                    fechaFormateada:
                                        data.fechaHora && typeof data.fechaHora.toDate === "function"
                                            ? data.fechaHora.toDate()
                                            : new Date(),
                                } as JugadaFirebase
                            })
                            pasadorEncontrado = pasador
                            break // Detener la búsqueda una vez encontrada
                        }
                    } catch (error) {
                        console.error(`❌ Error al buscar en colección "${nombreColeccion}":`, error)
                    }
                }
            }

            if (jugadasEncontradas.length === 0 || !pasadorEncontrado) {
                toast.error(`No se encontró ninguna jugada con la secuencia "${secuenciaBuscar}".`)
                return
            }

            // Incluir todos los tipos de jugada para la carga
            const tiposPermitidos = [
                "NUEVA JUGADA",
                "Jugada con redoblona",
                "NUEVA EXACTA",
                "NUEVA TRIPLONA",
                "NUEVA QUINTINA",
                "NUEVA BORRATINA",
            ]
            const jugadasFiltradas = jugadasEncontradas.filter(
                (jugada) => jugada.tipo && tiposPermitidos.includes(jugada.tipo),
            )

            if (jugadasFiltradas.length === 0) {
                toast.error(`La jugada con secuencia "${secuenciaBuscar}" no es de un tipo permitido.`)
                return
            }

            limpiarFormulario()
            setSelectedPasador(pasadorEncontrado.id)
            const jugada = jugadasFiltradas[0] // Tomar la primera jugada encontrada

            if (jugada.loteria) {
                setSelectedSorteo(jugada.loteria)
            }
            if (jugada.provincias && jugada.provincias.length > 0) {
                setSelectedLotteries(jugada.provincias)
            }

            if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                const nuevasJugadas = createEmptyJugadas()
                jugada.jugadas.forEach((jugadaItem: any, index: number) => {
                    if (index < TOTAL_FILAS) {
                        nuevasJugadas[index] = {
                            numero: jugadaItem.numero || "",
                            posicion: jugadaItem.posicion || "",
                            // Priorizar 'importe' (Next.js) o 'monto' (Flutter), luego 'montoTotal'
                            importe: jugadaItem.importe || jugadaItem.monto || jugadaItem.montoTotal?.toString() || "",
                        }
                    }
                })
                setJugadas(nuevasJugadas)
            } else {
                // Si el documento no tiene un array 'jugadas' (ej. jugadas simples antiguas)
                const nuevasJugadas = createEmptyJugadas()
                nuevasJugadas[0] = {
                    numero: jugada.numero || "",
                    posicion: jugada.posicion || "",
                    importe: jugada.monto || jugada.totalMonto?.toString() || "", // Usar monto o totalMonto del nivel superior
                }
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
            limpiarFormulario()

            if (jugadaSeleccionada.loteria) {
                setSelectedSorteo(jugadaSeleccionada.loteria)
            }
            if (jugadaSeleccionada.provincias && jugadaSeleccionada.provincias.length > 0) {
                setSelectedLotteries(jugadaSeleccionada.provincias)
            }

            if (jugadaSeleccionada.jugadas && Array.isArray(jugadaSeleccionada.jugadas)) {
                const nuevasJugadas = createEmptyJugadas()
                jugadaSeleccionada.jugadas.forEach((jugadaItem: any, index: number) => {
                    if (index < TOTAL_FILAS) {
                        nuevasJugadas[index] = {
                            numero: jugadaItem.numero || "",
                            posicion: jugadaItem.posicion || "",
                            // Priorizar 'importe' (Next.js) o 'monto' (Flutter), luego 'montoTotal'
                            importe: jugadaItem.importe || jugadaItem.monto || jugadaItem.montoTotal?.toString() || "",
                        }
                    }
                })
                setJugadas(nuevasJugadas)
            } else {
                // Si el documento no tiene un array 'jugadas' (ej. jugadas simples antiguas)
                const nuevasJugadas = createEmptyJugadas()
                nuevasJugadas[0] = {
                    numero: jugadaSeleccionada.numero || "",
                    posicion: jugadaSeleccionada.posicion || "",
                    importe: jugadaSeleccionada.monto || jugadaSeleccionada.totalMonto?.toString() || "", // Usar monto o totalMonto del nivel superior
                }
                setJugadas(nuevasJugadas)
            }

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
            // Para jugadas antiguas que no tienen el array 'jugadas'
            resumen = `1 Jugada (${jugada.numero || "N/A"})`
            total = jugada.totalMonto || Number.parseFloat(jugada.monto || "0") || 0
        }
        return { resumen, total: Number(total) || 0 }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault()
            let nextRow = rowIndex
            let nextCol = colIndex + 1

            if (nextCol > 2) {
                nextCol = 0
                nextRow = rowIndex + 1
            }

            if (nextRow >= jugadas.length) {
                nextRow = 0
                nextCol = 0
            }

            const nextInput = inputRefs.current[nextRow]?.[nextCol]
            if (nextInput) {
                nextInput.focus()
            }
        }
    }

    const setInputRef = (el: HTMLInputElement | null, rowIndex: number, colIndex: number) => {
        if (el && inputRefs.current[rowIndex]) {
            inputRefs.current[rowIndex][colIndex] = el
        }
    }

    const renderJugadasRows = () => {
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
                {/* Panel de Debug */}
                <Card className="mb-4 border-orange-200 bg-orange-50">
                    <CardHeader className="bg-orange-100">
                        <CardTitle className="text-orange-800 flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2" />🔧 Debug Panel - Sistema Simplificado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="bg-white p-3 rounded border font-mono text-sm">{debugInfo || "Esperando acción..."}</div>
                        {secuenciaActual && (
                            <div className="mt-2 bg-green-50 p-3 rounded border border-green-200">
                                <div className="flex items-center text-green-800">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    <span className="font-bold">Secuencia Actual:</span>
                                    <span className="ml-2 font-mono">{secuenciaActual}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold text-center">✅ CARGAR JUGADAS - SISTEMA SIMPLIFICADO</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                                    <Label htmlFor="sorteo" className="min-w-[80px] text-blue-800 font-semibold">
                                        SORTEO:
                                    </Label>
                                    <Select value={selectedSorteo} onValueChange={setSelectedSorteo}>
                                        <SelectTrigger id="sorteo" className="w-full sm:w-[200px] border-blue-300 focus:ring-blue-500">
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
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                                    <Label htmlFor="pasador" className="min-w-[80px] text-blue-800 font-semibold">
                                        PASADOR:
                                    </Label>
                                    <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                        <SelectTrigger id="pasador" className="w-full sm:w-[280px] border-blue-300 focus:ring-blue-500">
                                            <SelectValue placeholder="Seleccionar pasador" />
                                        </SelectTrigger>
                                        <SelectContent className="w-[280px]">
                                            {pasadores.map((pasador) => (
                                                <SelectItem key={pasador.id} value={pasador.id} className="w-full">
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="font-medium">{pasador.displayId}</span>
                                                        <span className="text-gray-600 ml-2">{pasador.nombreFantasia || pasador.nombre}</span>
                                                    </div>
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
                                    {secuenciaActual && (
                                        <Badge className="ml-4 bg-green-100 text-green-800">Secuencia: {secuenciaActual}</Badge>
                                    )}
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
                                        className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-md transition-all duration-200 transform hover:scale-105"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />✅ Guardar Jugadas
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* DIÁLOGO DE TICKET SIMPLIFICADO */}
                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800 text-center">✅ JUGADA GUARDADA EXITOSAMENTE</DialogTitle>
                            <DialogDescription className="text-center text-gray-600">
                                Su jugada ha sido guardada correctamente en Firebase
                            </DialogDescription>
                        </DialogHeader>
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                            <pre className="whitespace-pre-wrap font-mono text-sm">{ticketContent}</pre>
                        </div>
                        {secuenciaActual && (
                            <div className="bg-green-50 p-3 rounded-md border border-green-200">
                                <div className="flex items-center text-green-800">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    <span className="text-sm">
                                        <strong>Secuencia:</strong> {secuenciaActual}
                                    </span>
                                </div>
                            </div>
                        )}
                        <DialogFooter className="flex justify-between">
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
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir
                            </Button>
                            <Button onClick={limpiarFormulario} className="bg-green-600 hover:bg-green-700 text-white">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Continuar
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
                            <DialogDescription>
                                Seleccione una jugada anterior para repetir o busque por número de secuencia
                            </DialogDescription>
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
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="space-y-4">
                            {isLoadingJugadas ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                    <span className="ml-2">Cargando jugadas...</span>
                                </div>
                            ) : jugadasPasador.length > 0 ? (
                                <div>
                                    <Label className="text-sm font-medium mb-2 block">Seleccione la jugada que desea repetir:</Label>
                                    <ScrollArea className="h-[400px] rounded-md border p-2">
                                        <div className="space-y-2">
                                            {jugadasPasador.map((jugada) => {
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
