"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, Save, Printer, Share2, RefreshCw, RotateCcw, Search } from "lucide-react"
import Navbar from "@/app/components/Navbar"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore"
import { format } from "date-fns"
import { toast } from "react-hot-toast"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    nombreFantasia: string
}

interface TriplonaApuesta {
    numeros: string[]
    loteria: string
    provincias: string[]
}

interface BorratinaApuesta {
    numeros: string[]
    loteria: string
}

interface QuintinaApuesta {
    numeros: string[]
    loteria: string
    provincias: string[]
}

interface ExactaApuesta {
    numero: string
    posicion: string
    importe: string
    loteria: string
    provincias: string[]
}

interface ExactaJugada {
    numero: string
    posicion: string
    importe: string
}

interface Loteria {
    id: string
    label: string
    color: string
    habilitada?: boolean
}

interface JugadaFirebase {
    id: string
    tipo?: string
    observacion?: string
    fechaHora?: any
    fechaFormateada?: Date
    loterias?: string[]
    provincias?: string[]
    secuencia?: string
    totalMonto?: number
    montoTotal?: string | number
    numeros?: string[]
    jugadas?: any[]
    pasadorId?: string
    nombreObservacion?: string
    [key: string]: any
}

const lotteryAbbreviations: { [key: string]: string } = {
    PREVIA: "PRE",
    PRIMERA: "PRIM",
    MATUTINA: "MAT",
    VESPERTINA: "VES",
    NOCTURNA: "NOC",
}

const provinceAbbreviations: { [key: string]: string } = {
    NACION: "NAC",
    PROVIN: "PRO",
    SANTA: "SF",
    CORDOB: "COR",
    URUGUA: "URU",
    ENTRE: "ER",
    MENDOZ: "MEN",
    CORRIE: "CRI",
    CHACO: "CHA",
    RIONEG: "RN",
    SANTIA: "SG",
    TUCUMA: "TU",
    NEUQUE: "NEU",
    MISION: "MIS",
}

const loterias: Loteria[] = [
    { id: "NACION", label: "Nacional", color: "bg-blue-100 border-blue-500", habilitada: true },
    { id: "PROVIN", label: "Provincia", color: "bg-green-100 border-green-500", habilitada: true },
    { id: "SANTA", label: "Santa Fe", color: "bg-red-100 border-red-500", habilitada: true },
    { id: "CORDOB", label: "Córdoba", color: "bg-yellow-100 border-yellow-500", habilitada: true },
    { id: "URUGUA", label: "Uruguay", color: "bg-indigo-100 border-indigo-500", habilitada: true },
    { id: "ENTRE", label: "Entre Ríos", color: "bg-teal-100 border-teal-500", habilitada: true },
    { id: "MENDOZ", label: "Mendoza", color: "bg-purple-100 border-purple-500", habilitada: true },
    { id: "CORRIE", label: "Corrientes", color: "bg-orange-100 border-orange-500", habilitada: true },
    { id: "CHACO", label: "Chaco", color: "bg-pink-100 border-pink-500", habilitada: true },
    { id: "RIONEG", label: "Río Negro", color: "bg-cyan-100 border-cyan-500", habilitada: true },
    { id: "SANTIA", label: "Santiago", color: "bg-lime-100 border-lime-500", habilitada: true },
    { id: "TUCUMA", label: "Tucumán", color: "bg-emerald-100 border-emerald-500", habilitada: true },
    { id: "NEUQUE", label: "Neuquén", color: "bg-violet-100 border-violet-500", habilitada: true },
    { id: "MISION", label: "Misiones", color: "bg-rose-100 border-rose-500", habilitada: true },
]

const formatDate = (date: Date): string => {
    return format(date, "dd/MM/yy HH:mm")
}

