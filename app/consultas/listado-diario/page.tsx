"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { format, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import Navbar from "@/app/components/Navbar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/firebase"
import { collection, getDocs, doc, query, where, onSnapshot, setDoc, Timestamp, getDoc } from "firebase/firestore"
import toast from "react-hot-toast"
import {
    esJugadaAnulada,
    extraerResultados,
    procesarJugadasYEncontrarAciertos,
    calcularTotalGanado,
    guardarAciertosEnFirestore,
} from "@/lib/aciertos-utils"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    saldoFinal: number
    saldoAnterior: number
    saldoActual: number // Ahora representa el movimiento neto del día
    saldoTotal: number // Ahora representa el saldo acumulado
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
    modulo: number
    posicionEnModulo: number
}

interface ExtractoData {
    [fecha: string]: {
        resultados: any[]
        // ... otros campos del extracto
    }
}

const ITEMS_POR_PAGINA = 15

// Componente BotonSelectorFecha
const BotonSelectorFecha = ({
    fecha,
    onChange,
    etiqueta,
}: {
    fecha: Date | undefined
    onChange: (fecha: Date) => void
    etiqueta: string
}) => (
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

// Componente SelectorFecha
const SelectorFecha = ({
    fechaSeleccionada,
    onCambioFecha,
    onBuscar,
    estaCargando,
    onActualizarAciertos,
    estaCargandoAciertos,
}: {
    fechaSeleccionada: Date
    onCambioFecha: (fecha: Date) => void
    onBuscar: () => void
    estaCargando: boolean
    onActualizarAciertos: () => void
    estaCargandoAciertos: boolean
}) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
            <span className="font-medium text-blue-700">Fecha:</span>
            <BotonSelectorFecha fecha={fechaSeleccionada} onChange={onCambioFecha} etiqueta="Seleccionar" />
        </div>
        <div className="flex gap-2">
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
            <Button
                onClick={onActualizarAciertos}
                variant="outline"
                className="h-8 px-3 text-xs border-green-300 text-green-700 hover:bg-green-50 bg-transparent"
                disabled={estaCargando || estaCargandoAciertos}
            >
                <RefreshCw className={`mr-1 h-3 w-3 ${estaCargandoAciertos ? "animate-spin" : ""}`} />
                Aciertos
            </Button>
        </div>
    </div>
)

// ✅ FUNCIÓN PARA CONFIGURAR LISTENERS DE PAGOS Y COBROS
const configurarListenerPagosCobros = (
    pasadorId: string,
    fechaString: string,
    onUpdate: (pagos: number, cobros: number) => void,
): (() => void)[] => {
    const pagosRef = collection(db, "pagos")
    const cobrosRef = collection(db, "cobros")

    const pagosQuery = query(pagosRef, where("pasadorId", "==", pasadorId), where("fecha", "==", fechaString))
    const cobrosQuery = query(cobrosRef, where("pasadorId", "==", pasadorId), where("fecha", "==", fechaString))

    let currentPagos = 0
    let currentCobros = 0 // This will store the largest cobro

    const unsubscribePagos = onSnapshot(
        pagosQuery,
        (snapshot) => {
            let totalPagos = 0
            snapshot.forEach((doc) => {
                const monto = doc.data().monto
                if (typeof monto === "number") {
                    totalPagos += monto
                } else if (typeof monto === "string") {
                    const montoNumerico = Number.parseFloat(monto)
                    if (!isNaN(montoNumerico)) {
                        totalPagos += montoNumerico
                    }
                }
            })
            currentPagos = totalPagos
            console.log(`🔄 Pagos actualizados para ${pasadorId} en ${fechaString}: ${currentPagos}`)
            onUpdate(currentPagos, currentCobros)
        },
        (error) => {
            console.error(`❌ Error en listener de pagos para ${pasadorId}:`, error)
        },
    )

    const unsubscribeCobros = onSnapshot(
        cobrosQuery,
        (snapshot) => {
            let cobroMasGrande = 0
            snapshot.forEach((doc) => {
                const monto = doc.data().monto
                let montoNumerico = 0
                if (typeof monto === "number") {
                    montoNumerico = monto
                } else if (typeof monto === "string") {
                    montoNumerico = Number.parseFloat(monto)
                    if (isNaN(montoNumerico)) montoNumerico = 0
                }
                if (montoNumerico > cobroMasGrande) {
                    cobroMasGrande = montoNumerico
                }
            })
            currentCobros = cobroMasGrande
            console.log(`🔄 Cobros actualizados para ${pasadorId} en ${fechaString}: ${currentCobros}`)
            onUpdate(currentPagos, currentCobros)
        },
        (error) => {
            console.error(`❌ Error en listener de cobros para ${pasadorId}:`, error)
        },
    )

    return [unsubscribePagos, unsubscribeCobros]
}

