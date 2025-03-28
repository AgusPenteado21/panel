"use client"

import { useState, useEffect } from "react"
import { Search, Calendar, Clock, Trash2, Download, Filter, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Navbar from "../components/Navbar"
import * as XLSX from "xlsx"

export default function SorteosPage() {
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = 2
    const [draws, setDraws] = useState<any[]>([])
    const [selectedDraws, setSelectedDraws] = useState<string[]>([])
    const [selectedDrawType, setSelectedDrawType] = useState("")
    const [selectedDay, setSelectedDay] = useState("")
    const [newCloseTime, setNewCloseTime] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [availableDays, setAvailableDays] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState("")

    const weekDays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const drawTypes = ["LaPrevia", "Primera", "Matutina", "Vespertina", "Nocturna"]

    useEffect(() => {
        const generateDraws = () => {
            const today = new Date()
            const currentDayIndex = today.getDay()
            let nro = 8642
            const newDraws = []
            const newAvailableDays = []

            for (let i = currentDayIndex; i <= 6; i++) {
                const currentDate = new Date(today)
                currentDate.setDate(today.getDate() + (i - currentDayIndex))
                newAvailableDays.push(weekDays[i])

                for (const type of drawTypes) {
                    newDraws.push({
                        nro: nro.toString(),
                        sorteo: `${type} (${getDrawTime(type)})`,
                        dia: weekDays[i],
                        fechaSorteo: currentDate.toLocaleDateString("es-ES"),
                        horaInicio: "00:00:00",
                        horaCierre: getClosingTime(type),
                        nacional: true,
                        provincia: true,
                        mendoza: true,
                        santaFe: true,
                        uruguay: type === "Matutina" || type === "Nocturna",
                        cordoba: true,
                        santiago: false,
                        entreRios: true,
                        corrientes: true,
                        chaco: true,
                    })
                    nro++
                }
            }
            setAvailableDays(newAvailableDays)
            return newDraws
        }

        const updateDraws = () => {
            setDraws(generateDraws())
        }

        updateDraws()

        const now = new Date()
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const msUntilMidnight = tomorrow.getTime() - now.getTime()

        const midnightTimeout = setTimeout(() => {
            updateDraws()
            setInterval(updateDraws, 24 * 60 * 60 * 1000) // Update every 24 hours
        }, msUntilMidnight)

        return () => {
            clearTimeout(midnightTimeout)
        }
    }, [])

    const getDrawTime = (type: string) => {
        switch (type) {
            case "LaPrevia":
                return "10:15"
            case "Primera":
                return "12:00"
            case "Matutina":
                return "15:00"
            case "Vespertina":
                return "18:00"
            case "Nocturna":
                return "21:00"
            default:
                return ""
        }
    }

    const getClosingTime = (type: string) => {
        switch (type) {
            case "LaPrevia":
                return "10:10:00"
            case "Primera":
                return "11:55:00"
            case "Matutina":
                return "14:55:00"
            case "Vespertina":
                return "17:55:00"
            case "Nocturna":
                return "20:55:00"
            default:
                return ""
        }
    }

    const handleSaveCloseTime = () => {
        if (selectedDrawType && selectedDay && newCloseTime) {
            const updatedDraws = draws.map((draw) =>
                draw.sorteo.startsWith(selectedDrawType) && draw.dia === selectedDay
                    ? { ...draw, horaCierre: newCloseTime }
                    : draw,
            )
            setDraws(updatedDraws)
            setIsDialogOpen(false)
            setSelectedDrawType("")
            setSelectedDay("")
            setNewCloseTime("")
        }
    }

    const handleSelectDraw = (nro: string) => {
        setSelectedDraws((prev) => (prev.includes(nro) ? prev.filter((id) => id !== nro) : [...prev, nro]))
    }

    const handleSelectAllDraws = () => {
        if (selectedDraws.length === draws.length) {
            setSelectedDraws([])
        } else {
            setSelectedDraws(draws.map((draw) => draw.nro))
        }
    }

    const handleDeleteSelected = () => {
        setDraws((prev) => prev.filter((draw) => !selectedDraws.includes(draw.nro)))
        setSelectedDraws([])
    }

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(draws)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Sorteos")
        XLSX.writeFile(wb, "sorteos.xlsx")
    }

    const filteredDraws = draws.filter(
        (draw) =>
            draw.sorteo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            draw.dia.toLowerCase().includes(searchTerm.toLowerCase()) ||
            draw.fechaSorteo.includes(searchTerm),
    )

    const getDrawTypeColor = (type: string) => {
        if (type.includes("LaPrevia")) return "bg-purple-100 text-purple-800"
        if (type.includes("Primera")) return "bg-blue-100 text-blue-800"
        if (type.includes("Matutina")) return "bg-green-100 text-green-800"
        if (type.includes("Vespertina")) return "bg-orange-100 text-orange-800"
        if (type.includes("Nocturna")) return "bg-indigo-100 text-indigo-800"
        return "bg-gray-100 text-gray-800"
    }

    const getDayColor = (day: string) => {
        switch (day) {
            case "Lunes":
                return "text-blue-600"
            case "Martes":
                return "text-green-600"
            case "Miércoles":
                return "text-purple-600"
            case "Jueves":
                return "text-orange-600"
            case "Viernes":
                return "text-indigo-600"
            case "Sábado":
                return "text-red-600"
            case "Domingo":
                return "text-yellow-600"
            default:
                return "text-gray-600"
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50">
            <Navbar />
            <main className="container mx-auto p-6">
                <Card className="shadow-xl border border-purple-200">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold flex items-center">
                            <Calendar className="h-6 w-6 mr-2" />
                            Sorteos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-purple-200">
                                <span className="text-purple-800 font-medium">
                                    Página {currentPage} de {totalPages}
                                </span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-purple-500" />
                                    <Input
                                        type="search"
                                        placeholder="Buscar..."
                                        className="pl-8 border-purple-200 focus:border-purple-500 focus:ring-purple-500 w-full"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105 w-full sm:w-auto">
                                    <Search className="h-4 w-4 mr-2" />
                                    Buscar
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6 bg-white p-3 rounded-lg shadow-sm border border-purple-200">
                            <Button
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500"
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Sorteos Activos
                            </Button>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                                    >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Modificar Fecha de Cierre
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-white border border-purple-200 shadow-xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-purple-800 flex items-center">
                                            <Clock className="h-5 w-5 mr-2 text-purple-600" />
                                            Modificar Fecha de Cierre
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="drawType" className="text-right text-purple-700 font-medium">
                                                Tipo de Sorteo:
                                            </label>
                                            <Select onValueChange={setSelectedDrawType} value={selectedDrawType}>
                                                <SelectTrigger className="col-span-3 border-purple-200 focus:ring-purple-500">
                                                    <SelectValue placeholder="Seleccionar tipo de sorteo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {drawTypes.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="day" className="text-right text-purple-700 font-medium">
                                                Día:
                                            </label>
                                            <Select onValueChange={setSelectedDay} value={selectedDay}>
                                                <SelectTrigger className="col-span-3 border-purple-200 focus:ring-purple-500">
                                                    <SelectValue placeholder="Seleccionar día" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableDays.map((day) => (
                                                        <SelectItem key={day} value={day}>
                                                            {day}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <label htmlFor="closeTime" className="text-right text-purple-700 font-medium">
                                                Nueva Hora de Cierre:
                                            </label>
                                            <Input
                                                id="closeTime"
                                                type="time"
                                                value={newCloseTime}
                                                onChange={(e) => setNewCloseTime(e.target.value)}
                                                className="col-span-3 border-purple-200 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={handleSaveCloseTime}
                                            disabled={!selectedDrawType || !selectedDay || !newCloseTime}
                                            className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white"
                                        >
                                            <Clock className="h-4 w-4 mr-2" />
                                            Guardar Cambios
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button
                                variant="outline"
                                onClick={handleDeleteSelected}
                                disabled={selectedDraws.length === 0}
                                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </Button>
                            <Button
                                variant="outline"
                                onClick={exportToExcel}
                                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Exportar a Excel
                            </Button>
                        </div>

                        <div className="border border-purple-200 rounded-lg overflow-x-auto shadow-md bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gradient-to-r from-purple-600 to-indigo-700">
                                        <TableHead className="w-12 text-white">
                                            <Checkbox
                                                checked={selectedDraws.length === draws.length}
                                                onCheckedChange={handleSelectAllDraws}
                                                className="border-white text-white"
                                            />
                                        </TableHead>
                                        <TableHead className="text-white font-bold">Nro</TableHead>
                                        <TableHead className="text-white font-bold">Sorteo</TableHead>
                                        <TableHead className="text-white font-bold">Día</TableHead>
                                        <TableHead className="text-white font-bold">Fecha Sorteo</TableHead>
                                        <TableHead className="text-white font-bold">Hora Inicio</TableHead>
                                        <TableHead className="text-white font-bold">Hora Cierre</TableHead>
                                        <TableHead className="text-white font-bold">Nacional</TableHead>
                                        <TableHead className="text-white font-bold">Provincia</TableHead>
                                        <TableHead className="text-white font-bold">Mendoza</TableHead>
                                        <TableHead className="text-white font-bold">Santa Fe</TableHead>
                                        <TableHead className="text-white font-bold">Uruguay</TableHead>
                                        <TableHead className="text-white font-bold">Córdoba</TableHead>
                                        <TableHead className="text-white font-bold">Santiago</TableHead>
                                        <TableHead className="text-white font-bold">Entre Ríos</TableHead>
                                        <TableHead className="text-white font-bold">Corrientes</TableHead>
                                        <TableHead className="text-white font-bold">Chaco</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDraws.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                                                No se encontraron sorteos con los criterios de búsqueda
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredDraws.map((draw, index) => (
                                            <TableRow
                                                key={draw.nro}
                                                className={`${index % 2 === 0 ? "bg-purple-50" : "bg-white"} hover:bg-purple-100 transition-colors`}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedDraws.includes(draw.nro)}
                                                        onCheckedChange={() => handleSelectDraw(draw.nro)}
                                                        className="border-purple-400 text-purple-600"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium text-purple-800">{draw.nro}</TableCell>
                                                <TableCell>
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getDrawTypeColor(draw.sorteo)}`}
                                                    >
                                                        {draw.sorteo}
                                                    </span>
                                                </TableCell>
                                                <TableCell className={`font-medium ${getDayColor(draw.dia)}`}>{draw.dia}</TableCell>
                                                <TableCell className="text-indigo-600">{draw.fechaSorteo}</TableCell>
                                                <TableCell className="text-gray-600">{draw.horaInicio}</TableCell>
                                                <TableCell className="text-blue-600 font-medium">{draw.horaCierre}</TableCell>
                                                <TableCell>
                                                    {draw.nacional ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.provincia ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.mendoza ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.santaFe ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.uruguay ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.cordoba ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.santiago ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.entreRios ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.corrientes ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {draw.chaco ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-gray-300" />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

