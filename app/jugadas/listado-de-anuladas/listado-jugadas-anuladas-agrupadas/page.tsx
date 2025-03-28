"use client"

import { useState, useEffect } from "react"
import { format, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, Search, AlertCircle, FileX, Ban, DollarSign, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import Navbar from "@/app/components/Navbar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface Jugada {
    decompositionStep: number
    fechaHora: string
    loteria: string
    monto: string
    montoTotal: number
    numero: string
    numeros: string[]
    originalNumero: string
    originalPosicion: string
    posicion: string
    provincias: string[]
    secuencia: string
    tipo: string
}

interface JugadaAnulada {
    id: string
    fechaAnulacion: Timestamp
    fechaHora: Timestamp
    jugadaOriginalId: string
    jugadas: Jugada[]
    loteria: string
    monto: string
    numero: string
    numeros: string[]
    pasadorId: string
    pasadorIdQueAnulo: string
    pasadorOriginal: string
    pasadorQueAnulo: string
    provincias: string[]
    secuencia: string
    tipo: string
    totalMonto: number
}

interface GroupedJugadaAnulada {
    pasadorIdQueAnulo: string
    pasadorQueAnulo: string
    totalMonto: number
    tickets: number
    detalles: JugadaAnulada[]
}

const DatePickerButton = ({ date, onChange, label }: { date: Date; onChange: (date: Date) => void; label: string }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                    "w-[120px] h-8 justify-start text-left font-normal text-xs border-red-300 hover:border-red-500 hover:bg-red-50",
                    !date && "text-muted-foreground",
                )}
            >
                <CalendarIcon className="mr-2 h-3 w-3 text-red-500" />
                {date ? format(date, "dd/MM/yyyy", { locale: es }) : label}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-red-200 shadow-lg">
            <Calendar
                mode="single"
                selected={date}
                onSelect={(date) => date && onChange(date)}
                initialFocus
                locale={es}
                className="rounded-md"
            />
        </PopoverContent>
    </Popover>
)

const DatePicker = ({
    selectedDate,
    onDateChange,
    onSearch,
    isLoading,
}: {
    selectedDate: Date
    onDateChange: (date: Date) => void
    onSearch: () => void
    isLoading: boolean
}) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
            <span className="font-medium text-red-700">Fecha:</span>
            <DatePickerButton date={selectedDate} onChange={onDateChange} label="Seleccionar" />
        </div>
        <Button
            onClick={onSearch}
            className="bg-gradient-to-r from-red-600 to-rose-700 text-white hover:from-red-700 hover:to-rose-800 h-8 px-4 text-xs rounded-md shadow-md transition-all duration-200 transform hover:scale-105"
            disabled={isLoading}
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Cargando...
                </>
            ) : (
                <>
                    <Search className="mr-2 h-3 w-3" />
                    Consultar
                </>
            )}
        </Button>
    </div>
)