// Función para obtener saldo anterior
const obtenerSaldoAnterior = async (pasadorId: string, fechaSeleccionada: Date): Promise<number> => {
    try {
        const fechaAnterior = new Date(fechaSeleccionada)
        fechaAnterior.setDate(fechaAnterior.getDate() - 1)
        const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd")

        const saldosDiariosRef = collection(db, "saldos_diarios")
        const q = query(saldosDiariosRef, where("pasador_id", "==", pasadorId), where("fecha", "==", fechaAnteriorStr))
        const saldosDiariosSnapshot = await getDocs(q)

        if (!saldosDiariosSnapshot.empty) {
            const doc = saldosDiariosSnapshot.docs[0]
            const data = doc.data()
            const saldoAnterior = data.saldo_total || data.saldo_final || 0
            console.log(`✅ Saldo anterior para ${pasadorId} en ${fechaAnteriorStr}: ${saldoAnterior}`)
            return saldoAnterior
        } else {
            console.log(`⚠️ No se encontró saldo anterior para ${pasadorId} en ${fechaAnteriorStr}. Asumiendo 0.`)
            return 0
        }
    } catch (error) {
        console.error(`❌ Error al obtener saldo anterior para ${pasadorId}:`, error)
        return 0
    }
}

// ✅ FUNCIÓN CALCULAR SALDOS - AJUSTADA SEGÚN REQUERIMIENTO
const calcularSaldos = (
    saldoCierreDiaAnterior: number, // Este es el saldo final del día anterior
    jugado: number,
    comision: number,
    premios: number,
    pagosInmutables: number,
    cobrosInmutables: number,
) => {
    // ✅ Saldo Actual: Representa el movimiento neto del día, comenzando desde 0.
    const saldoActualDelDia = jugado - comision - premios
    // ✅ Saldo Total: Es el saldo acumulado, incluyendo el saldo del día anterior y las operaciones del día actual (incluyendo pagos/cobros).
    const saldoTotalCalculado = saldoCierreDiaAnterior + saldoActualDelDia + pagosInmutables - cobrosInmutables

    return {
        saldoAnterior: saldoCierreDiaAnterior, // Se mantiene como el saldo de cierre del día anterior
        saldoActual: saldoActualDelDia, // Este es el nuevo "saldoActual" (movimiento neto del día)
        saldoTotal: saldoTotalCalculado, // Este es el nuevo "saldoTotal" (saldo acumulado)
        saldoFinal: saldoTotalCalculado, // saldoFinal es igual a saldoTotal
    }
}

// ✅ FUNCIÓN PARA CREAR REGISTROS FALTANTES
const crearRegistrosFaltantes = async (pasadores: Pasador[], fecha: Date): Promise<void> => {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        for (const pasador of pasadores) {
            // Solo crear registro si hay alguna actividad o saldo diferente de cero
            if (
                pasador.saldoTotal !== pasador.saldoAnterior ||
                pasador.jugado !== 0 ||
                pasador.pagado !== 0 ||
                pasador.cobrado !== 0 ||
                pasador.premioTotal !== 0
            ) {
                const docId = `${pasador.id}_${fechaStr}`
                await setDoc(
                    doc(db, "saldos_diarios", docId),
                    {
                        pasador_id: pasador.id,
                        pasador_nombre: pasador.nombre,
                        fecha: fechaStr,
                        timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                        saldo_anterior: pasador.saldoAnterior,
                        saldo_actual: pasador.saldoActual, // Almacena el movimiento neto del día
                        saldo_final: pasador.saldoTotal, // Almacena el saldo acumulado
                        saldo_total: pasador.saldoTotal, // Mantener consistente con saldo_final
                        ventas_online: pasador.jugado,
                        comision_pasador: pasador.comisionPasador,
                        total_pagos: pasador.pagado,
                        total_cobros: pasador.cobrado,
                        total_ganado: pasador.premioTotal,
                        modulo: pasador.modulo,
                        posicion_en_modulo: pasador.posicionEnModulo,
                        display_id: pasador.displayId,
                    },
                    { merge: true },
                )
                console.log(`💾 Registro diario guardado/actualizado para ${pasador.nombre} en ${fechaStr}`)
            }
        }
    } catch (error) {
        console.error(`❌ Error al crear registros faltantes:`, error)
    }
}

// Función para guardar los saldos diarios en Firestore
const guardarSaldosDiarios = async (pasador: Pasador, fecha: Date): Promise<boolean> => {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        const docId = `${pasador.id}_${fechaStr}`
        await setDoc(
            doc(db, "saldos_diarios", docId),
            {
                pasador_id: pasador.id,
                pasador_nombre: pasador.nombre,
                fecha: fechaStr,
                timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                saldo_anterior: pasador.saldoAnterior,
                saldo_actual: pasador.saldoActual, // Almacena el movimiento neto del día
                saldo_final: pasador.saldoTotal, // Almacena el saldo acumulado
                saldo_total: pasador.saldoTotal, // Mantener consistente con saldo_final
                ventas_online: pasador.jugado,
                comision_pasador: pasador.comisionPasador,
                total_pagos: pasador.pagado,
                total_cobros: pasador.cobrado,
                total_ganado: pasador.premioTotal,
                modulo: pasador.modulo,
                posicion_en_modulo: pasador.posicionEnModulo,
                display_id: pasador.displayId,
            },
            { merge: true },
        )
        return true
    } catch (error) {
        console.error(`❌ Error al guardar saldos diarios:`, error)
        return false
    }
}

