"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, Save, Printer, Share2, RefreshCw } from "lucide-react"
import Navbar from "@/app/components/Navbar"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { format } from "date-fns"
import { toast } from "react-hot-toast"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    nombreFantasia: string
}

interface TriplonaApuesta {
    numeros: string[]
    loteria: string
    provincias: string[]
}

interface BorratinaApuesta {
    numeros: string[]
    loteria: string
}

interface QuintinaApuesta {
    numeros: string[]
    loteria: string
    provincias: string[]
}

interface ExactaApuesta {
    numero: string
    posicion: string
    importe: string
    loteria: string
    provincias: string[]
}

interface ExactaJugada {
    numero: string
    posicion: string
    importe: string
}

interface Loteria {
    id: string
    label: string
    color: string
    habilitada?: boolean
}

const lotteryAbbreviations: { [key: string]: string } = {
    PREVIA: "PRE",
    PRIMERA: "PRIM",
    MATUTINA: "MAT",
    VESPERTINA: "VES",
    NOCTURNA: "NOC",
}

// Agregar Río Negro a las provincias y abreviaturas
const provinceAbbreviations: { [key: string]: string } = {
    NACION: "NAC",
    PROVIN: "PRO",
    SANTA: "SF",
    CORDOB: "COR",
    URUGUA: "URU",
    ENTRE: "ER",
    MENDOZ: "MEN",
    CORRIE: "CRI",
    CHACO: "CHA",
    RIONEG: "RN",
}

// Agregar Río Negro a la lista de loterías
const loterias: Loteria[] = [
    { id: "NACION", label: "Nacional", color: "bg-blue-100 border-blue-500", habilitada: true },
    { id: "PROVIN", label: "Provincia", color: "bg-green-100 border-green-500", habilitada: true },
    { id: "SANTA", label: "Santa Fe", color: "bg-red-100 border-red-500", habilitada: true },
    { id: "CORDOB", label: "Córdoba", color: "bg-yellow-100 border-yellow-500", habilitada: true },
    { id: "URUGUA", label: "Uruguay", color: "bg-indigo-100 border-indigo-500", habilitada: true },
    { id: "ENTRE", label: "Entre Ríos", color: "bg-teal-100 border-teal-500", habilitada: true },
    { id: "MENDOZ", label: "Mendoza", color: "bg-purple-100 border-purple-500", habilitada: true },
    { id: "CORRIE", label: "Corrientes", color: "bg-orange-100 border-orange-500", habilitada: true },
    { id: "CHACO", label: "Chaco", color: "bg-pink-100 border-pink-500", habilitada: true },
    { id: "RIONEG", label: "Río Negro", color: "bg-cyan-100 border-cyan-500", habilitada: true },
]

const formatDate = (date: Date): string => {
    return format(date, "dd/MM/yy HH:mm")
}

