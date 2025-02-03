"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Navbar from "@/app/components/Navbar"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore"
import { format } from "date-fns"

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
}

const lotteryAbbreviations: { [key: string]: string } = {
    PREVIA: "PRE",
    PRIMERA: "PRIM",
    MATUTINA: "MAT",
    VESPERTINA: "VES",
    NOCTURNA: "NOC",
}

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
}

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

    const numero1Ref = useRef<HTMLInputElement>(null)
    const numero2Ref = useRef<HTMLInputElement>(null)
    const numero3Ref = useRef<HTMLInputElement>(null)
    const borratinaRefs = useRef<(HTMLInputElement | null)[]>(Array(8).fill(null))
    const quintinaRefs = useRef<(HTMLInputElement | null)[]>(Array(5).fill(null))

    const sorteos: string[] = ["PREVIA", "PRIMERA", "MATUTINA", "VESPERTINA", "NOCTURNA"]

    const loterias: Loteria[] = [
        { id: "NACION", label: "Nacional" },
        { id: "PROVIN", label: "Provincia" },
        { id: "SANTA", label: "Santa Fe" },
        { id: "CORDOB", label: "Córdoba" },
        { id: "URUGUA", label: "Uruguay" },
        { id: "ENTRE", label: "Entre Ríos" },
        { id: "MENDOZ", label: "Mendoza" },
        { id: "CORRIE", label: "Corrientes" },
        { id: "CHACO", label: "Chaco" },
    ]

    useEffect(() => {
        fetchPasadores()
        if (!["MATUTINA", "NOCTURNA"].includes(selectedSorteo)) {
            setSelectedLotteries((prevLotteries) => prevLotteries.filter((lottery) => lottery !== "URUGUA"))
        }
    }, [selectedSorteo])

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
            console.error("Error al obtener pasadores:", error)
            alert("Error: No se pudieron cargar los pasadores. Por favor, intente nuevamente.")
        }
    }

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

    const handleBorratinaInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const value = e.target.value.replace(/\D/g, "")
        e.target.value = value
        if (value.length === 2) {
            const isRepeated = borratinaRefs.current.some((ref, i) => i !== index && ref?.value === value)
            if (isRepeated) {
                e.target.value = ""
                alert("Este número ya ha sido ingresado. Por favor, elija otro.")
                return
            }
            if (index < 7 && borratinaRefs.current[index + 1]) {
                borratinaRefs.current[index + 1]?.focus()
            } else if (index === 7) {
                agregarBorratina()
            }
        }
    }

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
            alert("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numero1 = numero1Ref.current?.value || ""
        const numero2 = numero2Ref.current?.value || ""
        const numero3 = numero3Ref.current?.value || ""

        if (numero1.length !== 2 || numero2.length !== 2 || numero3.length !== 2) {
            alert("Por favor, ingrese tres números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: TriplonaApuesta = {
            numeros: [numero1, numero2, numero3],
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setTriplonaApuestas([...triplonaApuestas, nuevaApuesta])
        setTotal(total + selectedLotteries.length * 50)

        if (numero1Ref.current) numero1Ref.current.value = ""
        if (numero2Ref.current) numero2Ref.current.value = ""
        if (numero3Ref.current) numero3Ref.current.value = ""
        if (numero1Ref.current) numero1Ref.current.focus()
    }

    const agregarBorratina = () => {
        if (!selectedPasador || !selectedSorteo) {
            alert("Por favor, seleccione pasador y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = borratinaRefs.current.map((ref) => ref?.value || "")
        if (numeros.some((num) => num.length !== 2)) {
            alert("Por favor, ingrese ocho números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: BorratinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
        }

        setBorratinaApuestas([...borratinaApuestas, nuevaApuesta])
        setTotal(total + 30)

        borratinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (borratinaRefs.current[0]) borratinaRefs.current[0].focus()
    }

    const agregarQuintina = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            alert("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        const numeros = quintinaRefs.current.map((ref) => ref?.value || "")
        if (numeros.some((num) => num.length !== 2)) {
            alert("Por favor, ingrese cinco números de dos dígitos cada uno.")
            return
        }

        const nuevaApuesta: QuintinaApuesta = {
            numeros: numeros,
            loteria: selectedSorteo,
            provincias: selectedLotteries,
        }

        setQuintinaApuestas([...quintinaApuestas, nuevaApuesta])
        setTotal(total + selectedLotteries.length * 50)

        quintinaRefs.current.forEach((ref) => {
            if (ref) ref.value = ""
        })
        if (quintinaRefs.current[0]) quintinaRefs.current[0].focus()
    }

    const eliminarTriplona = (index: number) => {
        const apuestaEliminada = triplonaApuestas[index]
        setTriplonaApuestas(triplonaApuestas.filter((_, i) => i !== index))
        setTotal(total - apuestaEliminada.provincias.length * 50)
    }

    const eliminarBorratina = (index: number) => {
        setBorratinaApuestas(borratinaApuestas.filter((_, i) => i !== index))
        setTotal(total - 30)
    }

    const eliminarQuintina = (index: number) => {
        const apuestaEliminada = quintinaApuestas[index]
        setQuintinaApuestas(quintinaApuestas.filter((_, i) => i !== index))
        setTotal(total - apuestaEliminada.provincias.length * 50)
    }

    const agregarExacta = () => {
        if (!selectedPasador || selectedLotteries.length === 0 || !selectedSorteo) {
            alert("Por favor, seleccione pasador, loterías y sorteo antes de agregar una apuesta.")
            return
        }

        if (
            exactaNumero.length < 2 ||
            exactaNumero.length > 4 ||
            !["1", "5", "10", "15", "20"].includes(exactaPosicion) ||
            !exactaImporte
        ) {
            alert("Por favor, ingrese un número de 2 a 4 dígitos, una posición válida (1, 5, 10, 15 o 20) y un importe.")
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

        setExactaNumero("")
        setExactaPosicion("")
        setExactaImporte("")
    }

    const eliminarExacta = (index: number) => {
        const apuestaEliminada = exactaApuestas[index]
        setExactaApuestas(exactaApuestas.filter((_, i) => i !== index))
        const montoEliminado = Number.parseFloat(apuestaEliminada.importe) * apuestaEliminada.provincias.length
        setTotal(total - montoEliminado)
    }

    const generarSecuencia = (): string => {
        return Date.now().toString()
    }

    const generarContenidoTicket = () => {
        const pasadorSeleccionado = pasadores.find((p) => p.id === selectedPasador)
        if (!pasadorSeleccionado) {
            console.error("Pasador no encontrado")
            return ""
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

        let totalGeneral = 0
        jugadas.forEach((jugada) => {
            const numero = jugada.numero.padStart(4, "0")
            const posicion = jugada.posicion.padStart(2, " ")
            const importe = Number.parseFloat(jugada.importe) || 0
            const importeTotal = importe * selectedLotteries.length

            totalGeneral += importeTotal

            ticketContent += `${numero}  ${posicion}   $${importe.toFixed(2)}\n`
        })

        ticketContent += "-".repeat(32) + "\n"
        ticketContent += `TOTAL: $${totalGeneral.toFixed(2)}`.padStart(32) + "\n"

        return ticketContent
    }

    const imprimirTicket = (ticketContent: string) => {
        setTicketContent(ticketContent)
        setIsTicketDialogOpen(true)
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
    }

    const guardarJugadas = async () => {
        if (
            triplonaApuestas.length === 0 &&
            borratinaApuestas.length === 0 &&
            quintinaApuestas.length === 0 &&
            exactaApuestas.length === 0
        ) {
            alert("No hay jugadas para guardar.")
            return
        }

        try {
            console.log("Iniciando proceso de guardar jugadas")
            const pasadorDoc = pasadores.find((p) => p.id === selectedPasador)
            if (!pasadorDoc) {
                throw new Error("Error: Pasador no encontrado.")
            }

            const jugadasCollection = collection(db, `JUGADAS DE ${pasadorDoc.nombre}`)
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
                        totalMonto: apuestas.length * selectedLotteries.length * 50,
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

            const ticketContent = generarContenidoTicket()
            imprimirTicket(ticketContent)
            resetearCampos()
            alert("Jugadas guardadas exitosamente")
        } catch (error) {
            console.error("Error detallado al guardar las jugadas:", error)
            if (error instanceof Error) {
                alert(`Error al guardar las jugadas: ${error.message}`)
            } else {
                alert("Error desconocido al guardar las jugadas. Por favor, intente nuevamente.")
            }
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
    }

    return (
        <>
            <Navbar />
            <div className="container mx-auto p-2">
                <Card>
                    <CardHeader className="bg-primary text-primary-foreground">
                        <CardTitle className="text-xl font-bold text-center">CARGAR JUGADAS</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
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
                                            <SelectItem key={sorteo} value={sorteo}>
                                                {sorteo}
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

                        <div>
                            <Label className="mb-2 block text-sm font-medium">LOTERÍAS:</Label>
                            <div className={`grid grid-cols-3 gap-2 ${activeTab === "borratina" ? "opacity-50" : ""}`}>
                                {loterias.map((loteria) => (
                                    <div key={loteria.id} className="flex items-center space-x-2">
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
                                        />
                                        <Label htmlFor={loteria.id} className="text-sm">
                                            {loteria.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Tabs
                            defaultValue="triplona"
                            className="w-full mt-4"
                            onValueChange={(value) => setActiveTab(value as "triplona" | "borratina" | "quintina" | "exacta")}
                        >
                            <TabsList className="grid w-full grid-cols-4 mb-4">
                                <TabsTrigger value="triplona">Nueva Triplona</TabsTrigger>
                                <TabsTrigger value="borratina">Nueva Borratina</TabsTrigger>
                                <TabsTrigger value="quintina">Nueva Quintina</TabsTrigger>
                                <TabsTrigger value="exacta">Nueva Exacta</TabsTrigger>
                            </TabsList>

                            <TabsContent value="triplona">
                                <Card className="mb-2">
                                    <CardHeader className="py-1">
                                        <CardTitle className="text-base">Nueva Triplona</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-1">
                                        <div className="flex space-x-2 mb-4">
                                            <Input
                                                ref={numero1Ref}
                                                className="w-1/3"
                                                maxLength={2}
                                                placeholder="Nº 1"
                                                onChange={(e) => handleTriplonaInput(e, numero2Ref)}
                                            />
                                            <Input
                                                ref={numero2Ref}
                                                className="w-1/3"
                                                maxLength={2}
                                                placeholder="Nº 2"
                                                onChange={(e) => handleTriplonaInput(e, numero3Ref)}
                                            />
                                            <Input
                                                ref={numero3Ref}
                                                className="w-1/3"
                                                maxLength={2}
                                                placeholder="Nº 3"
                                                onChange={(e) => handleTriplonaInput(e, null)}
                                            />
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="font-bold mb-2">Apuestas Actuales:</h3>
                                            {triplonaApuestas.map((apuesta, index) => (
                                                <div key={index} className="flex justify-between items-center mb-2">
                                                    <span>
                                                        {apuesta.numeros.join(" - ")} ({apuesta.loteria}) - {apuesta.provincias.join(", ")}
                                                    </span>
                                                    <Button variant="destructive" size="sm" onClick={() => eliminarTriplona(index)}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="borratina">
                                <Card className="mb-2">
                                    <CardHeader className="py-1">
                                        <CardTitle className="text-base">Nueva Borratina</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-1">
                                        <div className="grid grid-cols-4 gap-2 mb-4">
                                            {Array(8)
                                                .fill(null)
                                                .map((_, index) => (
                                                    <Input
                                                        key={index}
                                                        ref={(el: HTMLInputElement | null) => {
                                                            if (el) borratinaRefs.current[index] = el
                                                        }}
                                                        className="w-full"
                                                        maxLength={2}
                                                        placeholder={`Nº ${index + 1}`}
                                                        onChange={(e) => handleBorratinaInput(e, index)}
                                                    />
                                                ))}
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="font-bold mb-2">Apuestas Actuales:</h3>
                                            {borratinaApuestas.map((apuesta, index) => (
                                                <div key={index} className="flex justify-between items-center mb-2">
                                                    <span>
                                                        {apuesta.numeros.join(" - ")} ({apuesta.loteria})
                                                    </span>
                                                    <Button variant="destructive" size="sm" onClick={() => eliminarBorratina(index)}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="quintina">
                                <Card className="mb-2">
                                    <CardHeader className="py-1">
                                        <CardTitle className="text-base">Nueva Quintina</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-1">
                                        <div className="grid grid-cols-5 gap-2 mb-4">
                                            {Array(5)
                                                .fill(null)
                                                .map((_, index) => (
                                                    <Input
                                                        key={index}
                                                        ref={(el: HTMLInputElement | null) => {
                                                            if (el) quintinaRefs.current[index] = el
                                                        }}
                                                        className="w-full"
                                                        maxLength={2}
                                                        placeholder={`Nº ${index + 1}`}
                                                        onChange={(e) => handleQuintinaInput(e, index)}
                                                    />
                                                ))}
                                        </div>
                                        <div className="mt-4">
                                            <h3 className="font-bold mb-2">Apuestas Actuales:</h3>
                                            {quintinaApuestas.map((apuesta, index) => (
                                                <div key={index} className="flex justify-between items-center mb-2">
                                                    <span>
                                                        {apuesta.numeros.join(" - ")} ({apuesta.loteria}) - {apuesta.provincias.join(", ")}
                                                    </span>
                                                    <Button variant="destructive" size="sm" onClick={() => eliminarQuintina(index)}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="exacta">
                                <Card className="mb-2">
                                    <CardHeader className="py-1">
                                        <CardTitle className="text-base">Nueva Exacta</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-1">
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            <div>
                                                <Label htmlFor="exacta-numero">Número</Label>
                                                <Input
                                                    id="exacta-numero"
                                                    value={exactaNumero}
                                                    onChange={(e) => setExactaNumero(e.target.value.replace(/\D/g, ""))}
                                                    maxLength={4}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="exacta-posicion">Posición</Label>
                                                <Select value={exactaPosicion} onValueChange={setExactaPosicion}>
                                                    <SelectTrigger id="exacta-posicion">
                                                        <SelectValue placeholder="Seleccionar posición" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {["1", "5", "10", "15", "20"].map((pos) => (
                                                            <SelectItem key={pos} value={pos}>
                                                                {pos}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="exacta-importe">Importe</Label>
                                                <Input
                                                    id="exacta-importe"
                                                    value={exactaImporte}
                                                    onChange={(e) => setExactaImporte(e.target.value.replace(/\D/g, ""))}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={agregarExacta} className="w-full mb-4">
                                            Agregar Apuesta
                                        </Button>
                                        <div className="mt-4">
                                            <h3 className="font-bold mb-2">Apuestas Actuales:</h3>
                                            {exactaApuestas.map((apuesta, index) => (
                                                <div key={index} className="flex justify-between items-center mb-2">
                                                    <span>
                                                        {apuesta.numero} - {apuesta.posicion} - ${apuesta.importe} por provincia - {apuesta.loteria}{" "}
                                                        - {apuesta.provincias.join(", ")}
                                                    </span>
                                                    <Button variant="destructive" size="sm" onClick={() => eliminarExacta(index)}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-4 flex justify-between items-center">
                            <Label className="text-lg font-bold">TOTAL: ${total.toFixed(2)}</Label>
                            <Button onClick={guardarJugadas}>Guardar Jugadas</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}