const JugadasAnuladasTable = ({ jugadasAnuladas }: { jugadasAnuladas: GroupedJugadaAnulada[] }) => {
    const totalTickets = jugadasAnuladas.reduce((sum, jugada) => sum + jugada.tickets, 0)
    const totalMonto = jugadasAnuladas.reduce((sum, jugada) => sum + jugada.totalMonto, 0)

    return (
        <Table>
            <TableHeader className="bg-gradient-to-r from-red-600 to-rose-700">
                <TableRow>
                    <TableHead className="font-bold text-white py-2 px-3 text-xs">Pasador que anuló</TableHead>
                    <TableHead className="font-bold text-white text-right py-2 px-3 text-xs">Monto Total</TableHead>
                    <TableHead className="font-bold text-white text-right py-2 px-3 text-xs">Tickets Anulados</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {jugadasAnuladas.map((jugada, index) => (
                    <TableRow
                        key={jugada.pasadorIdQueAnulo}
                        className={`${index % 2 === 0 ? "bg-red-50" : "bg-white"} hover:bg-red-100 transition-colors`}
                    >
                        <TableCell className="py-2 px-3 text-xs">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center mr-2">
                                    {jugada.pasadorQueAnulo.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium">{jugada.pasadorQueAnulo}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2 px-3 text-xs font-semibold text-red-700">
                            $ {jugada.totalMonto.toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right py-2 px-3">
                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200">
                                <Ban className="h-3 w-3 mr-1" />
                                {jugada.tickets}
                            </Badge>
                        </TableCell>
                    </TableRow>
                ))}
                <TableRow className="bg-red-200 font-semibold">
                    <TableCell className="py-3 px-3 text-xs text-red-800">
                        <span className="font-bold">TOTALES</span>
                    </TableCell>
                    <TableCell className="text-right py-3 px-3 text-xs font-bold text-red-800">
                        $ {totalMonto.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right py-3 px-3">
                        <Badge className="bg-red-600 text-white hover:bg-red-700">
                            <Ticket className="h-3 w-3 mr-1" />
                            {totalTickets}
                        </Badge>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}

export default function ListadoJugadasAnuladasPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [jugadasAnuladas, setJugadasAnuladas] = useState<GroupedJugadaAnulada[]>([])

    useEffect(() => {
        handleSearch()
    }, [])

    const handleSearch = async () => {
        setIsLoading(true)
        setError(null)
        try {
            console.log("Iniciando búsqueda de jugadas anuladas...")
            console.log("Fecha seleccionada:", format(selectedDate, "yyyy-MM-dd"))
            const jugadasAnuladasTemp: JugadaAnulada[] = []

            const jugadasAnuladasRef = collection(db, "jugadas_anuladas")
            const startOfSelectedDate = startOfDay(selectedDate)
            const endOfSelectedDate = endOfDay(selectedDate)

            console.log(
                "Rango de fechas para la consulta:",
                format(startOfSelectedDate, "yyyy-MM-dd HH:mm:ss"),
                "hasta",
                format(endOfSelectedDate, "yyyy-MM-dd HH:mm:ss"),
            )

            const q = query(
                jugadasAnuladasRef,
                where("fechaAnulacion", ">=", Timestamp.fromDate(startOfSelectedDate)),
                where("fechaAnulacion", "<=", Timestamp.fromDate(endOfSelectedDate)),
            )

            const querySnapshot = await getDocs(q)
            console.log("Número de documentos encontrados:", querySnapshot.size)

            querySnapshot.forEach((doc) => {
                const data = doc.data() as JugadaAnulada
                jugadasAnuladasTemp.push({
                    ...data,
                    id: doc.id,
                })
            })

            console.log("Jugadas anuladas encontradas:", jugadasAnuladasTemp.length)

            // Agrupar jugadas por pasadorIdQueAnulo
            const groupedJugadas: { [key: string]: GroupedJugadaAnulada } = {}
            jugadasAnuladasTemp.forEach((jugada) => {
                if (!groupedJugadas[jugada.pasadorIdQueAnulo]) {
                    groupedJugadas[jugada.pasadorIdQueAnulo] = {
                        pasadorIdQueAnulo: jugada.pasadorIdQueAnulo,
                        pasadorQueAnulo: jugada.pasadorQueAnulo,
                        totalMonto: 0,
                        tickets: 0,
                        detalles: [],
                    }
                }
                groupedJugadas[jugada.pasadorIdQueAnulo].totalMonto += jugada.totalMonto
                // Incrementar tickets solo si es una nueva secuencia
                if (!groupedJugadas[jugada.pasadorIdQueAnulo].detalles.some((d) => d.secuencia === jugada.secuencia)) {
                    groupedJugadas[jugada.pasadorIdQueAnulo].tickets += 1
                }
                groupedJugadas[jugada.pasadorIdQueAnulo].detalles.push(jugada)
            })

            const groupedJugadasArray = Object.values(groupedJugadas)
            setJugadasAnuladas(groupedJugadasArray)
            console.log("Datos agrupados:", groupedJugadasArray)
        } catch (err) {
            console.error("Error en handleSearch:", err)
            setError(`Hubo un error al buscar las jugadas anuladas: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-red-50 to-rose-50">
            <Navbar />
            <main className="container mx-auto p-4 max-w-7xl">
                <Card className="shadow-xl border border-red-200">
                    <CardHeader className="bg-gradient-to-r from-red-600 to-rose-700 text-white">
                        <CardTitle className="text-2xl font-bold flex items-center">
                            <FileX className="h-6 w-6 mr-2" />
                            Listado de Jugadas Anuladas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-red-200">
                            <h2 className="text-sm font-semibold mb-3 text-red-800 border-b border-red-200 pb-2 flex items-center">
                                <CalendarIcon className="h-4 w-4 mr-2 text-red-600" />
                                Seleccionar fecha
                            </h2>
                            <DatePicker
                                selectedDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onSearch={handleSearch}
                                isLoading={isLoading}
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive" className="mb-4 bg-red-100 border-red-400 text-red-700 flex items-start">
                                <AlertCircle className="h-5 w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>
                                    <p className="font-bold">Error</p>
                                    <p>{error}</p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {jugadasAnuladas.length === 0 && !isLoading && (
                            <Alert className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700 flex items-start">
                                <AlertCircle className="h-5 w-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription>No se encontraron jugadas anuladas para la fecha seleccionada.</AlertDescription>
                            </Alert>
                        )}

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-8">
                                <Loader2 className="h-12 w-12 animate-spin text-red-600" />
                                <p className="mt-4 text-red-600 font-medium">Cargando jugadas anuladas...</p>
                            </div>
                        ) : jugadasAnuladas.length > 0 ? (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden border border-red-200">
                                <div className="p-4 bg-red-50 border-b border-red-200 flex justify-between items-center">
                                    <div className="flex items-center">
                                        <Ban className="h-5 w-5 mr-2 text-red-600" />
                                        <h3 className="font-semibold text-red-800">Resumen de Anulaciones</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center">
                                            <DollarSign className="h-4 w-4 mr-1 text-red-600" />
                                            <span className="text-sm text-red-700">Monto Total</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Ticket className="h-4 w-4 mr-1 text-red-600" />
                                            <span className="text-sm text-red-700">Tickets Anulados</span>
                                        </div>
                                    </div>
                                </div>
                                <JugadasAnuladasTable jugadasAnuladas={jugadasAnuladas} />
                            </div>
                        ) : null}

                        {jugadasAnuladas.length > 0 && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                                <p className="text-sm text-red-800 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                                    Nota: Los montos mostrados corresponden al valor total de los tickets anulados.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

