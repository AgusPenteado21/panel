"use client"

import { useState, useEffect } from "react"
import { format, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Navbar from "@/app/components/Navbar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"

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
                className={cn("w-[120px] h-8 justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}
            >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {date ? format(date, "dd/MM/yyyy", { locale: es }) : label}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={date} onSelect={(date) => date && onChange(date)} initialFocus locale={es} />
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
            <span className="font-medium">Fecha:</span>
            <DatePickerButton date={selectedDate} onChange={onDateChange} label="Seleccionar" />
        </div>
        <Button onClick={onSearch} className="bg-black text-white hover:bg-gray-800 h-8 px-3 text-xs" disabled={isLoading}>
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Cargando...
                </>
            ) : (
                "Consultar"
            )}
        </Button>
    </div>
)

const JugadasAnuladasTable = ({ jugadasAnuladas }: { jugadasAnuladas: GroupedJugadaAnulada[] }) => {
    const totalTickets = jugadasAnuladas.reduce((sum, jugada) => sum + jugada.tickets, 0)
    const totalMonto = jugadasAnuladas.reduce((sum, jugada) => sum + jugada.totalMonto, 0)

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-black hover:bg-black">
                    <TableHead className="font-semibold text-white py-2 px-3 text-xs">Pasador que anuló</TableHead>
                    <TableHead className="font-semibold text-white text-right py-2 px-3 text-xs">Monto Total</TableHead>
                    <TableHead className="font-semibold text-white text-right py-2 px-3 text-xs">Tickets Anulados</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {jugadasAnuladas.map((jugada, index) => (
                    <TableRow key={jugada.pasadorIdQueAnulo} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <TableCell className="py-2 px-3 text-xs">{jugada.pasadorQueAnulo}</TableCell>
                        <TableCell className="text-right py-2 px-3 text-xs">
                            $ {jugada.totalMonto.toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right py-2 px-3 text-xs">{jugada.tickets}</TableCell>
                    </TableRow>
                ))}
                <TableRow className="bg-gray-200 font-semibold">
                    <TableCell className="py-2 px-3 text-xs">Totales</TableCell>
                    <TableCell className="text-right py-2 px-3 text-xs">$ {totalMonto.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right py-2 px-3 text-xs">{totalTickets}</TableCell>
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
        <div className="min-h-screen bg-gray-100">
            <Navbar />
            <main className="container mx-auto p-2 max-w-7xl">
                <h1 className="text-xl font-bold text-black mb-4">Listado de Jugadas Anuladas</h1>

                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <h2 className="text-sm font-semibold mb-2 text-black">Seleccionar fecha</h2>
                    <DatePicker
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        onSearch={handleSearch}
                        isLoading={isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {jugadasAnuladas.length === 0 && !isLoading && (
                    <div
                        className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded mb-4 text-sm"
                        role="alert"
                    >
                        <p>No se encontraron jugadas anuladas para la fecha seleccionada.</p>
                    </div>
                )}

                {jugadasAnuladas.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <JugadasAnuladasTable jugadasAnuladas={jugadasAnuladas} />
                    </div>
                )}
            </main>
        </div>
    )
}

