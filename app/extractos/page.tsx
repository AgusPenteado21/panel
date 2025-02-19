"use client"

import { useState, useCallback, useEffect } from "react"
import Navbar from "../components/Navbar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCcw, CalendarIcon } from "lucide-react"
import * as XLSX from "xlsx"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, setHours, isFuture, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

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
        const today = startOfDay(new Date())
        return setHours(today, 12)
    })
    const [debugInfo, setDebugInfo] = useState<string>("")

    const fetchExtractos = useCallback(async (date: Date) => {
        console.log(`Fetching extractos for date: ${date.toISOString()}`)
        try {
            setIsLoading(true)
            setError(null)
            setDebugInfo("Iniciando fetchExtractos")
            const dateParam = format(date, "yyyy-MM-dd")
            const apiUrl = `/api/extractos?date=${dateParam}`
            setDebugInfo((prev) => prev + `\nIntentando cargar datos de: ${apiUrl}`)

            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            setDebugInfo((prev) => prev + `\nRespuesta recibida. Status: ${response.status}`)

            if (!response.ok) {
                throw new Error(`Error HTTP! status: ${response.status}`)
            }

            const data = await response.json()
            setDebugInfo((prev) => prev + `\nDatos recibidos: ${JSON.stringify(data)}`)

            if (data && Array.isArray(data) && data.length > 0) {
                const extractosConCamposAdicionales = data.map((extracto: any) => ({
                    ...extracto,
                    necesita: extracto.necesita || "No",
                    confirmado: extracto.confirmado || "No",
                }))
                setExtractos(extractosConCamposAdicionales)
                setLastUpdate(new Date().toLocaleTimeString())
                setDebugInfo((prev) => prev + `\n${data.length} extractos cargados`)
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
    }, [])

    const handleNumberChange = (extractoId: string, index: number, value: string) => {
        setExtractos((prevExtractos) =>
            prevExtractos.map((extracto) =>
                extracto.id === extractoId
                    ? { ...extracto, numeros: extracto.numeros.map((num, i) => (i === index ? value : num)) }
                    : extracto,
            ),
        )
    }

    const formatDateAndDay = (fecha: string) => {
        const [day, month, year] = fecha.split("/")
        const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
        return format(date, "dd/MM/yyyy (EEEE)", { locale: es })
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

    const sorteoOrder = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    const sortExtractos = (a: Extracto, b: Extracto) => {
        return sorteoOrder.indexOf(a.sorteo) - sorteoOrder.indexOf(b.sorteo)
    }

    useEffect(() => {
        fetchExtractos(selectedDate)
    }, [fetchExtractos, selectedDate])

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main className="container mx-auto p-2">
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-xl font-bold">Extractos del Día</h1>
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                            <span className="ml-1 text-xs">Actualizar</span>
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-1 items-center">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[280px] justify-start text-left font-normal",
                                        !selectedDate && "text-muted-foreground",
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? (
                                        format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })
                                    ) : (
                                        <span>Seleccionar fecha</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={handleDateSelect}
                                    initialFocus
                                    disabled={(date) => isFuture(date)}
                                />
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                            {editMode ? "Guardar" : "Modificar"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleConfirmar}>
                            Confirmar
                        </Button>
                        <Button variant="outline" size="sm">
                            Eliminar Confirmación
                        </Button>
                        <Button variant="outline" size="sm">
                            Eliminar Extracto
                        </Button>
                        <Button variant="outline" size="sm">
                            Imprimir
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToExcel}>
                            Exportar
                        </Button>
                    </div>

                    <div className="mt-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
                        <p className="text-sm text-blue-800">
                            Nota: Los sorteos de Montevideo (Matutina y Nocturna) solo se muestran de lunes a viernes.
                        </p>
                    </div>
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {extractos.length > 0 && (
                        <Alert variant="default" className="mb-4 bg-green-100 border-green-400 text-green-700">
                            <AlertDescription>{`Se cargaron ${extractos.length} extractos correctamente.`}</AlertDescription>
                        </Alert>
                    )}
                    {extractos.length === 0 && !isLoading && (
                        <Alert variant="default" className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700">
                            <AlertDescription>No se encontraron extractos para la fecha seleccionada.</AlertDescription>
                        </Alert>
                    )}
                    <div className="rounded-md border overflow-x-auto">
                        <Table className="w-full [&_th]:p-2 [&_td]:p-2 [&_th]:text-xs [&_td]:text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox className="h-3 w-3" checked={selectAll} onCheckedChange={handleSelectAll} />
                                    </TableHead>
                                    <TableHead>Id</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Sorteo</TableHead>
                                    <TableHead>Lotería</TableHead>
                                    <TableHead>Necesita</TableHead>
                                    <TableHead>Confirmado</TableHead>
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <TableHead key={i} className="text-center">
                                            {String(i + 1).padStart(2, "0")}
                                        </TableHead>
                                    ))}
                                    <TableHead>Pizarra</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={28} className="h-16 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                            <p className="mt-2 text-sm text-muted-foreground">Cargando extractos...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : extractos.length > 0 ? (
                                    extractos.sort(sortExtractos).map((extracto) => (
                                        <TableRow key={extracto.id}>
                                            <TableCell>
                                                <Checkbox
                                                    className="h-3 w-3"
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
                                            <TableCell>{extracto.id}</TableCell>
                                            <TableCell>{formatDateAndDay(extracto.fecha)}</TableCell>
                                            <TableCell>{extracto.sorteo}</TableCell>
                                            <TableCell>{extracto.loteria}</TableCell>
                                            <TableCell>{extracto.necesita}</TableCell>
                                            <TableCell>{extracto.confirmado}</TableCell>
                                            {extracto.numeros.map((numero, index) => (
                                                <TableCell key={index} className="text-center">
                                                    {editMode ? (
                                                        <input
                                                            type="text"
                                                            value={numero}
                                                            onChange={(e) => handleNumberChange(extracto.id, index, e.target.value)}
                                                            className="w-12 text-center border rounded"
                                                        />
                                                    ) : (
                                                        numero
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                <a
                                                    href={extracto.pizarraLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:underline"
                                                >
                                                    Ver pizarra
                                                </a>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={28} className="h-16 text-center">
                                            No hay extractos disponibles para la fecha seleccionada.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>
        </div>
    )
}

