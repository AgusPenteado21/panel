'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Printer } from 'lucide-react'
import Navbar from '../../components/Navbar'

interface Pasador {
    id: string
    imprime: boolean
}

const pasadores: Pasador[] = [
    { id: "71-0001", imprime: false },
    { id: "71-0002", imprime: false },
    { id: "71-0003", imprime: false },
    { id: "71-0004", imprime: false },
    { id: "71-0005", imprime: false },
    { id: "71-0006", imprime: false },
]

const modulos = ["71", "72", "73", "74"]

export default function ResumenDiarioTodosPasadoresPage() {
    const [selectedModulo, setSelectedModulo] = useState<string>("")
    const [fecha, setFecha] = useState<string>("")
    const [selectedPasadores, setSelectedPasadores] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const handleSelectAll = () => {
        if (selectedPasadores.length === pasadores.length) {
            setSelectedPasadores([])
        } else {
            setSelectedPasadores(pasadores.map(p => p.id))
        }
    }

    const handleSelectPasador = (pasadorId: string) => {
        setSelectedPasadores(prev =>
            prev.includes(pasadorId)
                ? prev.filter(id => id !== pasadorId)
                : [...prev, pasadorId]
        )
    }

    const handleConsultar = async () => {
        setIsLoading(true)
        try {
            // Aquí iría la lógica de consulta
            await new Promise(resolve => setTimeout(resolve, 1000))
        } finally {
            setIsLoading(false)
        }
    }

    const handleGuardarCambios = () => {
        console.log("Guardando cambios...")
    }

    const handleImprimir = () => {
        console.log("Imprimiendo...")
    }


    const handleExportar = () => {
        console.log("Exportando...")
    }

    return (
        <div className="min-h-screen bg-white">
            <Navbar />
            <main className="container mx-auto p-6">
                <Card className="border-black">
                    <CardHeader className="bg-black">
                        <CardTitle className="text-white text-xl">
                            Resumen diario de todos los pasadores
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex flex-wrap gap-2 mb-6">
                            <Button
                                variant="outline"
                                className="border-black"
                                onClick={handleGuardarCambios}
                            >
                                Guardar los cambios
                            </Button>
                            <Button
                                variant="outline"
                                className="border-black"
                                onClick={handleImprimir}
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-black">
                                        Exportar
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={handleExportar}>
                                        Exportar a Excel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportar}>
                                        Exportar a PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Seleccione el módulo
                                </label>
                                <Select value={selectedModulo} onValueChange={setSelectedModulo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar módulo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modulos.map((modulo) => (
                                            <SelectItem key={modulo} value={modulo}>
                                                {modulo}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Seleccione el día
                                </label>
                                <Input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex justify-center mb-6">
                            <Button
                                onClick={handleConsultar}
                                className="bg-black text-white hover:bg-gray-800"
                                disabled={isLoading}
                            >
                                {isLoading ? "Consultando..." : "Consultar"}
                            </Button>
                        </div>

                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-black hover:bg-black">
                                        <TableHead className="text-white w-[50px]">
                                            <Checkbox
                                                checked={selectedPasadores.length === pasadores.length}
                                                onCheckedChange={handleSelectAll}
                                                className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                                            />
                                        </TableHead>
                                        <TableHead className="text-white font-semibold">Pasador</TableHead>
                                        <TableHead className="text-white font-semibold">Imprime?</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pasadores.map((pasador, index) => (
                                        <TableRow key={pasador.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedPasadores.includes(pasador.id)}
                                                    onCheckedChange={() => handleSelectPasador(pasador.id)}
                                                />
                                            </TableCell>
                                            <TableCell>{pasador.id}</TableCell>
                                            <TableCell>NO</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

