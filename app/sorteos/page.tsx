'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import Navbar from '../components/Navbar'
import * as XLSX from 'xlsx'

export default function SorteosPage() {
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = 2
    const [draws, setDraws] = useState<any[]>([])
    const [selectedDraws, setSelectedDraws] = useState<string[]>([])
    const [selectedDrawType, setSelectedDrawType] = useState('')
    const [selectedDay, setSelectedDay] = useState('')
    const [newCloseTime, setNewCloseTime] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [availableDays, setAvailableDays] = useState<string[]>([])

    const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const drawTypes = ['LaPrevia', 'Primera', 'Matutina', 'Vespertina', 'Nocturna']

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

                for (let type of drawTypes) {
                    newDraws.push({
                        nro: nro.toString(),
                        sorteo: `${type} (${getDrawTime(type)})`,
                        dia: weekDays[i],
                        fechaSorteo: currentDate.toLocaleDateString('es-ES'),
                        horaInicio: '00:00:00',
                        horaCierre: getClosingTime(type),
                        nacional: true,
                        provincia: true,
                        mendoza: true,
                        santaFe: true,
                        uruguay: type === 'Matutina' || type === 'Nocturna',
                        cordoba: true,
                        santiago: false,
                        entreRios: true,
                        corrientes: true,
                        chaco: true
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
            case 'LaPrevia': return '10:15'
            case 'Primera': return '12:00'
            case 'Matutina': return '15:00'
            case 'Vespertina': return '18:00'
            case 'Nocturna': return '21:00'
            default: return ''
        }
    }

    const getClosingTime = (type: string) => {
        switch (type) {
            case 'LaPrevia': return '10:10:00'
            case 'Primera': return '11:55:00'
            case 'Matutina': return '14:55:00'
            case 'Vespertina': return '17:55:00'
            case 'Nocturna': return '20:55:00'
            default: return ''
        }
    }

    const handleSaveCloseTime = () => {
        if (selectedDrawType && selectedDay && newCloseTime) {
            const updatedDraws = draws.map(draw =>
                draw.sorteo.startsWith(selectedDrawType) && draw.dia === selectedDay
                    ? { ...draw, horaCierre: newCloseTime }
                    : draw
            )
            setDraws(updatedDraws)
            setIsDialogOpen(false)
            setSelectedDrawType('')
            setSelectedDay('')
            setNewCloseTime('')
        }
    }

    const handleSelectDraw = (nro: string) => {
        setSelectedDraws(prev =>
            prev.includes(nro) ? prev.filter(id => id !== nro) : [...prev, nro]
        )
    }

    const handleSelectAllDraws = () => {
        if (selectedDraws.length === draws.length) {
            setSelectedDraws([])
        } else {
            setSelectedDraws(draws.map(draw => draw.nro))
        }
    }

    const handleDeleteSelected = () => {
        setDraws(prev => prev.filter(draw => !selectedDraws.includes(draw.nro)))
        setSelectedDraws([])
    }

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(draws)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Sorteos")
        XLSX.writeFile(wb, "sorteos.xlsx")
    }


    return (
        <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow p-4 space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Sorteos</h1>
                    <div className="flex items-center gap-2">
                        <span>Página {currentPage} de {totalPages}</span>
                        <Input type="search" placeholder="Buscar..." className="w-64" />
                        <Button>
                            <Search className="h-4 w-4 mr-2" />
                            Buscar
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button variant="secondary">Sorteos Activos</Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary">Modificar Fecha de Cierre</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Modificar Fecha de Cierre</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <label htmlFor="drawType" className="text-right">
                                        Tipo de Sorteo:
                                    </label>
                                    <Select onValueChange={setSelectedDrawType} value={selectedDrawType}>
                                        <SelectTrigger className="col-span-3">
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
                                    <label htmlFor="day" className="text-right">
                                        Día:
                                    </label>
                                    <Select onValueChange={setSelectedDay} value={selectedDay}>
                                        <SelectTrigger className="col-span-3">
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
                                    <label htmlFor="closeTime" className="text-right">
                                        Nueva Hora de Cierre:
                                    </label>
                                    <Input
                                        id="closeTime"
                                        type="time"
                                        value={newCloseTime}
                                        onChange={(e) => setNewCloseTime(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleSaveCloseTime} disabled={!selectedDrawType || !selectedDay || !newCloseTime}>
                                Guardar Cambios
                            </Button>
                        </DialogContent>
                    </Dialog>
                    <Button variant="secondary" onClick={handleDeleteSelected} disabled={selectedDraws.length === 0}>Eliminar</Button>
                    <Button variant="secondary" onClick={exportToExcel}>
                        Exportar a Excel
                    </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={selectedDraws.length === draws.length}
                                        onCheckedChange={handleSelectAllDraws}
                                    />
                                </TableHead>
                                <TableHead>Nro</TableHead>
                                <TableHead>Sorteo</TableHead>
                                <TableHead>Día</TableHead>
                                <TableHead>Fecha Sorteo</TableHead>
                                <TableHead>Hora Inicio</TableHead>
                                <TableHead>Hora Cierre</TableHead>
                                <TableHead>Nacional</TableHead>
                                <TableHead>Provincia</TableHead>
                                <TableHead>Mendoza</TableHead>
                                <TableHead>Santa Fe</TableHead>
                                <TableHead>Uruguay</TableHead>
                                <TableHead>Córdoba</TableHead>
                                <TableHead>Santiago</TableHead>
                                <TableHead>Entre Ríos</TableHead>
                                <TableHead>Corrientes</TableHead>
                                <TableHead>Chaco</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {draws.map((draw) => (
                                <TableRow key={draw.nro}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedDraws.includes(draw.nro)}
                                            onCheckedChange={() => handleSelectDraw(draw.nro)}
                                        />
                                    </TableCell>
                                    <TableCell>{draw.nro}</TableCell>
                                    <TableCell>{draw.sorteo}</TableCell>
                                    <TableCell>{draw.dia}</TableCell>
                                    <TableCell>{draw.fechaSorteo}</TableCell>
                                    <TableCell>{draw.horaInicio}</TableCell>
                                    <TableCell>{draw.horaCierre}</TableCell>
                                    <TableCell>{draw.nacional ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.provincia ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.mendoza ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.santaFe ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.uruguay ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.cordoba ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.santiago ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.entreRios ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.corrientes ? 'Sí' : ''}</TableCell>
                                    <TableCell>{draw.chaco ? 'Sí' : ''}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </main>
        </div>
    )
}

