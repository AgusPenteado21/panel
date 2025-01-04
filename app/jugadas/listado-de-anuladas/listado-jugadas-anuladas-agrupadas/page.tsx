'use client'

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Navbar from "@/app/components/Navbar"

interface JugadaAnulada {
    pasador: string
    cantidadTickets: number
    monto: number
}

const jugadasAnuladas: JugadaAnulada[] = [
    { pasador: "72-0028", cantidadTickets: 5, monto: 6200 },
    { pasador: "74-0024", cantidadTickets: 5, monto: 7100 },
    { pasador: "72-0014", cantidadTickets: 4, monto: 19000 },
    { pasador: "72-0016", cantidadTickets: 4, monto: 11475 },
    { pasador: "72-0021", cantidadTickets: 3, monto: 6000 },
    { pasador: "72-0031", cantidadTickets: 3, monto: 53160 },
    { pasador: "73-0012", cantidadTickets: 3, monto: 622 },
    { pasador: "74-0023", cantidadTickets: 3, monto: 7700 },
    { pasador: "74-0017", cantidadTickets: 2, monto: 6700 },
    { pasador: "72-0006", cantidadTickets: 2, monto: 4100 },
]

function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    onSearch,
    isLoading
}: {
    startDate: Date
    endDate: Date
    onStartDateChange: (date: Date) => void
    onEndDateChange: (date: Date) => void
    onSearch: () => void
    isLoading: boolean
}) {
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
                <span className="font-medium">Desde:</span>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[150px] h-10 justify-start text-left font-normal",
                                !startDate && "text-muted-foreground"
                            )}
                            aria-label="Seleccionar fecha de inicio"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => date && onStartDateChange(date)}
                            initialFocus
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-medium">Hasta:</span>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[150px] h-10 justify-start text-left font-normal",
                                !endDate && "text-muted-foreground"
                            )}
                            aria-label="Seleccionar fecha de fin"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => date && onEndDateChange(date)}
                            initialFocus
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <Button
                onClick={onSearch}
                className="bg-black text-white hover:bg-gray-800 h-10 px-4"
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                    </>
                ) : (
                    'Consultar'
                )}
            </Button>
        </div>
    )
}

export default function ListadoJugadasAnuladasPage() {
    const [startDate, setStartDate] = useState<Date>(new Date())
    const [endDate, setEndDate] = useState<Date>(new Date())
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const totalTickets = jugadasAnuladas.reduce((sum, item) => sum + item.cantidadTickets, 0)
    const totalMonto = jugadasAnuladas.reduce((sum, item) => sum + item.monto, 0)

    const handleSearch = async () => {
        setIsLoading(true)
        setError(null)
        try {
            // Simular una llamada a la API
            await new Promise(resolve => setTimeout(resolve, 1000))
            console.log("Buscando jugadas anuladas entre:", startDate, "y", endDate)
            // Aquí iría la lógica real de búsqueda
        } catch (err) {
            setError("Hubo un error al buscar las jugadas anuladas. Por favor, intente de nuevo.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar />
            <main className="container mx-auto p-4 md:p-6">
                <h1 className="text-2xl font-bold text-black mb-6">
                    Listado Jugadas Anuladas Agrupadas
                </h1>

                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4 text-black">Intervalo de búsqueda</h2>
                    <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        onSearch={handleSearch}
                        isLoading={isLoading}
                    />
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-black hover:bg-black">
                                <TableHead className="font-semibold text-white py-3 px-4">Pasador</TableHead>
                                <TableHead className="font-semibold text-white text-right py-3 px-4">Cant. tickets anulados</TableHead>
                                <TableHead className="font-semibold text-white text-right py-3 px-4">Monto de los tickets</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jugadasAnuladas.map((jugada, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                                    <TableCell className="py-3 px-4">{jugada.pasador}</TableCell>
                                    <TableCell className="text-right py-3 px-4">{jugada.cantidadTickets}</TableCell>
                                    <TableCell className="text-right py-3 px-4">$ {jugada.monto.toLocaleString('es-AR')}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-gray-200 font-semibold">
                                <TableCell className="py-3 px-4">Totales</TableCell>
                                <TableCell className="text-right py-3 px-4">{totalTickets}</TableCell>
                                <TableCell className="text-right py-3 px-4">$ {totalMonto.toLocaleString('es-AR')}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </main>
        </div>
    )
}

