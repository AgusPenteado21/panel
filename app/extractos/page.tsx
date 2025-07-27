"use client"
import type React from "react"
import { useState, useCallback, useEffect } from "react"
import Navbar from "../components/Navbar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Loader2,
    RefreshCcw,
    CalendarIcon,
    FileText,
    Edit,
    CheckCircle,
    XCircle,
    Trash2,
    Printer,
    Download,
    AlertTriangle,
    Info,
    Keyboard,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, setHours, isFuture, startOfDay, getDay } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Extracto {
    id: string
    fecha: string
    dia: string
    sorteo: string
    loteria: string
    numeros: string[]
    pizarraLink: string
    necesita: string
    confirmado: string
    provincia?: string
}

interface ProvinciaData {
    [key: string]: string[] // turno -> numeros
}

async function confirmarResultados(extractos: Extracto[]): Promise<any> {
    console.log("Confirmando resultados:", extractos)
    // Aquí iría la lógica real para confirmar en el backend
    return { success: true, message: "Resultados confirmados localmente" }
}

// Mapeo de nombres de loterías para la búsqueda en extractos (puede haber variaciones)
const LOTERIA_NAME_MAP: { [key: string]: string[] } = {
    "SANTA FE": ["SANTA FE", "SANTA"],
    MISIONES: ["MISIONES", "MISION"],
    "SANTIAGO DEL ESTERO": ["SANTIAGO DEL ESTERO", "SANTIAGO"],
    NACIONAL: ["NACIONAL", "LOTERIA NACIONAL"],
    PROVINCIA: ["PROVINCIA", "LOTERIA DE LA PROVINCIA"],
    CIUDAD: ["CIUDAD", "LOTERIA DE LA CIUDAD"],
    CORDOBA: ["CORDOBA", "LOTERIA DE CORDOBA"],
    MENDOZA: ["MENDOZA", "LOTERIA DE MENDOZA"],
    "ENTRE RIOS": ["ENTRE RIOS", "LOTERIA DE ENTRE RIOS"],
    CORRIENTES: ["CORRIENTES", "LOTERIA DE CORRIENTES"],
    CHACO: ["CHACO", "LOTERIA DEL CHACO"],
    CHUBUT: ["CHUBUT", "LOTERIA DEL CHUBUT"],
    FORMOSA: ["FORMOSA", "LOTERIA DE FORMOSA"],
    JUJUY: ["JUJUY", "LOTERIA DE JUJUY"],
    "LA PAMPA": ["LA PAMPA", "LOTERIA DE LA PAMPA"],
    "LA RIOJA": ["LA RIOJA", "LOTERIA DE LA RIOJA"],
    "RIO NEGRO": ["RIO NEGRO", "LOTERIA DE RIO NEGRO"],
    SALTA: ["SALTA", "LOTERIA DE SALTA"],
    "SAN JUAN": ["SAN JUAN", "LOTERIA DE SAN JUAN"],
    "SAN LUIS": ["SAN LUIS", "LOTERIA DE SAN LUIS"],
    "TIERRA DEL FUEGO": ["TIERRA DEL FUEGO", "LOTERIA DE TIERRA DEL FUEGO"],
    TUCUMAN: ["TUCUMAN", "LOTERIA DE TUCUMAN"],
    NEUQUEN: ["NEUQUEN", "LOTERIA DE NEUQUEN"],
    MONTEVIDEO: ["MONTEVIDEO", "LOTERIA DE MONTEVIDEO", "QUINIELA MONTEVIDEO"],
}

// Mapeo de nombres de loterías para enviar al backend (si el backend espera nombres cortos)
const BACKEND_PROVINCE_MAP: { [key: string]: string } = {
    "SANTA FE": "SANTA FE", // Corrected to match backend URLS_PIZARRAS key
    MISIONES: "MISIONES", // Correct
    "SANTIAGO DEL ESTERO": "SANTIAGO", // Correct
    TUCUMAN: "TUCUMAN", // Correct
    NEUQUEN: "NEUQUEN", // Correct
    MONTEVIDEO: "MONTEVIDEO", // Correct
    NACIONAL: "NACION", // Corrected to match backend URLS_PIZARRAS key
    PROVINCIA: "PROVINCIA", // Correct
    CIUDAD: "CIUDAD", // Correct
    CORDOBA: "CORDOBA", // Correct
    MENDOZA: "MENDOZA", // Correct
    "ENTRE RIOS": "ENTRE RIOS", // Correct
    CORRIENTES: "CORRIENTES", // Correct
    CHACO: "CHACO", // Correct
    "RIO NEGRO": "RIO NEGRO", // Correct
    "SAN JUAN": "SAN JUAN", // Correct
    // "CHUBUT", // Eliminado
    // "FORMOSA", // Eliminado
    // "JUJUY", // Eliminado
    // "LA PAMPA", // Eliminado
    // "LA RIOJA", // Eliminado
    // "SALTA", // Eliminado
    // "SAN LUIS", // Eliminado
    // "TIERRA DEL FUEGO", // Eliminado
    // "CIUDAD", // Eliminado
}

// Lista de loterías que tienen botones y modales dedicados
const DEDICATED_BUTTON_LOTERIAS = ["TUCUMAN", "NEUQUEN", "SANTA FE", "MISIONES", "SANTIAGO DEL ESTERO", "MONTEVIDEO"]

// Lista de todas las loterías para las que queremos mostrar un botón (incluyendo las que no tienen modal dedicado)
const ALL_LOTERIAS_TO_DISPLAY = [
    ...DEDICATED_BUTTON_LOTERIAS, // "TUCUMAN", "NEUQUEN", "SANTA FE", "MISIONES", "SANTIAGO DEL ESTERO", "MONTEVIDEO"
    "NACIONAL",
    "PROVINCIA",
    "CORDOBA",
    "MENDOZA",
    "ENTRE RIOS",
    "CORRIENTES",
    "CHACO",
    "RIO NEGRO", // Re-agregado
    "SAN JUAN",
].sort() // Ordenar alfabéticamente para consistencia

// Filtrar las loterías que ya tienen botones dedicados para generar los dinámicos
const OTHER_LOTERIAS_FOR_DYNAMIC_BUTTONS = ALL_LOTERIAS_TO_DISPLAY.filter(
    (loteria) => !DEDICATED_BUTTON_LOTERIAS.includes(loteria),
)