export default function CargarJugadas() {
    const [selectedLotteries, setSelectedLotteries] = useState<string[]>([])
    const [selectedSorteo, setSelectedSorteo] = useState<string>("")
    const [selectedPasador, setSelectedPasador] = useState<string>("")
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [triplonaApuestas, setTriplonaApuestas] = useState<TriplonaApuesta[]>([])
    const [borratinaApuestas, setBorratinaApuestas] = useState<BorratinaApuesta[]>([])
    const [quintinaApuestas, setQuintinaApuestas] = useState<QuintinaApuesta[]>([])
    const [exactaApuestas, setExactaApuestas] = useState<ExactaApuesta[]>([])
    const [total, setTotal] = useState<number>(0)
    const [secuencia, setSecuencia] = useState<string>("")
    const [activeTab, setActiveTab] = useState<"triplona" | "borratina" | "quintina" | "exacta">("triplona")
    const [exactaNumero, setExactaNumero] = useState("")
    const [exactaPosicion, setExactaPosicion] = useState("")
    const [exactaImporte, setExactaImporte] = useState("")
    const [jugadas, setJugadas] = useState<ExactaJugada[]>(Array(4).fill({ numero: "", posicion: "", importe: "" }))
    const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false)
    const [ticketContent, setTicketContent] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const numero1Ref = useRef<HTMLInputElement>(null)
    const numero2Ref = useRef<HTMLInputElement>(null)
    const numero3Ref = useRef<HTMLInputElement>(null)
    const borratinaRefs = useRef<(HTMLInputElement | null)[]>(Array(8).fill(null))
    const quintinaRefs = useRef<(HTMLInputElement | null)[]>(Array(5).fill(null))

    const sorteos: { id: string; label: string; color: string }[] = [
        { id: "PREVIA", label: "La Previa", color: "bg-purple-600" },
        { id: "PRIMERA", label: "Primera", color: "bg-blue-600" },
        { id: "MATUTINA", label: "Matutina", color: "bg-yellow-600" },
        { id: "VESPERTINA", label: "Vespertina", color: "bg-orange-600" },
        { id: "NOCTURNA", label: "Nocturna", color: "bg-indigo-600" },
    ]

    useEffect(() => {
        fetchPasadores()
        if (!["MATUTINA", "NOCTURNA"].includes(selectedSorteo)) {
            setSelectedLotteries((prevLotteries) => prevLotteries.filter((lottery) => lottery !== "URUGUA"))
        }
    }, [selectedSorteo])

    const fetchPasadores = async () => {
        try {
            setIsLoading(true)
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
            console.error("Error al obtener pasadores:", error)
            toast.error("No se pudieron cargar los pasadores. Por favor, intente nuevamente.")
        } finally {
            setIsLoading(false)
        }
    }

    // Modificar la función handleTriplonaInput para agregar la jugada al presionar Enter en el último campo
    const handleTriplonaInput = (
        e: React.ChangeEvent<HTMLInputElement>,
        nextRef: React.RefObject<HTMLInputElement> | null,
    ) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value
        if (value.length === 2 && nextRef && nextRef.current) {
            nextRef.current.focus()
        }
        if (value.length === 2 && !nextRef) {
            agregarTriplona()
        }
    }

    // Modificar la función handleBorratinaInput para agregar la jugada al presionar Enter en el último campo
    const handleBorratinaInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value
        if (value.length === 2) {
            const isRepeated = borratinaRefs.current.some((ref, i) => i !== index && ref?.value === value)
            if (isRepeated) {
                e.target.value = ""
                toast.error("Este número ya ha sido ingresado. Por favor, elija otro.")
                return
            }
            if (index < 7 && borratinaRefs.current[index + 1]) {
                borratinaRefs.current[index + 1]?.focus()
            } else if (index === 7) {
                agregarBorratina()
            }
        }
    }

    // Modificar la función handleQuintinaInput para agregar la jugada al presionar Enter en el último campo
    const handleQuintinaInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value
        if (value.length === 2) {
            if (index < 4 && quintinaRefs.current[index + 1]) {
                quintinaRefs.current[index + 1]?.focus()
            } else if (index === 4) {
                agregarQuintina()
            }
        }
    }

    const agregarTriplona = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numero1 = numero1Ref.current?.value || ""
        const numero2 = numero2Ref.current?.value || ""
        const numero3 = numero3Ref.current?.value || ""

        if (numero1.length !== 2 || numero2.length !== 2 || numero3.length !== 2) {
            toast.error("Por favor, ingrese tres números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: TriplonaApuesta = {
            numeros: [numero1, numero2, numero3],
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setTriplonaApuestas([...triplonaApuestas, nuevaApuesta])
        setTotal(total + selectedLotteries.length * 50)
        toast.success("Triplona agregada correctamente")

        if (numero1Ref.current) numero1Ref.current.value = ""
        if (numero2Ref.current) numero2Ref.current.value = ""
        if (numero3Ref.current) numero3Ref.current.value = ""
        if (numero1Ref.current) numero1Ref.current.focus()
    }

    const agregarBorratina = () => {
        if (!selectedPasador || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = borratinaRefs.current.map((ref) => ref?.value || "")
        if (numeros.some((num) => num.length !== 2)) {
            toast.error("Por favor, ingrese ocho números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: BorratinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
        }

        setBorratinaApuestas([...borratinaApuestas, nuevaApuesta])
        setTotal(total + 30)
        toast.success("Borratina agregada correctamente")

        borratinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (borratinaRefs.current[0]) borratinaRefs.current[0].focus()
    }

    const agregarQuintina = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = quintinaRefs.current.map((ref) => ref?.value || "")
        if (numeros.some((num) => num.length !== 2)) {
            toast.error("Por favor, ingrese cinco números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: QuintinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setQuintinaApuestas([...quintinaApuestas, nuevaApuesta])
        // Cambiar de 50 a 100 pesos por provincia
        setTotal(total + selectedLotteries.length * 100)
        toast.success("Quintina agregada correctamente")

        quintinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (quintinaRefs.current[0]) quintinaRefs.current[0].focus()
    }

    const eliminarTriplona = (index: number) => {
        const apuestaEliminada = triplonaApuestas[index]
        setTriplonaApuestas(triplonaApuestas.filter((_, i) => i !== index))
        setTotal(total - apuestaEliminada.provincias.length * 50)
        toast.success("Triplona eliminada")
    }

    const eliminarBorratina = (index: number) => {
        setBorratinaApuestas(borratinaApuestas.filter((_, i) => i !== index))
        setTotal(total - 30)
        toast.success("Borratina eliminada")
    }

    const eliminarQuintina = (index: number) => {
        const apuestaEliminada = quintinaApuestas[index]
        setQuintinaApuestas(quintinaApuestas.filter((_, i) => i !== index))
        // Cambiar de 50 a 100 pesos por provincia
        setTotal(total - apuestaEliminada.provincias.length * 100)
        toast.success("Quintina eliminada")
    }

    const agregarExacta = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            toast.error("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        if (
            exactaNumero.length < 2 ||
            exactaNumero.length > 4 ||
            !["1", "5", "10", "20"].includes(exactaPosicion) ||
            !exactaImporte
        ) {
            toast.error("Por favor, ingrese un número de 2 a 4 dígitos, una posición válida (1, 5, 10 o 20) y un importe.")
            return
        }

        const nuevaApuesta: ExactaApuesta = {
            numero: exactaNumero,
            posicion: exactaPosicion,
            importe: exactaImporte,
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        const montoTotal = Number.parseFloat(exactaImporte) * selectedLotteries.length
        setExactaApuestas([...exactaApuestas, nuevaApuesta])
        setTotal(total + montoTotal)
        toast.success("Exacta agregada correctamente")

        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
    }

    const eliminarExacta = (index: number) => {
        const apuestaEliminada = exactaApuestas[index]
        setExactaApuestas(exactaApuestas.filter((_, i) => i !== index))
        const montoEliminado = Number.parseFloat(apuestaEliminada.importe) * apuestaEliminada.provincias.length
        setTotal(total - montoEliminado)
        toast.success("Exacta eliminada")
    }

    const generarSecuencia = (): string => {
        return Date.now().toString()
    }

    // Reemplazar la función generarContenidoTicket con esta versión actualizada
    const generarContenidoTicket = (secuenciaParam?: string) => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            console.error("Pasador no encontrado")
            return ""
        }

        let ticketContent = ""
        const fechaHora = formatDate(new Date())
        const terminal = "72-0005"
        const secuenciaTicket = secuenciaParam || generarSecuencia()

        ticketContent += "TICKET\n"
        ticketContent += `FECHA/HORA ${fechaHora}\n`
        ticketContent += `TERMINAL   ${terminal}\n`
        ticketContent += `PASADOR    ${pasadorSeleccionado.nombre}\n`
        ticketContent += `SORTEO     ${selectedSorteo}\n`
        ticketContent += "-".repeat(32) + "\n"

        const loteriaAbreviada = lotteryAbbreviations[selectedSorteo] || selectedSorteo
        ticketContent += `${loteriaAbreviada}\n`
        ticketContent += `SECUENCIA  ${secuenciaTicket}\n`

        // Generar contenido para cada tipo de jugada
        if (triplonaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA TRIPLONA ****\n"
            const provinciasSet = new Set(triplonaApuestas[0].provincias.map((l) => provinceAbbreviations[l] || l))
            ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`

            triplonaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                ticketContent += `${numerosFormateados}   $50.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            ticketContent += `TOTAL: $${(triplonaApuestas.length * 50 * triplonaApuestas[0].provincias.length).toFixed(2)}\n\n`
        }

        if (borratinaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA BORRATINA ****\n"

            borratinaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                ticketContent += `${numerosFormateados}   $30.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            ticketContent += `TOTAL: $${(borratinaApuestas.length * 30).toFixed(2)}\n\n`
        }

        if (quintinaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA QUINTINA ****\n"
            const provinciasSet = new Set(quintinaApuestas[0].provincias.map((l) => provinceAbbreviations[l] || l))
            ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`

            quintinaApuestas.forEach((apuesta) => {
                const numerosFormateados = apuesta.numeros.join("-")
                // Cambiar de $50.00 a $100.00 en el ticket
                ticketContent += `${numerosFormateados}   $100.00\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            // Cambiar de 50 a 100 pesos por provincia en el cálculo del total
            ticketContent += `TOTAL: $${(quintinaApuestas.length * 100 * quintinaApuestas[0].provincias.length).toFixed(2)}\n\n`
        }

        if (exactaApuestas.length > 0) {
            ticketContent += "\n**** NUEVA EXACTA ****\n"
            const provinciasSet = new Set(exactaApuestas[0].provincias.map((l) => provinceAbbreviations[l] || l))
            ticketContent += `LOTERIAS: ${Array.from(provinciasSet).join(" ")}\n`
            ticketContent += "NUMERO UBIC   IMPORTE\n"

            exactaApuestas.forEach((apuesta) => {
                const numero = apuesta.numero.padStart(4, "0")
                const posicion = apuesta.posicion.padStart(2, " ")
                const importe = Number.parseFloat(apuesta.importe) || 0

                ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`
            })

            ticketContent += "-".repeat(32) + "\n"
            const totalExacta = exactaApuestas.reduce(
                (acc, apuesta) => acc + Number.parseFloat(apuesta.importe) * apuesta.provincias.length,
                0,
            )
            ticketContent += `TOTAL: $${totalExacta.toFixed(2)}\n\n`
        }

        // Total general
        ticketContent += "=".repeat(32) + "\n"
        ticketContent += `TOTAL GENERAL: $${total.toFixed(2)}`.padStart(32) + "\n"

        return ticketContent
    }

    // Modificar la función de impresión para adaptarla a impresoras térmicas
    const imprimirTicket = (ticketContent: string) => {
        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)
    }

    // Implementar la función para imprimir en impresora térmica
    const imprimirEnTermica = async () => {
        try {
            const printWindow = window.open("", "_blank")
            if (!printWindow) {
                toast.error("No se pudo abrir la ventana de impresión. Verifique que no esté bloqueada por el navegador.")
                return
            }

            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ticket de Jugada</title>
            <style>
              body {
                font-family: monospace;
                font-size: 12px;
                width: 80mm;
                margin: 0;
                padding: 0;
              }
              pre {
                white-space: pre-wrap;
                margin: 0;
                padding: 5px;
              }
              @media print {
                body {
                  width: 100%;
                }
                @page {
                  size: 80mm auto;
                  margin: 0mm;
                }
              }
            }
          </style>
          </head>
          <body>
            <pre>${ticketContent}</pre>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `)

            printWindow.document.close()
        } catch (error) {
            console.error("Error al imprimir:", error)
            toast.error("Error al imprimir el ticket")
        }
    }

    // Implementar la función para compartir el ticket
    const compartirTicket = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: "Ticket de Jugada",
                    text: ticketContent,
                })
            } else {
                // Fallback para navegadores que no soportan Web Share API
                await navigator.clipboard.writeText(ticketContent)
                toast.success("Ticket copiado al portapapeles")
            }
        } catch (error) {
            console.error("Error al compartir:", error)
            toast.error("Error al compartir el ticket")
        }
    }

    const resetearCampos = () => {
        setTriplonaApuestas([])
        setBorratinaApuestas([])
        setQuintinaApuestas([])
        setExactaApuestas([])
        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
        setSelectedLotteries([])
        setSelectedSorteo("")
        setSelectedPasador("")
        setTotal(0)
        toast.success("Formulario reiniciado")
    }

    const guardarJugadas = async () => {
        if (
            triplonaApuestas.length === 0 &&
            borratinaApuestas.length === 0 &&
            quintinaApuestas.length === 0 &&
            exactaApuestas.length === 0
        ) {
            toast.error("No hay jugadas para guardar.")
            return
        }

        try {
            setIsSaving(true)
            console.log("Iniciando proceso de guardar jugadas")
            const pasadorDoc = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorDoc) {
                throw new Error("Error: Pasador no encontrado.")
            }

            const jugadasCollection = collection(db, `JUGADAS DE ${pasadorDoc.nombre}`)

            // Generar una única secuencia para usar en todo el proceso
            const nuevaSecuencia = generarSecuencia()
            setSecuencia(nuevaSecuencia)

            const fechaHoraISO = new Date().toISOString()

            // Función para guardar jugadas agrupadas por tipo
            const guardarJugadasPorTipo = async (tipo: string, apuestas: any[]) => {
                if (apuestas.length === 0) return

                if (tipo === "NUEVA QUINTINA") {
                    const nuevaJugada: any = {
                        fechaHora: serverTimestamp(),
                        id: nuevaSecuencia,
                        loterias: [selectedSorteo],
                        numeros: apuestas.map((a) => a.numeros.join(",")),
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA QUINTINA",
                        // Cambiar de 50 a 100 pesos por provincia
                        totalMonto: apuestas.length * selectedLotteries.length * 100,
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugada NUEVA QUINTINA guardada con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA TRIPLONA") {
                    const nuevaJugada: any = {
                        fechaHora: serverTimestamp(),
                        id: nuevaSecuencia,
                        loterias: [selectedSorteo],
                        montoTotal: (apuestas.length * selectedLotteries.length * 50).toString(),
                        numeros: apuestas.map((a) => a.numeros.join(" - ")),
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA TRIPLONA",
                    }

                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugada NUEVA TRIPLONA guardada con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA BORRATINA") {
                    const nuevaJugada: any = {
                        fechaHora: fechaHoraISO,
                        loterias: [selectedSorteo],
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA BORRATINA",
                        totalMonto: apuestas.length * 30,
                        jugadas: apuestas.map((d: BorratinaApuesta) => ({
                            numeros: d.numeros,
                        })),
                    }
                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugadas NUEVA BORRATINA guardadas con ID: ${docRef.id}`)
                } else if (tipo === "NUEVA EXACTA") {
                    const nuevaJugada: any = {
                        fechaHora: fechaHoraISO,
                        loterias: [selectedSorteo],
                        pasadorId: selectedPasador,
                        provincias: selectedLotteries,
                        secuencia: nuevaSecuencia,
                        tipo: "NUEVA EXACTA",
                        totalMonto: apuestas.reduce(
                            (acc: number, d: ExactaApuesta) => acc + Number.parseFloat(d.importe) * selectedLotteries.length,
                            0,
                        ),
                        jugadas: apuestas.map((d: ExactaApuesta) => ({
                            numero: d.numero,
                            posicion: d.posicion,
                            importe: d.importe,
                        })),
                    }
                    const docRef = await addDoc(jugadasCollection, nuevaJugada)
                    console.log(`Jugadas NUEVA EXACTA guardadas con ID: ${docRef.id}`)
                }
            }

            // Guardar cada tipo de apuesta
            await guardarJugadasPorTipo("NUEVA TRIPLONA", triplonaApuestas)
            await guardarJugadasPorTipo("NUEVA BORRATINA", borratinaApuestas)
            await guardarJugadasPorTipo("NUEVA QUINTINA", quintinaApuestas)
            await guardarJugadasPorTipo("NUEVA EXACTA", exactaApuestas)

            // Generar el ticket con la misma secuencia que se usó para guardar en la base de datos
            const ticketContent = generarContenidoTicket(nuevaSecuencia)
            imprimirTicket(ticketContent)
            resetearCampos()
            toast.success("Jugadas guardadas exitosamente")
        } catch (error) {
            console.error("Error detallado al guardar las jugadas:", error)
            if (error instanceof Error) {
                toast.error(`Error al guardar las jugadas: ${error.message}`)
            } else {
                toast.error("Error desconocido al guardar las jugadas. Por favor, intente nuevamente.")
            }
        } finally {
            setIsSaving(false)
        }
    }

    const limpiarFormulario = () => {
        setJugadas(Array(4).fill({ numero: "", posicion: "", importe: "" }))
        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
        setSelectedLotteries([])
        setSelectedSorteo("")
        setSelectedPasador("")
        toast.success("Formulario limpiado")
    }

    // Obtener el color del sorteo seleccionado
    const getSorteoColor = () => {
        const sorteo = sorteos.find((s) => s.id === selectedSorteo)
        return sorteo?.color || "bg-gray-600"
    }

    return (
        <>
            <Navbar />
            <div className="container mx-auto p-4 bg-gray-50 min-h-screen">
                <div className="grid gap-6">
                    {/* Encabezado */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg shadow-lg p-6 text-white">
                        <h1 className="text-2xl font-bold mb-2">Sistema de Carga de Jugadas</h1>
                        <p className="opacity-90">Complete los datos y agregue las jugadas para generar el ticket</p>
                    </div>

                    {/* Selección de sorteo, pasador y loterías */}
                    <Card className="shadow-md border-t-4 border-t-blue-500">
                        <CardHeader className="bg-gray-50 pb-2">
                            <CardTitle className="text-lg font-medium flex items-center">
                                <span className="mr-2">Configuración de la Jugada</span>
                                {selectedSorteo && (
                                    <Badge className={`${getSorteoColor()} text-white ml-2`}>
                                        {sorteos.find((s) => s.id === selectedSorteo)?.label || selectedSorteo}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <Label htmlFor="sorteo" className="mb-2 block text-sm font-medium">
                                        SORTEO:
                                    </Label>
                                    <Select value={selectedSorteo} onValueChange={setSelectedSorteo}>
                                        <SelectTrigger id="sorteo" className="w-full">
                                            <SelectValue placeholder="Seleccionar sorteo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sorteos.map((sorteo) => (
                                                <SelectItem key={sorteo.id} value={sorteo.id} className="flex items-center">
                                                    <div className="flex items-center">
                                                        <div className={`w-3 h-3 rounded-full ${sorteo.color} mr-2`}></div>
                                                        {sorteo.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="pasador" className="mb-2 block text-sm font-medium">
                                        PASADOR:
                                    </Label>
                                    <Select value={selectedPasador} onValueChange={setSelectedPasador}>
                                        <SelectTrigger id="pasador" className="w-full">
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

                            <div className="mb-6">
                                <Label className="mb-2 block text-sm font-medium">LOTERÍAS:</Label>
                                <div
                                    className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${activeTab === "borratina" ? "opacity-50" : ""}`}
                                >
                                    {loterias.map((loteria) => (
                                        <div
                                            key={loteria.id}
                                            className={`flex items-center space-x-2 p-2 rounded-md border ${selectedLotteries.includes(loteria.id) ? loteria.color : "bg-white border-gray-200"
                                                } ${!loteria.habilitada || (loteria.id === "URUGUA" && !["MATUTINA", "NOCTURNA"].includes(selectedSorteo)) || activeTab === "borratina" ? "opacity-50" : ""}`}
                                        >
                                            <Checkbox
                                                id={loteria.id}
                                                checked={selectedLotteries.includes(loteria.id)}
                                                onCheckedChange={(checked) => {
                                                    if (activeTab !== "borratina") {
                                                        if (checked) {
                                                            setSelectedLotteries([...selectedLotteries, loteria.id])
                                                        } else {
                                                            setSelectedLotteries(selectedLotteries.filter((id) => id !== loteria.id))
                                                        }
                                                    }
                                                }}
                                                disabled={
                                                    activeTab === "borratina" ||
                                                    (loteria.id === "URUGUA" && !["MATUTINA", "NOCTURNA"].includes(selectedSorteo))
                                                }
                                                className={selectedLotteries.includes(loteria.id) ? "border-blue-500 text-blue-500" : ""}
                                            />
                                            <Label htmlFor={loteria.id} className="text-sm cursor-pointer">
                                                {loteria.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs para diferentes tipos de jugadas */}
                    <Card className="shadow-md">
                        <CardContent className="p-0">
                            <Tabs
                                defaultValue="triplona"
                                className="w-full"
                                onValueChange={(value) => setActiveTab(value as "triplona" | "borratina" | "quintina" | "exacta")}
                            >
                                <TabsList className="w-full grid grid-cols-4 rounded-none">
                                    <TabsTrigger
                                        value="triplona"
                                        className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800"
                                    >
                                        Nueva Triplona
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="borratina"
                                        className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800"
                                    >
                                        Nueva Borratina
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="quintina"
                                        className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
                                    >
                                        Nueva Quintina
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="exacta"
                                        className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800"
                                    >
                                        Nueva Exacta
                                    </TabsTrigger>
                                </TabsList>

                                <div className="p-4">
                                    <TabsContent value="triplona" className="mt-0">
                                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
                                            <h3 className="text-lg font-semibold text-purple-800 mb-3">Nueva Triplona</h3>
                                            <div className="flex space-x-2 mb-4">
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero1Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 1"
                                                        onChange={(e) => handleTriplonaInput(e, numero2Ref)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">1</span>
                                                </div>
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero2Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 2"
                                                        onChange={(e) => handleTriplonaInput(e, numero3Ref)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">2</span>
                                                </div>
                                                <div className="relative w-1/3">
                                                    <Input
                                                        ref={numero3Ref}
                                                        className="pl-8 bg-white border-purple-300 focus:border-purple-500"
                                                        maxLength={2}
                                                        placeholder="Nº 3"
                                                        onChange={(e) => handleTriplonaInput(e, null)}
                                                    />
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-500 font-bold">3</span>
                                                </div>
                                            </div>
                                            <Button onClick={agregarTriplona} className="w-full bg-purple-600 hover:bg-purple-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Triplona
                                            </Button>
                                        </div>

                                        {triplonaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Triplonas Agregadas</span>
                                                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                                                        {triplonaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {triplonaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-purple-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarTriplona(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="borratina" className="mt-0">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                                            <h3 className="text-lg font-semibold text-blue-800 mb-3">Nueva Borratina</h3>
                                            <div className="grid grid-cols-4 gap-2 mb-4">
                                                {Array(8)
                                                    .fill(null)
                                                    .map((_, index) => (
                                                        <div key={index} className="relative">
                                                            <Input
                                                                ref={(el: HTMLInputElement | null) => {
                                                                    if (el) borratinaRefs.current[index] = el
                                                                }}
                                                                className="pl-8 bg-white border-blue-300 focus:border-blue-500"
                                                                maxLength={2}
                                                                placeholder={`Nº ${index + 1}`}
                                                                onChange={(e) => handleBorratinaInput(e, index)}
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500 font-bold">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                            <Button onClick={agregarBorratina} className="w-full bg-blue-600 hover:bg-blue-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Borratina
                                            </Button>
                                        </div>

                                        {borratinaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Borratinas Agregadas</span>
                                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                                        {borratinaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {borratinaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-blue-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarBorratina(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="quintina" className="mt-0">
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                                            <h3 className="text-lg font-semibold text-green-800 mb-3">Nueva Quintina</h3>
                                            <div className="grid grid-cols-5 gap-2 mb-4">
                                                {Array(5)
                                                    .fill(null)
                                                    .map((_, index) => (
                                                        <div key={index} className="relative">
                                                            <Input
                                                                ref={(el: HTMLInputElement | null) => {
                                                                    if (el) quintinaRefs.current[index] = el
                                                                }}
                                                                className="pl-8 bg-white border-green-300 focus:border-green-500"
                                                                maxLength={2}
                                                                placeholder={`Nº ${index + 1}`}
                                                                onChange={(e) => handleQuintinaInput(e, index)}
                                                            />
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-500 font-bold">
                                                                {index + 1}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                            <Button onClick={agregarQuintina} className="w-full bg-green-600 hover:bg-green-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Quintina
                                            </Button>
                                        </div>

                                        {quintinaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Quintinas Agregadas</span>
                                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                                        {quintinaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {quintinaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-green-700">{apuesta.numeros.join(" - ")}</span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarQuintina(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="exacta" className="mt-0">
                                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                                            <h3 className="text-lg font-semibold text-amber-800 mb-3">Nueva Exacta</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div>
                                                    <Label htmlFor="exacta-numero" className="text-amber-800">
                                                        Número
                                                    </Label>
                                                    <Input
                                                        id="exacta-numero"
                                                        value={exactaNumero}
                                                        onChange={(e) => setExactaNumero(e.target.value.replace(/\D/g, ""))}
                                                        maxLength={4}
                                                        className="bg-white border-amber-300 focus:border-amber-500"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="exacta-posicion" className="text-amber-800">
                                                        Posición
                                                    </Label>
                                                    <Select value={exactaPosicion} onValueChange={setExactaPosicion}>
                                                        <SelectTrigger
                                                            id="exacta-posicion"
                                                            className="bg-white border-amber-300 focus:border-amber-500"
                                                        >
                                                            <SelectValue placeholder="Seleccionar posición" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {["1", "5", "10", "20"].map((pos) => (
                                                                <SelectItem key={pos} value={pos}>
                                                                    {pos}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label htmlFor="exacta-importe" className="text-amber-800">
                                                        Importe
                                                    </Label>
                                                    <Input
                                                        id="exacta-importe"
                                                        value={exactaImporte}
                                                        onChange={(e) => setExactaImporte(e.target.value.replace(/\D/g, ""))}
                                                        type="text"
                                                        inputMode="numeric"
                                                        pattern="[0-9]*"
                                                        className="bg-white border-amber-300 focus:border-amber-500"
                                                    />
                                                </div>
                                            </div>
                                            <Button onClick={agregarExacta} className="w-full bg-amber-600 hover:bg-amber-700">
                                                <Plus className="h-4 w-4 mr-2" /> Agregar Exacta
                                            </Button>
                                        </div>

                                        {exactaApuestas.length > 0 && (
                                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <h3 className="font-bold mb-3 text-gray-700 flex items-center">
                                                    <span className="mr-2">Exactas Agregadas</span>
                                                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                                        {exactaApuestas.length}
                                                    </Badge>
                                                </h3>
                                                <ScrollArea className="h-[200px] rounded-md border p-2">
                                                    <div className="space-y-2">
                                                        {exactaApuestas.map((apuesta, index) => (
                                                            <div
                                                                key={index}
                                                                className="flex justify-between items-center p-2 bg-gray-50 rounded-md border border-gray-200"
                                                            >
                                                                <div>
                                                                    <span className="font-medium text-amber-700">
                                                                        Número: {apuesta.numero} - Pos: {apuesta.posicion} - ${apuesta.importe}
                                                                    </span>
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                                            {apuesta.loteria}
                                                                        </span>
                                                                        <span className="ml-2">{apuesta.provincias.length} provincias</span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => eliminarExacta(index)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Resumen y acciones */}
                    <Card className="shadow-md border-t-4 border-t-green-500">
                        <CardHeader className="bg-gray-50 pb-2">
                            <CardTitle className="text-lg font-medium">Resumen de Jugadas</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="bg-purple-100 p-3 rounded-lg border border-purple-200">
                                    <h4 className="text-sm font-medium text-purple-800">Triplonas</h4>
                                    <p className="text-2xl font-bold text-purple-700">{triplonaApuestas.length}</p>
                                </div>
                                <div className="bg-blue-100 p-3 rounded-lg border border-blue-200">
                                    <h4 className="text-sm font-medium text-blue-800">Borratinas</h4>
                                    <p className="text-2xl font-bold text-blue-700">{borratinaApuestas.length}</p>
                                </div>
                                <div className="bg-green-100 p-3 rounded-lg border border-green-200">
                                    <h4 className="text-sm font-medium text-green-800">Quintinas</h4>
                                    <p className="text-2xl font-bold text-green-700">{quintinaApuestas.length}</p>
                                </div>
                                <div className="bg-amber-100 p-3 rounded-lg border border-amber-200">
                                    <h4 className="text-sm font-medium text-amber-800">Exactas</h4>
                                    <p className="text-2xl font-bold text-amber-700">{exactaApuestas.length}</p>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 rounded-lg text-white w-full md:w-auto">
                                    <h3 className="text-sm font-medium opacity-90">TOTAL A PAGAR:</h3>
                                    <p className="text-3xl font-bold">${total.toFixed(2)}</p>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Button
                                        variant="outline"
                                        onClick={resetearCampos}
                                        className="border-red-500 text-red-600 hover:bg-red-50"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" /> Reiniciar
                                    </Button>
                                    <Button
                                        onClick={guardarJugadas}
                                        disabled={
                                            isSaving ||
                                            (triplonaApuestas.length === 0 &&
                                                borratinaApuestas.length === 0 &&
                                                quintinaApuestas.length === 0 &&
                                                exactaApuestas.length === 0)
                                        }
                                        className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-none"
                                    >
                                        {isSaving ? (
                                            <>
                                                <svg
                                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                </svg>
                                                Guardando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" /> Guardar Jugadas
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Diálogo de ticket */}
                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center">
                                <span className="mr-2">Ticket Generado</span>
                                <Badge className="bg-green-500">Secuencia: {secuencia}</Badge>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="bg-gray-100 p-4 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
                            {ticketContent}
                        </div>
                        <DialogFooter className="flex justify-between">
                            <div className="flex gap-2">
                                <Button variant="outline" className="border-blue-500 text-blue-600" onClick={compartirTicket}>
                                    <Share2 className="h-4 w-4 mr-2" /> Compartir
                                </Button>
                                <Button variant="outline" className="border-green-500 text-green-600" onClick={imprimirEnTermica}>
                                    <Printer className="h-4 w-4 mr-2" /> Imprimir
                                </Button>
                            </div>
                            <Button onClick={() => setIsTicketDialogOpen(false)}>Cerrar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    )
}
