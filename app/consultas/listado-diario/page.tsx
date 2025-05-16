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
import { collection, getDocs, getDoc, doc, query, where, onSnapshot, setDoc } from "firebase/firestore"
import toast from "react-hot-toast"

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

// Actualizar el componente BotonSelectorFecha para que tenga más color
const BotonSelectorFecha = ({
    fecha,
    onChange,
    etiqueta,
}: { fecha: Date; onChange: (fecha: Date) => void; etiqueta: string }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                    "w-[120px] h-8 justify-start text-left font-normal text-xs border-blue-300 hover:border-blue-500 hover:bg-blue-50",
                    !fecha && "text-muted-foreground",
                )}
            >
                <CalendarIcon className="mr-2 h-3 w-3 text-blue-500" />
                {fecha ? format(fecha, "dd/MM/yyyy", { locale: es }) : etiqueta}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg">
            <Calendar
                mode="single"
                selected={fecha}
                onSelect={(fecha) => fecha && onChange(fecha)}
                initialFocus
                locale={es}
                className="rounded-md"
            />
        </PopoverContent>
    </Popover>
)

// Actualizar el componente SelectorFecha para que tenga más color
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
            <span className="font-medium text-blue-700">Fecha:</span>
            <BotonSelectorFecha fecha={fechaSeleccionada} onChange={onCambioFecha} etiqueta="Seleccionar" />
        </div>
        <Button
            onClick={onBuscar}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 h-8 px-4 text-xs rounded-md shadow-md transition-all duration-200 transform hover:scale-105"
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

// Modificar la función fetchAciertosData para validar mejor los datos
const fetchAciertosData = async (fecha: Date) => {
    const aciertosRef = collection(db, "aciertos")
    const fechaString = format(fecha, "yyyy-MM-dd")
    console.log(`Obteniendo aciertos para la fecha: ${fechaString}`)

    try {
        // Obtener todos los documentos de aciertos
        const querySnapshot = await getDocs(aciertosRef)
        const aciertosData: { [key: string]: number } = {}

        // Procesar cada documento de aciertos (uno por pasador)
        querySnapshot.forEach((doc) => {
            const data = doc.data()
            if (data[fechaString] && data[fechaString].totalGanado !== undefined) {
                // Validar que el valor sea un número válido
                const totalGanado = Number(data[fechaString].totalGanado)
                if (!isNaN(totalGanado)) {
                    // Guardar el total ganado para este pasador
                    aciertosData[doc.id] = totalGanado
                    console.log(`Aciertos encontrados para ${doc.id}: ${totalGanado}`)
                } else {
                    console.log(`Valor inválido de aciertos para ${doc.id}: ${data[fechaString].totalGanado}`)
                }
            } else {
                console.log(`No se encontraron aciertos para ${doc.id} en la fecha ${fechaString}`)
            }
        })

        // Si no hay aciertos en la colección "aciertos", buscar en "extractos"
        if (Object.keys(aciertosData).length === 0) {
            console.log("No se encontraron aciertos en la colección 'aciertos', buscando en 'extractos'...")
            const extractosRef = doc(db, "extractos", fechaString)
            const extractoSnapshot = await getDoc(extractosRef)

            if (extractoSnapshot.exists()) {
                const extractoData = extractoSnapshot.data()
                if (extractoData && extractoData.aciertos) {
                    // Agrupar aciertos por pasador
                    const aciertos = extractoData.aciertos

                    // Crear un mapa para acumular los premios por pasador
                    const premiosPorPasador: { [key: string]: number } = {}

                    // Procesar cada acierto
                    aciertos.forEach((acierto: any) => {
                        if (acierto.pasador && acierto.premio !== undefined) {
                            const pasador = acierto.pasador
                            const premio =
                                typeof acierto.premio === "number" ? acierto.premio : Number.parseFloat(acierto.premio) || 0

                            // Acumular premio para este pasador
                            premiosPorPasador[pasador] = (premiosPorPasador[pasador] || 0) + premio
                        }
                    })

                    // Transferir los premios acumulados al resultado
                    Object.keys(premiosPorPasador).forEach((pasador) => {
                        aciertosData[pasador] = premiosPorPasador[pasador]
                        console.log(`Aciertos encontrados en extractos para ${pasador}: ${premiosPorPasador[pasador]}`)
                    })
                }
            }
        }

        return aciertosData
    } catch (error) {
        console.error("Error al obtener aciertos:", error)
        return {}
    }
}