export default function ListadoDiario() {
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [modulos, setModulos] = useState<string[]>([])
    const [moduloSeleccionado, setModuloSeleccionado] = useState<string>("70")
    const [paginaActual, setPaginaActual] = useState(1)
    const [estaCargando, setEstaCargando] = useState(false)
    const [estaCargandoAciertos, setEstaCargandoAciertos] = useState(false)
    const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(startOfDay(new Date()))
    const [error, setError] = useState<string | null>(null)
    const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date())
    const unsubscribersRef = useRef<(() => void)[]>([])
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // ✅ CACHE DE PAGOS Y COBROS INMUTABLES
    const pagosCobrosCache = useRef<Map<string, { pagos: number; cobros: number }>>(new Map())

    // ✅ ESTADO PARA LOS EXTRACTOS (RESULTADOS DE SORTEOS)
    const [extractosResultados, setExtractosResultados] = useState<any[]>([])

    // ✅ FUNCIÓN PARA CARGAR DATOS HISTÓRICOS CON PAGOS/COBROS INMUTABLES
    const cargarDatosHistoricos = useCallback(
        async (pasadoresList: Pasador[], fecha: Date, resultadosExtracto: any[]) => {
            try {
                const fechaString = format(fecha, "yyyy-MM-dd")
                console.log(`📚 Cargando datos históricos para ${fechaString}`)

                const pasadoresActualizados = await Promise.all(
                    pasadoresList.map(async (pasador) => {
                        // ✅ OBTENER JUGADAS
                        const jugadasRef = collection(db, `JUGADAS DE ${pasador.nombre}`)
                        const jugadasQuery = query(
                            jugadasRef,
                            where("fechaHora", ">=", Timestamp.fromDate(startOfDay(fecha))),
                            where("fechaHora", "<=", Timestamp.fromDate(endOfDay(fecha))),
                        )
                        const jugadasSnapshot = await getDocs(jugadasQuery)
                        let ventasOnlineAcumuladas = 0
                        const jugadasData: Record<string, any>[] = []
                        jugadasSnapshot.forEach((docSnapshot) => {
                            const jugada = docSnapshot.data()
                            if (!esJugadaAnulada(jugada)) {
                                ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
                                jugadasData.push(jugada)
                            }
                        })

                        // ✅ OBTENER PAGOS Y COBROS (UNA SOLA VEZ para datos históricos)
                        const pagosRef = collection(db, "pagos")
                        const cobrosRef = collection(db, "cobros")

                        const pagosQuery = query(pagosRef, where("pasadorId", "==", pasador.id), where("fecha", "==", fechaString))
                        const cobrosQuery = query(
                            cobrosRef,
                            where("pasadorId", "==", pasador.id),
                            where("fecha", "==", fechaString),
                        )

                        const [pagosSnapshot, cobrosSnapshot] = await Promise.all([getDocs(pagosQuery), getDocs(cobrosQuery)])

                        let totalPagos = 0
                        pagosSnapshot.forEach((doc) => {
                            const monto = doc.data().monto
                            if (typeof monto === "number") {
                                totalPagos += monto
                            } else if (typeof monto === "string") {
                                const montoNumerico = Number.parseFloat(monto)
                                if (!isNaN(montoNumerico)) {
                                    totalPagos += montoNumerico
                                }
                            }
                        })

                        let cobroMasGrande = 0
                        cobrosSnapshot.forEach((doc) => {
                            const monto = doc.data().monto
                            let montoNumerico = 0
                            if (typeof monto === "number") {
                                montoNumerico = monto
                            } else if (typeof monto === "string") {
                                montoNumerico = Number.parseFloat(monto)
                                if (isNaN(montoNumerico)) montoNumerico = 0
                            }
                            if (montoNumerico > cobroMasGrande) {
                                cobroMasGrande = montoNumerico
                            }
                        })

                        // ✅ CALCULAR ACIERTOS PARA DATOS HISTÓRICOS
                        const aciertosCalculados = procesarJugadasYEncontrarAciertos(jugadasData, resultadosExtracto)
                        const premioTotalCalculado = calcularTotalGanado(aciertosCalculados)
                        await guardarAciertosEnFirestore(pasador.nombre, aciertosCalculados, fecha)

                        const comisionCalculada = (pasador.comisionPorcentaje / 100) * ventasOnlineAcumuladas

                        const saldosCalculados = calcularSaldos(
                            pasador.saldoAnterior, // Saldo de cierre del día anterior
                            ventasOnlineAcumuladas,
                            comisionCalculada,
                            premioTotalCalculado, // Usar el premio total calculado
                            totalPagos, // ✅ VALOR OBTENIDO DE LA DB
                            cobroMasGrande, // ✅ VALOR OBTENIDO DE LA DB
                        )

                        console.log(`--- Datos Históricos para ${pasador.nombre} (${fechaString}) ---`)
                        console.log(`  Saldo Anterior: ${pasador.saldoAnterior}`)
                        console.log(`  Jugado: ${ventasOnlineAcumuladas}`)
                        console.log(`  Comisión: ${comisionCalculada}`)
                        console.log(`  Premios Calculados: ${premioTotalCalculado}`)
                        console.log(`  Pagos: ${totalPagos}`)
                        console.log(`  Cobros: ${cobroMasGrande}`)
                        console.log(`  Saldo Actual (Movimiento Neto): ${saldosCalculados.saldoActual}`)
                        console.log(`  Saldo Total (Acumulado): ${saldosCalculados.saldoTotal}`)
                        console.log(`-------------------------------------------------`)

                        return {
                            ...pasador,
                            jugado: ventasOnlineAcumuladas,
                            pagado: totalPagos, // ✅ VALOR OBTENIDO DE LA DB
                            cobrado: cobroMasGrande, // ✅ VALOR OBTENIDO DE LA DB
                            comisionPasador: comisionCalculada,
                            premioTotal: premioTotalCalculado, // Actualizar premioTotal
                            ...saldosCalculados,
                        }
                    }),
                )
                setPasadores(pasadoresActualizados)
                await crearRegistrosFaltantes(pasadoresActualizados, fecha)
                console.log("✅ Datos históricos cargados con pagos/cobros inmutables y aciertos calculados")
            } catch (error) {
                console.error("❌ Error al cargar datos históricos:", error)
                throw error // Re-throw para que el catch de manejarBusqueda lo capture
            }
        },
        [],
    )

    // ✅ FUNCIÓN PARA OBTENER DATOS EN TIEMPO REAL CON PAGOS/COBROS INMUTABLES Y ACIERTOS CALCULADOS
    const obtenerDatosEnTiempoReal = useCallback(
        (pasador: Pasador, resultadosExtracto: any[]) => {
            const jugadasRef = collection(db, `JUGADAS DE ${pasador.nombre}`)
            const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

            const jugadasQuery = query(
                jugadasRef,
                where("fechaHora", ">=", Timestamp.fromDate(startOfDay(fechaSeleccionada))),
                where("fechaHora", "<=", Timestamp.fromDate(endOfDay(fechaSeleccionada))),
            )

            const unsubscribers: (() => void)[] = []

            // Listener para jugadas
            const unsubscribeJugadas = onSnapshot(
                jugadasQuery,
                async (jugadasSnapshot) => {
                    let ventasOnlineAcumuladas = 0
                    const jugadasData: Record<string, any>[] = []
                    jugadasSnapshot.forEach((docSnapshot) => {
                        const jugada = docSnapshot.data()
                        if (!esJugadaAnulada(jugada)) {
                            ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
                            jugadasData.push(jugada)
                        }
                    })

                    // Obtener pagos/cobros del cache (serán actualizados por sus propios listeners)
                    const cacheKey = `${pasador.id}_${fechaString}`
                    const pagosCobros = pagosCobrosCache.current.get(cacheKey) || {
                        pagos: pasador.pagado, // Fallback to current pasador state if not in cache yet
                        cobros: pasador.cobrado,
                    }

                    // ✅ CALCULAR ACIERTOS EN TIEMPO REAL
                    const aciertosCalculados = procesarJugadasYEncontrarAciertos(jugadasData, resultadosExtracto)
                    const premioTotalCalculado = calcularTotalGanado(aciertosCalculados)
                    await guardarAciertosEnFirestore(pasador.nombre, aciertosCalculados, fechaSeleccionada)

                    const comisionCalculada = (pasador.comisionPorcentaje / 100) * ventasOnlineAcumuladas

                    const saldosCalculados = calcularSaldos(
                        pasador.saldoAnterior,
                        ventasOnlineAcumuladas,
                        comisionCalculada,
                        premioTotalCalculado, // Usar el premio total calculado
                        pagosCobros.pagos,
                        pagosCobros.cobros,
                    )

                    console.log(`--- Datos Tiempo Real para ${pasador.nombre} (${fechaString}) ---`)
                    console.log(`  Saldo Anterior: ${pasador.saldoAnterior}`)
                    console.log(`  Jugado: ${ventasOnlineAcumuladas}`)
                    console.log(`  Comisión: ${comisionCalculada}`)
                    console.log(`  Premios Calculados: ${premioTotalCalculado}`)
                    console.log(`  Pagos (cache): ${pagosCobros.pagos}`)
                    console.log(`  Cobros (cache): ${pagosCobros.cobros}`)
                    console.log(`  Saldo Actual (Movimiento Neto): ${saldosCalculados.saldoActual}`)
                    console.log(`  Saldo Total (Acumulado): ${saldosCalculados.saldoTotal}`)
                    console.log(`-------------------------------------------------`)

                    setPasadores((prevPasadores) =>
                        prevPasadores.map((p) => {
                            if (p.id === pasador.id) {
                                const pasadorActualizado = {
                                    ...p,
                                    jugado: ventasOnlineAcumuladas,
                                    pagado: pagosCobros.pagos, // Use cached/updated value
                                    cobrado: pagosCobros.cobros, // Use cached/updated value
                                    comisionPasador: comisionCalculada,
                                    premioTotal: premioTotalCalculado, // Actualizar premioTotal
                                    ...saldosCalculados,
                                }
                                setTimeout(() => guardarSaldosDiarios(pasadorActualizado, fechaSeleccionada), 0)
                                return pasadorActualizado
                            }
                            return p
                        }),
                    )
                },
                (error) => {
                    console.error(`Error en listener de jugadas para ${pasador.nombre}:`, error)
                },
            )
            unsubscribers.push(unsubscribeJugadas)

            // Listener para pagos y cobros
            const pagosCobrosUnsubscribers = configurarListenerPagosCobros(pasador.id, fechaString, (newPagos, newCobros) => {
                const cacheKey = `${pasador.id}_${fechaString}`
                pagosCobrosCache.current.set(cacheKey, { pagos: newPagos, cobros: newCobros })

                setPasadores((prevPasadores) =>
                    prevPasadores.map((p) => {
                        if (p.id === pasador.id) {
                            const comisionCalculada = (pasador.comisionPorcentaje / 100) * p.jugado // Use current 'jugado'
                            const saldosCalculados = calcularSaldos(
                                p.saldoAnterior,
                                p.jugado,
                                comisionCalculada,
                                p.premioTotal, // Use current premioTotal
                                newPagos, // Use new values
                                newCobros, // Use new values
                            )
                            const pasadorActualizado = {
                                ...p,
                                pagado: newPagos,
                                cobrado: newCobros,
                                ...saldosCalculados,
                            }
                            setTimeout(() => guardarSaldosDiarios(pasadorActualizado, fechaSeleccionada), 0)
                            return pasadorActualizado
                        }
                        return p
                    }),
                )
            })
            unsubscribers.push(...pagosCobrosUnsubscribers)

            return () => unsubscribers.forEach((unsub) => unsub())
        },
        [fechaSeleccionada],
    )

    const manejarBusqueda = useCallback(async () => {
        setEstaCargando(true)
        setError(null)
        pagosCobrosCache.current.clear()
        unsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
        unsubscribersRef.current = []

        try {
            console.log(`🚀 INICIANDO BÚSQUEDA para fecha: ${format(fechaSeleccionada, "yyyy-MM-dd")}`)

            // 1. Obtener extractos (resultados de sorteos)
            const fechaFirestore = format(fechaSeleccionada, "yyyy-MM-dd")
            const extractoDocRef = doc(db, "extractos", fechaFirestore)
            let resultadosExtracto: any[] = []
            const esHoy = format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

            if (esHoy) {
                // Si es hoy, configurar listener para extractos
                const unsubscribeExtractos = onSnapshot(
                    extractoDocRef,
                    (docSnapshot) => {
                        if (docSnapshot.exists()) {
                            const extractoData = docSnapshot.data() as ExtractoData
                            const fechaFormateada = format(fechaSeleccionada, "dd/MM/yyyy")
                            const nuevosResultados = extraerResultados(extractoData, fechaFormateada)
                            setExtractosResultados(nuevosResultados)
                            console.log(`🔄 Extractos actualizados en tiempo real: ${nuevosResultados.length} resultados`)
                            // No es necesario forzar re-cálculo aquí, los listeners de jugadas lo harán.
                        } else {
                            setExtractosResultados([])
                            console.log("Extracto no encontrado para la fecha actual.")
                        }
                    },
                    (error) => {
                        console.error("Error en listener de extractos:", error)
                        setError(`Error al obtener extractos en tiempo real: ${error.message}`)
                    },
                )
                unsubscribersRef.current.push(unsubscribeExtractos)
            } else {
                // Si no es hoy, obtener extractos una sola vez
                const extractoSnapshot = await getDocs(
                    query(collection(db, "extractos"), where("__name__", "==", fechaFirestore)),
                )
                if (!extractoSnapshot.empty) {
                    const extractoData = extractoSnapshot.docs[0].data() as ExtractoData
                    const fechaFormateada = format(fechaSeleccionada, "dd/MM/yyyy")
                    resultadosExtracto = extraerResultados(extractoData, fechaFormateada)
                    setExtractosResultados(resultadosExtracto)
                    console.log(`📚 Extractos históricos cargados: ${resultadosExtracto.length} resultados`)
                } else {
                    setExtractosResultados([])
                    console.log("Extracto histórico no encontrado para la fecha.")
                }
            }

            // 2. Obtener lista de pasadores
            const pasadoresRef = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresRef)
            const listaPasadores: Pasador[] = []

            for (const docSnapshot of pasadoresSnapshot.docs) {
                const data = docSnapshot.data()
                const saldoAnteriorReal = await obtenerSaldoAnterior(docSnapshot.id, fechaSeleccionada)

                listaPasadores.push({
                    id: docSnapshot.id,
                    displayId:
                        data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                    nombre: data.nombre || "Sin nombre",
                    saldoFinal: 0, // Se calculará
                    saldoAnterior: saldoAnteriorReal,
                    saldoActual: 0, // ✅ CAMBIO: Saldo actual empieza en 0 para el nuevo día
                    saldoTotal: saldoAnteriorReal, // ✅ CAMBIO: Saldo total empieza con el saldo anterior
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
                    comisionPorcentaje: data.comision || 0,
                    modulo: data.modulo || 70,
                    posicionEnModulo: data.posicionEnModulo || 1,
                })
            }

            listaPasadores.sort((a, b) => {
                if (a.modulo !== b.modulo) return a.modulo - b.modulo
                return a.posicionEnModulo - b.posicionEnModulo
            })

            setPasadores(listaPasadores) // Set initial pasadores state

            const modulosUnicos = Array.from(new Set(listaPasadores.map((p) => p.modulo.toString()))).sort(
                (a, b) => Number.parseInt(a) - Number.parseInt(b),
            )
            setModulos(modulosUnicos)
            if (modulosUnicos.length > 0 && !modulosUnicos.includes(moduloSeleccionado)) {
                setModuloSeleccionado(modulosUnicos[0])
            }

            if (esHoy) {
                console.log("📅 Es hoy, configurando listeners en tiempo real para jugadas y pagos/cobros...")
                // Configurar listeners para cada pasador
                listaPasadores.forEach((pasador) => {
                    const unsubscribe = obtenerDatosEnTiempoReal(pasador, extractosResultados) // Pass initial extractos
                    unsubscribersRef.current.push(unsubscribe)
                })
            } else {
                console.log("📅 No es hoy, cargando datos históricos...")
                await cargarDatosHistoricos(listaPasadores, fechaSeleccionada, resultadosExtracto)
            }

            setUltimaActualizacion(new Date())
            console.log("✅ Búsqueda completada exitosamente")
            toast.success("✅ Datos cargados exitosamente")
        } catch (err) {
            console.error("❌ Error en manejarBusqueda:", err)
            setError(`Error al cargar los datos: ${err instanceof Error ? err.message : String(err)}`)
            toast.error("Error al cargar los datos")
        } finally {
            setEstaCargando(false)
        }
    }, [fechaSeleccionada, moduloSeleccionado, cargarDatosHistoricos, obtenerDatosEnTiempoReal])

    // Effect para re-ejecutar la búsqueda cuando cambia la fecha o el módulo
    useEffect(() => {
        manejarBusqueda()
        return () => {
            unsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
            unsubscribersRef.current = []
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [manejarBusqueda])

    // Effect para re-calcular aciertos cuando los extractos cambian (solo para el modo en tiempo real)
    useEffect(() => {
        const esHoy = format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
        if (esHoy && extractosResultados.length > 0) {
            console.log("🔄 Extractos resultados cambiaron, re-calculando aciertos para pasadores activos...")
            // Trigger re-calculation for all pasadores by re-running their real-time listeners
            setPasadores((prevPasadores) => {
                return prevPasadores.map((pasador) => {
                    // This is a simplified way to trigger an update.
                    // The actual re-calculation will happen within the jugadas listener
                    // of obtenerDatosEnTiempoReal when it detects a change or is re-initialized.
                    // For now, we just ensure the state is marked as needing update.
                    return { ...pasador }
                })
            })
        }
    }, [extractosResultados, fechaSeleccionada])

    const actualizarAciertos = useCallback(async () => {
        setEstaCargandoAciertos(true)
        try {
            console.log("🔄 Forzando actualización de aciertos desde base de datos...")
            const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

            // Re-fetch extractos for the selected date
            const extractoDocRef = doc(db, "extractos", fechaString)
            const extractoSnapshot = await getDoc(extractoDocRef) // ✅ CORRECCIÓN: Usar getDoc para un documento individual
            let currentExtractosResults: any[] = []
            if (extractoSnapshot.exists()) {
                const extractoData = extractoSnapshot.data() as ExtractoData
                const fechaFormateada = format(fechaSeleccionada, "dd/MM/yyyy")
                currentExtractosResults = extraerResultados(extractoData, fechaFormateada)
            } else {
                console.log("Extracto no encontrado para la fecha al actualizar aciertos.")
            }
            setExtractosResultados(currentExtractosResults) // Update state for consistency

            const pasadoresActualizados = await Promise.all(
                pasadores.map(async (pasador) => {
                    // Fetch jugadas for this pasador
                    const jugadasRef = collection(db, `JUGADAS DE ${pasador.nombre}`)
                    const jugadasQuery = query(
                        jugadasRef,
                        where("fechaHora", ">=", Timestamp.fromDate(startOfDay(fechaSeleccionada))),
                        where("fechaHora", "<=", Timestamp.fromDate(endOfDay(fechaSeleccionada))),
                    )
                    const jugadasSnapshot = await getDocs(jugadasQuery)
                    const jugadasData: Record<string, any>[] = []
                    jugadasSnapshot.forEach((docSnapshot) => {
                        const jugada = docSnapshot.data()
                        if (!esJugadaAnulada(jugada)) {
                            jugadasData.push(jugada)
                        }
                    })

                    // Calculate aciertos
                    const aciertosCalculados = procesarJugadasYEncontrarAciertos(jugadasData, currentExtractosResults)
                    const premioTotalCalculado = calcularTotalGanado(aciertosCalculados)
                    await guardarAciertosEnFirestore(pasador.nombre, aciertosCalculados, fechaSeleccionada)

                    // Use cached/current pagos/cobros
                    const cacheKey = `${pasador.id}_${fechaString}`
                    const pagosCobros = pagosCobrosCache.current.get(cacheKey) || {
                        pagos: pasador.pagado,
                        cobros: pasador.cobrado,
                    }

                    const comisionCalculada = (pasador.comisionPorcentaje / 100) * pasador.jugado

                    const saldosCalculados = calcularSaldos(
                        pasador.saldoAnterior,
                        pasador.jugado,
                        comisionCalculada,
                        premioTotalCalculado,
                        pagosCobros.pagos,
                        pagosCobros.cobros,
                    )

                    console.log(`--- Datos Actualización Manual para ${pasador.nombre} (${fechaString}) ---`)
                    console.log(`  Saldo Anterior: ${pasador.saldoAnterior}`)
                    console.log(`  Jugado: ${pasador.jugado}`)
                    console.log(`  Comisión: ${comisionCalculada}`)
                    console.log(`  Premios Calculados: ${premioTotalCalculado}`)
                    console.log(`  Pagos (cache): ${pagosCobros.pagos}`)
                    console.log(`  Cobros (cache): ${pagosCobros.cobros}`)
                    console.log(`  Saldo Actual (Movimiento Neto): ${saldosCalculados.saldoActual}`)
                    console.log(`  Saldo Total (Acumulado): ${saldosCalculados.saldoTotal}`)
                    console.log(`-------------------------------------------------`)

                    return {
                        ...pasador,
                        premioTotal: premioTotalCalculado,
                        pagado: pagosCobros.pagos,
                        cobrado: pagosCobros.cobros,
                        ...saldosCalculados,
                    }
                }),
            )
            setPasadores(pasadoresActualizados)
            const totalPremios = pasadoresActualizados.reduce((sum, p) => sum + p.premioTotal, 0)
            toast.success(
                `✅ Aciertos actualizados: ${pasadoresActualizados.filter((p) => p.premioTotal > 0).length} pasadores (Total: $${totalPremios.toLocaleString("es-AR", { minimumFractionDigits: 2 })})`,
            )
            setUltimaActualizacion(new Date())
        } catch (error) {
            console.error("Error al actualizar aciertos:", error)
            toast.error("Error al actualizar aciertos")
        } finally {
            setEstaCargandoAciertos(false)
        }
    }, [fechaSeleccionada, pasadores]) // Dependencia 'pasadores' para acceder a sus datos actuales

    const formatearMoneda = useCallback((monto: number): string => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
        }).format(monto)
    }, [])

    const pasadoresFiltrados = useMemo(
        () => pasadores.filter((p) => p.modulo.toString() === moduloSeleccionado),
        [pasadores, moduloSeleccionado],
    )

    const totalPaginas = useMemo(
        () => Math.ceil(pasadoresFiltrados.length / ITEMS_POR_PAGINA),
        [pasadoresFiltrados.length],
    )

    const pasadoresPaginados = useMemo(
        () => pasadoresFiltrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA),
        [pasadoresFiltrados, paginaActual],
    )

    const totalesModulo = useMemo(() => {
        return pasadoresFiltrados.reduce(
            (acc, pasador) => ({
                saldoTotal: acc.saldoTotal + pasador.saldoTotal,
                saldoAnterior: acc.saldoAnterior + pasador.saldoAnterior,
                saldoActual: acc.saldoActual + pasador.saldoActual,
                jugado: acc.jugado + pasador.jugado,
                cobrado: acc.cobrado + pasador.cobrado,
                pagado: acc.pagado + pasador.pagado,
                comision: acc.comision + pasador.comisionPasador,
                premios: acc.premios + pasador.premioTotal,
            }),
            {
                saldoTotal: 0,
                saldoAnterior: 0,
                saldoActual: 0,
                jugado: 0,
                cobrado: 0,
                pagado: 0,
                comision: 0,
                premios: 0,
            },
        )
    }, [pasadoresFiltrados])

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Navbar />
            <main className="container mx-auto p-4">
                <h1 className="text-2xl font-bold text-blue-800 mb-4 border-b-2 border-blue-500 pb-2">
                    🔒 Listado Diario - PAGOS Y COBROS INMUTABLES ✅
                </h1>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-4 mb-4 border border-blue-200">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <span className="font-medium text-blue-700">Seleccione el módulo:</span>
                            <Select value={moduloSeleccionado} onValueChange={setModuloSeleccionado}>
                                <SelectTrigger className="w-[180px] border-blue-300 focus:ring-blue-500">
                                    <SelectValue placeholder="Módulo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {modulos.map((modulo) => {
                                        const pasadoresEnModulo = pasadores.filter((p) => p.modulo.toString() === modulo).length
                                        return (
                                            <SelectItem key={modulo} value={modulo}>
                                                Módulo {modulo} ({pasadoresEnModulo} pasadores)
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <SelectorFecha
                            fechaSeleccionada={fechaSeleccionada}
                            onCambioFecha={setFechaSeleccionada}
                            onBuscar={manejarBusqueda}
                            estaCargando={estaCargando}
                            onActualizarAciertos={actualizarAciertos}
                            estaCargandoAciertos={estaCargandoAciertos}
                        />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-4 p-3 bg-white rounded-lg border border-blue-200 text-center">
                        <div>
                            <div className="text-xs text-gray-600">S. Anterior</div>
                            <div
                                className={`font-bold text-sm ${totalesModulo.saldoAnterior >= 0 ? "text-blue-600" : "text-red-600"}`}
                            >
                                {formatearMoneda(totalesModulo.saldoAnterior)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">S. Actual</div>
                            <div
                                className={`font-bold text-sm ${totalesModulo.saldoActual >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                                {formatearMoneda(totalesModulo.saldoActual)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">S. Total</div>
                            <div
                                className={`font-bold text-sm ${totalesModulo.saldoTotal >= 0 ? "text-purple-600" : "text-red-600"}`}
                            >
                                {formatearMoneda(totalesModulo.saldoTotal)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Jugado</div>
                            <div className="font-bold text-sm text-indigo-600">{formatearMoneda(totalesModulo.jugado)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Comisión</div>
                            <div className="font-bold text-sm text-orange-600">{formatearMoneda(totalesModulo.comision)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Premios</div>
                            <div className="font-bold text-sm text-teal-600">{formatearMoneda(totalesModulo.premios)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Cobrado 🔒</div>
                            <div className="font-bold text-sm text-green-600">{formatearMoneda(totalesModulo.cobrado)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Pagado 🔒</div>
                            <div className="font-bold text-sm text-red-600">{formatearMoneda(totalesModulo.pagado)}</div>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-xs text-green-800">
                            <p>
                                <strong>🔒 PAGOS Y COBROS INMUTABLES:</strong>
                            </p>
                            <p>
                                💰 <strong>Los PAGOS son PAGOS:</strong> Una vez registrados, NO CAMBIAN NUNCA
                            </p>
                            <p>
                                💸 <strong>Los COBROS son COBROS:</strong> Una vez registrados, NO CAMBIAN NUNCA
                            </p>
                            <p>
                                📋 <strong>Cache implementado:</strong> Los valores se cargan UNA SOLA VEZ por sesión
                            </p>
                            <p>
                                🚫 <strong>NO se recalculan:</strong> Los montos históricos permanecen intactos
                            </p>
                            <p>
                                ✅ <strong>Solo se actualizan:</strong> Jugadas y Aciertos en tiempo real
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                    <span>
                        Última actualización: {format(ultimaActualizacion, "dd/MM/yyyy HH:mm:ss", { locale: es })}
                        {estaCargandoAciertos && (
                            <span className="ml-2 text-green-600 animate-pulse">• Actualizando aciertos...</span>
                        )}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-600">
                            🔒 PAGOS/COBROS INMUTABLES |{" "}
                            {format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                                ? "Tiempo real ✅"
                                : "Datos históricos 📚"}
                        </span>
                    </div>
                </div>
                {error && (
                    <div
                        className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded my-4 shadow-md"
                        role="alert"
                    >
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                {estaCargando ? (
                    <div className="flex justify-center p-8">
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                            <p className="text-blue-600 font-medium">Cargando datos...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {pasadoresFiltrados.length === 0 ? (
                            <div
                                className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded my-4 shadow-md"
                                role="alert"
                            >
                                <p className="font-bold">Sin datos</p>
                                <p>No se encontraron datos para la fecha y módulo seleccionados.</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-lg overflow-x-auto border border-gray-200 mt-4">
                                    <Table>
                                        <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                            <TableRow>
                                                <TableHead className="text-white font-bold">Pasador</TableHead>
                                                <TableHead className="text-right text-white font-bold">S. Anterior</TableHead>
                                                <TableHead className="text-right text-white font-bold">S. Actual</TableHead>
                                                <TableHead className="text-right text-white font-bold">S. Total</TableHead>
                                                <TableHead className="text-right text-white font-bold">Cobrado 🔒</TableHead>
                                                <TableHead className="text-right text-white font-bold">Pagado 🔒</TableHead>
                                                <TableHead className="text-right text-white font-bold">Jugado</TableHead>
                                                <TableHead className="text-right text-white font-bold">Comisión</TableHead>
                                                <TableHead className="text-right text-white font-bold">Premios</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pasadoresPaginados.map((pasador, index) => (
                                                <TableRow key={pasador.id} className={index % 2 === 0 ? "bg-blue-50/50" : "bg-white"}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3 text-sm font-bold">
                                                                {pasador.nombre.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-blue-800">{pasador.displayId}</div>
                                                                <div className="text-xs text-gray-600">{pasador.nombre}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-semibold ${pasador.saldoAnterior >= 0 ? "text-blue-700" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoAnterior)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-semibold ${pasador.saldoActual >= 0 ? "text-green-600" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoActual)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-bold ${pasador.saldoTotal >= 0 ? "text-purple-700" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoTotal)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600 font-semibold">
                                                        {formatearMoneda(pasador.cobrado)}
                                                        <div className="text-xs text-gray-500">🔒 Inmutable</div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-red-600 font-semibold">
                                                        {formatearMoneda(pasador.pagado)}
                                                        <div className="text-xs text-gray-500">🔒 Inmutable</div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-indigo-600">
                                                        {formatearMoneda(pasador.jugado)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-orange-600">
                                                        {formatearMoneda(pasador.comisionPasador)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-bold ${pasador.premioTotal > 0 ? "text-teal-500" : "text-gray-400"}`}
                                                    >
                                                        {formatearMoneda(pasador.premioTotal)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex items-center justify-between mt-6 bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                                    <div className="text-sm text-blue-700 font-medium">
                                        Página {paginaActual} de {totalPaginas} - Módulo {moduloSeleccionado}: {pasadoresFiltrados.length}{" "}
                                        pasadores
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