export default function ExtractosPage() {
    const [extractos, setExtractos] = useState<Extracto[]>([])
    const [extractosSeleccionados, setExtractosSeleccionados] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<string>("")
    const [editMode, setEditMode] = useState(false)
    const [selectAll, setSelectAll] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        try {
            const fechaUTC = new Date()
            const fechaArgentina = new Date(fechaUTC.getTime() - 3 * 60 * 60 * 1000)
            return setHours(startOfDay(fechaArgentina), 12)
        } catch (error) {
            console.error("Error al inicializar fecha:", error)
            const today = startOfDay(new Date())
            return setHours(today, 12)
        }
    })
    const [debugInfo, setDebugInfo] = useState<string>("")
    const [usarFechaForzada, setUsarFechaForzada] = useState(false)

    // Estados para el modal de Tucumán
    const [showTucumanModal, setShowTucumanModal] = useState(false)
    const [tucumanData, setTucumanData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingTucuman, setIsSavingTucuman] = useState(false)

    // Estados para el modal de Neuquén
    const [showNeuquenModal, setShowNeuquenModal] = useState(false)
    const [neuquenData, setNeuquenData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingNeuquen, setIsSavingNeuquen] = useState(false)

    // Estados para el modal de Santa Fe
    const [showSantaFeModal, setShowSantaFeModal] = useState(false)
    const [santaFeData, setSantaFeData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingSantaFe, setIsSavingSantaFe] = useState(false)

    // Estados para el modal de Misiones
    const [showMisionesModal, setShowMisionesModal] = useState(false)
    const [misionesData, setMisionesData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingMisiones, setIsSavingMisiones] = useState(false)

    // Estados para el modal de Santiago
    const [showSantiagoModal, setShowSantiagoModal] = useState(false)
    const [santiagoData, setSantiagoData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingSantiago, setIsSavingSantiago] = useState(false)

    // Estados para el modal de Montevideo
    const [showMontevideoModal, setShowMontevideoModal] = useState(false)
    const [montevideoData, setMontevideoData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingMontevideo, setIsSavingMontevideo] = useState(false)

    // Estados para el modal genérico de tipear loterías (NUEVO)
    const [showGenericModal, setShowGenericModal] = useState(false)
    const [currentGenericLoteria, setCurrentGenericLoteria] = useState<string>("")
    const [currentGenericLoteriaData, setCurrentGenericLoteriaData] = useState<ProvinciaData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingGenericLoteria, setIsSavingGenericLoteria] = useState(false)

    const fetchExtractos = useCallback(
        async (date: Date) => {
            console.log(`Fetching extractos for date: ${date.toISOString()}`)
            try {
                setIsLoading(true)
                setError(null)
                setDebugInfo("Iniciando fetchExtractos")
                const dateParam = format(date, "yyyy-MM-dd")
                const hoy = new Date()
                const esHoy = format(date, "yyyy-MM-dd") === format(hoy, "yyyy-MM-dd")
                let apiUrl = `${window.location.origin}/api/extractos?date=${dateParam}` // Usar ruta absoluta
                if (esHoy || usarFechaForzada) {
                    apiUrl += "&forceRefresh=true"
                }
                setDebugInfo((prev) => prev + `\nIntentando cargar datos de: ${apiUrl}`)
                const response = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        Pragma: "no-cache",
                        Expires: "0",
                    },
                })
                setDebugInfo((prev) => prev + `\nRespuesta recibida. Status: ${response.status}`)
                if (!response.ok) {
                    throw new Error(`Error HTTP! status: ${response.status}`)
                }
                const data = await response.json()
                setDebugInfo((prev) => prev + `\nDatos recibidos: ${JSON.stringify(data).substring(0, 200)}...`)
                if (data && Array.isArray(data) && data.length > 0) {
                    const extractosConCamposAdicionales = data.map((extracto: any) => ({
                        ...extracto,
                        necesita: extracto.necesita || "No",
                        confirmado: extracto.confirmado || "No",
                    }))
                    setExtractos(extractosConCamposAdicionales)
                    setLastUpdate(new Date().toLocaleTimeString())
                    setDebugInfo((prev) => prev + `\n${data.length} extractos cargados`)
                    if (extractosConCamposAdicionales.length > 0) {
                        const fechaRecibida = extractosConCamposAdicionales[0].fecha
                        setDebugInfo((prev) => prev + `\nFecha recibida en los datos: ${fechaRecibida}`)
                    }
                } else {
                    setError("No se encontraron extractos para la fecha seleccionada.")
                    setDebugInfo((prev) => prev + "\nNo se encontraron extractos")
                    setExtractos([])
                }
            } catch (err) {
                console.error("Error en fetchExtractos:", err)
                const errorMessage = err instanceof Error ? err.message : "Error desconocido al obtener los extractos"
                setError(`Error en la API: ${errorMessage}`)
                setDebugInfo((prev) => prev + `\nError: ${errorMessage}`)
                setExtractos([])
            } finally {
                setIsLoading(false)
                setDebugInfo((prev) => prev + "\nFinalizado fetchExtractos")
            }
        },
        [usarFechaForzada],
    )

    const handleNumberChange = (extractoId: string, index: number, value: string) => {
        setExtractos((prevExtractos) =>
            prevExtractos.map((extracto) =>
                extracto.id === extractoId
                    ? { ...extracto, numeros: extracto.numeros.map((num, i) => (i === index ? value : num)) }
                    : extracto,
            ),
        )
    }

    // Función genérica para manejar cambios de números (para modales específicos)
    const handleProvinciaNumberChange = (
        provincia: string,
        turno: string,
        index: number,
        value: string,
        setData: React.Dispatch<React.SetStateAction<ProvinciaData>>,
        data: ProvinciaData,
    ) => {
        // Solo permitir números y máximo 4 dígitos
        const numeroLimpio = value.replace(/\D/g, "").slice(0, 4)
        setData((prev) => ({
            ...prev,
            [turno]: prev[turno].map((num, i) => (i === index ? numeroLimpio : num)),
        }))
        // Auto-focus al siguiente campo cuando se completen 4 dígitos
        if (numeroLimpio.length === 4) {
            const nextIndex = index + 1
            if (nextIndex < 20) {
                // Focus al siguiente input del mismo turno
                setTimeout(() => {
                    const nextInput = document.querySelector(
                        `input[data-provincia="${provincia}"][data-turno="${turno}"][data-index="${nextIndex}"]`,
                    ) as HTMLInputElement
                    if (nextInput) {
                        nextInput.focus()
                        nextInput.select()
                    }
                }, 10)
            } else {
                // Si es el último del turno, pasar al primer input del siguiente turno
                const turnos = Object.keys(data)
                const currentTurnoIndex = turnos.indexOf(turno)
                if (currentTurnoIndex < turnos.length - 1) {
                    const nextTurno = turnos[currentTurnoIndex + 1]
                    setTimeout(() => {
                        const firstInputNextTurno = document.querySelector(
                            `input[data-provincia="${provincia}"][data-turno="${nextTurno}"][data-index="0"]`,
                        ) as HTMLInputElement
                        if (firstInputNextTurno) {
                            firstInputNextTurno.focus()
                        }
                    }, 10)
                }
            }
        }
    }

    // Handlers específicos para cada provincia
    const handleTucumanNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("TUCUMAN", turno, index, value, setTucumanData, tucumanData)
    }
    const handleNeuquenNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("NEUQUEN", turno, index, value, setNeuquenData, neuquenData)
    }
    const handleSantaFeNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("SANTA", turno, index, value, setSantaFeData, santaFeData)
    }
    const handleMisionesNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("MISION", turno, index, value, setMisionesData, misionesData)
    }
    const handleSantiagoNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("SANTIAGO", turno, index, value, setSantiagoData, santiagoData)
    }
    const handleMontevideoNumberChange = (turno: string, index: number, value: string) => {
        handleProvinciaNumberChange("MONTEVIDEO", turno, index, value, setMontevideoData, montevideoData)
    }

    // Función genérica para manejar cambios de números en el modal genérico (NUEVO)
    const handleGenericNumberChange = (loteria: string, turno: string, index: number, value: string) => {
        const numeroLimpio = value.replace(/\D/g, "").slice(0, 4)
        setCurrentGenericLoteriaData((prev) => ({
            ...prev,
            [turno]: prev[turno].map((num, i) => (i === index ? numeroLimpio : num)),
        }))
        if (numeroLimpio.length === 4) {
            const nextIndex = index + 1
            if (nextIndex < 20) {
                setTimeout(() => {
                    const nextInput = document.querySelector(
                        `input[data-loteria="${loteria}"][data-turno="${turno}"][data-index="${nextIndex}"]`,
                    ) as HTMLInputElement
                    if (nextInput) {
                        nextInput.focus()
                        nextInput.select()
                    }
                }, 10)
            } else {
                const turnos = Object.keys(currentGenericLoteriaData)
                const currentTurnoIndex = turnos.indexOf(turno)
                if (currentTurnoIndex < turnos.length - 1) {
                    const nextTurno = turnos[currentTurnoIndex + 1]
                    setTimeout(() => {
                        const firstInputNextTurno = document.querySelector(
                            `input[data-loteria="${loteria}"][data-turno="${nextTurno}"][data-index="0"]`,
                        ) as HTMLInputElement
                        if (firstInputNextTurno) {
                            firstInputNextTurno.focus()
                        }
                    }, 10)
                }
            }
        }
    }

    // Función para obtener turnos disponibles de Montevideo según el día
    const getTurnosDisponiblesMontevideo = (fecha: Date) => {
        const diaSemana = getDay(fecha) // 0 = domingo, 1 = lunes, ..., 6 = sábado
        if (diaSemana === 0) {
            // Domingo - no hay sorteos
            return []
        } else if (diaSemana === 6) {
            // Sábado - solo Nocturna
            return ["Nocturna"]
        } else {
            // Lunes a Viernes - Matutina y Nocturna
            return ["Matutina", "Nocturna"]
        }
    }

    // Función genérica para obtener turnos ya guardados (MEJORADA)
    const getTurnosYaGuardados = (loteriaBoton: string) => {
        // Normalizar el nombre de la lotería para buscar en el mapa
        const normalizedLoteriaBoton = loteriaBoton.toUpperCase()
        // Obtener todos los nombres posibles para esta lotería (incluyendo abreviaciones o nombres completos)
        const targetNames = LOTERIA_NAME_MAP[normalizedLoteriaBoton] || [normalizedLoteriaBoton]
        const turnosLoteria = extractos
            .filter((extracto) => {
                const extractoLoteriaNormalizada = extracto.loteria.toUpperCase()
                const extractoProvinciaNormalizada = (extracto.provincia || "").toUpperCase()
                // Verificar si el extracto coincide con alguno de los nombres objetivo
                return targetNames.some(
                    (name) => extractoLoteriaNormalizada.includes(name) || extractoProvinciaNormalizada.includes(name),
                )
            })
            .map((extracto) => extracto.sorteo)
        console.log(`DEBUG ${loteriaBoton}: Turnos ya guardados para ${loteriaBoton}:`, turnosLoteria)
        return turnosLoteria
    }

    // Función genérica para obtener turnos pendientes
    const getTurnosPendientes = (provincia: string) => {
        const turnosYaGuardados = getTurnosYaGuardados(provincia)
        const diaSemana = getDay(selectedDate) // 0 = domingo, 1 = lunes, ..., 6 = sábado
        let todosTurnos: string[] = []
        if (provincia === "MONTEVIDEO") {
            todosTurnos = getTurnosDisponiblesMontevideo(selectedDate)
        } else if (provincia === "SANTIAGO DEL ESTERO") {
            if (diaSemana === 0) {
                // Domingo: solo Matutina y Vespertina
                todosTurnos = ["Matutina", "Vespertina"]
            } else {
                // Lunes a Sábado: todos los turnos
                todosTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
            }
        } else {
            // Para todas las demás provincias
            if (diaSemana === 0) {
                // Domingo para otras provincias (no Santiago, no Montevideo)
                todosTurnos = [] // No hay sorteos para tipear en domingo para estas provincias
            } else {
                // Lunes a Sábado para otras provincias
                todosTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
            }
        }
        const pendientes = todosTurnos.filter((turno) => !turnosYaGuardados.includes(turno))
        console.log(
            `DEBUG ${provincia}: Todos los turnos: ${todosTurnos}, Ya guardados: ${turnosYaGuardados}, Pendientes: ${pendientes}`,
        )
        return pendientes
    }

    // Función genérica para validar que un turno esté completo
    const isTurnoCompleto = (turno: string, data: ProvinciaData) => {
        const numerosDelTurno = data[turno]
        const numerosCompletos = numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim()))
        return numerosCompletos.length === 20
    }

    // Función genérica para contar números completados
    const contarNumerosCompletados = (turno: string, data: ProvinciaData) => {
        const numerosDelTurno = data[turno]
        return numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim())).length
    }

    // Función genérica para confirmar resultados de provincia (para modales específicos)
    const handleConfirmarProvincia = async (
        provincia: string,
        data: ProvinciaData,
        setData: React.Dispatch<React.SetStateAction<ProvinciaData>>,
        setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
        setShowModal: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
        try {
            setIsSaving(true)
            setError(null)
            // Usar la fecha seleccionada
            const fecha = format(selectedDate, "dd/MM/yyyy", { locale: es })
            console.log(`🗓️ Guardando con fecha seleccionada: ${fecha}`)

            // Obtener los turnos que deberían estar disponibles para la provincia y fecha seleccionada
            const turnosDisponiblesParaGuardar = getTurnosPendientes(provincia)

            // Filtrar los turnos que tienen datos completos y están disponibles para guardar
            const turnosConDatos = turnosDisponiblesParaGuardar.filter((turno) => {
                const numerosDelTurno = data[turno]
                // Verificar que TODOS los 20 números estén completos y sean de 4 dígitos
                const numerosCompletos = numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim()))
                return numerosCompletos.length === 20
            })

            if (turnosConDatos.length === 0) {
                setError("Debe completar TODOS los 20 números de 4 dígitos para cada turno que desee guardar")
                return
            }

            console.log(`🔄 Guardando turnos de ${provincia}:`, turnosConDatos)
            let turnosGuardadosExitosamente = 0

            // Enviar cada turno por separado
            for (const turno of turnosConDatos) {
                const numerosCompletos = data[turno].map((num) => num.trim())

                // Validación final antes de enviar
                const todosCompletos = numerosCompletos.every((num) => /^\d{4}$/.test(num))
                if (!todosCompletos) {
                    throw new Error(`El turno ${turno} tiene números incompletos. Todos deben ser de 4 dígitos.`)
                }

                // Mapear el nombre de la lotería para el backend si es necesario
                const provinciaParaBackend = BACKEND_PROVINCE_MAP[provincia.toUpperCase()] || provincia
                console.log(`📤 Enviando ${provinciaParaBackend} ${turno} para fecha ${fecha}:`, numerosCompletos)

                // *** CAMBIO CLAVE AQUÍ: Usar ruta relativa en lugar de window.location.origin ***
                const apiUrl = "/api/extractos"
                console.log(`API URL para POST: ${apiUrl}`)

                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        provincia: provinciaParaBackend,
                        turno: turno,
                        fecha: fecha,
                        numeros: numerosCompletos,
                    }),
                })

                const responseData = await response.json()
                console.log(`📥 Respuesta ${provinciaParaBackend} ${turno}:`, responseData)

                if (!response.ok) {
                    console.error(`Error en la respuesta del servidor para ${provinciaParaBackend} ${turno}:`, responseData)
                    throw new Error(
                        `Error al guardar ${turno}: ${responseData.error || responseData.detalles || response.statusText}`,
                    )
                }
                if (!responseData.success) {
                    console.error(`Respuesta no exitosa del servidor para ${provinciaParaBackend} ${turno}:`, responseData)
                    throw new Error(`Error al guardar ${turno}: ${responseData.error || "Respuesta no exitosa del servidor"}`)
                }
                turnosGuardadosExitosamente++
                console.log(`✅ ${provinciaParaBackend} ${turno} guardado exitosamente para ${fecha}`)
            }

            // Si llegamos aquí, todos los turnos se guardaron exitosamente
            console.log(`🎉 ${turnosGuardadosExitosamente} turnos de ${provincia} guardados exitosamente para ${fecha}`)

            // Limpiar solo los turnos que se guardaron
            setData((prev) => {
                const newData = { ...prev }
                turnosConDatos.forEach((turno) => {
                    newData[turno] = Array(20).fill("")
                })
                return newData
            })

            // Mostrar mensaje de éxito
            setError(null)
            // Refrescar datos inmediatamente
            console.log("🔄 Refrescando datos desde Firebase...")
            await fetchExtractos(selectedDate)
            console.log("✅ Datos refrescados")

            // Cerrar el modal después de un breve delay para que el usuario vea la confirmación
            setTimeout(() => {
                setShowModal(false)
                // Mostrar alerta de éxito
                alert(`✅ ${turnosGuardadosExitosamente} turno(s) de ${provincia} guardado(s) exitosamente para ${fecha}`)
            }, 500)
        } catch (error) {
            console.error(`❌ Error al guardar ${provincia}:`, error)
            setError(error instanceof Error ? error.message : `Error al guardar los resultados de ${provincia}`)
        } finally {
            setIsSaving(false)
        }
    }

    // Handlers específicos para confirmar cada provincia
    const handleConfirmarTucuman = () => {
        handleConfirmarProvincia("TUCUMAN", tucumanData, setTucumanData, setIsSavingTucuman, setShowTucumanModal)
    }
    const handleConfirmarNeuquen = () => {
        handleConfirmarProvincia("NEUQUEN", neuquenData, setNeuquenData, setIsSavingNeuquen, setShowNeuquenModal)
    }
    const handleConfirmarSantaFe = () => {
        handleConfirmarProvincia("SANTA FE", santaFeData, setSantaFeData, setIsSavingSantaFe, setShowSantaFeModal)
    }
    const handleConfirmarMisiones = () => {
        handleConfirmarProvincia("MISIONES", misionesData, setMisionesData, setIsSavingMisiones, setShowMisionesModal)
    }
    const handleConfirmarSantiago = () => {
        handleConfirmarProvincia(
            "SANTIAGO DEL ESTERO",
            santiagoData,
            setSantiagoData,
            setIsSavingSantiago,
            setShowSantiagoModal,
        )
    }
    const handleConfirmarMontevideo = () => {
        handleConfirmarProvincia(
            "MONTEVIDEO",
            montevideoData,
            setMontevideoData,
            setIsSavingMontevideo,
            setShowMontevideoModal,
        )
    }

    // Función genérica para confirmar resultados de cualquier lotería (NUEVO)
    const handleConfirmarGenericLoteria = async () => {
        try {
            setIsSavingGenericLoteria(true)
            setError(null)
            const fecha = format(selectedDate, "dd/MM/yyyy", { locale: es })
            console.log(`🗓️ Guardando con fecha seleccionada: ${fecha}`)

            // Obtener los turnos que deberían estar disponibles para la lotería y fecha seleccionada
            const turnosDisponiblesParaGuardar = getTurnosPendientes(currentGenericLoteria)

            const turnosConDatos = turnosDisponiblesParaGuardar.filter((turno) => {
                const numerosDelTurno = currentGenericLoteriaData[turno]
                const numerosCompletos = numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim()))
                return numerosCompletos.length === 20
            })

            if (turnosConDatos.length === 0) {
                setError("Debe completar TODOS los 20 números de 4 dígitos para cada turno que desee guardar")
                return
            }

            console.log(`🔄 Guardando turnos de ${currentGenericLoteria}:`, turnosConDatos)
            let turnosGuardadosExitosamente = 0

            for (const turno of turnosConDatos) {
                const numerosCompletos = currentGenericLoteriaData[turno].map((num) => num.trim())
                const todosCompletos = numerosCompletos.every((num) => /^\d{4}$/.test(num))
                if (!todosCompletos) {
                    throw new Error(`El turno ${turno} tiene números incompletos. Todos deben ser de 4 dígitos.`)
                }

                const provinciaParaBackend = BACKEND_PROVINCE_MAP[currentGenericLoteria.toUpperCase()] || currentGenericLoteria
                console.log(`📤 Enviando ${provinciaParaBackend} ${turno} para fecha ${fecha}:`, numerosCompletos)

                // *** CAMBIO CLAVE AQUÍ: Usar ruta relativa en lugar de window.location.origin ***
                const apiUrl = "/api/extractos"
                console.log(`API URL para POST: ${apiUrl}`)

                const response = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        provincia: provinciaParaBackend,
                        turno: turno,
                        fecha: fecha,
                        numeros: numerosCompletos,
                    }),
                })

                const responseData = await response.json()
                console.log(`📥 Respuesta ${provinciaParaBackend} ${turno}:`, responseData)

                if (!response.ok) {
                    console.error(`Error en la respuesta del servidor para ${provinciaParaBackend} ${turno}:`, responseData)
                    throw new Error(
                        `Error al guardar ${turno}: ${responseData.error || responseData.detalles || response.statusText}`,
                    )
                }
                if (!responseData.success) {
                    console.error(`Respuesta no exitosa del servidor para ${provinciaParaBackend} ${turno}:`, responseData)
                    throw new Error(`Error al guardar ${turno}: ${responseData.error || "Respuesta no exitosa del servidor"}`)
                }
                turnosGuardadosExitosamente++
                console.log(`✅ ${provinciaParaBackend} ${turno} guardado exitosamente para ${fecha}`)
            }

            console.log(
                `🎉 ${turnosGuardadosExitosamente} turnos de ${currentGenericLoteria} guardados exitosamente para ${fecha}`,
            )

            setCurrentGenericLoteriaData((prev) => {
                const newData = { ...prev }
                turnosConDatos.forEach((turno) => {
                    newData[turno] = Array(20).fill("")
                })
                return newData
            })

            setError(null)
            console.log("🔄 Refrescando datos desde Firebase...")
            await fetchExtractos(selectedDate)
            console.log("✅ Datos refrescados")

            setTimeout(() => {
                setShowGenericModal(false)
                alert(
                    `✅ ${turnosGuardadosExitosamente} turno(s) de ${currentGenericLoteria} guardado(s) exitosamente para ${fecha}`,
                )
            }, 500)
        } catch (error) {
            console.error(`❌ Error al guardar ${currentGenericLoteria}:`, error)
            setError(error instanceof Error ? error.message : `Error al guardar los resultados de ${currentGenericLoteria}`)
        } finally {
            setIsSavingGenericLoteria(false)
        }
    }

    const formatDateAndDay = (fecha: string) => {
        try {
            const [day, month, year] = fecha.split("/")
            const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
            return format(date, "dd 'de' MMMM 'de' yyyy (EEEE)", { locale: es })
        } catch (error) {
            console.error("Error al formatear fecha:", error, fecha)
            return fecha
        }
    }

    const exportToExcel = () => {
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(
            extractos.map((extracto) => ({
                ID: extracto.id,
                Fecha: extracto.fecha,
                Día: extracto.dia,
                Sorteo: extracto.sorteo,
                Lotería: extracto.loteria,
                Necesita: extracto.necesita,
                Confirmado: extracto.confirmado,
                ...extracto.numeros.reduce(
                    (acc, num, index) => {
                        acc[`Número ${index + 1}`] = num
                        return acc
                    },
                    {} as Record<string, string>,
                ),
            })),
        )
        XLSX.utils.book_append_sheet(workbook, worksheet, "Extractos")
        XLSX.writeFile(workbook, "Extractos.xlsx")
    }

    const handleConfirmar = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const extractosAConfirmar = extractos.filter(
                (extracto) => selectAll || extractosSeleccionados.includes(extracto.id),
            )
            console.log(`Confirmando ${extractosAConfirmar.length} extractos`)
            const response = await confirmarResultados(extractosAConfirmar)
            console.log("Respuesta de confirmación recibida")
            setExtractos((prevExtractos) =>
                prevExtractos.map((extracto) =>
                    selectAll || extractosSeleccionados.includes(extracto.id) ? { ...extracto, confirmado: "Sí" } : extracto,
                ),
            )
            setExtractosSeleccionados([])
            setSelectAll(false)
            console.log("Extractos confirmados con éxito")
        } catch (error) {
            console.error("Error al confirmar resultados:", error)
            setError(error instanceof Error ? error.message : "Error desconocido al confirmar los resultados")
            console.log(`Error al confirmar: ${error instanceof Error ? error.message : "Error desconocido"}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked)
        if (checked) {
            setExtractosSeleccionados(extractos.map((e) => e.id))
        } else {
            setExtractosSeleccionados([])
        }
    }

    const handleDateSelect = (newDate: Date | undefined) => {
        if (newDate) {
            const today = startOfDay(new Date())
            if (isFuture(newDate)) {
                setError("No se pueden seleccionar fechas futuras.")
                return
            }
            const adjustedDate = setHours(newDate, 12)
            console.log(`Nueva fecha seleccionada: ${adjustedDate.toISOString()}`)
            setSelectedDate(adjustedDate)
            fetchExtractos(adjustedDate)
        }
    }

    const handleRefresh = () => {
        fetchExtractos(selectedDate)
    }

    const handleForzarFecha = async () => {
        try {
            setIsLoading(true)
            setError(null)
            setDebugInfo("Obteniendo fecha forzada de Argentina...")
            const apiUrl = `${window.location.origin}/api/extractos/forzar-fecha` // Usar ruta absoluta
            console.log(`API URL para forzar fecha: ${apiUrl}`)
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            })
            if (!response.ok) {
                throw new Error(`Error HTTP! status: ${response.status}`)
            }
            const data = await response.json()
            setDebugInfo((prev) => prev + `\nFecha forzada recibida: ${JSON.stringify(data)}`)
            setUsarFechaForzada(true)
            fetchExtractos(selectedDate)
        } catch (error) {
            console.error("Error al forzar fecha:", error)
            setError(error instanceof Error ? error.message : "Error desconocido al forzar fecha")
        } finally {
            setIsLoading(false)
        }
    }

    const sorteoOrder = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
    const sortExtractos = (a: Extracto, b: Extracto) => {
        return sorteoOrder.indexOf(a.sorteo) - sorteoOrder.indexOf(b.sorteo)
    }

    const getSorteoColor = (sorteo: string) => {
        if (sorteo.includes("Previa")) return "bg-purple-100 text-purple-800"
        if (sorteo.includes("Primera")) return "bg-blue-100 text-blue-800"
        if (sorteo.includes("Matutina")) return "bg-green-100 text-green-800"
        if (sorteo.includes("Vespertina")) return "bg-orange-100 text-orange-800"
        if (sorteo.includes("Nocturna")) return "bg-indigo-100 text-indigo-800"
        return "bg-gray-100 text-gray-800"
    }

    // Funciones para abrir modales específicos
    const abrirModalTucuman = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Tucumán")
        setShowTucumanModal(true)
    }
    const abrirModalNeuquen = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Neuquén")
        setShowNeuquenModal(true)
    }
    const abrirModalSantaFe = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Santa Fe")
        setShowSantaFeModal(true)
    }
    const abrirModalMisiones = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Misiones")
        setShowMisionesModal(true)
    }
    const abrirModalSantiago = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Santiago")
        setShowSantiagoModal(true)
    }
    const abrirModalMontevideo = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        console.log("🔓 Abriendo modal Montevideo")
        setShowMontevideoModal(true)
    }

    // Función para abrir el modal genérico de tipear loterías (NUEVO)
    const abrirGenericModal = (loteria: string) => {
        console.log(`🔓 Abriendo modal genérico para tipear ${loteria}`)
        setCurrentGenericLoteria(loteria)
        // Inicializar los datos del modal con arrays vacíos para todos los turnos
        setCurrentGenericLoteriaData({
            Previa: Array(20).fill(""),
            Primera: Array(20).fill(""),
            Matutina: Array(20).fill(""),
            Vespertina: Array(20).fill(""),
            Nocturna: Array(20).fill(""),
        })
        setShowGenericModal(true)
    }

    // Función para cerrar modal (ahora puede ser usada por modales específicos y genérico)
    const cerrarModal = (provincia: string, setShowModal: React.Dispatch<React.SetStateAction<boolean>>) => {
        console.log(`🔒 Cerrando modal ${provincia}`)
        setShowModal(false)
    }

    // Función para cerrar el modal genérico de tipear (NUEVO)
    const cerrarGenericModal = () => {
        console.log(`🔒 Cerrando modal genérico de tipear ${currentGenericLoteria}`)
        setShowGenericModal(false)
        setCurrentGenericLoteria("")
        setCurrentGenericLoteriaData({
            Previa: Array(20).fill(""),
            Primera: Array(20).fill(""),
            Matutina: Array(20).fill(""),
            Vespertina: Array(20).fill(""),
            Nocturna: Array(20).fill(""),
        })
    }

    // Función para obtener el mensaje de disponibilidad de Montevideo
    const getMensajeDisponibilidadMontevideo = () => {
        const diaSemana = getDay(selectedDate) // 0 = domingo, 1 = lunes, ..., 6 = sábado
        const nombreDia = format(selectedDate, "EEEE", { locale: es })
        if (diaSemana === 0) {
            // Domingo - no hay sorteos
            return `Los domingos no hay sorteos en Montevideo`
        } else if (diaSemana === 6) {
            // Sábado - solo Nocturna
            return `Los sábados solo hay sorteo Nocturno en Montevideo`
        } else {
            // Lunes a Viernes - Matutina y Nocturna
            return `${nombreDia}: Matutina y Nocturna disponibles`
        }
    }

    // Función para obtener el mensaje de disponibilidad genérico (NUEVO)
    const getMensajeDisponibilidad = (loteria: string) => {
        const diaSemana = getDay(selectedDate) // 0 = domingo, 1 = lunes, ..., 6 = sábado
        const nombreDia = format(selectedDate, "EEEE", { locale: es })
        if (loteria === "MONTEVIDEO") {
            return getMensajeDisponibilidadMontevideo()
        } else if (loteria === "SANTIAGO DEL ESTERO") {
            if (diaSemana === 0) {
                return `Los domingos, solo Matutina y Vespertina disponibles para Santiago.`
            } else {
                return `Todos los turnos disponibles para Santiago.` // Mensaje para L-S
            }
        } else if (diaSemana === 0) {
            // Cualquier otra lotería en domingo (que no sea Santiago ni Montevideo)
            return `Los domingos no hay sorteos para ${loteria}.`
        } else {
            return `Todos los turnos disponibles para ${loteria}`
        }
    }

    // Colores específicos para cada lotería (NUEVO - extendido para todas las loterías)
    const getLoteriaColor = (lot: string) => {
        switch (lot.toUpperCase()) {
            case "TUCUMAN":
                return "border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-500"
            case "NEUQUEN":
                return "border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500"
            case "SANTA FE":
                return "border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500"
            case "MISIONES":
                return "border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-500"
            case "SANTIAGO DEL ESTERO":
                return "border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-500"
            case "MONTEVIDEO":
                return "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500"
            case "NACIONAL":
                return "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
            case "PROVINCIA":
                return "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
            case "CIUDAD":
                return "border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500"
            case "CORDOBA":
                return "border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500"
            case "MENDOZA":
                return "border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-500"
            case "ENTRE RIOS":
                return "border-lime-300 text-lime-700 hover:bg-lime-50 hover:border-lime-500"
            case "CORRIENTES":
                return "border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-500"
            case "CHACO":
                return "border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-500"
            case "CHUBUT":
                return "border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-500"
            case "FORMOSA":
                return "border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
            case "JUJUY":
                return "border-lime-300 text-lime-700 hover:bg-lime-50 hover:border-lime-500"
            case "LA PAMPA":
                return "border-sky-300 text-sky-700 hover:bg-sky-50 hover:border-sky-500"
            case "LA RIOJA":
                return "border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500"
            case "RIO NEGRO": // Re-agregado
                return "border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500"
            case "SALTA":
                return "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
            case "SAN JUAN":
                return "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
            case "SAN LUIS":
                return "border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500"
            case "TIERRA DEL FUEGO":
                return "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-500"
            default:
                return "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-500"
        }
    }

    // Abreviaciones para móvil (NUEVO - extendido para todas las loterías)
    const getAbreviacion = (lot: string) => {
        switch (lot.toUpperCase()) {
            case "TUCUMAN":
                return "TUC"
            case "NEUQUEN":
                return "NEU"
            case "SANTA FE":
                return "SF"
            case "MISIONES":
                return "MIS"
            case "SANTIAGO DEL ESTERO":
                return "SGO"
            case "MONTEVIDEO":
                return "MVD"
            case "NACIONAL":
                return "NAC"
            case "PROVINCIA":
                return "PRO"
            case "CIUDAD":
                return "CIU"
            case "CORDOBA":
                return "COR"
            case "MENDOZA":
                return "MEN"
            case "ENTRE RIOS":
                return "ER"
            case "CORRIENTES":
                return "CTE"
            case "CHACO":
                return "CHA"
            case "CHUBUT":
                return "CHU"
            case "FORMOSA":
                return "FSA"
            case "JUJUY":
                return "JUJ"
            case "LA PAMPA":
                return "LPA"
            case "LA RIOJA":
                return "LRI"
            case "RIO NEGRO": // Re-agregado
                return "RNE"
            case "SALTA":
                return "SAL"
            case "SAN JUAN":
                return "SJU"
            case "SAN LUIS":
                return "SLU"
            case "TIERRA DEL FUEGO":
                return "TDF"
            default:
                return lot.substring(0, 3).toUpperCase()
        }
    }

    useEffect(() => {
        fetchExtractos(selectedDate)
    }, [fetchExtractos, selectedDate])

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <main className="container mx-auto p-2 sm:p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-xl sm:text-2xl font-bold flex items-center">
                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                            Extractos del Día
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-blue-200 w-full lg:w-auto">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full lg:w-[280px] justify-start text-left font-normal border-blue-300 hover:border-blue-500 hover:bg-blue-50",
                                                !selectedDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                            {selectedDate ? (
                                                <span className="truncate">
                                                    {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                                                </span>
                                            ) : (
                                                <span>Seleccionar fecha</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                            disabled={(date) => isFuture(date)}
                                            className="rounded-md"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={isLoading}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 bg-transparent flex-1 sm:flex-none"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                        <RefreshCcw className="h-3 w-3 mr-1" />
                                    )}
                                    <span className="text-xs">Actualizar</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleForzarFecha}
                                    disabled={isLoading}
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 bg-transparent flex-1 sm:flex-none"
                                >
                                    <span className="text-xs">Forzar Fecha</span>
                                </Button>
                            </div>
                        </div>

                        {/* Botones de acción - Responsive */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-6 bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditMode(!editMode)}
                                className={cn(
                                    "text-xs h-8 col-span-2 sm:col-span-1",
                                    editMode
                                        ? "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
                                        : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500",
                                )}
                            >
                                {editMode ? (
                                    <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        <span>Guardar</span>
                                    </>
                                ) : (
                                    <>
                                        <Edit className="h-3 w-3 mr-1" />
                                        <span>Modificar</span>
                                    </>
                                )}
                            </Button>

                            {/* Botones Tipear - Específicos (EXISTENTES) */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalTucuman}
                                className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("TUCUMAN").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("TUCUMAN").length === 0
                                        ? "Tucumán OK"
                                        : `Tucumán (${getTurnosPendientes("TUCUMAN").length})`}
                                </span>
                                <span className="sm:hidden">{getTurnosPendientes("TUCUMAN").length === 0 ? "TUC✓" : "TUC"}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalNeuquen}
                                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("NEUQUEN").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("NEUQUEN").length === 0
                                        ? "Neuquén OK"
                                        : `Neuquén (${getTurnosPendientes("NEUQUEN").length})`}
                                </span>
                                <span className="sm:hidden">{getTurnosPendientes("NEUQUEN").length === 0 ? "NEU✓" : "NEU"}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalSantaFe}
                                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("SANTA FE").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("SANTA FE").length === 0
                                        ? "Santa Fe OK"
                                        : `Santa Fe (${getTurnosPendientes("SANTA FE").length})`}
                                </span>
                                <span className="sm:hidden">{getTurnosPendientes("SANTA FE").length === 0 ? "SF✓" : "SF"}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalMisiones}
                                className="border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("MISIONES").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("MISIONES").length === 0
                                        ? "Misiones OK"
                                        : `Misiones (${getTurnosPendientes("MISIONES").length})`}
                                </span>
                                <span className="sm:hidden">{getTurnosPendientes("MISIONES").length === 0 ? "MIS✓" : "MIS"}</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalSantiago}
                                className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("SANTIAGO DEL ESTERO").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("SANTIAGO DEL ESTERO").length === 0
                                        ? "Santiago OK"
                                        : `Santiago (${getTurnosPendientes("SANTIAGO DEL ESTERO").length})`}
                                </span>
                                <span className="sm:hidden">
                                    {getTurnosPendientes("SANTIAGO DEL ESTERO").length === 0 ? "SGO✓" : "SGO"}
                                </span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={abrirModalMontevideo}
                                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 bg-transparent text-xs h-8"
                                disabled={getTurnosPendientes("MONTEVIDEO").length === 0}
                            >
                                <Keyboard className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">
                                    {getTurnosPendientes("MONTEVIDEO").length === 0
                                        ? "Montevideo OK"
                                        : `Montevideo (${getTurnosPendientes("MONTEVIDEO").length})`}
                                </span>
                                <span className="sm:hidden">{getTurnosPendientes("MONTEVIDEO").length === 0 ? "MVD✓" : "MVD"}</span>
                            </Button>

                            {/* Botones Tipear - Dinámicos para OTRAS loterías (NUEVO) */}
                            {OTHER_LOTERIAS_FOR_DYNAMIC_BUTTONS.map((loteria) => {
                                const turnosPendientes = getTurnosPendientes(loteria)
                                const isDisabled = turnosPendientes.length === 0
                                return (
                                    <Button
                                        key={loteria}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => abrirGenericModal(loteria)} // Usa el nuevo abridor de modal genérico
                                        className={`${getLoteriaColor(loteria)} bg-transparent text-xs h-8`}
                                        disabled={isDisabled}
                                    >
                                        <Keyboard className="h-3 w-3 mr-1" />
                                        <span className="hidden sm:inline">
                                            {isDisabled ? `${loteria} OK` : `${loteria} (${turnosPendientes.length})`}
                                        </span>
                                        <span className="sm:hidden">
                                            {isDisabled ? `${getAbreviacion(loteria)}✓` : getAbreviacion(loteria)}
                                        </span>
                                    </Button>
                                )
                            })}

                            {/* Botones de acción adicionales */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConfirmar}
                                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 bg-transparent text-xs h-8"
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Confirmar</span>
                                <span className="sm:hidden">OK</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500 bg-transparent text-xs h-8"
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Eliminar Conf.</span>
                                <span className="sm:hidden">DEL</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 bg-transparent text-xs h-8"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Eliminar</span>
                                <span className="sm:hidden">DEL</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500 bg-transparent text-xs h-8"
                            >
                                <Printer className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Imprimir</span>
                                <span className="sm:hidden">IMP</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToExcel}
                                className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-500 bg-transparent text-xs h-8"
                            >
                                <Download className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Exportar</span>
                                <span className="sm:hidden">EXP</span>
                            </Button>
                        </div>

                        {/* Nota informativa - Responsive */}
                        <div className="mb-4 p-3 sm:p-4 bg-blue-100 border border-blue-300 rounded-lg flex items-start">
                            <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs sm:text-sm text-blue-800">
                                <p className="mb-2">
                                    <strong>Montevideo (Uruguay):</strong> {getMensajeDisponibilidadMontevideo()}
                                </p>
                                <p>
                                    Para las provincias argentinas y otras loterías, use los botones "Tipear" para ingresar los resultados
                                    manualmente. Los resultados se guardarán con la fecha seleccionada.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="mb-4 bg-red-100 border-red-400 text-red-700 flex items-start">
                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                            </Alert>
                        )}
                        {extractos.length > 0 && (
                            <Alert variant="default" className="mb-4 bg-green-100 border-green-400 text-green-700 flex items-start">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">{`Se cargaron ${extractos.length} extractos correctamente.`}</AlertDescription>
                            </Alert>
                        )}
                        {extractos.length === 0 && !isLoading && (
                            <Alert
                                variant="default"
                                className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700 flex items-start"
                            >
                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">
                                    No se encontraron extractos para la fecha seleccionada.
                                </AlertDescription>
                            </Alert>
                        )}
                        {usarFechaForzada && (
                            <Alert variant="default" className="mb-4 bg-blue-100 border-blue-400 text-blue-700 flex items-start">
                                <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">
                                    Usando fecha forzada de Argentina para los resultados.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Tabla responsive */}
                        <div className="rounded-lg overflow-x-auto shadow-md border border-blue-200 bg-white">
                            <Table className="w-full min-w-[800px] [&_th]:p-1 [&_td]:p-1 sm:[&_th]:p-2 sm:[&_td]:p-2 [&_th]:text-xs [&_td]:text-xs">
                                <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                    <TableRow>
                                        <TableHead className="w-[30px] sm:w-[40px] text-white">
                                            <Checkbox
                                                className="h-3 w-3 border-white text-white"
                                                checked={selectAll} // Corrected: depends only on selectAll
                                                onCheckedChange={handleSelectAll} // Corrected: uses the dedicated handler
                                            />
                                        </TableHead>
                                        <TableHead className="text-white font-bold min-w-[60px]">Id</TableHead>
                                        <TableHead className="text-white font-bold min-w-[120px] hidden sm:table-cell">Fecha</TableHead>
                                        <TableHead className="text-white font-bold min-w-[80px]">Sorteo</TableHead>
                                        <TableHead className="text-white font-bold min-w-[80px]">Lotería</TableHead>
                                        <TableHead className="text-white font-bold min-w-[60px] hidden md:table-cell">Necesita</TableHead>
                                        <TableHead className="text-white font-bold min-w-[80px]">Confirmado</TableHead>
                                        {Array.from({ length: 20 }, (_, i) => (
                                            <TableHead key={i} className="text-center text-white font-bold min-w-[40px]">
                                                {String(i + 1).padStart(2, "0")}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-white font-bold min-w-[80px] hidden lg:table-cell">Pizarra</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={28} className="h-16 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                                                <p className="mt-2 text-xs sm:text-sm text-blue-600">Cargando extractos...</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : extractos.length > 0 ? (
                                        extractos.sort(sortExtractos).map((extracto, index) => (
                                            <TableRow
                                                key={extracto.id}
                                                className={`${index % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        className="h-3 w-3 border-blue-400 text-blue-600"
                                                        checked={extractosSeleccionados.includes(extracto.id)} // Corrected: depends on individual selection
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setExtractosSeleccionados([...extractosSeleccionados, extracto.id])
                                                            } else {
                                                                setExtractosSeleccionados(extractosSeleccionados.filter((id) => id !== extracto.id))
                                                            }
                                                            setSelectAll(false) // Deselect "select all" if any individual is unchecked
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium text-blue-800">{extracto.id}</TableCell>
                                                <TableCell className="text-indigo-600 font-medium hidden sm:table-cell">
                                                    <span className="hidden lg:inline">{formatDateAndDay(extracto.fecha)}</span>
                                                    <span className="lg:hidden">{extracto.fecha}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${getSorteoColor(extracto.sorteo)} text-xs`}>{extracto.sorteo}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-purple-700">{extracto.loteria}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {extracto.necesita === "Sí" ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 text-xs">Sí</Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs">No</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {extracto.confirmado === "Sí" ? (
                                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-xs">
                                                            <CheckCircle className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                                            <span className="hidden sm:inline">Sí</span>
                                                            <span className="sm:hidden">✓</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-800 hover:bg-red-200 text-xs">
                                                            <XCircle className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                                            <span className="hidden sm:inline">No</span>
                                                            <span className="sm:hidden">✗</span>
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                {extracto.numeros.map((numero, index) => (
                                                    <TableCell key={index} className="text-center">
                                                        {editMode ? (
                                                            <input
                                                                type="text"
                                                                value={numero}
                                                                onChange={(e) => handleNumberChange(extracto.id, index, e.target.value)}
                                                                className="w-8 sm:w-12 text-center border border-blue-300 rounded focus:border-blue-500 focus:ring-blue-500 text-xs"
                                                            />
                                                        ) : (
                                                            <span className="font-mono font-medium text-gray-800 text-xs">{numero}</span>
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="hidden lg:table-cell">
                                                    <a
                                                        href={extracto.pizarraLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center text-xs"
                                                    >
                                                        <FileText className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                                                        <span className="hidden xl:inline">Ver pizarra</span>
                                                        <span className="xl:hidden">Ver</span>
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={28} className="h-16 text-center text-gray-500 text-xs sm:text-sm">
                                                No hay extractos disponibles para la fecha seleccionada.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Sección de diagnóstico - Responsive */}
                        <div className="mt-6 p-3 sm:p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <h3 className="text-xs sm:text-sm font-bold mb-2 text-gray-700 flex items-center">
                                <Info className="h-3 w-3 sm:h-4 sm:w-4 mr-1 text-gray-600" />
                                Información de diagnóstico:
                            </h3>
                            <pre className="text-xs overflow-auto max-h-32 sm:max-h-40 p-2 bg-gray-200 rounded border border-gray-300">
                                {debugInfo}
                            </pre>
                        </div>
                    </CardContent>
                </Card>

                {/* Modal de Tucumán */}
                <Dialog open={showTucumanModal} onOpenChange={(open) => !open && cerrarModal("TUCUMAN", setShowTucumanModal)}>
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - TUCUMÁN ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                        </DialogHeader>
                        {getTurnosPendientes("TUCUMAN").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">¡Todos los turnos de TUCUMÁN ya están guardados!</p>
                                <p className="text-sm text-gray-600 mt-2">No hay turnos pendientes para tipear.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("TUCUMAN").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, tucumanData)
                                        const turnoCompleto = isTurnoCompleto(turno, tucumanData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {tucumanData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleTucumanNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="TUCUMAN"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("TUCUMAN", setShowTucumanModal)}
                                        disabled={isSavingTucuman}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarTucuman}
                                        disabled={
                                            isSavingTucuman ||
                                            getTurnosPendientes("TUCUMAN").filter((turno) => isTurnoCompleto(turno, tucumanData)).length === 0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingTucuman ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {getTurnosPendientes("TUCUMAN").filter((turno) => isTurnoCompleto(turno, tucumanData)).length}{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Neuquén */}
                <Dialog open={showNeuquenModal} onOpenChange={(open) => !open && cerrarModal("NEUQUEN", setShowNeuquenModal)}>
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - NEUQUÉN ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                        </DialogHeader>
                        {getTurnosPendientes("NEUQUEN").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">¡Todos los turnos de NEUQUÉN ya están guardados!</p>
                                <p className="text-sm text-gray-600 mt-2">No hay turnos pendientes para tipear.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("NEUQUEN").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, neuquenData)
                                        const turnoCompleto = isTurnoCompleto(turno, neuquenData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {neuquenData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleNeuquenNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="NEUQUEN"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("NEUQUEN", setShowNeuquenModal)}
                                        disabled={isSavingNeuquen}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarNeuquen}
                                        disabled={
                                            isSavingNeuquen ||
                                            getTurnosPendientes("NEUQUEN").filter((turno) => isTurnoCompleto(turno, neuquenData)).length === 0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingNeuquen ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {getTurnosPendientes("NEUQUEN").filter((turno) => isTurnoCompleto(turno, neuquenData)).length}{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Santa Fe */}
                <Dialog open={showSantaFeModal} onOpenChange={(open) => !open && cerrarModal("SANTA FE", setShowSantaFeModal)}>
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - SANTA FE ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                        </DialogHeader>
                        {getTurnosPendientes("SANTA FE").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">
                                    ¡Todos los turnos de SANTA FE ya están guardados!
                                </p>
                                <p className="text-sm text-gray-600 mt-2">No hay turnos pendientes para tipear.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("SANTA FE").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, santaFeData)
                                        const turnoCompleto = isTurnoCompleto(turno, santaFeData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {santaFeData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleSantaFeNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="SANTA"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("SANTA FE", setShowSantaFeModal)}
                                        disabled={isSavingSantaFe}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarSantaFe}
                                        disabled={
                                            isSavingSantaFe ||
                                            getTurnosPendientes("SANTA FE").filter((turno) => isTurnoCompleto(turno, santaFeData)).length ===
                                            0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingSantaFe ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {getTurnosPendientes("SANTA FE").filter((turno) => isTurnoCompleto(turno, santaFeData)).length}{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Misiones */}
                <Dialog
                    open={showMisionesModal}
                    onOpenChange={(open) => !open && cerrarModal("MISIONES", setShowMisionesModal)}
                >
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - MISIONES ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                        </DialogHeader>
                        {getTurnosPendientes("MISIONES").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">
                                    ¡Todos los turnos de MISIONES ya están guardados!
                                </p>
                                <p className="text-sm text-gray-600 mt-2">No hay turnos pendientes para tipear.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("MISIONES").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, misionesData)
                                        const turnoCompleto = isTurnoCompleto(turno, misionesData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {misionesData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleMisionesNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="MISION"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("MISIONES", setShowMisionesModal)}
                                        disabled={isSavingMisiones}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarMisiones}
                                        disabled={
                                            isSavingMisiones ||
                                            getTurnosPendientes("MISIONES").filter((turno) => isTurnoCompleto(turno, misionesData)).length ===
                                            0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingMisiones ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {getTurnosPendientes("MISIONES").filter((turno) => isTurnoCompleto(turno, misionesData)).length}{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Santiago */}
                <Dialog
                    open={showSantiagoModal}
                    onOpenChange={(open) => !open && cerrarModal("SANTIAGO DEL ESTERO", setShowSantiagoModal)}
                >
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - SANTIAGO ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                            <div className="text-center text-sm text-gray-600 mt-2">
                                {getMensajeDisponibilidad("SANTIAGO DEL ESTERO")}
                            </div>
                        </DialogHeader>
                        {getTurnosPendientes("SANTIAGO DEL ESTERO").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">
                                    {getDay(selectedDate) === 0
                                        ? "¡Todos los turnos de Matutina y Vespertina de Santiago ya están guardados para este domingo!"
                                        : "¡Todos los turnos de SANTIAGO ya están guardados para la fecha seleccionada!"}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {getDay(selectedDate) === 0
                                        ? "No hay más turnos pendientes para tipear en Santiago este domingo."
                                        : "No hay turnos pendientes para tipear."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("SANTIAGO DEL ESTERO").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, santiagoData)
                                        const turnoCompleto = isTurnoCompleto(turno, santiagoData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {santiagoData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleSantiagoNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="SANTIAGO"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("SANTIAGO DEL ESTERO", setShowSantiagoModal)}
                                        disabled={isSavingSantiago}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarSantiago}
                                        disabled={
                                            isSavingSantiago ||
                                            getTurnosPendientes("SANTIAGO DEL ESTERO").filter((turno) => isTurnoCompleto(turno, santiagoData))
                                                .length === 0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingSantiago ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {
                                                    getTurnosPendientes("SANTIAGO DEL ESTERO").filter((turno) =>
                                                        isTurnoCompleto(turno, santiagoData),
                                                    ).length
                                                }{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Montevideo con lógica específica de días */}
                <Dialog
                    open={showMontevideoModal}
                    onOpenChange={(open) => !open && cerrarModal("MONTEVIDEO", setShowMontevideoModal)}
                >
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - MONTEVIDEO ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                            <div className="text-center text-sm text-gray-600 mt-2">{getMensajeDisponibilidadMontevideo()}</div>
                        </DialogHeader>
                        {getTurnosPendientes("MONTEVIDEO").length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">
                                    {getDay(selectedDate) === 0
                                        ? "Los domingos no hay sorteos en Montevideo"
                                        : "¡Todos los turnos disponibles de MONTEVIDEO ya están guardados!"}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {getDay(selectedDate) === 0
                                        ? "Seleccione otro día para ingresar resultados."
                                        : "No hay turnos pendientes para tipear."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes("MONTEVIDEO").map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, montevideoData)
                                        const turnoCompleto = isTurnoCompleto(turno, montevideoData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {montevideoData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleMontevideoNumberChange(turno, index, e.target.value)}
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-provincia="MONTEVIDEO"
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => cerrarModal("MONTEVIDEO", setShowMontevideoModal)}
                                        disabled={isSavingMontevideo}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarMontevideo}
                                        disabled={
                                            isSavingMontevideo ||
                                            getTurnosPendientes("MONTEVIDEO").filter((turno) => isTurnoCompleto(turno, montevideoData))
                                                .length === 0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingMontevideo ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {
                                                    getTurnosPendientes("MONTEVIDEO").filter((turno) => isTurnoCompleto(turno, montevideoData))
                                                        .length
                                                }{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal Genérico para tipear cualquier lotería (NUEVO) */}
                <Dialog open={showGenericModal} onOpenChange={(open) => !open && cerrarGenericModal()}>
                    <DialogContent
                        className="max-w-4xl max-h-[80vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-center">
                                Tipear Resultados - {currentGenericLoteria} ({format(selectedDate, "dd/MM/yyyy", { locale: es })})
                            </DialogTitle>
                            <div className="text-center text-sm text-gray-600 mt-2">
                                {getMensajeDisponibilidad(currentGenericLoteria)}
                            </div>
                        </DialogHeader>
                        {getTurnosPendientes(currentGenericLoteria).length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                <p className="text-lg font-semibold text-green-700">
                                    {currentGenericLoteria === "MONTEVIDEO" && getDay(selectedDate) === 0
                                        ? "Los domingos no hay sorteos en Montevideo"
                                        : currentGenericLoteria === "SANTIAGO DEL ESTERO" && getDay(selectedDate) === 0
                                            ? "¡Todos los turnos de Matutina y Vespertina de Santiago ya están guardados para este domingo!"
                                            : `¡Todos los turnos disponibles de ${currentGenericLoteria} ya están guardados!`}
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    {currentGenericLoteria === "MONTEVIDEO" && getDay(selectedDate) === 0
                                        ? "Seleccione otro día para ingresar resultados."
                                        : currentGenericLoteria === "SANTIAGO DEL ESTERO" && getDay(selectedDate) === 0
                                            ? "No hay más turnos pendientes para tipear en Santiago este domingo."
                                            : "No hay turnos pendientes para tipear."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {getTurnosPendientes(currentGenericLoteria).map((turno) => {
                                        const numerosCompletados = contarNumerosCompletados(turno, currentGenericLoteriaData)
                                        const turnoCompleto = isTurnoCompleto(turno, currentGenericLoteriaData)
                                        return (
                                            <div key={turno} className="border rounded-lg p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <Label className="text-sm font-semibold">{turno}</Label>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded ${turnoCompleto ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {numerosCompletados}/20
                                                        </span>
                                                        {turnoCompleto && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                                    {currentGenericLoteriaData[turno].map((numero, index) => (
                                                        <Input
                                                            key={index}
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) =>
                                                                handleGenericNumberChange(currentGenericLoteria, turno, index, e.target.value)
                                                            }
                                                            className={`text-center text-xs h-8 ${numero.length === 4 && /^\d{4}$/.test(numero)
                                                                    ? "border-green-300 bg-green-50"
                                                                    : numero.length > 0
                                                                        ? "border-yellow-300 bg-yellow-50"
                                                                        : "border-gray-300"
                                                                }`}
                                                            placeholder={`${index + 1}`}
                                                            maxLength={4}
                                                            data-loteria={currentGenericLoteria}
                                                            data-turno={turno}
                                                            data-index={index}
                                                        />
                                                    ))}
                                                </div>
                                                {!turnoCompleto && numerosCompletados > 0 && (
                                                    <p className="text-xs text-yellow-600 mt-2">
                                                        Faltan {20 - numerosCompletados} números de 4 dígitos para completar este turno
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <Button variant="outline" onClick={() => cerrarGenericModal()} disabled={isSavingGenericLoteria}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleConfirmarGenericLoteria}
                                        disabled={
                                            isSavingGenericLoteria ||
                                            getTurnosPendientes(currentGenericLoteria).filter((turno) =>
                                                isTurnoCompleto(turno, currentGenericLoteriaData),
                                            ).length === 0
                                        }
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        {isSavingGenericLoteria ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirmar (
                                                {
                                                    getTurnosPendientes(currentGenericLoteria).filter((turno) =>
                                                        isTurnoCompleto(turno, currentGenericLoteriaData),
                                                    ).length
                                                }{" "}
                                                turnos listos)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}

interface ProvinciaModalProps {
    provincia: string
    data: ProvinciaData
    setData: React.Dispatch<React.SetStateAction<ProvinciaData>>
    handleNumberChange: (turno: string, index: number, value: string) => void
    isSaving: boolean
    onConfirm: () => void
    onClose: () => void
    getTurnosYaGuardados: (loteriaBoton: string) => string[]
    getTurnosPendientes: (provincia: string) => string[]
    isTurnoCompleto: (turno: string, data: ProvinciaData) => boolean
    contarNumerosCompletados: (turno: string, data: ProvinciaData) => number
    mensajeDisponibilidad?: string
}

const ProvinciaModal: React.FC<ProvinciaModalProps> = ({
    provincia,
    data,
    setData,
    handleNumberChange,
    isSaving,
    onConfirm,
    onClose,
    getTurnosYaGuardados,
    getTurnosPendientes,
    isTurnoCompleto,
    contarNumerosCompletados,
    mensajeDisponibilidad,
}) => {
    const turnosYaGuardados = getTurnosYaGuardados(provincia)
    const turnosPendientes = getTurnosPendientes(provincia)
    const todosTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
    const turnosDisponibles = todosTurnos.filter((turno) => turnosPendientes.includes(turno))

    return (
        <div>
            {mensajeDisponibilidad && (
                <Alert variant="default" className="mb-4 bg-blue-100 border-blue-400 text-blue-700 flex items-start">
                    <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs sm:text-sm">{mensajeDisponibilidad}</AlertDescription>
                </Alert>
            )}
            {turnosDisponibles.length === 0 ? (
                <Alert variant="default" className="mb-4 bg-green-100 border-green-400 text-green-700 flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs sm:text-sm">
                        Todos los turnos de {provincia} ya fueron tipeados para este día.
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert variant="default" className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700 flex items-start">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs sm:text-sm">
                        {turnosPendientes.length} turnos pendientes de {provincia} para este día: {turnosPendientes.join(", ")}.
                    </AlertDescription>
                </Alert>
            )}

            {todosTurnos.map((turno) => (
                <div key={turno} className="mb-4">
                    <Label className="block font-medium text-gray-700 mb-2">{turno}</Label>
                    <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 20 }).map((_, index) => (
                            <Input
                                key={index}
                                type="text"
                                placeholder={`${index + 1}`}
                                value={data[turno][index] || ""}
                                onChange={(e) => handleNumberChange(turno, index, e.target.value)}
                                className="w-full text-center"
                                data-provincia={provincia}
                                data-turno={turno}
                                data-index={index}
                                maxLength={4}
                            />
                        ))}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">{contarNumerosCompletados(turno, data)}/20 números completos</div>
                </div>
            ))}

            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Cancelar
                </Button>
                <Button type="button" onClick={onConfirm} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Guardar
                </Button>
            </div>
        </div>
    )
}
