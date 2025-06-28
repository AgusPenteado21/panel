"use client"

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
import { format, setHours, isFuture, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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

interface TucumanData {
    [key: string]: string[] // turno -> numeros
}

async function confirmarResultados(extractos: Extracto[]): Promise<any> {
    console.log("Confirmando resultados:", extractos)
    return { success: true, message: "Resultados confirmados localmente" }
}

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
    const [tucumanData, setTucumanData] = useState<TucumanData>({
        Previa: Array(20).fill(""),
        Primera: Array(20).fill(""),
        Matutina: Array(20).fill(""),
        Vespertina: Array(20).fill(""),
        Nocturna: Array(20).fill(""),
    })
    const [isSavingTucuman, setIsSavingTucuman] = useState(false)

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

                let apiUrl = `/api/extractos?date=${dateParam}`
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

    const handleTucumanNumberChange = (turno: string, index: number, value: string) => {
        // Solo permitir números y máximo 4 dígitos
        const numeroLimpio = value.replace(/\D/g, "").slice(0, 4)

        setTucumanData((prev) => ({
            ...prev,
            [turno]: prev[turno].map((num, i) => (i === index ? numeroLimpio : num)),
        }))

        // Auto-focus al siguiente campo cuando se completen 4 dígitos
        if (numeroLimpio.length === 4) {
            const nextIndex = index + 1
            if (nextIndex < 20) {
                // Focus al siguiente input del mismo turno
                const nextInput = document.querySelector(
                    `input[data-turno="${turno}"][data-index="${nextIndex}"]`,
                ) as HTMLInputElement
                if (nextInput) {
                    nextInput.focus()
                    nextInput.select()
                }
            } else {
                // Si es el último del turno, pasar al primer input del siguiente turno
                const turnos = Object.keys(tucumanData)
                const currentTurnoIndex = turnos.indexOf(turno)
                if (currentTurnoIndex < turnos.length - 1) {
                    const nextTurno = turnos[currentTurnoIndex + 1]
                    const firstInputNextTurno = document.querySelector(
                        `input[data-turno="${nextTurno}"][data-index="0"]`,
                    ) as HTMLInputElement
                    if (firstInputNextTurno) {
                        firstInputNextTurno.focus()
                    }
                }
            }
        }
    }

    // Función para obtener turnos de Tucumán ya guardados
    const getTurnosYaGuardados = () => {
        const turnosTucuman = extractos
            .filter((extracto) => extracto.provincia === "TUCUMAN" || extracto.loteria === "TUCUMAN")
            .map((extracto) => extracto.sorteo)
        return turnosTucuman
    }

    // Función para obtener solo turnos pendientes
    const getTurnosPendientes = () => {
        const turnosYaGuardados = getTurnosYaGuardados()
        const todosTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
        return todosTurnos.filter((turno) => !turnosYaGuardados.includes(turno))
    }

    // Función para validar que un turno esté completo
    const isTurnoCompleto = (turno: string) => {
        const numerosDelTurno = tucumanData[turno]
        const numerosCompletos = numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim()))
        return numerosCompletos.length === 20
    }

    // Función para contar números completados en un turno
    const contarNumerosCompletados = (turno: string) => {
        const numerosDelTurno = tucumanData[turno]
        return numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim())).length
    }

    const handleConfirmarTucuman = async () => {
        try {
            setIsSavingTucuman(true)
            setError(null)

            const fecha = format(selectedDate, "dd/MM/yyyy", { locale: es })
            const turnosPendientes = getTurnosPendientes()

            // Validar que al menos un turno pendiente tenga números
            const turnosConDatos = turnosPendientes.filter((turno) => {
                const numerosDelTurno = tucumanData[turno]
                // Verificar que TODOS los 20 números estén completos y sean de 4 dígitos
                const numerosCompletos = numerosDelTurno.filter((num) => num.trim().length === 4 && /^\d{4}$/.test(num.trim()))
                return numerosCompletos.length === 20
            })

            if (turnosConDatos.length === 0) {
                setError("Debe completar TODOS los 20 números de 4 dígitos para cada turno que desee guardar")
                return
            }

            console.log("🔄 Guardando turnos de Tucumán:", turnosConDatos)

            let turnosGuardadosExitosamente = 0

            // Enviar cada turno por separado
            for (const turno of turnosConDatos) {
                const numerosCompletos = tucumanData[turno].map((num) => num.trim())

                // Validación final antes de enviar
                const todosCompletos = numerosCompletos.every((num) => /^\d{4}$/.test(num))
                if (!todosCompletos) {
                    throw new Error(`El turno ${turno} tiene números incompletos. Todos deben ser de 4 dígitos.`)
                }

                console.log(`📤 Enviando ${turno}:`, numerosCompletos)

                const response = await fetch("/api/extractos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        provincia: "TUCUMAN",
                        turno: turno,
                        fecha: fecha,
                        numeros: numerosCompletos,
                    }),
                })

                const responseData = await response.json()
                console.log(`📥 Respuesta ${turno}:`, responseData)

                if (!response.ok) {
                    throw new Error(
                        `Error al guardar ${turno}: ${responseData.error || responseData.detalles || response.statusText}`,
                    )
                }

                if (!responseData.success) {
                    throw new Error(`Error al guardar ${turno}: ${responseData.error || "Respuesta no exitosa del servidor"}`)
                }

                turnosGuardadosExitosamente++
                console.log(`✅ ${turno} guardado exitosamente`)
            }

            // Si llegamos aquí, todos los turnos se guardaron exitosamente
            console.log(`🎉 ${turnosGuardadosExitosamente} turnos guardados exitosamente en la base de datos`)

            // Limpiar solo los turnos que se guardaron
            setTucumanData((prev) => {
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
                setShowTucumanModal(false)
                // Mostrar alerta de éxito (opcional)
                alert(`✅ ${turnosGuardadosExitosamente} turno(s) de Tucumán guardado(s) exitosamente en la base de datos`)
            }, 500)
        } catch (error) {
            console.error("❌ Error al guardar Tucumán:", error)
            setError(error instanceof Error ? error.message : "Error al guardar los resultados de Tucumán")
        } finally {
            setIsSavingTucuman(false)
        }
    }

    const formatDateAndDay = (fecha: string) => {
        try {
            const [day, month, year] = fecha.split("/")
            const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
            return format(date, "dd/MM/yyyy (EEEE)", { locale: es })
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
            const response = await fetch("/api/extractos/forzar-fecha", {
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

    useEffect(() => {
        fetchExtractos(selectedDate)
    }, [fetchExtractos, selectedDate])

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <main className="container mx-auto p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold flex items-center">
                            <FileText className="h-6 w-6 mr-2" />
                            Extractos del Día
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-blue-200">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[280px] justify-start text-left font-normal border-blue-300 hover:border-blue-500 hover:bg-blue-50",
                                                !selectedDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                            {selectedDate ? (
                                                format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })
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

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={isLoading}
                                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500 bg-transparent"
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
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500 bg-transparent"
                                >
                                    <span className="text-xs">Forzar Fecha Argentina</span>
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6 bg-white p-3 rounded-lg shadow-sm border border-blue-200">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditMode(!editMode)}
                                className={
                                    editMode
                                        ? "border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
                                        : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                                }
                            >
                                {editMode ? (
                                    <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        <span className="text-xs">Guardar</span>
                                    </>
                                ) : (
                                    <>
                                        <Edit className="h-3 w-3 mr-1" />
                                        <span className="text-xs">Modificar</span>
                                    </>
                                )}
                            </Button>

                            {/* Botón Tipear Tucumán */}
                            <Dialog open={showTucumanModal} onOpenChange={setShowTucumanModal}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-500 bg-transparent"
                                        disabled={getTurnosPendientes().length === 0}
                                    >
                                        <Keyboard className="h-3 w-3 mr-1" />
                                        <span className="text-xs">
                                            {getTurnosPendientes().length === 0 ? "Completo" : `Tipear (${getTurnosPendientes().length})`}
                                        </span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle className="text-lg font-bold text-center">Tipear Resultados - Tucumán</DialogTitle>
                                    </DialogHeader>

                                    {getTurnosPendientes().length === 0 ? (
                                        <div className="text-center py-8">
                                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                            <p className="text-lg font-semibold text-green-700">
                                                ¡Todos los turnos de Tucumán ya están guardados!
                                            </p>
                                            <p className="text-sm text-gray-600 mt-2">No hay turnos pendientes para tipear.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-6">
                                                {getTurnosPendientes().map((turno) => {
                                                    const numerosCompletados = contarNumerosCompletados(turno)
                                                    const turnoCompleto = isTurnoCompleto(turno)

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
                                                            <div className="grid grid-cols-10 gap-2">
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
                                                <Button variant="outline" onClick={() => setShowTucumanModal(false)} disabled={isSavingTucuman}>
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    onClick={handleConfirmarTucuman}
                                                    disabled={
                                                        isSavingTucuman ||
                                                        getTurnosPendientes().filter((turno) => isTurnoCompleto(turno)).length === 0
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
                                                            Confirmar ({getTurnosPendientes().filter((turno) => isTurnoCompleto(turno)).length} turnos
                                                            listos)
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConfirmar}
                                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 bg-transparent"
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span className="text-xs">Confirmar</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500 bg-transparent"
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                <span className="text-xs">Eliminar Confirmación</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 bg-transparent"
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                <span className="text-xs">Eliminar Extracto</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500 bg-transparent"
                            >
                                <Printer className="h-3 w-3 mr-1" />
                                <span className="text-xs">Imprimir</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToExcel}
                                className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-500 bg-transparent"
                            >
                                <Download className="h-3 w-3 mr-1" />
                                <span className="text-xs">Exportar</span>
                            </Button>
                        </div>

                        <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg flex items-start">
                            <Info className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800">
                                Nota: Los sorteos de Montevideo (Matutina y Nocturna) solo se muestran de lunes a viernes. Para Tucumán,
                                use el botón "Tipear" para ingresar los resultados manualmente.
                            </p>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="mb-4 bg-red-100 border-red-400 text-red-700 flex items-start">
                                <AlertTriangle className="h-5 w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {extractos.length > 0 && (
                            <Alert variant="default" className="mb-4 bg-green-100 border-green-400 text-green-700 flex items-start">
                                <CheckCircle className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>{`Se cargaron ${extractos.length} extractos correctamente.`}</AlertDescription>
                            </Alert>
                        )}

                        {extractos.length === 0 && !isLoading && (
                            <Alert
                                variant="default"
                                className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700 flex items-start"
                            >
                                <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>No se encontraron extractos para la fecha seleccionada.</AlertDescription>
                            </Alert>
                        )}

                        {usarFechaForzada && (
                            <Alert variant="default" className="mb-4 bg-blue-100 border-blue-400 text-blue-700 flex items-start">
                                <Info className="h-5 w-5 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>Usando fecha forzada de Argentina para los resultados.</AlertDescription>
                            </Alert>
                        )}

                        <div className="rounded-lg overflow-x-auto shadow-md border border-blue-200 bg-white">
                            <Table className="w-full [&_th]:p-2 [&_td]:p-2 [&_th]:text-xs [&_td]:text-xs">
                                <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                    <TableRow>
                                        <TableHead className="w-[40px] text-white">
                                            <Checkbox
                                                className="h-3 w-3 border-white text-white"
                                                checked={selectAll}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="text-white font-bold">Id</TableHead>
                                        <TableHead className="text-white font-bold">Fecha</TableHead>
                                        <TableHead className="text-white font-bold">Sorteo</TableHead>
                                        <TableHead className="text-white font-bold">Lotería</TableHead>
                                        <TableHead className="text-white font-bold">Necesita</TableHead>
                                        <TableHead className="text-white font-bold">Confirmado</TableHead>
                                        {Array.from({ length: 20 }, (_, i) => (
                                            <TableHead key={i} className="text-center text-white font-bold">
                                                {String(i + 1).padStart(2, "0")}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-white font-bold">Pizarra</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={28} className="h-16 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                                                <p className="mt-2 text-sm text-blue-600">Cargando extractos...</p>
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
                                                        checked={selectAll || extractosSeleccionados.includes(extracto.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (selectAll) {
                                                                setSelectAll(false)
                                                                setExtractosSeleccionados(extractos.map((e) => e.id).filter((id) => id !== extracto.id))
                                                            } else {
                                                                if (checked) {
                                                                    setExtractosSeleccionados([...extractosSeleccionados, extracto.id])
                                                                } else {
                                                                    setExtractosSeleccionados(extractosSeleccionados.filter((id) => id !== extracto.id))
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium text-blue-800">{extracto.id}</TableCell>
                                                <TableCell className="text-indigo-600 font-medium">
                                                    {formatDateAndDay(extracto.fecha)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`${getSorteoColor(extracto.sorteo)}`}>{extracto.sorteo}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-purple-700">{extracto.loteria}</TableCell>
                                                <TableCell>
                                                    {extracto.necesita === "Sí" ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Sí</Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">No</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {extracto.confirmado === "Sí" ? (
                                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Sí
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">
                                                            <XCircle className="h-3 w-3 mr-1" />
                                                            No
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
                                                                className="w-12 text-center border border-blue-300 rounded focus:border-blue-500 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <span className="font-mono font-medium text-gray-800">{numero}</span>
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell>
                                                    <a
                                                        href={extracto.pizarraLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                                                    >
                                                        <FileText className="h-3 w-3 mr-1" />
                                                        Ver pizarra
                                                    </a>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={28} className="h-16 text-center text-gray-500">
                                                No hay extractos disponibles para la fecha seleccionada.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Sección de diagnóstico */}
                        <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <h3 className="text-sm font-bold mb-2 text-gray-700 flex items-center">
                                <Info className="h-4 w-4 mr-1 text-gray-600" />
                                Información de diagnóstico:
                            </h3>
                            <pre className="text-xs overflow-auto max-h-40 p-2 bg-gray-200 rounded border border-gray-300">
                                {debugInfo}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
