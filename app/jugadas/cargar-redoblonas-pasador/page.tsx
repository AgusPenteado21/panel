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
import { toast } from "react-hot-toast"
import { Loader2, Save, Printer, X, Calculator, Plus } from "lucide-react"
import Navbar from "@/app/components/Navbar"

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

interface Redoblona {
    numero: string
    posicion: string
    originalNumero: string
    originalPosicion: string
}

interface JugadaCompleta extends Jugada {
    id?: string
    secuencia?: string
    loteria: string
    provincias: string[]
    fechaHora?: string
    tipo: string
    originalNumero?: string
    originalPosicion?: string
    decompositionStep?: number
    redoblonas: Redoblona[]
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
    SANTIA: "SG",
    TUCUMA: "TU",
}

// Número total de filas de jugadas
const TOTAL_FILAS = 50

// Crear un array de jugadas vacías para inicializar el estado
const createEmptyJugadas = () => {
    return Array(TOTAL_FILAS)
        .fill(null)
        .map(() => ({ numero: "", posicion: "", importe: "" }))
}

export default function CargarRedoblonas() {
    const [selectedLotteries, setSelectedLotteries] = useState<string[]>([])
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [selectedSorteo, setSelectedSorteo] = useState<string>("")
    const [jugadas, setJugadas] = useState<Jugada[]>(createEmptyJugadas())
    const [jugadasCompletas, setJugadasCompletas] = useState<JugadaCompleta[]>([])
    const [totalMonto, setTotalMonto] = useState(0)
    const [ticketContent, setTicketContent] = useState<string>("")
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
    const [secuenciaCounter, setSecuenciaCounter] = useState(10000)
    const [isLoading, setIsLoading] = useState(false)
    const [isRedoblonaDialogOpen, setIsRedoblonaDialogOpen] = useState(false)
    const [currentJugadaIndex, setCurrentJugadaIndex] = useState<number | null>(null)
    const [redoblonaNumero, setRedoblonaNumero] = useState("")
    const [redoblonaPosicion, setRedoblonaPosicion] = useState("")

    // Crear un array para almacenar las referencias a los inputs
    const inputRefs = useRef<HTMLInputElement[][]>([])

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
        { id: "SANTIA", label: "Santiago" },
        { id: "TUCUMA", label: "Tucumán" },
    ]

    const fetchPasadores = useCallback(async () => {
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
    }, [])

    const loadSecuenciaCounter = useCallback(() => {
        const storedCounter = localStorage.getItem("secuenciaCounter")
        if (storedCounter) {
            setSecuenciaCounter(Number.parseInt(storedCounter))
        } else {
            // Inicializar con un número más grande para tener 13 dígitos
            setSecuenciaCounter(1000000000000) // 13 dígitos
        }
    }, [])

    const incrementSecuenciaCounter = useCallback(() => {
        setSecuenciaCounter((prevCounter) => {
            const newCounter = prevCounter + 1
            localStorage.setItem("secuenciaCounter", newCounter.toString())
            return newCounter
        })
    }, [])

    const calcularTotalMonto = useCallback(() => {
        const total = jugadasCompletas.reduce((sum, jugada) => {
            const importe = Number.parseFloat(jugada.importe) || 0
            return sum + importe * jugada.provincias.length
        }, 0)
        setTotalMonto(total)
    }, [jugadasCompletas])

    const generarSecuenciaUnicaRapida = useCallback((): string => {
        // Usar timestamp + contador + número aleatorio para garantizar unicidad
        const timestamp = Date.now().toString().slice(-8) // Últimos 8 dígitos del timestamp
        const contador = secuenciaCounter.toString().padStart(3, "0")
        const aleatorio = Math.floor(Math.random() * 100)
            .toString()
            .padStart(2, "0")

        const secuencia = `${timestamp}${contador}${aleatorio}`.padStart(13, "0")
        incrementSecuenciaCounter()

        console.log(`⚡ Secuencia generada instantáneamente: ${secuencia}`)
        return secuencia
    }, [secuenciaCounter, incrementSecuenciaCounter])

    // Inicializar el array de referencias
    useEffect(() => {
        // Asegurarse de que tenemos filas de jugadas
        if (jugadas.length < TOTAL_FILAS) {
            setJugadas(createEmptyJugadas())
        }

        // Inicializar las referencias
        inputRefs.current = Array(TOTAL_FILAS)
            .fill(0)
            .map(() => Array(3).fill(null))
    }, [jugadas.length])

    useEffect(() => {
        fetchPasadores()
        loadSecuenciaCounter()
    }, [fetchPasadores, loadSecuenciaCounter])

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

    const generarTicketConMultiplesSecuencias = (jugadasParaTicket: JugadaCompleta[], secuencias: string[]) => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            toast.error("Pasador no encontrado")
            return
        }

        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005"

        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"

        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo

        let secuenciaIndex = 0
        let totalGeneral = 0

        // Procesar cada jugada principal con su primera redoblona
        for (let i = 0; i < jugadasCompletas.length; i++) {
            const jugada = jugadasCompletas[i]
            const importe = Number.parseFloat(jugada.importe) || 0
            const subtotal = importe * jugada.provincias.length
            totalGeneral += subtotal

            // Secuencia para la jugada principal + primera redoblona
            const secuenciaPrincipal = secuencias[secuenciaIndex++]

            // Mostrar encabezado de la lotería y secuencia
            ticketContent += `${loteriaAbreviada}\n`
            ticketContent += `SECUENCIA  ${secuenciaPrincipal}\n`

            // Mostrar loterías seleccionadas
            const provinciasSet = new Set(jugada.provincias.map((p) => provinceAbbreviations[p] || p))
            ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
            ticketContent += "NUMERO UBIC   IMPORTE\n"

            // Mostrar la jugada principal
            const numero = jugada.numero.padStart(4, " ")
            const posicion = jugada.posicion.padStart(2, " ")
            ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`

            // Mostrar la primera redoblona (si existe)
            if (jugada.redoblonas && jugada.redoblonas.length > 0) {
                const primeraRedoblona = jugada.redoblonas[0]
                const redoblonaNumero = primeraRedoblona.numero.padStart(4, " ")
                const redoblonaPosicion = primeraRedoblona.posicion.padStart(2, " ")
                ticketContent += `${redoblonaNumero}  ${redoblonaPosicion}   XXX\n`
            }

            // Agregar separador después de cada jugada principal
            ticketContent += "-".repeat(32) + "\n"

            // Procesar redoblonas adicionales (cada una con su propia secuencia)
            for (let j = 1; j < jugada.redoblonas.length; j++) {
                const redoblonaAdicional = jugada.redoblonas[j]
                const secuenciaAdicional = secuencias[secuenciaIndex++]

                // Mostrar encabezado para la redoblona adicional
                ticketContent += `${loteriaAbreviada}\n`
                ticketContent += `SECUENCIA  ${secuenciaAdicional}\n`
                ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
                ticketContent += "NUMERO UBIC   IMPORTE\n"

                // Mostrar la redoblona adicional
                const redoblonaNumeroAdicional = redoblonaAdicional.numero.padStart(4, " ")
                const redoblonaPosicionAdicional = redoblonaAdicional.posicion.padStart(2, " ")
                ticketContent += `${redoblonaNumeroAdicional}  ${redoblonaPosicionAdicional}   $${importe.toFixed(2)}\n`

                // Agregar separador después de cada redoblona adicional
                ticketContent += "-".repeat(32) + "\n"
            }
        }

        // Mostrar el subtotal al final
        ticketContent += `SUBTOTAL: $${totalGeneral.toFixed(2)}\n\n`

        // Mostrar el total general
        ticketContent += "=".repeat(32) + "\n"
        ticketContent += `TOTAL: $${totalGeneral.toFixed(2)}`.padStart(32) + "\n"

        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)
    }

    const guardarJugadas = async () => {
        if (jugadasCompletas.length === 0 || !selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Faltan datos para guardar las jugadas")
            return
        }

        // Validar que todas las jugadas tengan al menos una redoblona
        const jugadasSinRedoblona = jugadasCompletas.filter((jugada) => jugada.redoblonas.length === 0)
        if (jugadasSinRedoblona.length > 0) {
            toast.error("Todas las jugadas deben tener al menos una redoblona")
            return
        }

        try {
            setIsLoading(true)
            const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorSeleccionado) {
                toast.error("Pasador no encontrado")
                return
            }

            console.log("⚡ Generando secuencias instantáneamente...")
            const fechaHoraISO = new Date().toISOString()
            const jugadasPasadorCollection = collection(db, `JUGADAS DE ${pasadorSeleccionado.nombre}`)

            // Generar todas las secuencias de una vez (instantáneo)
            const documentosAGuardar = []
            const secuenciasGeneradas = []

            for (const jugada of jugadasCompletas) {
                // Generar secuencia única para la jugada principal + primera redoblona
                const secuenciaApuestaPrincipal = generarSecuenciaUnicaRapida()
                secuenciasGeneradas.push(secuenciaApuestaPrincipal)

                // Preparar la primera redoblona (va con la jugada principal)
                const primeraRedoblona = jugada.redoblonas[0]
                const redoblonasPrincipales = [
                    {
                        numero: primeraRedoblona.numero,
                        originalNumero: primeraRedoblona.originalNumero,
                        originalPosicion: primeraRedoblona.originalPosicion,
                        posicion: primeraRedoblona.posicion,
                        secuencia: secuenciaApuestaPrincipal,
                        tipo: "Jugada con redoblona",
                    },
                ]

                // Documento para la jugada principal + primera redoblona
                const documentoApuestaPrincipal = {
                    fechaHora: serverTimestamp(),
                    jugadas: [
                        {
                            decompositionStep: jugada.decompositionStep || 0,
                            fechaHora: fechaHoraISO,
                            loteria: selectedSorteo,
                            monto: jugada.importe,
                            montoTotal: Number.parseFloat(jugada.importe) * selectedLotteries.length,
                            numero: jugada.numero,
                            numeros: [jugada.numero],
                            originalNumero: jugada.originalNumero || jugada.numero,
                            originalPosicion: jugada.originalPosicion || jugada.posicion,
                            posicion: jugada.posicion,
                            provincias: selectedLotteries,
                            secuencia: secuenciaApuestaPrincipal,
                            redoblonas: redoblonasPrincipales,
                        },
                    ],
                    loteria: selectedSorteo,
                    monto: jugada.importe,
                    numero: jugada.numero,
                    numeros: [jugada.numero],
                    pasadorId: selectedPasador,
                    provincias: selectedLotteries,
                    secuencia: secuenciaApuestaPrincipal,
                    tipo: "Jugada con redoblona",
                    totalMonto: Number.parseFloat(jugada.importe) * selectedLotteries.length,
                }
                documentosAGuardar.push(documentoApuestaPrincipal)

                // Crear documentos separados para redoblonas adicionales (segunda, tercera, etc.)
                for (let i = 1; i < jugada.redoblonas.length; i++) {
                    const redoblonaAdicional = jugada.redoblonas[i]
                    const secuenciaRedoblonaAdicional = generarSecuenciaUnicaRapida()
                    secuenciasGeneradas.push(secuenciaRedoblonaAdicional)

                    const documentoRedoblonaAdicional = {
                        fechaHora: serverTimestamp(),
                        jugadas: [
                            {
                                decompositionStep: 0,
                                fechaHora: fechaHoraISO,
                                loteria: selectedSorteo,
                                monto: jugada.importe,
                                montoTotal: Number.parseFloat(jugada.importe) * selectedLotteries.length,
                                numero: redoblonaAdicional.numero,
                                numeros: [redoblonaAdicional.numero],
                                originalNumero: redoblonaAdicional.originalNumero,
                                originalPosicion: redoblonaAdicional.originalPosicion,
                                posicion: redoblonaAdicional.posicion,
                                provincias: selectedLotteries,
                                secuencia: secuenciaRedoblonaAdicional,
                                redoblonas: [],
                            },
                        ],
                        loteria: selectedSorteo,
                        monto: jugada.importe,
                        numero: redoblonaAdicional.numero,
                        numeros: [redoblonaAdicional.numero],
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: secuenciaRedoblonaAdicional,
                        tipo: "Redoblona adicional",
                        totalMonto: Number.parseFloat(jugada.importe) * selectedLotteries.length,
                    }
                    documentosAGuardar.push(documentoRedoblonaAdicional)
                }
            }

            // Guardar todos los documentos en paralelo (mucho más rápido)
            console.log(`⚡ Guardando ${documentosAGuardar.length} documentos en paralelo...`)
            const promesasGuardado = documentosAGuardar.map((documento) => addDoc(jugadasPasadorCollection, documento))

            await Promise.all(promesasGuardado)
            console.log(`✅ Todos los documentos guardados exitosamente`)

            // Generar y mostrar el ticket con todas las secuencias
            generarTicketConMultiplesSecuencias(jugadasCompletas, secuenciasGeneradas)

            toast.success(`Jugadas guardadas exitosamente con ${secuenciasGeneradas.length} apuestas`)
            limpiarFormulario()
        } catch (error: unknown) {
            console.error("Error al guardar las jugadas:", error)
            let errorMessage = "Error al guardar las jugadas"

            // Verificar si el error tiene una propiedad message
            if (error instanceof Error) {
                errorMessage += ": " + error.message
            }

            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const limpiarFormulario = () => {
        setJugadas(createEmptyJugadas())
        setJugadasCompletas([])
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

    const eliminarJugada = (index: number) => {
        setJugadasCompletas((prev) => prev.filter((_, i) => i !== index))
    }

    const abrirDialogoRedoblona = (index: number) => {
        console.log("🔥 Abriendo diálogo redoblona para índice:", index)
        console.log("🔥 Jugadas completas:", jugadasCompletas)
        console.log("🔥 Jugada seleccionada:", jugadasCompletas[index])

        setCurrentJugadaIndex(index)
        setRedoblonaNumero("")
        setRedoblonaPosicion("")
        setIsRedoblonaDialogOpen(true)
    }

    const agregarRedoblona = () => {
        console.log("🔥 Agregando redoblona...")
        console.log("🔥 Current jugada index:", currentJugadaIndex)
        console.log("🔥 Redoblona numero:", redoblonaNumero)
        console.log("🔥 Redoblona posicion:", redoblonaPosicion)

        if (currentJugadaIndex === null) {
            console.log("❌ Error: currentJugadaIndex es null")
            toast.error("Error: No se ha seleccionado una jugada")
            return
        }

        if (!redoblonaNumero || !redoblonaPosicion) {
            console.log("❌ Error: Faltan datos de redoblona")
            toast.error("Debe ingresar número y posición para la redoblona")
            return
        }

        // Validar que la posición sea 5, 10 o 20
        if (!["5", "10", "20"].includes(redoblonaPosicion)) {
            console.log("❌ Error: Posición inválida")
            toast.error("La posición de la redoblona debe ser 5, 10 o 20")
            return
        }

        if (currentJugadaIndex >= jugadasCompletas.length) {
            console.log("❌ Error: Índice fuera de rango")
            toast.error("Error: Índice de jugada inválido")
            return
        }

        const jugadaOriginal = jugadasCompletas[currentJugadaIndex]
        console.log("🔥 Jugada original:", jugadaOriginal)

        const nuevaRedoblona: Redoblona = {
            numero: redoblonaNumero,
            posicion: redoblonaPosicion,
            originalNumero: jugadaOriginal.numero,
            originalPosicion: jugadaOriginal.posicion,
        }

        console.log("🔥 Nueva redoblona:", nuevaRedoblona)

        const nuevasJugadas = [...jugadasCompletas]
        nuevasJugadas[currentJugadaIndex] = {
            ...jugadaOriginal,
            tipo: "Jugada con redoblona",
            redoblonas: [...jugadaOriginal.redoblonas, nuevaRedoblona],
        }

        console.log("🔥 Jugadas actualizadas:", nuevasJugadas)

        setJugadasCompletas(nuevasJugadas)
        setIsRedoblonaDialogOpen(false)
        setCurrentJugadaIndex(null)
        setRedoblonaNumero("")
        setRedoblonaPosicion("")
        toast.success("Redoblona agregada exitosamente")
    }

    const crearJugadaConRedoblona = (index: number) => {
        const jugada = jugadas[index]
        if (!jugada.numero || !jugada.posicion || !jugada.importe) {
            toast.error("Debe completar número, posición e importe")
            return
        }

        if (!selectedSorteo) {
            toast.error("Debe seleccionar un sorteo")
            return
        }

        if (selectedLotteries.length === 0) {
            toast.error("Debe seleccionar al menos una lotería")
            return
        }

        // Crear la jugada base
        const nuevaJugada: JugadaCompleta = {
            numero: jugada.numero,
            posicion: jugada.posicion,
            importe: jugada.importe,
            loteria: selectedSorteo,
            provincias: [...selectedLotteries],
            tipo: "NUEVA JUGADA",
            redoblonas: [],
        }

        // Agregar la jugada al estado
        setJugadasCompletas((prev) => {
            const nuevasJugadas = [...prev, nuevaJugada]

            // Configurar el índice para la redoblona DESPUÉS de que se actualice el estado
            setTimeout(() => {
                setCurrentJugadaIndex(nuevasJugadas.length - 1)
                setRedoblonaNumero("")
                setRedoblonaPosicion("")
                setIsRedoblonaDialogOpen(true)
            }, 0)

            return nuevasJugadas
        })

        // Limpiar la fila de la tabla
        const newJugadas = [...jugadas]
        newJugadas[index] = { numero: "", posicion: "", importe: "" }
        setJugadas(newJugadas)

        // Enfocar el primer campo de la fila
        setTimeout(() => {
            const firstInput = inputRefs.current[index]?.[0]
            if (firstInput) {
                firstInput.focus()
            }
        }, 100)
    }

    // Generar las filas de jugadas para la tabla de entrada
    const renderJugadasRows = () => {
        return jugadas.map((jugada, rowIndex) => (
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
                <TableCell>
                    <Button
                        size="sm"
                        variant="outline"
                        className="bg-amber-500 text-white hover:bg-amber-600"
                        onClick={() => crearJugadaConRedoblona(rowIndex)}
                    >
                        <Plus className="h-4 w-4 mr-1" />+ Redoblona
                    </Button>
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
                        <CardTitle className="text-2xl font-bold text-center">CARGAR REDOBLONAS</CardTitle>
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
                                    INGRESAR JUGADAS
                                </h3>
                                <div className="border border-blue-200 rounded-md overflow-auto max-h-[400px] shadow-md">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 z-10">
                                            <TableRow>
                                                <TableHead className="w-[60px] text-white font-bold">Nº</TableHead>
                                                <TableHead className="text-white font-bold">NÚMERO</TableHead>
                                                <TableHead className="text-white font-bold">POSICIÓN</TableHead>
                                                <TableHead className="text-white font-bold">IMPORTE</TableHead>
                                                <TableHead className="text-white font-bold">ACCIÓN</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>{renderJugadasRows()}</TableBody>
                                    </Table>
                                </div>
                            </div>

                            {jugadasCompletas.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-2 text-blue-800 border-b-2 border-blue-300 pb-2">
                                        JUGADAS AGREGADAS
                                    </h3>
                                    <div className="border border-blue-200 rounded-md overflow-auto max-h-[300px] shadow-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 z-10">
                                                <TableRow>
                                                    <TableHead className="text-white font-bold">NÚMERO</TableHead>
                                                    <TableHead className="text-white font-bold">POSICIÓN</TableHead>
                                                    <TableHead className="text-white font-bold">IMPORTE</TableHead>
                                                    <TableHead className="text-white font-bold">REDOBLONAS</TableHead>
                                                    <TableHead className="text-white font-bold">ACCIONES</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {jugadasCompletas.map((jugada, index) => (
                                                    <TableRow key={index} className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}>
                                                        <TableCell>{jugada.numero}</TableCell>
                                                        <TableCell>{jugada.posicion}</TableCell>
                                                        <TableCell>${jugada.importe}</TableCell>
                                                        <TableCell>
                                                            {jugada.redoblonas.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {jugada.redoblonas.map((redoblona, rIndex) => (
                                                                        <div key={rIndex} className="text-sm bg-indigo-100 p-1 rounded">
                                                                            {redoblona.numero} - {redoblona.posicion}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-500">Sin redoblonas</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex space-x-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="bg-amber-500 text-white hover:bg-amber-600"
                                                                    onClick={() => {
                                                                        console.log("🔥 Click en botón + Redoblona, índice:", index)
                                                                        abrirDialogoRedoblona(index)
                                                                    }}
                                                                >
                                                                    + Redoblona
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="bg-red-500 text-white hover:bg-red-600"
                                                                    onClick={() => eliminarJugada(index)}
                                                                >
                                                                    Eliminar
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                                <div className="text-xl font-bold text-blue-800">
                                    Total: <span className="text-green-600">${totalMonto.toFixed(2)}</span>
                                </div>
                                <Button
                                    onClick={guardarJugadas}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105"
                                    disabled={isLoading || jugadasCompletas.length === 0}
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

                {/* Diálogo para mostrar el ticket */}
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

                {/* Diálogo para agregar redoblona */}
                <Dialog open={isRedoblonaDialogOpen} onOpenChange={setIsRedoblonaDialogOpen}>
                    <DialogContent className="bg-amber-100 border border-amber-300 shadow-xl max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-amber-800 text-center">Agregar Redoblona</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Panel de debug */}
                            <div className="bg-gray-100 p-2 rounded text-xs">
                                <p>Debug: Índice actual: {currentJugadaIndex}</p>
                                <p>Debug: Número: &quot;{redoblonaNumero}&quot;</p>
                                <p>Debug: Posición: &quot;{redoblonaPosicion}&quot;</p>
                            </div>

                            {currentJugadaIndex !== null && jugadasCompletas[currentJugadaIndex] && (
                                <div className="bg-white p-3 rounded-md">
                                    <p className="font-semibold text-gray-700">Jugada Original:</p>
                                    <p>Número: {jugadasCompletas[currentJugadaIndex]?.numero}</p>
                                    <p>Posición: {jugadasCompletas[currentJugadaIndex]?.posicion}</p>
                                    <p>Redoblonas actuales: {jugadasCompletas[currentJugadaIndex]?.redoblonas?.length || 0}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="redoblonaNumero" className="text-amber-800">
                                        Número Redoblona
                                    </Label>
                                    <Input
                                        id="redoblonaNumero"
                                        value={redoblonaNumero}
                                        onChange={(e) => {
                                            console.log("🔥 Cambiando número redoblona:", e.target.value)
                                            setRedoblonaNumero(e.target.value)
                                        }}
                                        className="border-amber-300"
                                        maxLength={4}
                                        placeholder="Ej: 1234"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="redoblonaPosicion" className="text-amber-800">
                                        Posición Redoblona
                                    </Label>
                                    <Select
                                        value={redoblonaPosicion}
                                        onValueChange={(value: string) => {
                                            console.log("🔥 Cambiando posición redoblona:", value)
                                            setRedoblonaPosicion(value)
                                        }}
                                    >
                                        <SelectTrigger id="redoblonaPosicion" className="border-amber-300">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5</SelectItem>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-sm text-amber-700">La redoblona utilizará el mismo importe que la jugada original.</p>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={() => {
                                    console.log("🔥 Cancelando diálogo redoblona")
                                    setIsRedoblonaDialogOpen(false)
                                    setCurrentJugadaIndex(null)
                                    setRedoblonaNumero("")
                                    setRedoblonaPosicion("")
                                }}
                                variant="outline"
                                className="border-amber-300 text-amber-700"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    console.log("🔥 Click en Agregar Redoblona")
                                    agregarRedoblona()
                                }}
                                className="bg-amber-600 text-white hover:bg-amber-700"
                            >
                                Agregar Redoblona
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