export default function CargarJugadas() {
    const [selectedLotteries, setSelectedLotteries] = useState<string[]>([])
    const [selectedSorteo, setSelectedSorteo] = useState<string>("")
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [triplonaApuestas, setTriplonaApuestas] = useState<TriplonaApuesta[]>([])
    const [borratinaApuestas, setBorratinaApuestas] = useState<BorratinaApuesta[]>([])
    const [quintinaApuestas, setQuintinaApuestas] = useState<QuintinaApuesta[]>([])
    const [exactaApuestas, setExactaApuestas] = useState<ExactaApuesta[]>([])
    const [total, setTotal] = useState<number>(0)
    const [secuencia, setSecuencia] = useState<string>("")
    const [activeTab, setActiveTab] = useState<"triplona" | "borratina" | "quintina" | "exacta">("triplona")
    const [exactaNumero, setExactaNumero] = useState("")
    const [exactaPosicion, setExactaPosicion] = useState("")
    const [exactaImporte, setExactaImporte] = useState("")
    const [jugadas, setJugadas] = useState<ExactaJugada[]>(Array(4).fill({ numero: "", posicion: "", importe: "" }))
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
    const [ticketContent, setTicketContent] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Estados para repetir jugada
    const [isRepeatDialogOpen, setIsRepeatDialogOpen] = useState(false)
    const [secuenciaBuscar, setSecuenciaBuscar] = useState("")
    const [isSearching, setIsSearching] = useState(false)

    // Estados para la funcionalidad mejorada
    const [jugadasPasador, setJugadasPasador] = useState<JugadaFirebase[]>([])
    const [isLoadingJugadas, setIsLoadingJugadas] = useState(false)
    const [jugadaSeleccionada, setJugadaSeleccionada] = useState<JugadaFirebase | null>(null)

    // Estados para observación y búsqueda
    const [observacionJugada, setObservacionJugada] = useState<string>("")
    const [nombreObservacionJugada, setNombreObservacionJugada] = useState<string>("")
    const [busquedaObservacion, setBusquedaObservacion] = useState<string>("")

    const numero1Ref = useRef<HTMLInputElement>(null)
    const numero2Ref = useRef<HTMLInputElement>(null)
    const numero3Ref = useRef<HTMLInputElement>(null)
    const borratinaRefs = useRef<(HTMLInputElement | null)[]>(Array(8).fill(null))
    const quintinaRefs = useRef<(HTMLInputElement | null)[]>(Array(5).fill(null))

    const sorteos: { id: string; label: string; color: string }[] = [
        { id: "PREVIA", label: "La Previa", color: "bg-purple-600" },
        { id: "PRIMERA", label: "Primera", color: "bg-blue-600" },
        { id: "MATUTINA", label: "Matutina", color: "bg-yellow-600" },
        { id: "VESPERTINA", label: "Vespertina", color: "bg-orange-600" },
        { id: "NOCTURNA", label: "Nocturna", color: "bg-indigo-600" },
    ]

    useEffect(() => {
        fetchPasadores()
        if (!["MATUTINA", "NOCTURNA"].includes(selectedSorteo)) {
            setSelectedLotteries((prevLotteries) => prevLotteries.filter((lottery) => lottery !== "URUGUA"))
        }
    }, [selectedSorteo])

    const fetchPasadores = async () => {
        try {
            setIsLoading(true)
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
            console.error("Error al obtener pasadores:", error)
            toast.error("No se pudieron cargar los pasadores. Por favor, intente nuevamente.")
        } finally {
            setIsLoading(false)
        }
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

            // Filtrar solo los tipos de jugadas que queremos mostrar
            const tiposPermitidos = ["NUEVA TRIPLONA", "NUEVA QUINTINA", "NUEVA BORRATINA"]
            let jugadasFiltradas = jugadasList.filter((jugada) => jugada.tipo && tiposPermitidos.includes(jugada.tipo))

            // Aplicar filtro de búsqueda por observación si existe
            if (busquedaObservacion.trim()) {
                jugadasFiltradas = jugadasFiltradas.filter(
                    (jugada) =>
                        jugada.observacion && jugada.observacion.toLowerCase().includes(busquedaObservacion.toLowerCase().trim()),
                )
            }

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
                toast.error(`No se encontraron jugadas anteriores de Triplona, Quintina o Borratina para ${pasadorDoc.nombre}.`)
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
            const tiposPermitidos = ["NUEVA TRIPLONA", "NUEVA QUINTINA", "NUEVA BORRATINA"]
            const jugadasFiltradas = jugadasEncontradas.filter((jugada) => tiposPermitidos.includes(jugada.tipo))

            if (jugadasFiltradas.length === 0) {
                toast.error(`La jugada con secuencia "${secuenciaBuscar}" no es de tipo Triplona, Quintina o Borratina.`)
                return
            }

            console.log("🎯 Jugadas encontradas:", jugadasFiltradas)

            // Limpiar jugadas actuales
            resetearCampos()

            // Configurar pasador
            setSelectedPasador(pasadorEncontrado.id)

            let totalCalculado = 0
            let sorteoEncontrado = ""
            let provinciasEncontradas: string[] = []

            // Procesar cada jugada encontrada
            for (const jugada of jugadasFiltradas) {
                console.log("📋 Procesando jugada:", jugada)

                // Configurar sorteo y provincias
                if (jugada.loterias && jugada.loterias.length > 0 && !sorteoEncontrado) {
                    const sorteoOriginal = jugada.loterias[0]
                    const sorteoConvertido = sorteoOriginal === "LAPREVIA" ? "PREVIA" : sorteoOriginal
                    sorteoEncontrado = sorteoConvertido
                    setSelectedSorteo(sorteoConvertido)
                    console.log("🎯 Sorteo configurado:", sorteoConvertido)
                }

                if (jugada.provincias && jugada.provincias.length > 0 && provinciasEncontradas.length === 0) {
                    provinciasEncontradas = jugada.provincias
                    setSelectedLotteries(jugada.provincias)
                    console.log("🌍 Provincias configuradas:", jugada.provincias)
                }

                // Procesar según el tipo de jugada
                if (jugada.tipo === "NUEVA TRIPLONA") {
                    const nuevasTriplonas: TriplonaApuesta[] = []
                    if (jugada.numeros && Array.isArray(jugada.numeros)) {
                        jugada.numeros.forEach((numeroStr: string) => {
                            const numeros = numeroStr.includes(" - ") ? numeroStr.split(" - ") : numeroStr.split("-")
                            if (numeros.length === 3) {
                                nuevasTriplonas.push({
                                    numeros: numeros.map((n) => n.trim()),
                                    loteria: sorteoEncontrado,
                                    provincias: jugada.provincias || [],
                                })
                            }
                        })
                    }
                    setTriplonaApuestas(nuevasTriplonas)
                    totalCalculado += nuevasTriplonas.length * (jugada.provincias?.length || 1) * 50
                    toast.success(
                        `${nuevasTriplonas.length} Triplona(s) cargada(s) en ${jugada.provincias?.length || 0} lotería(s)`,
                    )
                } else if (jugada.tipo === "NUEVA QUINTINA") {
                    const nuevasQuintinas: QuintinaApuesta[] = []
                    if (jugada.numeros && Array.isArray(jugada.numeros)) {
                        jugada.numeros.forEach((numeroStr: string) => {
                            const numeros = numeroStr.split(",").map((n) => n.trim())
                            if (numeros.length === 5) {
                                nuevasQuintinas.push({
                                    numeros: numeros,
                                    loteria: sorteoEncontrado,
                                    provincias: jugada.provincias || [],
                                })
                            }
                        })
                    }
                    setQuintinaApuestas(nuevasQuintinas)
                    totalCalculado += nuevasQuintinas.length * (jugada.provincias?.length || 1) * 100
                    toast.success(
                        `${nuevasQuintinas.length} Quintina(s) cargada(s) en ${jugada.provincias?.length || 0} lotería(s)`,
                    )
                } else if (jugada.tipo === "NUEVA BORRATINA") {
                    const nuevasBorratinas: BorratinaApuesta[] = []
                    if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                        jugada.jugadas.forEach((borratina: any) => {
                            if (borratina.numeros && Array.isArray(borratina.numeros) && borratina.numeros.length === 8) {
                                nuevasBorratinas.push({
                                    numeros: borratina.numeros,
                                    loteria: sorteoEncontrado,
                                })
                            }
                        })
                    }
                    setBorratinaApuestas(nuevasBorratinas)
                    totalCalculado += nuevasBorratinas.length * 30
                    toast.success(`${nuevasBorratinas.length} Borratina(s) cargada(s)`)
                }
            }

            setTotal(totalCalculado)
            const tiposEncontrados = jugadasFiltradas.map((j) => j.tipo).join(", ")
            const loteriasTexto = provinciasEncontradas.join(", ")

            console.log("🎉 Búsqueda completada exitosamente")
            console.log("📋 Resumen:")
            console.log("- Tipos:", tiposEncontrados)
            console.log("- Sorteo:", sorteoEncontrado)
            console.log("- Loterías:", loteriasTexto)
            console.log("- Total:", totalCalculado)

            toast.success(
                `Jugada encontrada y cargada. Sorteo: ${sorteoEncontrado}. Loterías: ${loteriasTexto}. Total: $${totalCalculado.toFixed(2)}`,
            )

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
            console.log("📋 Datos completos de la jugada:", jugadaSeleccionada)

            // PASO 1: Limpiar SOLO las jugadas, NO el sorteo ni las loterías
            setTriplonaApuestas([])
            setBorratinaApuestas([])
            setQuintinaApuestas([])
            setExactaApuestas([])
            setObservacionJugada("")
            setNombreObservacionJugada("")

            // PASO 2: Configurar sorteo desde loterias[0]
            let sorteoConfiguracion = ""
            if (jugadaSeleccionada.loterias && jugadaSeleccionada.loterias.length > 0) {
                const sorteoOriginal = jugadaSeleccionada.loterias[0]
                sorteoConfiguracion = sorteoOriginal === "LAPREVIA" ? "PREVIA" : sorteoOriginal
                console.log("🎯 Configurando sorteo:", sorteoConfiguracion)
            }

            // PASO 3: Configurar las provincias/loterías desde provincias
            const provinciasJugada = jugadaSeleccionada.provincias || []
            console.log("🌍 Configurando provincias:", provinciasJugada)

            // PASO 4: Aplicar configuración de forma síncrona
            setSelectedSorteo(sorteoConfiguracion)
            setSelectedLotteries(provinciasJugada)

            let totalCalculado = 0
            const nuevasTriplonas: TriplonaApuesta[] = []
            const nuevasQuintinas: QuintinaApuesta[] = []
            const nuevasBorratinas: BorratinaApuesta[] = []

            // PASO 5: Procesar según el tipo de jugada
            if (jugadaSeleccionada.tipo === "NUEVA TRIPLONA") {
                console.log("🔢 Procesando TRIPLONA")
                console.log("📊 Números array:", jugadaSeleccionada.numeros)

                if (jugadaSeleccionada.numeros && Array.isArray(jugadaSeleccionada.numeros)) {
                    jugadaSeleccionada.numeros.forEach((numeroStr: string, index: number) => {
                        console.log(`🎲 Procesando número ${index + 1}:`, numeroStr)
                        const numeros = numeroStr.includes(" - ") ? numeroStr.split(" - ") : numeroStr.split("-")
                        if (numeros.length === 3) {
                            const numerosLimpios = numeros.map((n) => n.trim())
                            console.log("✅ Números procesados:", numerosLimpios)
                            nuevasTriplonas.push({
                                numeros: numerosLimpios,
                                loteria: sorteoConfiguracion,
                                provincias: provinciasJugada,
                            })
                        }
                    })
                }

                setTriplonaApuestas(nuevasTriplonas)
                totalCalculado = nuevasTriplonas.length * provinciasJugada.length * 50
                console.log(
                    `💰 Total Triplona: ${nuevasTriplonas.length} × ${provinciasJugada.length} × 50 = ${totalCalculado}`,
                )
                toast.success(
                    `${nuevasTriplonas.length} Triplona(s) cargada(s) en ${provinciasJugada.length} lotería(s): ${provinciasJugada.join(", ")}`,
                )
            } else if (jugadaSeleccionada.tipo === "NUEVA QUINTINA") {
                console.log("🔢 Procesando QUINTINA")
                console.log("📊 Números array:", jugadaSeleccionada.numeros)

                if (jugadaSeleccionada.numeros && Array.isArray(jugadaSeleccionada.numeros)) {
                    jugadaSeleccionada.numeros.forEach((numeroStr: string, index: number) => {
                        console.log(`🎲 Procesando quintina ${index + 1}:`, numeroStr)
                        const numeros = numeroStr.split(",").map((n) => n.trim())
                        if (numeros.length === 5) {
                            console.log("✅ Números procesados:", numeros)
                            nuevasQuintinas.push({
                                numeros: numeros,
                                loteria: sorteoConfiguracion,
                                provincias: provinciasJugada,
                            })
                        }
                    })
                }

                setQuintinaApuestas(nuevasQuintinas)
                totalCalculado = nuevasQuintinas.length * provinciasJugada.length * 100
                console.log(
                    `💰 Total Quintina: ${nuevasQuintinas.length} × ${provinciasJugada.length} × 100 = ${totalCalculado}`,
                )
                toast.success(
                    `${nuevasQuintinas.length} Quintina(s) cargada(s) en ${provinciasJugada.length} lotería(s): ${provinciasJugada.join(", ")}`,
                )
            } else if (jugadaSeleccionada.tipo === "NUEVA BORRATINA") {
                console.log("🔢 Procesando BORRATINA")
                console.log("📊 Jugadas array:", jugadaSeleccionada.jugadas)

                if (jugadaSeleccionada.jugadas && Array.isArray(jugadaSeleccionada.jugadas)) {
                    jugadaSeleccionada.jugadas.forEach((borratina: any, index: number) => {
                        console.log(`🎲 Procesando borratina ${index + 1}:`, borratina)
                        if (borratina.numeros && Array.isArray(borratina.numeros) && borratina.numeros.length === 8) {
                            console.log("✅ Números procesados:", borratina.numeros)
                            nuevasBorratinas.push({
                                numeros: borratina.numeros,
                                loteria: sorteoConfiguracion,
                            })
                        }
                    })
                }

                setBorratinaApuestas(nuevasBorratinas)
                totalCalculado = nuevasBorratinas.length * 30
                console.log(`💰 Total Borratina: ${nuevasBorratinas.length} × 30 = ${totalCalculado}`)
                toast.success(`${nuevasBorratinas.length} Borratina(s) cargada(s)`)
            }

            // PASO 6: Establecer el total calculado
            setTotal(totalCalculado)
            console.log("💰 Total final establecido:", totalCalculado)

            // PASO 7: Cerrar el diálogo
            setIsRepeatDialogOpen(false)
            setJugadaSeleccionada(null)
            setJugadasPasador([])

            // PASO 8: Esperar un momento para que React actualice la UI
            await new Promise((resolve) => setTimeout(resolve, 100))

            // PASO 9: Generar y mostrar el ticket automáticamente con los datos correctos
            const nuevaSecuencia = generarSecuencia()
            setSecuencia(nuevaSecuencia)

            // Esperar otro momento para asegurar que el estado se haya actualizado
            await new Promise((resolve) => setTimeout(resolve, 100))

            const ticketContent = generarContenidoTicket(nuevaSecuencia)
            imprimirTicket(ticketContent)

            // PASO 10: Mostrar resumen final
            const loteriasTexto = provinciasJugada.length > 0 ? provinciasJugada.join(", ") : "Sin loterías"
            console.log("🎉 Jugada cargada exitosamente")
            console.log("📋 Resumen final:")
            console.log("- Sorteo:", sorteoConfiguracion)
            console.log("- Loterías:", loteriasTexto)
            console.log("- Total:", totalCalculado)
            console.log("- Ticket generado con secuencia:", nuevaSecuencia)

            toast.success(
                `¡Jugada repetida exitosamente! Sorteo: ${sorteoConfiguracion}. Loterías: ${loteriasTexto}. Total: $${totalCalculado.toFixed(2)}. Ticket generado.`,
            )
        } catch (error) {
            console.error("❌ Error al cargar jugada:", error)
            toast.error("Error al cargar la jugada seleccionada.")
        }
    }

    const formatearFecha = (fecha: Date) => {
        return format(fecha, "dd/MM/yy HH:mm")
    }

    const obtenerResumenJugada = (jugada: JugadaFirebase) => {
        let resumen = ""
        let total = 0
        let numerosJugados: string[] = []
        let loteriasApostadas = ""

        // Obtener el sorteo desde loterias[0]
        let sorteoJugada = "Sin especificar"
        if (jugada.loterias && jugada.loterias.length > 0) {
            const sorteoOriginal = jugada.loterias[0]
            // Convertir nombres de sorteos si es necesario
            if (sorteoOriginal === "LAPREVIA") {
                sorteoJugada = "PREVIA"
            } else {
                sorteoJugada = sorteoOriginal
            }
        }

        // Obtener las loterías apostadas desde provincias
        if (jugada.provincias && jugada.provincias.length > 0) {
            // Convertir códigos de provincias a nombres completos
            const provinciasNombres = jugada.provincias.map((provincia) => {
                const loteria = loterias.find((l) => l.id === provincia)
                return loteria ? loteria.label : provincia
            })
            loteriasApostadas = provinciasNombres.join(", ")
        } else {
            // Si no hay provincias específicas, verificar si es borratina
            if (jugada.tipo === "NUEVA BORRATINA") {
                loteriasApostadas = "Todas las loterías"
            } else {
                loteriasApostadas = "Sin loterías especificadas"
            }
        }

        // Procesar según el tipo de jugada
        if (jugada.tipo === "NUEVA TRIPLONA") {
            let cantidad = 0
            if (jugada.numeros && Array.isArray(jugada.numeros)) {
                cantidad = jugada.numeros.length
                numerosJugados = jugada.numeros.map((numeroStr: string) => {
                    return numeroStr.replace(/ - /g, "-")
                })
            } else if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                cantidad = jugada.jugadas.length
                numerosJugados = jugada.jugadas
                    .map((j: any) => {
                        if (j.numeros && Array.isArray(j.numeros)) {
                            return j.numeros.join("-")
                        }
                        return ""
                    })
                    .filter(Boolean)
            }

            resumen = `${cantidad} Triplona(s)`
            if (jugada.totalMonto) {
                total = jugada.totalMonto
            } else if (jugada.montoTotal) {
                total = typeof jugada.montoTotal === "string" ? Number.parseFloat(jugada.montoTotal) : jugada.montoTotal
            } else {
                total = cantidad * (jugada.provincias?.length || 1) * 50
            }
        } else if (jugada.tipo === "NUEVA QUINTINA") {
            let cantidad = 0
            if (jugada.numeros && Array.isArray(jugada.numeros)) {
                cantidad = jugada.numeros.length
                numerosJugados = jugada.numeros.map((numeroStr: string) => {
                    return numeroStr.replace(/,/g, "-")
                })
            } else if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                cantidad = jugada.jugadas.length
                numerosJugados = jugada.jugadas
                    .map((j: any) => {
                        if (j.numeros && Array.isArray(j.numeros)) {
                            return j.numeros.join("-")
                        }
                        return ""
                    })
                    .filter(Boolean)
            }

            resumen = `${cantidad} Quintina(s)`
            if (jugada.totalMonto) {
                total = jugada.totalMonto
            } else {
                total = cantidad * (jugada.provincias?.length || 1) * 100
            }
        } else if (jugada.tipo === "NUEVA BORRATINA") {
            let cantidad = 0
            if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                cantidad = jugada.jugadas.length
                numerosJugados = jugada.jugadas
                    .map((j: any) => {
                        if (j.numeros && Array.isArray(j.numeros)) {
                            return j.numeros.join("-")
                        }
                        return ""
                    })
                    .filter(Boolean)
            } else if (jugada.numeros && Array.isArray(jugada.numeros)) {
                cantidad = jugada.numeros.length
                numerosJugados = jugada.numeros
            }

            resumen = `${cantidad} Borratina(s)`
            if (jugada.totalMonto) {
                total = jugada.totalMonto
            } else {
                total = cantidad * 30
            }
        } else if (jugada.tipo === "NUEVA EXACTA") {
            let cantidad = 0
            if (jugada.jugadas && Array.isArray(jugada.jugadas)) {
                cantidad = jugada.jugadas.length
                numerosJugados = jugada.jugadas
                    .map((j: any) => {
                        return `${j.numero || ""}-Pos:${j.posicion || ""}-$${j.importe || ""}`
                    })
                    .filter(Boolean)
            }

            resumen = `${cantidad} Exacta(s)`
            total = jugada.totalMonto || 0
        }

        return {
            resumen,
            total: Number(total) || 0,
            numerosJugados,
            loteriasApostadas,
            sorteoJugada, // Agregar el sorteo al retorno
        }
    }

    const handleTriplonaInput = (
        e: React.ChangeEvent<HTMLInputElement>,
        nextRef: React.RefObject<HTMLInputElement> | null,
    ) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value

        if (value.length === 2 && nextRef && nextRef.current) {
            nextRef.current.focus()
        }

        if (value.length === 2 && !nextRef) {
            agregarTriplona()
        }
    }

    const handleBorratinaInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value

        if (value.length === 2) {
            const isRepeated = borratinaRefs.current.some((ref, i) => i !== index && ref?.value === value)

            if (isRepeated) {
                e.target.value = ""
                toast.error("Este número ya ha sido ingresado. Por favor, elija otro.")
                return
            }

            if (index < 7 && borratinaRefs.current[index + 1]) {
                borratinaRefs.current[index + 1]?.focus()
            } else if (index === 7) {
                agregarBorratina()
            }
        }
    }

    const handleQuintinaInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value

        if (value.length === 2) {
            if (index < 4 && quintinaRefs.current[index + 1]) {
                quintinaRefs.current[index + 1]?.focus()
            } else if (index === 4) {
                agregarQuintina()
            }
        }
    }

    const agregarTriplona = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numero1 = numero1Ref.current?.value || ""
        const numero2 = numero2Ref.current?.value || ""
        const numero3 = numero3Ref.current?.value || ""

        if (numero1.length !== 2 || numero2.length !== 2 || numero3.length !== 2) {
            toast.error("Por favor, ingrese tres números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: TriplonaApuesta = {
            numeros: [numero1, numero2, numero3],
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setTriplonaApuestas([...triplonaApuestas, nuevaApuesta])
        setTotal(total + selectedLotteries.length * 50)
        toast.success("Triplona agregada correctamente")

        if (numero1Ref.current) numero1Ref.current.value = ""
        if (numero2Ref.current) numero2Ref.current.value = ""
        if (numero3Ref.current) numero3Ref.current.value = ""
        if (numero1Ref.current) numero1Ref.current.focus()
    }

    const agregarBorratina = () => {
        if (!selectedPasador || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = borratinaRefs.current.map((ref) => ref?.value || "")

        if (numeros.some((num) => num.length !== 2)) {
            toast.error("Por favor, ingrese ocho números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: BorratinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
        }

        setBorratinaApuestas([...borratinaApuestas, nuevaApuesta])
        setTotal(total + 30)
        toast.success("Borratina agregada correctamente")

        borratinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (borratinaRefs.current[0]) borratinaRefs.current[0].focus()
    }

    const agregarQuintina = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = quintinaRefs.current.map((ref) => ref?.value || "")

        if (numeros.some((num) => num.length !== 2)) {
            toast.error("Por favor, ingrese cinco números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: QuintinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setQuintinaApuestas([...quintinaApuestas, nuevaApuesta])
        setTotal(total + selectedLotteries.length * 100)
        toast.success("Quintina agregada correctamente")

        quintinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (quintinaRefs.current[0]) quintinaRefs.current[0].focus()
    }

    const eliminarTriplona = (index: number) => {
        const apuestaEliminada = triplonaApuestas[index]
        setTriplonaApuestas(triplonaApuestas.filter((_, i) => i !== index))
        setTotal(total - apuestaEliminada.provincias.length * 50)
        toast.success("Triplona eliminada")
    }

    const eliminarBorratina = (index: number) => {
        setBorratinaApuestas(borratinaApuestas.filter((_, i) => i !== index))
        setTotal(total - 30)
        toast.success("Borratina eliminada")
    }

    const eliminarQuintina = (index: number) => {
        const apuestaEliminada = quintinaApuestas[index]
        setQuintinaApuestas(quintinaApuestas.filter((_, i) => i !== index))
        setTotal(total - apuestaEliminada.provincias.length * 100)
        toast.success("Quintina eliminada")
    }

    const agregarExacta = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        if (
            exactaNumero.length < 2 ||
            exactaNumero.length > 4 ||
            !["1", "5", "10", "20"].includes(exactaPosicion) ||
            !exactaImporte
        ) {
            toast.error("Por favor, ingrese un número de 2 a 4 dígitos, una posición válida (1, 5, 10 o 20) y un importe.")
            return
        }

        const nuevaApuesta: ExactaApuesta = {
            numero: exactaNumero,
            posicion: exactaPosicion,
            importe: exactaImporte,
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        const montoTotal = Number.parseFloat(exactaImporte) * selectedLotteries.length
        setExactaApuestas([...exactaApuestas, nuevaApuesta])
        setTotal(total + montoTotal)
        toast.success("Exacta agregada correctamente")

        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
    }

    const eliminarExacta = (index: number) => {
        const apuestaEliminada = exactaApuestas[index]
        setExactaApuestas(exactaApuestas.filter((_, i) => i !== index))
        const montoEliminado = Number.parseFloat(apuestaEliminada.importe) * apuestaEliminada.provincias.length
        setTotal(total - montoEliminado)
        toast.success("Exacta eliminada")
    }

    const generarSecuencia = (): string => {
        return Date.now().toString()
    }

    // FUNCIÓN CORREGIDA PARA GENERAR EL CONTENIDO DEL TICKET
    const generarContenidoTicket = (secuenciaParam?: string) => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            console.error("Pasador no encontrado")
            return ""
        }

        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005"
        const secuenciaTicket = secuenciaParam || generarSecuencia()

        // Encabezado del ticket
        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"

        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo
        ticketContent += `${loteriaAbreviada}\n`
        ticketContent += `SECUENCIA  ${secuenciaTicket}\n`

        // TRIPLONA - Con provincias y números
        if (triplonaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA TRIPLONA ****\n"

            // Mostrar las loterías donde se juega
            const provinciasTriplona = triplonaApuestas[0].provincias || selectedLotteries
            if (provinciasTriplona.length > 0) {
                const provinciasAbreviadas = provinciasTriplona.map((l) => provinceAbbreviations[l] || l)
                ticketContent += `LOTERIAS: ${provinciasAbreviadas.join(" ")}\n`
            }

            // Mostrar cada triplona con sus números
            triplonaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                ticketContent += `${numerosFormateados}   $50.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            const totalTriplona = triplonaApuestas.length * 50 * provinciasTriplona.length
            ticketContent += `TOTAL: $${totalTriplona.toFixed(2)}\n\n`
        }

        // BORRATINA - Con números (las borratinas van en todas las loterías)
        if (borratinaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA BORRATINA ****\n"
            ticketContent += "LOTERIAS: TODAS\n"

            // Mostrar cada borratina con sus números
            borratinaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                ticketContent += `${numerosFormateados}   $30.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            const totalBorratina = borratinaApuestas.length * 30
            ticketContent += `TOTAL: $${totalBorratina.toFixed(2)}\n\n`
        }

        // QUINTINA - Con provincias y números
        if (quintinaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA QUINTINA ****\n"

            // Mostrar las loterías donde se juega
            const provinciasQuintina = quintinaApuestas[0].provincias || selectedLotteries
            if (provinciasQuintina.length > 0) {
                const provinciasAbreviadas = provinciasQuintina.map((l) => provinceAbbreviations[l] || l)
                ticketContent += `LOTERIAS: ${provinciasAbreviadas.join(" ")}\n`
            }

            // Mostrar cada quintina con sus números
            quintinaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                ticketContent += `${numerosFormateados}   $100.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            const totalQuintina = quintinaApuestas.length * 100 * provinciasQuintina.length
            ticketContent += `TOTAL: $${totalQuintina.toFixed(2)}\n\n`
        }

        // EXACTA - Con provincias, números, posiciones e importes
        if (exactaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA EXACTA ****\n"

            // Mostrar las loterías donde se juega
            const provinciasExacta = exactaApuestas[0].provincias || selectedLotteries
            if (provinciasExacta.length > 0) {
                const provinciasAbreviadas = provinciasExacta.map((l) => provinceAbbreviations[l] || l)
                ticketContent += `LOTERIAS: ${provinciasAbreviadas.join(" ")}\n`
            }

            ticketContent += "NUMERO UBIC   IMPORTE\n"

            // Mostrar cada exacta con número, posición e importe
            exactaApuestas.forEach((apuesta) => {
                const numero = apuesta.numero.padStart(4, "0")
                const posicion = apuesta.posicion.padStart(2, " ")
                const importe = Number.parseFloat(apuesta.importe) || 0
                ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            const totalExacta = exactaApuestas.reduce(
                (acc, apuesta) => acc + Number.parseFloat(apuesta.importe) * apuesta.provincias.length,
                0,
            )
            ticketContent += `TOTAL: $${totalExacta.toFixed(2)}\n\n`
        }

        // Total general
        ticketContent += "=".repeat(32) + "\n"
        ticketContent += `TOTAL GENERAL: $${total.toFixed(2)}`.padStart(32) + "\n"

        return ticketContent
    }

    const imprimirTicket = (ticketContent: string) => {
        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)
    }

    const imprimirEnTermica = async () => {
        try {
            const printWindow = window.open("", "_blank")
            if (!printWindow) {
                toast.error("No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.")
                return
            }

            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket de Jugada</title>
            <style>
              body {
                font-family: monospace;
                font-size: 12px;
                width: 80mm;
                margin: 0;
                padding: 0;
              }
              pre {
                white-space: pre-wrap;
                margin: 0;
                padding: 5px;
              }
              @media print {
                body {
                  width: 100%;
                }
                @page {
                  size: 80mm auto;
                  margin: 0mm;
                }
              }
            }
          </style>
          </head>
          <body>
            <pre>${ticketContent}</pre>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `)

            printWindow.document.close()
        } catch (error) {
            console.error("Error al imprimir:", error)
            toast.error("Error al imprimir el ticket")
        }
    }

    const compartirTicket = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: "Ticket de Jugada",
                    text: ticketContent,
                })
            } else {
                await navigator.clipboard.writeText(ticketContent)
                toast.success("Ticket copiado al portapapeles")
            }
        } catch (error) {
            console.error("Error al compartir:", error)
            toast.error("Error al compartir el ticket")
        }
    }

    const resetearCampos = () => {
        setTriplonaApuestas([])
        setBorratinaApuestas([])
        setQuintinaApuestas([])
        setExactaApuestas([])
        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
        setSelectedLotteries([])
        setSelectedSorteo("")
        setSelectedPasador("")
        setObservacionJugada("")
        setNombreObservacionJugada("") // Agregar esta línea
        setTotal(0)
        toast.success("Formulario reiniciado")
    }

    const guardarJugadas = async () => {
        if (
            triplonaApuestas.length === 0 &&
            borratinaApuestas.length === 0 &&
            quintinaApuestas.length === 0 &&
            exactaApuestas.length === 0
        ) {
            toast.error("No hay jugadas para guardar.")
            return
        }

        try {
            setIsSaving(true)
            console.log("Iniciando proceso de guardar jugadas")

            const pasadorDoc = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorDoc) {
                throw new Error("Error: Pasador no encontrado.")
            }

            const jugadasCollection = collection(db, `JUGADAS DE ${pasadorDoc.nombre}`)
            const nuevaSecuencia = generarSecuencia()
            setSecuencia(nuevaSecuencia)

            const fechaHoraISO = new Date().toISOString()

            const guardarJugadasPorTipo = async (tipo: string, apuestas: any[], observacion = "", nombreObservacion = "") => {
                if (apuestas.length === 0) return

                if (tipo === "NUEVA QUINTINA") {
                    const nuevaJugada: any = {
                        fechaHora: serverTimestamp(),
                        id: nuevaSecuencia,
                        loterias: [selectedSorteo],
                        numeros: apuestas.map((a) => a.numeros.join(",")),
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA QUINTINA",
                        totalMonto: apuestas.length * selectedLotteries.length * 100,
                        observacion: observacion,
                        nombreObservacion: nombreObservacion, // Agregar esta línea
                        jugadas: apuestas.map((a) => ({ numeros: a.numeros })),
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugada NUEVA QUINTINA guardada con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA TRIPLONA") {
                    const nuevaJugada: any = {
                        fechaHora: serverTimestamp(),
                        id: nuevaSecuencia,
                        loterias: [selectedSorteo],
                        montoTotal: (apuestas.length * selectedLotteries.length * 50).toString(),
                        numeros: apuestas.map((a) => a.numeros.join(" - ")),
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA TRIPLONA",
                        observacion: observacion,
                        nombreObservacion: nombreObservacion, // Agregar esta línea
                        jugadas: apuestas.map((a) => ({ numeros: a.numeros })),
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugada NUEVA TRIPLONA guardada con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA BORRATINA") {
                    const nuevaJugada: any = {
                        fechaHora: fechaHoraISO,
                        loterias: [selectedSorteo],
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA BORRATINA",
                        totalMonto: apuestas.length * 30,
                        observacion: observacion,
                        nombreObservacion: nombreObservacion, // Agregar esta línea
                        jugadas: apuestas.map((d: BorratinaApuesta) => ({
                            numeros: d.numeros,
                        })),
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugadas NUEVA BORRATINA guardadas con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA EXACTA") {
                    const nuevaJugada: any = {
                        fechaHora: fechaHoraISO,
                        loterias: [selectedSorteo],
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA EXACTA",
                        totalMonto: apuestas.reduce(
                            (acc: number, d: ExactaApuesta) => acc + Number.parseFloat(d.importe) * selectedLotteries.length,
                            0,
                        ),
                        jugadas: apuestas.map((d: ExactaApuesta) => ({
                            numero: d.numero,
                            posicion: d.posicion,
                            importe: d.importe,
                        })),
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugadas NUEVA EXACTA guardadas con ID: ${docRef.id}`)
                }
            }

            await guardarJugadasPorTipo("NUEVA TRIPLONA", triplonaApuestas, observacionJugada, nombreObservacionJugada)
            await guardarJugadasPorTipo("NUEVA BORRATINA", borratinaApuestas, observacionJugada, nombreObservacionJugada)
            await guardarJugadasPorTipo("NUEVA QUINTINA", quintinaApuestas, observacionJugada, nombreObservacionJugada)
            await guardarJugadasPorTipo("NUEVA EXACTA", exactaApuestas, "", nombreObservacionJugada)

            const ticketContent = generarContenidoTicket(nuevaSecuencia)
            imprimirTicket(ticketContent)

            resetearCampos()
            toast.success("Jugadas guardadas exitosamente")
        } catch (error) {
            console.error("Error detallado al guardar las jugadas:", error)
            if (error instanceof Error) {
                toast.error(`Error al guardar las jugadas: ${error.message}`)
            } else {
                toast.error("Error desconocido al guardar las jugadas. Por favor, intente nuevamente.")
            }
        } finally {
            setIsSaving(false)
        }
    }

    const getSorteoColor = () => {
        const sorteo = sorteos.find((s) => s.id === selectedSorteo)
        return sorteo?.color || "bg-gray-600"
    }

    return (
        <>
            <Navbar />
            <div className="container mx-auto p-4 bg-gray-50 min-h-screen">
                <div className="grid gap-6">
                    {/* Encabezado */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
                        <h1 className="text-2xl font-bold mb-2">Sistema de Carga de Jugadas</h1>
                        <p className="opacity-90">Complete los datos y agregue las jugadas para generar el ticket</p>
                    </div>

                    {/* Selección de sorteo, pasador y loterías */}
                    <Card className="shadow-md border-t-4 border-t-blue-500">
                        <CardHeader className="bg-gray-50 pb-2">
                            <CardTitle className="text-lg font-medium flex items-center">
                                <span className="mr-2">Configuración de la Jugada</span>
                                {selectedSorteo && (
                                    <Badge className={`${getSorteoColor()} text-white ml-2`}>
                                        {sorteos.find((s) => s.id === selectedSorteo)?.label || selectedSorteo}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <Label htmlFor="sorteo" className="mb-2 block text-sm font-medium">
                                        SORTEO:
                                    </Label>
                                    <Select value={selectedSorteo} onValueChange={setSelectedSorteo}>
                                        <SelectTrigger id="sorteo" className="w-full">
                                            <SelectValue placeholder="Seleccionar sorteo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sorteos.map((sorteo) => (
                                                <SelectItem key={sorteo.id} value={sorteo.id} className="flex items-center">
                                                    <div className="flex items-center">
                                                        <div className={`w-3 h-3 rounded-full ${sorteo.color} mr-2`}></div>
                                                        {sorteo.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="pasador" className="mb-2 block text-sm font-medium">
                                        PASADOR:
                                    </Label>
                                    <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                        <SelectTrigger id="pasador" className="w-full">
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

                            <div className="mb-6">
                                <Label className="mb-2 block text-sm font-medium">LOTERÍAS:</Label>
                                <div
                                    className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ${activeTab === "borratina" ? "opacity-50" : ""}`}
                                >
                                    {loterias.map((loteria) => (
                                        <div
                                            key={loteria.id}
                                            className={`flex items-center space-x-2 p-2 rounded-md border ${selectedLotteries.includes(loteria.id) ? loteria.color : "bg-white border-gray-200"
                                                } ${!loteria.habilitada || (loteria.id === "URUGUA" && !["MATUTINA", "NOCTURNA"].includes(selectedSorteo)) || activeTab === "borratina" ? "opacity-50" : ""}`}
                                        >
                                            <Checkbox
                                                id={loteria.id}
                                                checked={selectedLotteries.includes(loteria.id)}
                                                onCheckedChange={(checked) => {
                                                    if (activeTab !== "borratina") {
                                                        if (checked) {
                                                            setSelectedLotteries([...selectedLotteries, loteria.id])
                                                        } else {
                                                            setSelectedLotteries(selectedLotteries.filter((id) => id !== loteria.id))
                                                        }
                                                    }
                                                }}
                                                disabled={
                                                    activeTab === "borratina" ||
                                                    (loteria.id === "URUGUA" && !["MATUTINA", "NOCTURNA"].includes(selectedSorteo))
                                                }
                                                className={selectedLotteries.includes(loteria.id) ? "border-blue-500 text-blue-500" : ""}
                                            />
                                            <Label htmlFor={loteria.id} className="text-sm cursor-pointer">
                                                {loteria.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs para diferentes tipos de jugadas */}
                    <Card className="shadow-md">
                        <CardContent className="p-0">
                            <Tabs
                                defaultValue="triplona"
                                className="w-full"
                                onValueChange={(value) => setActiveTab(value as "triplona" | "borratina" | "quintina" | "exacta")}
                            >
                                <TabsList className="w-full grid grid-cols-4 rounded-none">
                                    <TabsTrigger
                                        value="triplona"
                                        className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800"
                                    >
                                        Nueva Triplona
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="borratina"
                                        className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800"
                                    >
                                        Nueva Borratina
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="quintina"
                                        className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
                                    >
                                        Nueva Quintina
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="exacta"
                                        className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800"
                                    >
                                        Nueva Exacta
                                    </TabsTrigger>
                                </TabsList>

                                <div className="p-4">
                                    <TabsContent value="triplona" className="mt-0">
                                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
                                            <h3 className="text-lg font-semibold text-purple-800 mb-3">Nueva Triplona</h3>
                                            <div className="flex space-x-2 mb-4">
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero1Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 1"
                                                        onChange={(e) => handleTriplonaInput(e, numero2Ref)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">1</span>
                                                </div>
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero2Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 2"
                                                        onChange={(e) => handleTriplonaInput(e, numero3Ref)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">2</span>
                                                </div>
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero3Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 3"
                                                        onChange={(e) => handleTriplonaInput(e, null)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">3</span>
                                                </div>
                                            </div>
                                            <Button onClick={agregarTriplona} className="w-full bg-purple-600 hover:bg-purple-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Triplona
                                            </Button>
                                        </div>

                                        {triplonaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Triplonas Agregadas</span>
                                                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                                                        {triplonaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {triplonaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-purple-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarTriplona(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="borratina" className="mt-0">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                                            <h3 className="text-lg font-semibold text-blue-800 mb-3">Nueva Borratina</h3>
                                            <div className="grid grid-cols-4 gap-2 mb-4">
                                                {Array(8)
                                                    .fill(null)
                                                    .map((_, index) => (
                                                        <div key={index} className="relative">
                                                            <Input
                                                                ref={(el: HTMLInputElement | null) => {
                                                                    if (el) borratinaRefs.current[index] = el
                                                                }}
                                                                className="pl-8 bg-white border-blue-300 focus:border-blue-500"
                                                                maxLength={2}
                                                                placeholder={`Nº ${index + 1}`}
                                                                onChange={(e) => handleBorratinaInput(e, index)}
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 font-bold">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                            <Button onClick={agregarBorratina} className="w-full bg-blue-600 hover:bg-blue-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Borratina
                                            </Button>
                                        </div>

                                        {borratinaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Borratinas Agregadas</span>
                                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                                        {borratinaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {borratinaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-blue-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarBorratina(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="quintina" className="mt-0">
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                                            <h3 className="text-lg font-semibold text-green-800 mb-3">Nueva Quintina</h3>
                                            <div className="grid grid-cols-5 gap-2 mb-4">
                                                {Array(5)
                                                    .fill(null)
                                                    .map((_, index) => (
                                                        <div key={index} className="relative">
                                                            <Input
                                                                ref={(el: HTMLInputElement | null) => {
                                                                    if (el) quintinaRefs.current[index] = el
                                                                }}
                                                                className="pl-8 bg-white border-green-300 focus:border-green-500"
                                                                maxLength={2}
                                                                placeholder={`Nº ${index + 1}`}
                                                                onChange={(e) => handleQuintinaInput(e, index)}
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-500 font-bold">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                            <Button onClick={agregarQuintina} className="w-full bg-green-600 hover:bg-green-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Quintina
                                            </Button>
                                        </div>

                                        {quintinaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Quintinas Agregadas</span>
                                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                                        {quintinaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {quintinaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-green-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarQuintina(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="exacta" className="mt-0">
                                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                                            <h3 className="text-lg font-semibold text-amber-800 mb-3">Nueva Exacta</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div>
                                                    <Label htmlFor="exacta-numero" className="text-amber-800">
                                                        Número
                                                    </Label>
                                                    <Input
                                                        id="exacta-numero"
                                                        value={exactaNumero}
                                                        onChange={(e) => setExactaNumero(e.target.value.replace(/\D/g, ""))}
                                                        maxLength={4}
                                                        className="bg-white border-amber-300 focus:border-amber-500"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="exacta-posicion" className="text-amber-800">
                                                        Posición
                                                    </Label>
                                                    <Select value={exactaPosicion} onValueChange={setExactaPosicion}>
                                                        <SelectTrigger
                                                            id="exacta-posicion"
                                                            className="bg-white border-amber-300 focus:border-amber-500"
                                                        >
                                                            <SelectValue placeholder="Seleccionar posición" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {["1", "5", "10", "20"].map((pos) => (
                                                                <SelectItem key={pos} value={pos}>
                                                                    {pos}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label htmlFor="exacta-importe" className="text-amber-800">
                                                        Importe
                                                    </Label>
                                                    <Input
                                                        id="exacta-importe"
                                                        value={exactaImporte}
                                                        onChange={(e) => setExactaImporte(e.target.value.replace(/\D/g, ""))}
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        className="bg-white border-amber-300 focus:border-amber-500"
                                                    />
                                                </div>
                                            </div>
                                            <Button onClick={agregarExacta} className="w-full bg-amber-600 hover:bg-amber-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Exacta
                                            </Button>
                                        </div>

                                        {exactaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Exactas Agregadas</span>
                                                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                                        {exactaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {exactaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-amber-700">
                                                                        Número: {apuesta.numero} - Pos: {apuesta.posicion} - ${apuesta.importe}
                                                                    </span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarExacta(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Resumen y acciones */}
                    <Card className="shadow-md border-t-4 border-t-green-500">
                        <CardHeader className="bg-gray-50 pb-2">
                            <CardTitle className="text-lg font-medium">Resumen de Jugadas</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
                                    <h4 className="text-sm font-medium text-purple-800">Triplonas</h4>
                                    <p className="text-2xl font-bold text-purple-700">{triplonaApuestas.length}</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg border border-blue-200">
                                    <h4 className="text-sm font-medium text-blue-800">Borratinas</h4>
                                    <p className="text-2xl font-bold text-blue-700">{borratinaApuestas.length}</p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg border border-green-200">
                                    <h4 className="text-sm font-medium text-green-800">Quintinas</h4>
                                    <p className="text-2xl font-bold text-green-700">{quintinaApuestas.length}</p>
                                </div>
                                <div className="bg-amber-100 p-3 rounded-lg border border-amber-200">
                                    <h4 className="text-sm font-medium text-amber-800">Exactas</h4>
                                    <p className="text-2xl font-bold text-amber-700">{exactaApuestas.length}</p>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            <div className="mb-4">
                                <Label htmlFor="observacion" className="text-sm font-medium mb-2 block">
                                    Observación (opcional):
                                </Label>
                                <Input
                                    id="observacion"
                                    value={observacionJugada}
                                    onChange={(e) => setObservacionJugada(e.target.value)}
                                    placeholder="Ej: Números de la suerte, Cumpleaños, etc."
                                    className="w-full"
                                    maxLength={100}
                                />
                            </div>

                            <div className="mb-4">
                                <Label htmlFor="nombreObservacion" className="text-sm font-medium mb-2 block">
                                    Asignar nombre a esta jugada (opcional):
                                </Label>
                                <Input
                                    id="nombreObservacion"
                                    value={nombreObservacionJugada}
                                    onChange={(e) => setNombreObservacionJugada(e.target.value)}
                                    placeholder="Ej: Jugada especial, Números favoritos, etc."
                                    className="w-full"
                                    maxLength={50}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Este nombre te ayudará a identificar y buscar esta jugada más fácilmente
                                </p>
                            </div>

                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-lg text-white w-full md:w-auto">
                                    <h3 className="text-sm font-medium opacity-90">TOTAL A PAGAR:</h3>
                                    <p className="text-3xl font-bold">${total.toFixed(2)}</p>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto flex-wrap">
                                    <Button
                                        variant="outline"
                                        onClick={resetearCampos}
                                        className="border-red-500 text-red-600 hover:bg-red-50 bg-transparent"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" /> Reiniciar
                                    </Button>

                                    <Button
                                        onClick={guardarJugadas}
                                        disabled={
                                            isSaving ||
                                            (triplonaApuestas.length === 0 &&
                                                borratinaApuestas.length === 0 &&
                                                quintinaApuestas.length === 0 &&
                                                exactaApuestas.length === 0)
                                        }
                                        className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-none"
                                    >
                                        {isSaving ? (
                                            <>
                                                <svg
                                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" /> Guardar Jugadas
                                            </>
                                        )}
                                    </Button>

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
                                        <RotateCcw className="h-4 w-4 mr-2" /> Repetir Jugada
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Diálogo de ticket */}
                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <span className="mr-2">Ticket Generado</span>
                                <Badge className="bg-green-500">Secuencia: {secuencia}</Badge>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="bg-gray-100 p-4 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
                            {ticketContent}
                        </div>
                        <DialogFooter className="flex justify-between">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="border-blue-500 text-blue-600 bg-transparent"
                                    onClick={compartirTicket}
                                >
                                    <Share2 className="h-4 w-4 mr-2" /> Compartir
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-green-500 text-green-600 bg-transparent"
                                    onClick={imprimirEnTermica}
                                >
                                    <Printer className="h-4 w-4 mr-2" /> Imprimir
                                </Button>
                            </div>
                            <Button onClick={() => setIsTicketDialogOpen(false)}>Cerrar</Button>
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
                                                const { resumen, total, numerosJugados, loteriasApostadas, sorteoJugada } =
                                                    obtenerResumenJugada(jugada)
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
                                                                        className={`text-xs ${jugada.tipo === "NUEVA TRIPLONA"
                                                                                ? "bg-purple-100 text-purple-800 border-purple-300"
                                                                                : jugada.tipo === "NUEVA QUINTINA"
                                                                                    ? "bg-green-100 text-green-800 border-green-300"
                                                                                    : jugada.tipo === "NUEVA BORRATINA"
                                                                                        ? "bg-blue-100 text-blue-800 border-blue-300"
                                                                                        : "bg-amber-100 text-amber-800 border-amber-300"
                                                                            }`}
                                                                    >
                                                                        {jugada.tipo?.replace("NUEVA ", "")}
                                                                    </Badge>
                                                                    <span className="text-sm font-medium">{resumen}</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 space-y-1">
                                                                    <div>📅 {formatearFecha(jugada.fechaFormateada || new Date())}</div>
                                                                    <div>🎯 Sorteo: {sorteoJugada || sorteoJugada}</div>
                                                                    <div>🎰 Loterías: {loteriasApostadas}</div>
                                                                    {jugada.provincias && jugada.provincias.length > 0 && (
                                                                        <div>🌍 {jugada.provincias.join(", ")}</div>
                                                                    )}
                                                                    <div>🔢 Secuencia: {jugada.secuencia}</div>
                                                                    {jugada.observacion && <div>📝 {jugada.observacion}</div>}
                                                                    {jugada.nombreObservacion && <div>🏷️ {jugada.nombreObservacion}</div>}
                                                                    {numerosJugados.length > 0 && (
                                                                        <div className="mt-2">
                                                                            <div className="text-xs font-medium text-gray-600 mb-1">🎲 Números jugados:</div>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {numerosJugados.slice(0, 3).map((numero, idx) => (
                                                                                    <span
                                                                                        key={idx}
                                                                                        className="inline-block bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs"
                                                                                    >
                                                                                        {numero}
                                                                                    </span>
                                                                                ))}
                                                                                {numerosJugados.length > 3 && (
                                                                                    <span className="text-xs text-gray-500">
                                                                                        +{numerosJugados.length - 3} más
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
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
                                    setBusquedaObservacion("")
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
        </>
    )
}