// Función para guardar los saldos diarios en Firestore
const guardarSaldosDiarios = async (pasador: Pasador, fecha: Date) => {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        const docId = `${pasador.id}_${fechaStr}`

        console.log(`Guardando saldos diarios para ${pasador.nombre} en fecha ${fechaStr}`)
        console.log(`ID del documento: ${docId}`)
        console.log(`Saldo anterior: ${pasador.saldoAnterior}`)
        console.log(`Saldo final: ${pasador.saldoFinal}`)
        console.log(`Saldo total: ${pasador.saldoTotal}`)

        // Crear o actualizar el documento de saldos diarios
        await setDoc(
            doc(db, "saldos_diarios", docId),
            {
                pasador_id: pasador.id,
                pasador_nombre: pasador.nombre,
                fecha: fechaStr,
                timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                saldo_anterior: pasador.saldoAnterior,
                saldo_final: pasador.saldoFinal,
                saldo_total: pasador.saldoTotal,
                ventas_online: pasador.jugado,
                comision_pasador: pasador.comisionPasador,
                total_pagos: pasador.pagado,
                total_cobros: pasador.cobrado,
                total_ganado: pasador.premioTotal,
            },
            { merge: true },
        )

        console.log(`Saldos diarios guardados correctamente para ${pasador.nombre}`)
        return true
    } catch (error) {
        console.error(`Error al guardar saldos diarios para ${pasador.nombre}:`, error)
        return false
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
    const [intervaloActualizacion, setIntervaloActualizacion] = useState<NodeJS.Timeout | null>(null)
    const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())

    useEffect(() => {
        // Configurar intervalo para actualización automática (cada 5 minutos)
        const intervalo = setInterval(
            () => {
                console.log("Ejecutando actualización automática de aciertos...")
                actualizarAciertosAutomaticamente()
            },
            5 * 60 * 1000,
        ) // 5 minutos

        setIntervaloActualizacion(intervalo)

        // Limpiar intervalo al desmontar
        return () => {
            if (intervaloActualizacion) {
                clearInterval(intervaloActualizacion)
            }
        }
    }, [])

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

    // Modificar la función actualizarComisionYSaldoFinal para validar los datos
    const actualizarComisionYSaldoFinal = (pasadorId: string, comision: number, saldoFinal: number) => {
        setPasadores((prevPasadores: Pasador[]) => {
            const nuevoPasadores = prevPasadores.map((p: Pasador) => {
                if (p.id === pasadorId) {
                    // Validar que el saldo final sea un número razonable
                    let saldoFinalValidado = saldoFinal

                    // Si hay un premio pero no hay jugadas, pagos ni cobros, el saldo no debería cambiar
                    if (p.premioTotal > 0 && p.jugado === 0 && p.pagado === 0 && p.cobrado === 0) {
                        console.log(`ADVERTENCIA: Premio sin jugadas para ${p.nombre}. Premio: ${p.premioTotal}`)
                        // Mantener el saldo anterior en este caso
                        saldoFinalValidado = p.saldoAnterior
                    }

                    // Ahora el saldo total es igual al saldo final
                    const pasadorActualizado = {
                        ...p,
                        comisionPasador: comision,
                        saldoFinal: saldoFinalValidado,
                        saldoTotal: saldoFinalValidado, // Saldo total = Saldo final
                    }

                    // Guardar los datos en Firestore después de actualizar el estado
                    setTimeout(() => {
                        guardarSaldosDiarios(pasadorActualizado, fechaSeleccionada)
                    }, 0)

                    return pasadorActualizado
                }
                return p
            })
            return nuevoPasadores
        })
    }

    useEffect(() => {
        manejarBusqueda()
    }, [])

    useEffect(() => {
        console.log("Estado actual de pasadores:", pasadores)
    }, [pasadores])

    // Modificar la función obtenerMontoJugadoPagosCobros para incluir el saldo anterior en los cálculos
    const obtenerMontoJugadoPagosCobros = (
        pasadorId: string,
        pasadorNombre: string,
        fecha: Date,
        comisionPorcentaje: number,
        saldoAnterior: number,
        premioTotal: number,
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

            // Obtener pagos y cobros por separado para depurar
            getDocs(pagosQuery).then((pagosSnapshot) => {
                let totalPagos = 0

                // Depurar cada documento de pago
                pagosSnapshot.forEach((doc) => {
                    const pagoData = doc.data()
                    // Asegurarse de que el monto del pago sea un valor positivo
                    const montoPago = Math.abs(pagoData.monto || 0)
                    console.log(`Pago encontrado para ${pasadorNombre}: ID=${doc.id}, Monto=${montoPago}`)
                    totalPagos += montoPago
                })

                console.log(`Total de pagos para ${pasadorNombre}: ${totalPagos}`)

                // Obtener cobros después de procesar pagos
                getDocs(cobrosQuery).then((cobrosSnapshot) => {
                    let totalCobros = 0

                    // Depurar cada documento de cobro
                    cobrosSnapshot.forEach((doc) => {
                        const cobroData = doc.data()
                        // Asegurarse de que el monto del cobro sea un valor positivo
                        const montoCobro = Math.abs(cobroData.monto || 0)
                        console.log(`Cobro encontrado para ${pasadorNombre}: ID=${doc.id}, Monto=${montoCobro}`)
                        totalCobros += montoCobro
                    })

                    console.log(`Total de cobros para ${pasadorNombre}: ${totalCobros}`)

                    console.log(`Monto jugado para ${pasadorNombre}: ${ventasOnlineAcumuladas}`)
                    console.log(`Pagos para ${pasadorNombre}: ${totalPagos}`)
                    console.log(`Cobros para ${pasadorNombre}: ${totalCobros}`)
                    console.log(`Premio total para ${pasadorNombre}: ${premioTotal}`)
                    console.log(`Saldo anterior para ${pasadorNombre}: ${saldoAnterior}`)

                    const comisionCalculada = (comisionPorcentaje / 100) * ventasOnlineAcumuladas
                    const comisionRedondeada = Math.round(comisionCalculada * 100) / 100

                    // Validar si hay premio pero no hay jugadas
                    if (premioTotal > 0 && ventasOnlineAcumuladas === 0 && totalPagos === 0 && totalCobros === 0) {
                        console.log(`ADVERTENCIA: Premio sin jugadas para ${pasadorNombre}. Premio: ${premioTotal}`)

                        // Actualizar solo el monto jugado, pagos y cobros, pero no el saldo
                        actualizarMontoJugadoPagosCobros(
                            pasadorId,
                            ventasOnlineAcumuladas,
                            Math.abs(totalPagos),
                            Math.abs(totalCobros),
                        )

                        // No actualizar el saldo en este caso
                        return
                    }

                    // Cálculo del saldo final con signos explícitos para mayor claridad
                    // Asegurarse de que los pagos se resten y los cobros se sumen
                    const saldoFinal =
                        saldoAnterior +
                        ventasOnlineAcumuladas -
                        comisionRedondeada -
                        premioTotal -
                        Math.abs(totalPagos) +
                        Math.abs(totalCobros)

                    console.log(`Cálculo de saldo final para ${pasadorNombre}:`)
                    console.log(`Saldo anterior: ${saldoAnterior}`)
                    console.log(`+ Ventas online: ${ventasOnlineAcumuladas}`)
                    console.log(`- Comisión (${comisionPorcentaje}%): ${comisionRedondeada}`)
                    console.log(`- Premio total: ${premioTotal}`)
                    console.log(`- Total pagos: ${Math.abs(totalPagos)}`)
                    console.log(`+ Total cobros: ${Math.abs(totalCobros)}`)
                    console.log(`= Saldo final: ${saldoFinal}`)

                    // Actualizar el estado con los valores calculados
                    // Asegurarse de que los valores se almacenen como positivos para mostrarlos correctamente en la UI
                    actualizarMontoJugadoPagosCobros(
                        pasadorId,
                        ventasOnlineAcumuladas,
                        Math.abs(totalPagos),
                        Math.abs(totalCobros),
                    )
                    actualizarComisionYSaldoFinal(pasadorId, comisionRedondeada, saldoFinal)
                })
            })
        })

        return () => {
            unsubscribeJugadas()
        }
    }

    // Modificar la función actualizarAciertosAutomaticamente para validar los datos
    const actualizarAciertosAutomaticamente = async () => {
        try {
            console.log("Actualizando aciertos automáticamente...")
            const aciertosData = await fetchAciertosData(fechaSeleccionada)

            // Actualizar solo los premios totales sin cambiar el resto de datos
            setPasadores((prevPasadores) =>
                prevPasadores.map((pasador) => {
                    const nuevoPremioPasador = aciertosData[pasador.nombre] || 0

                    // Si hay un premio pero no hay jugadas, no actualizar el saldo
                    if (nuevoPremioPasador > 0 && pasador.jugado === 0) {
                        console.log(`ADVERTENCIA: Premio sin jugadas para ${pasador.nombre}. Premio: ${nuevoPremioPasador}`)
                        // Solo actualizar el premio, no el saldo
                        return {
                            ...pasador,
                            premioTotal: nuevoPremioPasador,
                            // Mantener los saldos como estaban
                        }
                    }

                    return {
                        ...pasador,
                        premioTotal: nuevoPremioPasador,
                    }
                }),
            )

            // Recalcular saldos finales con los nuevos premios
            pasadores.forEach((pasador) => {
                const premioTotal = aciertosData[pasador.nombre] || pasador.premioTotal

                // Solo actualizar si el premio cambió y hay jugadas
                if (premioTotal !== pasador.premioTotal && pasador.jugado > 0) {
                    console.log(`Actualizando premio para ${pasador.nombre}: ${pasador.premioTotal} -> ${premioTotal}`)

                    // Recalcular saldo final con el nuevo premio
                    const comisionCalculada = (pasador.comisionPorcentaje / 100) * pasador.jugado
                    const comisionRedondeada = Math.round(comisionCalculada * 100) / 100

                    const saldoFinal =
                        pasador.saldoAnterior + pasador.jugado - comisionRedondeada - premioTotal - pasador.pagado + pasador.cobrado

                    // Actualizar comisión y saldo final
                    actualizarComisionYSaldoFinal(pasador.id, comisionRedondeada, saldoFinal)
                }
            })

            toast.success("Aciertos actualizados automáticamente")
            setUltimaActualizacion(new Date())
        } catch (error) {
            console.error("Error al actualizar aciertos automáticamente:", error)
        }
    }

    // Modificar la función manejarBusqueda para validar mejor los datos
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

            // Obtener saldo anterior (saldo total del día anterior)
            const fechaAnterior = new Date(fechaSeleccionada)
            fechaAnterior.setDate(fechaAnterior.getDate() - 1)
            const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd")
            console.log(`Buscando saldos del día anterior: ${fechaAnteriorStr}`)

            // Primero, obtener los saldos diarios del día anterior para cada pasador
            const saldosAnteriores: { [key: string]: number } = {}

            // Obtener todos los documentos de saldos_diarios que corresponden al día anterior
            const saldosDiariosRef = collection(db, "saldos_diarios")
            const saldosDiariosSnapshot = await getDocs(saldosDiariosRef)

            // Filtrar los documentos que corresponden al día anterior
            saldosDiariosSnapshot.forEach((docSnapshot) => {
                const docId = docSnapshot.id
                // Los IDs tienen el formato "pasadorId_fecha"
                if (docId.endsWith(fechaAnteriorStr)) {
                    const pasadorId = docId.split("_")[0]
                    const data = docSnapshot.data()

                    // SOLO usar saldo_total del día anterior como saldo anterior
                    if (data.saldo_total !== undefined) {
                        saldosAnteriores[pasadorId] = data.saldo_total
                        console.log(
                            `Encontrado saldo_total para pasador ${pasadorId} en fecha ${fechaAnteriorStr}: ${data.saldo_total}`,
                        )
                    }
                }
            })

            // Actualizar cada pasador con el saldo total del día anterior como saldo anterior
            updatedListaPasadoresComision.forEach((pasador, index) => {
                if (saldosAnteriores[pasador.id] !== undefined) {
                    updatedListaPasadoresComision[index].saldoAnterior = saldosAnteriores[pasador.id]
                    console.log(`Asignado saldo anterior para ${pasador.nombre}: ${saldosAnteriores[pasador.id]}`)
                } else {
                    console.log(`No se encontró saldo anterior para ${pasador.nombre} en fecha ${fechaAnteriorStr}`)

                    // Si no hay datos del día anterior, intentar obtener el saldo del pasador directamente
                    const pasadorDoc = pasadoresSnapshot.docs.find((doc) => doc.id === pasador.id)
                    if (pasadorDoc) {
                        const pasadorData = pasadorDoc.data()
                        // Intentar usar saldoTotal si existe, de lo contrario usar saldoFinal
                        const saldoPasador = pasadorData.saldoTotal || pasadorData.saldoFinal || 0
                        updatedListaPasadoresComision[index].saldoAnterior = saldoPasador
                        console.log(`Usando saldo del pasador como saldo anterior: ${saldoPasador}`)
                    } else {
                        console.log(`No se encontró documento del pasador ${pasador.nombre}`)
                        updatedListaPasadoresComision[index].saldoAnterior = 0
                    }
                }
            })

            // Ejecutar todas las consultas de saldos diarios en paralelo para el día actual
            const promesasSaldosDiarios = updatedListaPasadoresComision.map((pasador) => {
                // Preparar la consulta para los saldos diarios de este pasador
                const saldoDiarioRef = doc(db, "saldos_diarios", `${pasador.id}_${format(fechaSeleccionada, "yyyy-MM-dd")}`)
                return getDoc(saldoDiarioRef)
            })
            const snapshotsSaldosDiarios = await Promise.all(promesasSaldosDiarios)

            // Procesar los resultados de los saldos diarios del día actual
            snapshotsSaldosDiarios.forEach((snapshot, index) => {
                // Obtener el saldo anterior y el saldo final del día seleccionado
                if (snapshot.exists()) {
                    const datosSaldoDiario = snapshot.data()
                    // Mantener el saldo anterior que ya obtuvimos del día anterior
                    const saldoAnterior = updatedListaPasadoresComision[index].saldoAnterior
                    const saldoFinal = datosSaldoDiario.saldo_final || 0

                    updatedListaPasadoresComision[index] = {
                        ...updatedListaPasadoresComision[index],
                        // Mantener el saldo anterior que ya obtuvimos
                        saldoAnterior: saldoAnterior,
                        saldoFinal: saldoFinal,
                        saldoTotal: saldoFinal, // Saldo total = Saldo final
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
                console.log(
                    `Saldo total para ${updatedListaPasadoresComision[index].nombre}: ${updatedListaPasadoresComision[index].saldoTotal}`,
                )
            })

            // Validar los premios totales antes de actualizar los pasadores
            updatedListaPasadoresComision.forEach((pasador, index) => {
                // Si hay un premio pero no hay jugadas, no afectar el saldo
                if (pasador.premioTotal > 0 && pasador.jugado === 0) {
                    console.log(`ADVERTENCIA: Premio sin jugadas para ${pasador.nombre}. Premio: ${pasador.premioTotal}`)

                    // Establecer el saldo final igual al saldo anterior en este caso
                    updatedListaPasadoresComision[index].saldoFinal = pasador.saldoAnterior
                    updatedListaPasadoresComision[index].saldoTotal = pasador.saldoAnterior
                }
            })

            // Suscribirse a las actualizaciones de jugado, pagos y cobros para cada pasador
            updatedListaPasadoresComision.forEach((pasador) => {
                obtenerMontoJugadoPagosCobros(
                    pasador.id,
                    pasador.nombre,
                    fechaSeleccionada,
                    pasador.comisionPorcentaje,
                    pasador.saldoAnterior, // Pasar el saldo anterior actualizado
                    pasador.premioTotal,
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

            // Guardar automáticamente los saldos diarios al consultar
            console.log("Guardando saldos diarios para la fecha:", format(fechaSeleccionada, "yyyy-MM-dd"))
            try {
                const resultadosGuardado = await Promise.all(
                    updatedListaPasadoresComision.map((pasador) => guardarSaldosDiarios(pasador, fechaSeleccionada)),
                )
                const exitosos = resultadosGuardado.filter((r) => r).length
                toast.success(`Saldos diarios actualizados: ${exitosos} de ${updatedListaPasadoresComision.length}`)
            } catch (error) {
                console.error("Error al guardar saldos diarios:", error)
                toast.error("Error al guardar los saldos diarios")
            }

            console.log("Búsqueda completada")
            setUltimaActualizacion(new Date())
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
                <h1 className="text-2xl font-bold text-blue-800 mb-4 border-b-2 border-blue-500 pb-2">Listado Diario</h1>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-4 mb-4 border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <span className="font-medium text-blue-700">Seleccione el módulo:</span>
                            <Select value={moduloSeleccionado} onValueChange={setModuloSeleccionado}>
                                <SelectTrigger className="w-[100px] border-blue-300 focus:ring-blue-500">
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
                <div className="text-xs text-gray-500 mt-2">
                    Última actualización: {format(ultimaActualizacion, "dd/MM/yyyy HH:mm:ss", { locale: es })}
                    <Button
                        onClick={actualizarAciertosAutomaticamente}
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 px-2 text-blue-600"
                    >
                        <Loader2 className="h-3 w-3 mr-1" /> Actualizar ahora
                    </Button>
                </div>

                {error && (
                    <div
                        className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded mb-4 shadow-md"
                        role="alert"
                    >
                        <div className="flex">
                            <div className="py-1">
                                <svg
                                    className="fill-current h-6 w-6 text-red-500 mr-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {estaCargando ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <>
                        {pasadoresFiltrados.length === 0 ? (
                            <div
                                className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded mb-4 shadow-md"
                                role="alert"
                            >
                                <div className="flex">
                                    <div className="py-1">
                                        <svg
                                            className="fill-current h-6 w-6 text-yellow-500 mr-4"
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-bold">Sin datos</p>
                                        <p>No se encontraron datos para la fecha y módulo seleccionados.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                                    <Table>
                                        <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                            <TableRow>
                                                <TableHead className="text-white font-bold">Pasador</TableHead>
                                                <TableHead className="text-right text-white font-bold">Saldo Final</TableHead>
                                                <TableHead className="text-right text-white font-bold">Saldo Anterior</TableHead>
                                                <TableHead className="text-right text-white font-bold">Saldo Total</TableHead>
                                                <TableHead className="text-right text-white font-bold">Cobrado</TableHead>
                                                <TableHead className="text-right text-white font-bold">Pagado</TableHead>
                                                <TableHead className="text-right text-white font-bold">Jugado</TableHead>
                                                <TableHead className="text-right text-white font-bold">Comisión</TableHead>
                                                <TableHead className="text-right text-white font-bold">Total Ganado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pasadoresPaginados.map((pasador, index) => (
                                                <TableRow
                                                    key={pasador.id}
                                                    className={index % 2 === 0 ? "bg-blue-50" : "bg-white hover:bg-blue-100"}
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">
                                                                {pasador.nombre.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-blue-800">{pasador.displayId}</div>
                                                                <div className="text-sm text-gray-600">{pasador.nombre}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-semibold ${pasador.saldoFinal >= 0 ? "text-green-600" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoFinal)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right ${pasador.saldoAnterior >= 0 ? "text-green-600" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoAnterior)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-semibold ${pasador.saldoTotal >= 0 ? "text-green-600" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoTotal)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-blue-600">{formatearMoneda(pasador.cobrado)}</TableCell>
                                                    <TableCell className="text-right text-purple-600">
                                                        {formatearMoneda(pasador.pagado)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-indigo-600">
                                                        {formatearMoneda(pasador.jugado)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-orange-600">
                                                        {formatearMoneda(pasador.comisionPasador)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-teal-600">
                                                        {formatearMoneda(pasador.premioTotal)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex items-center justify-between mt-6 bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                                    <div className="text-sm text-blue-700 font-medium">
                                        Página {paginaActual} de {totalPaginas}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                                            disabled={paginaActual === 1}
                                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}
                                            disabled={paginaActual === totalPaginas}
                                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
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
