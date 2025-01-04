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
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import Navbar from '../../components/Navbar'

// Datos de ejemplo para el select de pasadores
const pasadores = [
    "71-0001",
    "71-0002",
    "71-0003",
    "72-0001",
    "72-0002",
]

interface ResumenData {
    detalle: string
    monto: number | null
}

export default function ResumenDiarioPasadorPage() {
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [fecha, setFecha] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [data, setData] = useState<ResumenData[]>([
        { detalle: "Saldo Anterior", monto: -8118.50 },
        { detalle: "--------", monto: null },
        { detalle: "Total", monto: null },
        { detalle: "--------", monto: null },
        { detalle: "Saldo actual", monto: -8118.50 },
        { detalle: "--------", monto: null },
        { detalle: "Detalle:", monto: null },
    ])

    const handleConsultar = async () => {
        setIsLoading(true)
        try {
            // Aquí iría la lógica de consulta
            await new Promise(resolve => setTimeout(resolve, 1000))
        } finally {
            setIsLoading(false)
        }
    }

    const handleExportar = () => {
        // Aquí iría la lógica de exportación
        console.log("Exportando datos...")
    }

    return (
        <div className="min-h-screen bg-white">
            <Navbar />
            <main className="container mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-black">Resumen diario por pasador</h1>
                    <Button
                        variant="outline"
                        onClick={handleExportar}
                        className="border-black text-black hover:bg-gray-100"
                    >
                        Exportar
                    </Button>
                </div>

                <Card className="mb-6 border-black">
                    <CardHeader className="bg-black text-white">
                        <CardTitle>Filtro</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Pasador:</label>
                                <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccionar pasador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pasadores.map((pasador) => (
                                            <SelectItem key={pasador} value={pasador}>
                                                {pasador}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Día:</label>
                                <Input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-center">
                            <Button
                                onClick={handleConsultar}
                                disabled={isLoading}
                                className="bg-black text-white hover:bg-gray-800"
                            >
                                {isLoading ? "Consultando..." : "Consultar"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-black">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-black hover:bg-black">
                                    <TableHead className="text-white font-semibold w-1/2">Detalle</TableHead>
                                    <TableHead className="text-white font-semibold w-1/2 text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row, index) => (
                                    <TableRow key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <TableCell className="font-medium">{row.detalle}</TableCell>
                                        <TableCell className="text-right">
                                            {row.monto !== null ? `$${row.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

