"use client"

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import toast from "react-hot-toast"
import Navbar from "@/app/components/Navbar"
import { Loader2, Save, Printer, X, Calculator } from "lucide-react"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    nombreFantasia: string
}

interface Jugada {
    numero: string
    posicion: string
    importe: string
}

const lotteryAbbreviations: { [key: string]: string } = {
    LAPREVIA: "PRE",
    PRIMERA: "PR",
    MATUTINA: "MA",
    VESPERTINA: "VE",
    NOCTURNA: "NO",
}

const provinceAbbreviations: { [key: string]: string } = {
    NACION: "N",
    PROVIN: "P",
    SANTA: "SF",
    CORDOB: "C",
    URUGUA: "U",
    ENTRE: "E",
    MENDOZ: "M",
    CORRIE: "CR",
    CHACO: "CH",
    RIONEG: "RN",
}

// Número total de filas de jugadas
const TOTAL_FILAS = 100

// Crear un array de 100 jugadas vacías para inicializar el estado
const createEmptyJugadas = () => {
    return Array(TOTAL_FILAS)
        .fill(null)
        .map(() => ({ numero: "", posicion: "", importe: "" }))
}

export default function CargarJugadas() {
    const [selectedLotteries, setSelectedLotteries] = useState<string[]>([])
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [selectedSorteo, setSelectedSorteo] = useState<string>("")
    const [jugadas, setJugadas] = useState<Jugada[]>(createEmptyJugadas())
    const [totalMonto, setTotalMonto] = useState(0)
    const [ticketContent, setTicketContent] = useState<string>("")
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
    const [secuenciaCounter, setSecuenciaCounter] = useState(10000)
    const [isLoading, setIsLoading] = useState(false)

    // Crear un array para almacenar las referencias a los inputs
    const inputRefs = useRef<HTMLInputElement[][]>([])

    // Inicializar el array de referencias
    useEffect(() => {
        // Asegurarse de que tenemos 100 filas de jugadas
        if (jugadas.length < TOTAL_FILAS) {
            setJugadas(createEmptyJugadas())
        }

        // Inicializar las referencias
        inputRefs.current = Array(TOTAL_FILAS)
            .fill(0)
            .map(() => Array(3).fill(null))
    }, [jugadas.length])

    const horarios = [
        { id: "LAPREVIA", label: "La Previa (10:15)" },
        { id: "PRIMERA", label: "Primera (12:00)" },
        { id: "MATUTINA", label: "Matutina (15:00)" },
        { id: "VESPERTINA", label: "Vespertina (18:00)" },
        { id: "NOCTURNA", label: "Nocturna (21:00)" },
    ]

    const loterias = [
        { id: "NACION", label: "Nacional" },
        { id: "PROVIN", label: "Provincia" },
        { id: "SANTA", label: "Santa Fe" },
        { id: "CORDOB", label: "Córdoba" },
        { id: "URUGUA", label: "Uruguay" },
        { id: "ENTRE", label: "Entre Ríos" },
        { id: "MENDOZ", label: "Mendoza" },
        { id: "CORRIE", label: "Corrientes" },
        { id: "CHACO", label: "Chaco" },
        { id: "RIONEG", label: "Rio Negro" },
    ]

    useEffect(() => {
        fetchPasadores()
        loadSecuenciaCounter()
    }, [])

    const fetchPasadores = async () => {
        try {
            const pasadoresCollection = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresCollection)
            const pasadoresList = pasadoresSnapshot.docs.map((doc) => ({
                id: doc.id,
                displayId: doc.data().displayId,
                nombre: doc.data().nombre,
                nombreFantasia: doc.data().nombreFantasia,
            }))
            setPasadores(pasadoresList)
        } catch (error) {
            console.error("Error fetching pasadores:", error)
            toast.error("Error al cargar los pasadores")
        }
    }

    const loadSecuenciaCounter = () => {
        const storedCounter = localStorage.getItem("secuenciaCounter")
        if (storedCounter) {
            setSecuenciaCounter(Number.parseInt(storedCounter))
        }
    }

    const incrementSecuenciaCounter = useCallback(() => {
        setSecuenciaCounter((prevCounter) => {
            const newCounter = prevCounter + 1
            localStorage.setItem("secuenciaCounter", newCounter.toString())
            return newCounter
        })
    }, [])

    const calcularTotalMonto = useCallback(() => {
        const total = jugadas.reduce((sum, jugada) => {
            const importe = Number.parseFloat(jugada.importe) || 0
            return sum + importe * selectedLotteries.length
        }, 0)
        setTotalMonto(total)
    }, [jugadas, selectedLotteries])

    useEffect(() => {
        calcularTotalMonto()
    }, [calcularTotalMonto])

    const handleJugadaChange = (index: number, field: keyof Jugada, value: string) => {
        const newJugadas = [...jugadas]
        newJugadas[index] = { ...newJugadas[index], [field]: value }
        setJugadas(newJugadas)
    }

    const handleLotteryChange = (lotteryId: string, checked: boolean) => {
        setSelectedLotteries((prev) => (checked ? [...prev, lotteryId] : prev.filter((id) => id !== lotteryId)))
    }

    const formatDate = (date: Date) => {
        return date.toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        })
    }

    const generarSecuencia = () => {
        const secuencia = secuenciaCounter.toString().padStart(9, "0")
        incrementSecuenciaCounter()
        return secuencia
    }

    const generarTicket = (jugadasParaTicket: Jugada[]) => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            toast.error("Pasador no encontrado")
            return
        }

        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005"
        const secuencia = generarSecuencia()

        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"

        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo
        ticketContent += `${loteriaAbreviada}\n`
        ticketContent += `SECUENCIA  ${secuencia}\n`

        const provinciasSet = new Set(selectedLotteries.map((l) => provinceAbbreviations[l] || l))
        ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
        ticketContent += "NUMERO UBIC   IMPORTE\n"

        jugadasParaTicket.forEach((jugada) => {
            const numero = jugada.numero.padStart(4, " ")
            const posicion = jugada.posicion.padStart(2, " ")
            const importe = Number.parseFloat(jugada.importe) || 0
            ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`
        })

        ticketContent += "-".repeat(32) + "\n"
        ticketContent += `TOTAL: $${totalMonto.toFixed(2)}`.padStart(32) + "\n"

        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)

        return secuencia
    }

    const guardarJugadas = async () => {
        if (jugadas.length === 0 || !selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Faltan datos para guardar las jugadas")
            return
        }

        try {
            setIsLoading(true)
            const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorSeleccionado) {
                toast.error("Pasador no encontrado")
                return
            }

            const jugadasValidas = jugadas.filter((j) => j.numero && j.posicion && j.importe)
            if (jugadasValidas.length === 0) {
                toast.error("No hay jugadas válidas para guardar")
                return
            }

            const secuencia = generarTicket(jugadasValidas)

            const jugadasPasadorCollection = collection(db, `JUGADAS DE ${pasadorSeleccionado.nombre}`)

            const nuevaJugada = {
                fechaHora: serverTimestamp(),
                id: secuencia,
                jugadas: jugadasValidas.map((jugada) => ({
                    decompositionStep: 0,
                    fechaHora: new Date().toISOString(),
                    loteria: selectedSorteo,
                    monto: jugada.importe,
                    montoTotal: Number.parseFloat(jugada.importe),
                    numero: jugada.numero,
                    numeros: [jugada.numero],
                    originalNumero: jugada.numero,
                    originalPosicion: jugada.posicion,
                    posicion: jugada.posicion,
                    provincias: selectedLotteries,
                    secuencia: secuencia,
                    tipo: "NUEVA JUGADA",
                })),
                loteria: selectedSorteo,
                monto: totalMonto.toFixed(2),
                numero: jugadasValidas[0].numero,
                numeros: jugadasValidas.map((j) => j.numero),
                pasadorId: selectedPasador,
                provincias: selectedLotteries,
                secuencia: secuencia,
                tipo: "NUEVA JUGADA",
                totalMonto: totalMonto,
            }

            await addDoc(jugadasPasadorCollection, nuevaJugada)

            toast.success("Jugadas guardadas exitosamente")
            limpiarFormulario()
        } catch (error) {
            console.error("Error al guardar las jugadas:", error)
            toast.error("Error al guardar las jugadas")
        } finally {
            setIsLoading(false)
        }
    }

    const limpiarFormulario = () => {
        setJugadas(createEmptyJugadas())
        setSelectedLotteries([])
        setSelectedSorteo("")
        setTotalMonto(0)
    }

    // Función para manejar la navegación con Enter
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
        if (e.key === "Enter") {
            e.preventDefault()

            // Determinar el siguiente campo para enfocar
            let nextRow = rowIndex
            let nextCol = colIndex + 1

            // Si estamos en la última columna, pasar a la primera columna de la siguiente fila
            if (nextCol > 2) {
                nextCol = 0
                nextRow = rowIndex + 1
            }

            // Si llegamos al final de todas las filas, volver al primer campo
            if (nextRow >= jugadas.length) {
                nextRow = 0
                nextCol = 0
            }

            // Enfocar el siguiente campo
            const nextInput = inputRefs.current[nextRow]?.[nextCol]
            if (nextInput) {
                nextInput.focus()
            }
        }
    }

    // Función para guardar la referencia del input
    const setInputRef = (el: HTMLInputElement | null, rowIndex: number, colIndex: number) => {
        if (el && inputRefs.current[rowIndex]) {
            inputRefs.current[rowIndex][colIndex] = el
        }
    }

    // Generar las filas de jugadas para asegurar que siempre haya 100
    const renderJugadasRows = () => {
        // Asegurarse de que tenemos 100 filas
        const filasJugadas = jugadas.length < TOTAL_FILAS ? createEmptyJugadas() : jugadas

        return filasJugadas.map((jugada, rowIndex) => (
            <TableRow
                key={rowIndex}
                className={`${rowIndex % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors`}
            >
                <TableCell className="font-medium text-blue-800">{(rowIndex + 1).toString().padStart(3, "0")}</TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.numero}
                        onChange={(e) => handleJugadaChange(rowIndex, "numero", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
                        ref={(el) => setInputRef(el, rowIndex, 0)}
                    />
                </TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.posicion}
                        onChange={(e) => handleJugadaChange(rowIndex, "posicion", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                        ref={(el) => setInputRef(el, rowIndex, 1)}
                    />
                </TableCell>
                <TableCell>
                    <Input
                        className="w-full border-blue-200 focus:border-blue-500 focus:ring-blue-500"
                        value={jugada.importe}
                        onChange={(e) => handleJugadaChange(rowIndex, "importe", e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                        ref={(el) => setInputRef(el, rowIndex, 2)}
                    />
                </TableCell>
            </TableRow>
        ))
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <div className="container mx-auto p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-2xl font-bold text-center">PASAR JUGADAS QUINIELA</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <Label htmlFor="sorteo" className="min-w-[80px] text-blue-800 font-semibold">
                                        SORTEO:
                                    </Label>
                                    <Select value={selectedSorteo} onValueChange={setSelectedSorteo}>
                                        <SelectTrigger id="sorteo" className="w-[200px] border-blue-300 focus:ring-blue-500">
                                            <SelectValue placeholder="Seleccionar horario" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {horarios.map((horario) => (
                                                <SelectItem key={horario.id} value={horario.id}>
                                                    {horario.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Label htmlFor="pasador" className="min-w-[80px] text-blue-800 font-semibold">
                                        PASADOR:
                                    </Label>
                                    <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                        <SelectTrigger id="pasador" className="w-[200px] border-blue-300 focus:ring-blue-500">
                                            <SelectValue placeholder="Seleccionar pasador" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pasadores.map((pasador) => (
                                                <SelectItem key={pasador.id} value={pasador.id}>
                                                    {`${pasador.displayId} - ${pasador.nombreFantasia || pasador.nombre}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm">
                                <Label className="mb-3 block text-indigo-800 font-semibold">LOTERÍAS:</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {loterias.map((loteria) => (
                                        <div key={loteria.id} className="flex items-center space-x-2 bg-white p-2 rounded-md shadow-sm">
                                            <Checkbox
                                                id={loteria.id}
                                                checked={selectedLotteries.includes(loteria.id)}
                                                onCheckedChange={(checked) => handleLotteryChange(loteria.id, checked === true)}
                                                className="border-indigo-400 text-indigo-600"
                                            />
                                            <Label htmlFor={loteria.id} className="text-gray-700">
                                                {loteria.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-2 text-blue-800 border-b-2 border-blue-300 pb-2 flex items-center">
                                    <Calculator className="h-5 w-5 mr-2 text-blue-600" />
                                    DATOS DE LA JUGADA
                                </h3>
                                <div className="border border-blue-200 rounded-md overflow-auto max-h-[600px] shadow-md">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 z-10">
                                            <TableRow>
                                                <TableHead className="w-[60px] text-white font-bold">Nº</TableHead>
                                                <TableHead className="text-white font-bold">NÚMERO</TableHead>
                                                <TableHead className="text-white font-bold">POSICIÓN</TableHead>
                                                <TableHead className="text-white font-bold">IMPORTE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>{renderJugadasRows()}</TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="text-xl font-bold text-blue-800">
                                    Total: <span className="text-green-600">${totalMonto.toFixed(2)}</span>
                                </div>
                                <Button
                                    onClick={guardarJugadas}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Cargar Jugadas
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800 text-center">Ticket de Jugada</DialogTitle>
                        </DialogHeader>
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                            <pre className="whitespace-pre-wrap font-mono text-sm">{ticketContent}</pre>
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                onClick={() => setIsTicketDialogOpen(false)}
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cerrar
                            </Button>
                            <Button
                                onClick={() => {
                                    const printWindow = window.open("", "", "width=300,height=600")
                                    if (printWindow) {
                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>Ticket de Jugada</title>
                                                    <style>
                                                        body {
                                                            font-family: 'Courier New', monospace;
                                                            font-size: 12px;
                                                            width: 80mm;
                                                            margin: 0;
                                                            padding: 10px;
                                                        }
                                                        pre {
                                                            white-space: pre-wrap;
                                                            margin: 0;
                                                        }
                                                    </style>
                                                </head>
                                                <body>
                                                    <pre>${ticketContent}</pre>
                                                </body>
                                            </html>
                                        `)
                                        printWindow.document.close()
                                        printWindow.focus()
                                        printWindow.print()
                                        printWindow.close()
                                    }
                                }}
                                className="bg-gradient-to-r from-green-600 to-teal-700 hover:from-green-700 hover:to-teal-800 text-white"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
