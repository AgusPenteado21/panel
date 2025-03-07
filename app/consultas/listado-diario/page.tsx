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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/firebase"
import { collection, getDocs, getDoc, doc, query, where, onSnapshot } from "firebase/firestore"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    saldoFinal: number
    saldoAnterior: number
    saldoTotal: number
    cobrado: number
    pagado: number
    jugado: number
    aciertos: number[]
    aciertosBorratinas: number[]
    acreditacionComision: number
    anulacionVentaOnline: number
    borratinaOnline: number
    cobroAlCliente: number
    comisionPasador: number
    pagoACliente: number
    pagoAciertosBorras: number
    pagoPremioBorratina: number
    pagoPremioBorratinas: number
    pagoQuiniela: number
    quintinaOnline: number
    triplonaOnline: number
    ventasOnline: number
    fecha: string
    timestamp: string
    premioTotal: number
    comisionPorcentaje: number
}

const ITEMS_POR_PAGINA = 15
const PASADORES_POR_MODULO = 20

const BotonSelectorFecha = ({
    fecha,
    onChange,
    etiqueta,
}: { fecha: Date; onChange: (fecha: Date) => void; etiqueta: string }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn("w-[120px] h-8 justify-start text-left font-normal text-xs", !fecha && "text-muted-foreground")}
            >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {fecha ? format(fecha, "dd/MM/yyyy", { locale: es }) : etiqueta}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
            <Calendar
                mode="single"
                selected={fecha}
                onSelect={(fecha) => fecha && onChange(fecha)}
                initialFocus
                locale={es}
            />
        </PopoverContent>
    </Popover>
)

const SelectorFecha = ({
    fechaSeleccionada,
    onCambioFecha,
    onBuscar,
    estaCargando,
}: {
    fechaSeleccionada: Date
    onCambioFecha: (fecha: Date) => void
    onBuscar: () => void
    estaCargando: boolean
}) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
            <span className="font-medium">Fecha:</span>
            <BotonSelectorFecha fecha={fechaSeleccionada} onChange={onCambioFecha} etiqueta="Seleccionar" />
        </div>
        <Button
            onClick={onBuscar}
            className="bg-black text-white hover:bg-gray-800 h-8 px-3 text-xs"
            disabled={estaCargando}
        >
            {estaCargando ? (
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

const fetchAciertosData = async (fecha: Date) => {
    const aciertosRef = collection(db, "aciertos")
    const fechaString = format(fecha, "yyyy-MM-dd")

    const querySnapshot = await getDocs(aciertosRef)
    const aciertosData: { [key: string]: number } = {}

    querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data[fechaString] && data[fechaString].totalGanado) {
            aciertosData[doc.id] = data[fechaString].totalGanado
        }
    })

    return aciertosData
}

const obtenerMontoJugadoPagosCobros = (
    pasadorId: string,
    pasadorNombre: string,
    fecha: Date,
    comisionPorcentaje: number,
    saldoAnterior: number,
    premioTotal: number,
    actualizarMontoJugadoPagosCobros: (pasadorId: string, monto: number, pagos: number, cobros: number) => void,
    actualizarComisionYSaldoFinal: (pasadorId: string, comision: number, saldoFinal: number, saldoTotal: number) => void,
) => {
    const jugadasRef = collection(db, `JUGADAS DE ${pasadorNombre}`)
    const pagosRef = collection(db, "pagos")
    const cobrosRef = collection(db, "cobros")
    const fechaString = format(fecha, "yyyy-MM-dd")

    const jugadasQuery = query(
        jugadasRef,
        where("fechaHora", ">=", startOfDay(fecha)),
        where("fechaHora", "<=", endOfDay(fecha)),
    )
    const pagosQuery = query(pagosRef, where("pasadorId", "==", pasadorId), where("fecha", "==", fechaString))
    const cobrosQuery = query(cobrosRef, where("pasadorId", "==", pasadorId), where("fecha", "==", fechaString))

    const unsubscribeJugadas = onSnapshot(jugadasQuery, (jugadasSnapshot) => {
        let ventasOnlineAcumuladas = 0
        let anulacionVentaOnline = 0

        jugadasSnapshot.forEach((doc) => {
            const jugada = doc.data()
            if (jugada.anulada !== true) {
                ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
            } else {
                anulacionVentaOnline += Number(jugada.totalMonto) || 0
            }
        })

        Promise.all([getDocs(pagosQuery), getDocs(cobrosQuery)]).then(([pagosSnapshot, cobrosSnapshot]) => {
            let totalPagos = 0
            let totalCobros = 0

            pagosSnapshot.forEach((doc) => {
                totalPagos += doc.data().monto || 0
            })

            cobrosSnapshot.forEach((doc) => {
                totalCobros += doc.data().monto || 0
            })

            console.log(`Monto jugado para ${pasadorNombre}: ${ventasOnlineAcumuladas}`)
            console.log(`Pagos para ${pasadorNombre}: ${totalPagos}`)
            console.log(`Cobros para ${pasadorNombre}: ${totalCobros}`)
            console.log(`Premio total para ${pasadorNombre}: ${premioTotal}`)

            const comisionCalculada = (comisionPorcentaje / 100) * ventasOnlineAcumuladas
            const comisionRedondeada = Math.round(comisionCalculada * 100) / 100

            // Corrección: Incluir pagos y cobros en el cálculo del saldo final
            const saldoFinal = ventasOnlineAcumuladas - comisionRedondeada - premioTotal + totalPagos - totalCobros
            const saldoTotal = saldoFinal

            console.log(`Cálculo de saldo final para ${pasadorNombre}:`)
            console.log(`Ventas online: ${ventasOnlineAcumuladas}`)
            console.log(`Comisión (${comisionPorcentaje}%): ${comisionRedondeada}`)
            console.log(`Premio total: ${premioTotal}`)
            console.log(`Total pagos: ${totalPagos}`)
            console.log(`Total cobros: ${totalCobros}`)
            console.log(
                `Saldo final: ${ventasOnlineAcumuladas} - ${comisionRedondeada} - ${premioTotal} + ${totalPagos} - ${totalCobros} = ${saldoFinal}`,
            )

            actualizarMontoJugadoPagosCobros(pasadorId, ventasOnlineAcumuladas, totalPagos, totalCobros)
            actualizarComisionYSaldoFinal(pasadorId, comisionRedondeada, saldoFinal, saldoTotal)
        })
    })

    return () => {
        unsubscribeJugadas()
    }
}

export default function ListadoDiario() {
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [modulos, setModulos] = useState<string[]>([])
    const [moduloSeleccionado, setModuloSeleccionado] = useState<string>("73")
    const [paginaActual, setPaginaActual] = useState(1)
    const [estaCargando, setEstaCargando] = useState(true)
    const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(startOfDay(new Date()))
    const [error, setError] = useState<string | null>(null)

    const actualizarMontoJugadoPagosCobros = (pasadorId: string, monto: number, pagos: number, cobros: number) => {
        setPasadores((prevPasadores: Pasador[]) => {
            return prevPasadores.map((p: Pasador) => {
                if (p.id === pasadorId) {
                    return { ...p, jugado: monto, pagado: pagos, cobrado: cobros }
                }
                return p
            })
        })
    }

    const actualizarComisionYSaldoFinal = (
        pasadorId: string,
        comision: number,
        saldoFinal: number,
        saldoTotal: number,
    ) => {
        setPasadores((prevPasadores: Pasador[]) => {
            return prevPasadores.map((p: Pasador) => {
                if (p.id === pasadorId) {
                    return { ...p, comisionPasador: comision, saldoFinal: saldoFinal, saldoTotal: saldoTotal }
                }
                return p
            })
        })
    }

    useEffect(() => {
        manejarBusqueda()
    }, [])

    useEffect(() => {
        console.log("Estado actual de pasadores:", pasadores)
    }, [pasadores])

    const manejarBusqueda = async () => {
        setEstaCargando(true)
        setError(null)

        try {
            console.log("Iniciando búsqueda de datos...")
            console.log("Fecha seleccionada:", format(fechaSeleccionada, "yyyy-MM-dd"))

            // Obtener pasadores
            const pasadoresRef = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresRef)

            const listaPasadores: Pasador[] = []
            pasadoresSnapshot.forEach((doc) => {
                const data = doc.data()
                const index = listaPasadores.length
                const numeroModulo = Math.floor(index / PASADORES_POR_MODULO) + 73
                const indiceModulo = index % PASADORES_POR_MODULO

                listaPasadores.push({
                    id: doc.id,
                    displayId: `${numeroModulo}-${(indiceModulo + 1).toString().padStart(4, "0")}`,
                    nombre: data.nombre || "Sin nombre",
                    saldoFinal: 0,
                    saldoAnterior: 0,
                    saldoTotal: 0,
                    cobrado: 0,
                    pagado: 0,
                    jugado: 0,
                    aciertos: [],
                    aciertosBorratinas: [],
                    acreditacionComision: 0,
                    anulacionVentaOnline: 0,
                    borratinaOnline: 0,
                    cobroAlCliente: 0,
                    comisionPasador: 0,
                    pagoACliente: 0,
                    pagoAciertosBorras: 0,
                    pagoPremioBorratina: 0,
                    pagoPremioBorratinas: 0,
                    pagoQuiniela: 0,
                    quintinaOnline: 0,
                    triplonaOnline: 0,
                    ventasOnline: 0,
                    fecha: "",
                    timestamp: "",
                    premioTotal: 0,
                    comisionPorcentaje: 0,
                })
            })

            console.log("Pasadores procesados:", listaPasadores.length)

            // Fetch aciertos data
            const aciertosData = await fetchAciertosData(fechaSeleccionada)
            console.log("Aciertos data:", aciertosData)

            // Update listaPasadores with aciertos data
            const updatedListaPasadores = listaPasadores.map((pasador) => ({
                ...pasador,
                premioTotal: aciertosData[pasador.nombre] || 0, // Cambiado de pasador.id a pasador.nombre
            }))

            // Obtener la comisión de cada pasador
            const pasadoresComisionRef = collection(db, "pasadores")
            const pasadoresComisionSnapshot = await getDocs(pasadoresComisionRef)
            const comisionesPasadores: { [key: string]: number } = {}

            pasadoresComisionSnapshot.forEach((doc) => {
                const data = doc.data()
                comisionesPasadores[doc.id] = data.comision || 0
            })

            // Actualizar listaPasadores con la comisión
            const updatedListaPasadoresComision = updatedListaPasadores.map((pasador) => ({
                ...pasador,
                comisionPorcentaje: comisionesPasadores[pasador.id] || 0,
            }))

            // Obtener saldo anterior (saldo final del día anterior)
            const fechaAnterior = new Date(fechaSeleccionada)
            fechaAnterior.setDate(fechaAnterior.getDate() - 1)
            const saldoAnteriorPromesas = updatedListaPasadoresComision.map((pasador) => {
                const saldoDiarioAnteriorRef = doc(db, "saldos_diarios", `${pasador.id}_${format(fechaAnterior, "yyyy-MM-dd")}`)
                return getDoc(saldoDiarioAnteriorRef)
            })
            const snapshotsSaldosAnteriores = await Promise.all(saldoAnteriorPromesas)

            // Actualizar saldo anterior con el saldo final del día anterior
            snapshotsSaldosAnteriores.forEach((snapshot, index) => {
                if (snapshot.exists()) {
                    const datosSaldoAnterior = snapshot.data()
                    updatedListaPasadoresComision[index].saldoAnterior = datosSaldoAnterior.saldo_final || 0
                } else {
                    console.log(`No se encontraron datos de saldo anterior para ${updatedListaPasadoresComision[index].nombre}`)
                }
            })

            // Ejecutar todas las consultas de saldos diarios en paralelo
            const promesasSaldosDiarios = updatedListaPasadoresComision.map((pasador) => {
                // Preparar la consulta para los saldos diarios de este pasador
                const saldoDiarioRef = doc(db, "saldos_diarios", `${pasador.id}_${format(fechaSeleccionada, "yyyy-MM-dd")}`)
                return getDoc(saldoDiarioRef)
            })
            const snapshotsSaldosDiarios = await Promise.all(promesasSaldosDiarios)

            // Procesar los resultados de los saldos diarios
            snapshotsSaldosDiarios.forEach((snapshot, index) => {
                // Obtener el saldo anterior y el saldo final del día seleccionado
                if (snapshot.exists()) {
                    const datosSaldoDiario = snapshot.data()
                    updatedListaPasadoresComision[index] = {
                        ...updatedListaPasadoresComision[index],
                        saldoAnterior: datosSaldoDiario.saldo_anterior || 0,
                        saldoFinal: datosSaldoDiario.saldo_final || 0,
                        saldoTotal: datosSaldoDiario.saldo_total || 0,
                        jugado: datosSaldoDiario.ventas_online || 0,
                        aciertos: datosSaldoDiario.aciertos || [],
                        aciertosBorratinas: datosSaldoDiario.aciertos_borratinas || [],
                        acreditacionComision: datosSaldoDiario.acreditacion_comision || 0,
                        anulacionVentaOnline: datosSaldoDiario.anulacion_venta_online || 0,
                        borratinaOnline: datosSaldoDiario.borratina_online || 0,
                        cobroAlCliente: datosSaldoDiario.cobro_al_cliente || 0,
                        comisionPasador: datosSaldoDiario.comision_pasador || 0,
                        pagoACliente: datosSaldoDiario.pago_a_cliente || 0,
                        pagoAciertosBorras: datosSaldoDiario.pago_aciertos_borras || 0,
                        pagoPremioBorratina: datosSaldoDiario.pago_premio_borratina || 0,
                        pagoPremioBorratinas: datosSaldoDiario.pago_premio_borratinas || 0,
                        pagoQuiniela: datosSaldoDiario.pago_premio_quiniela || 0,
                        quintinaOnline: datosSaldoDiario.quintina_online || 0,
                        triplonaOnline: datosSaldoDiario.triplona_online || 0,
                        ventasOnline: datosSaldoDiario.ventas_online || 0,
                        fecha: datosSaldoDiario.fecha || "",
                        timestamp: datosSaldoDiario.timestamp || "",
                    }
                } else {
                    console.log(
                        `No se encontraron datos de saldo diario para ${updatedListaPasadoresComision[index].nombre} en la fecha ${format(fechaSeleccionada, "yyyy-MM-dd")}`,
                    )
                }

                console.log(
                    `Saldo anterior para ${updatedListaPasadoresComision[index].nombre}: ${updatedListaPasadoresComision[index].saldoAnterior}`,
                )
                console.log(
                    `Saldo final para ${updatedListaPasadoresComision[index].nombre}: ${updatedListaPasadoresComision[index].saldoFinal}`,
                )
            })

            // Suscribirse a las actualizaciones de jugado, pagos y cobros para cada pasador
            updatedListaPasadoresComision.forEach((pasador) => {
                obtenerMontoJugadoPagosCobros(
                    pasador.id,
                    pasador.nombre,
                    fechaSeleccionada,
                    pasador.comisionPorcentaje,
                    pasador.saldoAnterior,
                    pasador.premioTotal, // Pasar el premio total como parámetro
                    actualizarMontoJugadoPagosCobros,
                    actualizarComisionYSaldoFinal,
                )
            })

            setPasadores(updatedListaPasadoresComision)

            const modulosUnicos = Array.from(new Set(updatedListaPasadoresComision.map((p) => p.displayId.split("-")[0])))
            console.log("Módulos únicos:", modulosUnicos)
            setModulos(modulosUnicos)

            if (modulosUnicos.length > 0 && !modulosUnicos.includes(moduloSeleccionado)) {
                console.log("Actualizando módulo seleccionado a:", modulosUnicos[0])
                setModuloSeleccionado(modulosUnicos[0])
            }

            console.log("Búsqueda completada")
        } catch (err) {
            console.error("Error en manejarBusqueda:", err)
            setError(`Hubo un error al buscar los datos: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setEstaCargando(false)
        }
    }

    const formatearMoneda = (monto: number): string => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
        }).format(monto)
    }

    const pasadoresFiltrados = pasadores.filter((p) => p.displayId.startsWith(moduloSeleccionado))
    const totalPaginas = Math.ceil(pasadoresFiltrados.length / ITEMS_POR_PAGINA)
    const pasadoresPaginados = pasadoresFiltrados.slice(
        (paginaActual - 1) * ITEMS_POR_PAGINA,
        paginaActual * ITEMS_POR_PAGINA,
    )

    console.log("Renderizando componente, pasadores:", pasadores)
    console.log("Módulo seleccionado:", moduloSeleccionado)
    console.log("Pasadores filtrados:", pasadoresFiltrados)
    console.log("Pasadores paginados:", pasadoresPaginados)

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Navbar />
            <main className="container mx-auto p-4">
                <h1 className="text-xl font-bold text-black mb-4">Listado Diario</h1>

                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <span className="font-medium">Seleccione el módulo:</span>
                            <Select value={moduloSeleccionado} onValueChange={setModuloSeleccionado}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Módulo" />
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
                        <SelectorFecha
                            fechaSeleccionada={fechaSeleccionada}
                            onCambioFecha={setFechaSeleccionada}
                            onBuscar={manejarBusqueda}
                            estaCargando={estaCargando}
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {estaCargando ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        {pasadoresFiltrados.length === 0 ? (
                            <div
                                className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded mb-4 text-sm"
                                role="alert"
                            >
                                <p>No se encontraron datos para la fecha y módulo seleccionados.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Pasador</TableHead>
                                                <TableHead className="text-right">Saldo Final</TableHead>
                                                <TableHead className="text-right">Saldo Anterior</TableHead>
                                                <TableHead className="text-right">Saldo Total</TableHead>
                                                <TableHead className="text-right">Cobrado</TableHead>
                                                <TableHead className="text-right">Pagado</TableHead>
                                                <TableHead className="text-right">Jugado</TableHead>
                                                <TableHead className="text-right">Comisión</TableHead>
                                                <TableHead className="text-right">Total Ganado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pasadoresPaginados.map((pasador) => (
                                                <TableRow key={pasador.id}>
                                                    <TableCell>
                                                        {pasador.displayId} {pasador.nombre}
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.saldoFinal)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.saldoAnterior)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.saldoTotal)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.cobrado)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.pagado)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.jugado)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.comisionPasador)}</TableCell>
                                                    <TableCell className="text-right">{formatearMoneda(pasador.premioTotal)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-muted-foreground">
                                        Página {paginaActual} de {totalPaginas}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                                            disabled={paginaActual === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                                            disabled={paginaActual === totalPaginas}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}

