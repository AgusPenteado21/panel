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
import { collection, getDocs, doc, query, where, onSnapshot, setDoc } from "firebase/firestore"
import toast from "react-hot-toast"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    saldoFinal: number
    saldoAnterior: number
    saldoActual: number
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
    modulo: number
    posicionEnModulo: number
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

// Función para obtener aciertos desde la base de datos
const obtenerAciertosDesdeDB = async (fechaSeleccionada: Date): Promise<Record<string, number>> => {
    try {
        console.log("🔄 Obteniendo aciertos desde la base de datos...")
        const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")
        const aciertosRef = collection(db, "aciertos")
        const aciertosSnapshot = await getDocs(aciertosRef)
        const aciertosData: Record<string, number> = {}

        aciertosSnapshot.forEach((doc) => {
            const data = doc.data()
            if (data[fechaString]) {
                const pasadorNombre = data[fechaString].aciertos?.[0]?.pasador || ""
                const totalGanado = data[fechaString].totalGanado || 0
                if (pasadorNombre && totalGanado > 0) {
                    console.log(`💰 Aciertos encontrados para ${pasadorNombre} en ${fechaString}: $${totalGanado}`)
                    aciertosData[pasadorNombre.toLowerCase()] = totalGanado
                }
            }
        })

        console.log(`✅ Aciertos obtenidos para ${fechaString}: ${Object.keys(aciertosData).length} pasadores con premios`)
        return aciertosData
    } catch (error) {
        console.error("❌ Error al obtener aciertos desde DB:", error)
        return {}
    }
}

// Función para obtener saldo anterior
const obtenerSaldoAnterior = async (pasadorId: string, fechaSeleccionada: Date): Promise<number> => {
    try {
        const fechaAnterior = new Date(fechaSeleccionada)
        fechaAnterior.setDate(fechaAnterior.getDate() - 1)
        const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd")

        console.log(`🔍 DEBUGGING SÚPER DETALLADO - Pasador: ${pasadorId}`)
        console.log(`📅 Fecha actual: ${format(fechaSeleccionada, "yyyy-MM-dd")}`)
        console.log(`📅 Fecha anterior buscada: ${fechaAnteriorStr}`)

        const saldosDiariosRef = collection(db, "saldos_diarios")

        // ✅ PASO 1: Buscar documento específico del día anterior
        const q = query(saldosDiariosRef, where("pasador_id", "==", pasadorId), where("fecha", "==", fechaAnteriorStr))
        const saldosDiariosSnapshot = await getDocs(q)

        if (!saldosDiariosSnapshot.empty) {
            const doc = saldosDiariosSnapshot.docs[0]
            const data = doc.data()

            console.log(`✅ DOCUMENTO ENCONTRADO para ${pasadorId} en ${fechaAnteriorStr}:`)
            console.log(`   - DocID: ${doc.id}`)
            console.log(`   - saldo_total: ${data.saldo_total}`)
            console.log(`   - saldo_final: ${data.saldo_final}`)
            console.log(`   - saldo_anterior: ${data.saldo_anterior}`)
            console.log(`   - saldo_actual: ${data.saldo_actual}`)
            console.log(`   - timestamp: ${data.timestamp}`)

            // Usar saldo_total primero, luego saldo_final
            let saldoAnterior = 0
            if (typeof data.saldo_total === "number") {
                saldoAnterior = data.saldo_total
                console.log(`✅ Usando saldo_total: ${saldoAnterior}`)
            } else if (typeof data.saldo_final === "number") {
                saldoAnterior = data.saldo_final
                console.log(`⚠️ Usando saldo_final: ${saldoAnterior}`)
            } else {
                console.log(`❌ No hay saldo_total ni saldo_final válidos`)
            }

            return saldoAnterior
        } else {
            console.log(`❌ NO SE ENCONTRÓ documento para ${pasadorId} en ${fechaAnteriorStr}`)

            // ✅ PASO 2: Buscar TODOS los documentos de este pasador para ver qué fechas tiene
            console.log(`🔍 Buscando TODOS los registros históricos para ${pasadorId}...`)
            const qTodos = query(saldosDiariosRef, where("pasador_id", "==", pasadorId))
            const todosSnapshot = await getDocs(qTodos)

            if (todosSnapshot.empty) {
                console.log(`❌ NO HAY REGISTROS HISTÓRICOS para ${pasadorId}`)
                return 0
            }

            console.log(`📋 REGISTROS ENCONTRADOS para ${pasadorId}:`)
            const registros: any[] = []
            todosSnapshot.forEach((doc) => {
                const data = doc.data()
                registros.push({
                    fecha: data.fecha,
                    saldo_total: data.saldo_total,
                    saldo_final: data.saldo_final,
                    timestamp: data.timestamp,
                    docId: doc.id,
                })
                console.log(`   - Fecha: ${data.fecha}, saldo_total: ${data.saldo_total}, saldo_final: ${data.saldo_final}`)
            })

            // ✅ PASO 3: Buscar el registro más reciente anterior a la fecha seleccionada
            const registrosAnteriores = registros
                .filter((r) => r.fecha < fechaAnteriorStr)
                .sort((a, b) => b.fecha.localeCompare(a.fecha)) // Ordenar por fecha descendente

            if (registrosAnteriores.length > 0) {
                const ultimoRegistro = registrosAnteriores[0]
                console.log(`✅ USANDO ÚLTIMO REGISTRO ANTERIOR: ${ultimoRegistro.fecha}`)
                console.log(`   - saldo_total: ${ultimoRegistro.saldo_total}`)
                console.log(`   - saldo_final: ${ultimoRegistro.saldo_final}`)
                return ultimoRegistro.saldo_total || ultimoRegistro.saldo_final || 0
            } else {
                console.log(`❌ NO HAY REGISTROS ANTERIORES a ${fechaAnteriorStr}`)
                return 0
            }
        }
    } catch (error) {
        console.error(`❌ Error al obtener saldo anterior para ${pasadorId}:`, error)
        return 0
    }
}

// ✅ FUNCIÓN PARA CREAR REGISTROS FALTANTES
const crearRegistrosFaltantes = async (pasadores: Pasador[], fecha: Date): Promise<void> => {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        console.log(`🔧 CREANDO REGISTROS FALTANTES para ${fechaStr}`)

        for (const pasador of pasadores) {
            if (pasador.saldoTotal !== 0 || pasador.jugado !== 0 || pasador.pagado !== 0 || pasador.cobrado !== 0) {
                const docId = `${pasador.id}_${fechaStr}`
                console.log(`💾 Creando registro para ${pasador.nombre}: saldo_total = ${pasador.saldoTotal}`)

                await setDoc(
                    doc(db, "saldos_diarios", docId),
                    {
                        pasador_id: pasador.id,
                        pasador_nombre: pasador.nombre,
                        fecha: fechaStr,
                        timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                        saldo_anterior: pasador.saldoAnterior,
                        saldo_actual: pasador.saldoActual,
                        saldo_final: pasador.saldoTotal,
                        saldo_total: pasador.saldoTotal, // ✅ CRÍTICO: Este es el valor que se debe leer mañana
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
            }
        }

        console.log(`✅ Registros faltantes creados para ${fechaStr}`)
    } catch (error) {
        console.error(`❌ Error al crear registros faltantes:`, error)
    }
}

// ✅ FUNCIÓN CALCULAR SALDOS - CORREGIDA DEFINITIVAMENTE
const calcularSaldos = (
    saldoAnteriorOriginal: number,
    jugado: number,
    comision: number,
    premios: number,
    pagos: number,
    cobros: number,
) => {
    console.log(`🚨 FUNCIÓN calcularSaldos - DEBUGGING CRÍTICO:`)
    console.log(`🔒 saldoAnteriorOriginal: ${saldoAnteriorOriginal}`)
    console.log(`📈 jugado: ${jugado}`)
    console.log(`💼 comision: ${comision}`)
    console.log(`🎯 premios: ${premios}`)
    console.log(`💰 pagos: ${pagos}`)
    console.log(`💸 cobros: ${cobros}`)

    // ✅ PASO 1: El saldo anterior se mantiene tal como está
    const saldoAnteriorFinal = saldoAnteriorOriginal

    // ✅ PASO 2: El saldo actual SOLO incluye operaciones del día (SIN pagos ni cobros)
    const saldoActualDelDia = jugado - comision - premios

    // ✅ PASO 3: El saldo total incluye TODO: anterior + actual + pagos - cobros
    const saldoTotalFinal = saldoAnteriorFinal + saldoActualDelDia + pagos - cobros

    console.log(`🧮 CÁLCULOS PASO A PASO:`)
    console.log(`   Saldo Actual = ${jugado} - ${comision} - ${premios} = ${saldoActualDelDia}`)
    console.log(
        `   Saldo Total = ${saldoAnteriorFinal} + ${saldoActualDelDia} + ${pagos} - ${cobros} = ${saldoTotalFinal}`,
    )

    // ✅ VERIFICACIÓN CRÍTICA PARA HERNAN
    if (jugado === 146700 && comision === 44010 && premios === 0) {
        console.log(`🚨 CASO HERNAN DETECTADO:`)
        console.log(`   Saldo Anterior: ${saldoAnteriorOriginal}`)
        console.log(`   Jugado: ${jugado}`)
        console.log(`   Comisión: ${comision}`)
        console.log(`   Premios: ${premios}`)
        console.log(`   Pagos: ${pagos}`)
        console.log(`   Cobros: ${cobros}`)
        console.log(`   `)
        console.log(`   FÓRMULA COMPLETA:`)
        console.log(`   Saldo Actual = ${jugado} - ${comision} - ${premios} = ${saldoActualDelDia}`)
        console.log(`   Saldo Total = ${saldoAnteriorOriginal} + ${saldoActualDelDia} + ${pagos} - ${cobros}`)
        console.log(
            `   Saldo Total = ${saldoAnteriorOriginal} + ${saldoActualDelDia} + ${pagos} - ${cobros} = ${saldoTotalFinal}`,
        )
        console.log(`   `)
        console.log(`   RESULTADO ESPERADO:`)
        console.log(`   - Saldo Actual: ${saldoActualDelDia} (debería ser 102,690)`)
        console.log(
            `   - Saldo Total: ${saldoTotalFinal} (debería ser ${saldoAnteriorOriginal} + 102,690 + ${pagos} - ${cobros})`,
        )
    }

    return {
        saldoAnterior: saldoAnteriorFinal,
        saldoActual: saldoActualDelDia,
        saldoTotal: saldoTotalFinal,
        saldoFinal: saldoTotalFinal,
    }
}

// Función para guardar los saldos diarios en Firestore
const guardarSaldosDiarios = async (pasador: Pasador, fecha: Date): Promise<boolean> => {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        const docId = `${pasador.id}_${fechaStr}`

        console.log(`💾 GUARDANDO SALDOS para ${pasador.nombre}:`)
        console.log(`🔒 Saldo anterior: ${pasador.saldoAnterior}`)
        console.log(`📊 Saldo actual: ${pasador.saldoActual}`)
        console.log(`💯 Saldo final: ${pasador.saldoFinal}`)

        await setDoc(
            doc(db, "saldos_diarios", docId),
            {
                pasador_id: pasador.id,
                pasador_nombre: pasador.nombre,
                fecha: fechaStr,
                timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                saldo_anterior: pasador.saldoAnterior,
                saldo_actual: pasador.saldoActual,
                saldo_final: pasador.saldoFinal,
                saldo_total: pasador.saldoTotal,
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
        console.error(`❌ Error al guardar saldos diarios para ${pasador.nombre}:`, error)
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

    // Función para cargar datos históricos para fechas pasadas
    const cargarDatosHistoricos = useCallback(async (pasadoresList: Pasador[], fecha: Date) => {
        try {
            const fechaString = format(fecha, "yyyy-MM-dd")
            console.log(`📚 Cargando datos históricos para ${fechaString}`)

            const pasadoresActualizados = await Promise.all(
                pasadoresList.map(async (pasador) => {
                    const jugadasRef = collection(db, `JUGADAS DE ${pasador.nombre}`)
                    const jugadasQuery = query(
                        jugadasRef,
                        where("fechaHora", ">=", startOfDay(fecha)),
                        where("fechaHora", "<=", endOfDay(fecha)),
                    )
                    const jugadasSnapshot = await getDocs(jugadasQuery)

                    let ventasOnlineAcumuladas = 0
                    jugadasSnapshot.forEach((docSnapshot) => {
                        const jugada = docSnapshot.data()
                        if (jugada.anulada !== true) {
                            ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
                        }
                    })

                    const pagosRef = collection(db, "pagos")
                    const cobrosRef = collection(db, "cobros")
                    const pagosQuery = query(pagosRef, where("pasadorId", "==", pasador.id), where("fecha", "==", fechaString))
                    const cobrosQuery = query(cobrosRef, where("pasadorId", "==", pasador.id), where("fecha", "==", fechaString))

                    const [pagosSnapshot, cobrosSnapshot] = await Promise.all([getDocs(pagosQuery), getDocs(cobrosQuery)])

                    let totalPagos = 0
                    let totalCobros = 0

                    pagosSnapshot.forEach((docSnapshot) => {
                        const pagoData = docSnapshot.data()
                        totalPagos += Math.abs(pagoData.monto || 0)
                    })

                    cobrosSnapshot.forEach((docSnapshot) => {
                        const cobroData = docSnapshot.data()
                        totalCobros += Math.abs(cobroData.monto || 0)
                    })

                    const comisionCalculada = (pasador.comisionPorcentaje / 100) * ventasOnlineAcumuladas

                    const saldosCalculados = calcularSaldos(
                        pasador.saldoAnterior,
                        ventasOnlineAcumuladas,
                        comisionCalculada,
                        pasador.premioTotal,
                        totalPagos,
                        totalCobros,
                    )

                    return {
                        ...pasador,
                        jugado: ventasOnlineAcumuladas,
                        pagado: totalPagos,
                        cobrado: totalCobros,
                        comisionPasador: comisionCalculada,
                        ...saldosCalculados,
                    }
                }),
            )

            setPasadores(pasadoresActualizados)
            await crearRegistrosFaltantes(pasadoresActualizados, fecha)
            console.log("✅ Datos históricos cargados completamente")
        } catch (error) {
            console.error("❌ Error al cargar datos históricos:", error)
        }
    }, [])

    const configurarListenerAciertos = useCallback(() => {
        const aciertosRef = collection(db, "aciertos")
        const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

        const unsubscribeAciertos = onSnapshot(aciertosRef, (aciertosSnapshot) => {
            console.log("🔄 Detectado cambio en aciertos, actualizando...")
            try {
                const aciertosData: Record<string, number> = {}
                aciertosSnapshot.forEach((doc) => {
                    const data = doc.data()
                    if (data[fechaString]) {
                        const pasadorNombre = data[fechaString].aciertos?.[0]?.pasador || ""
                        const totalGanado = data[fechaString].totalGanado || 0
                        if (pasadorNombre && totalGanado > 0) {
                            aciertosData[pasadorNombre.toLowerCase()] = totalGanado
                        }
                    }
                })

                setPasadores((prevPasadores) =>
                    prevPasadores.map((pasador) => {
                        const nuevosAciertos = aciertosData[pasador.nombre.toLowerCase()] || 0
                        const saldoAnteriorOriginal = pasador.saldoAnterior

                        const saldosCalculados = calcularSaldos(
                            saldoAnteriorOriginal,
                            pasador.jugado,
                            pasador.comisionPasador,
                            nuevosAciertos,
                            pasador.pagado,
                            pasador.cobrado,
                        )

                        return {
                            ...pasador,
                            premioTotal: nuevosAciertos,
                            ...saldosCalculados,
                        }
                    }),
                )

                setUltimaActualizacion(new Date())
            } catch (error) {
                console.error("❌ Error al actualizar aciertos en tiempo real:", error)
            }
        })

        return unsubscribeAciertos
    }, [fechaSeleccionada])

    const obtenerDatosEnTiempoReal = useCallback(
        (pasador: Pasador) => {
            const jugadasRef = collection(db, `JUGADAS DE ${pasador.nombre}`)
            const pagosRef = collection(db, "pagos")
            const cobrosRef = collection(db, "cobros")
            const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

            const jugadasQuery = query(
                jugadasRef,
                where("fechaHora", ">=", startOfDay(fechaSeleccionada)),
                where("fechaHora", "<=", endOfDay(fechaSeleccionada)),
            )

            const pagosQuery = query(pagosRef, where("pasadorId", "==", pasador.id), where("fecha", "==", fechaString))
            const cobrosQuery = query(cobrosRef, where("pasadorId", "==", pasador.id), where("fecha", "==", fechaString))

            const unsubscribeJugadas = onSnapshot(jugadasQuery, async (jugadasSnapshot) => {
                let ventasOnlineAcumuladas = 0
                jugadasSnapshot.forEach((docSnapshot) => {
                    const jugada = docSnapshot.data()
                    if (jugada.anulada !== true) {
                        ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
                    }
                })

                try {
                    const [pagosSnapshot, cobrosSnapshot] = await Promise.all([getDocs(pagosQuery), getDocs(cobrosQuery)])

                    let totalPagos = 0
                    let totalCobros = 0

                    pagosSnapshot.forEach((docSnapshot) => {
                        const pagoData = docSnapshot.data()
                        totalPagos += Math.abs(pagoData.monto || 0)
                    })

                    cobrosSnapshot.forEach((docSnapshot) => {
                        const cobroData = docSnapshot.data()
                        totalCobros += Math.abs(cobroData.monto || 0)
                    })

                    const comisionCalculada = (pasador.comisionPorcentaje / 100) * ventasOnlineAcumuladas
                    const saldoAnteriorOriginal = pasador.saldoAnterior

                    const saldosCalculados = calcularSaldos(
                        saldoAnteriorOriginal,
                        ventasOnlineAcumuladas,
                        comisionCalculada,
                        pasador.premioTotal,
                        totalPagos,
                        totalCobros,
                    )

                    setPasadores((prevPasadores) =>
                        prevPasadores.map((p) => {
                            if (p.id === pasador.id) {
                                const pasadorActualizado = {
                                    ...p,
                                    jugado: ventasOnlineAcumuladas,
                                    pagado: totalPagos,
                                    cobrado: totalCobros,
                                    comisionPasador: comisionCalculada,
                                    ...saldosCalculados,
                                }

                                setTimeout(() => guardarSaldosDiarios(pasadorActualizado, fechaSeleccionada), 0)
                                return pasadorActualizado
                            }
                            return p
                        }),
                    )
                } catch (error) {
                    console.error(`Error al obtener pagos/cobros para ${pasador.nombre}:`, error)
                }
            })

            return () => unsubscribeJugadas()
        },
        [fechaSeleccionada],
    )

    const manejarBusqueda = useCallback(async () => {
        setEstaCargando(true)
        setError(null)
        unsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
        unsubscribersRef.current = []

        try {
            console.log(`🚀 INICIANDO BÚSQUEDA para fecha: ${format(fechaSeleccionada, "yyyy-MM-dd")}`)
            const pasadoresRef = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresRef)
            const listaPasadores: Pasador[] = []

            for (const docSnapshot of pasadoresSnapshot.docs) {
                const data = docSnapshot.data()
                // ✅ CRÍTICO: Obtener el saldo anterior REAL
                const saldoAnteriorReal = await obtenerSaldoAnterior(docSnapshot.id, fechaSeleccionada)
                console.log(`🔍 PASADOR ${data.nombre || docSnapshot.id}: Saldo anterior = ${saldoAnteriorReal}`)

                listaPasadores.push({
                    id: docSnapshot.id,
                    displayId:
                        data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                    nombre: data.nombre || "Sin nombre",
                    saldoFinal: 0,
                    saldoAnterior: saldoAnteriorReal,
                    saldoActual: 0,
                    saldoTotal: saldoAnteriorReal,
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

            console.log(`✅ ${listaPasadores.length} pasadores cargados`)

            const aciertosData = await obtenerAciertosDesdeDB(fechaSeleccionada)
            const pasadoresFinales = listaPasadores.map((pasador) => {
                const premioTotal = aciertosData[pasador.nombre.toLowerCase()] || 0
                return {
                    ...pasador,
                    premioTotal: premioTotal,
                }
            })

            setPasadores(pasadoresFinales)

            const modulosUnicos = Array.from(new Set(pasadoresFinales.map((p) => p.modulo.toString()))).sort(
                (a, b) => Number.parseInt(a) - Number.parseInt(b),
            )
            setModulos(modulosUnicos)

            if (modulosUnicos.length > 0 && !modulosUnicos.includes(moduloSeleccionado)) {
                setModuloSeleccionado(modulosUnicos[0])
            }

            const esHoy = format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

            if (esHoy) {
                console.log("📅 Es hoy, configurando listeners en tiempo real...")
                pasadoresFinales.forEach((pasador) => {
                    const unsubscribe = obtenerDatosEnTiempoReal(pasador)
                    unsubscribersRef.current.push(unsubscribe)
                })

                const unsubscribeAciertos = configurarListenerAciertos()
                unsubscribersRef.current.push(unsubscribeAciertos)
            } else {
                console.log("📅 No es hoy, cargando datos históricos...")
                await cargarDatosHistoricos(pasadoresFinales, fechaSeleccionada)
            }

            setUltimaActualizacion(new Date())
            console.log("✅ Búsqueda completada exitosamente")

            const totalAciertos = Object.keys(aciertosData).length
            const totalPremios = Object.values(aciertosData).reduce((sum: number, premio: number) => sum + premio, 0)

            if (totalAciertos > 0) {
                toast.success(`✅ ${totalAciertos} pasadores con aciertos (Total: $${totalPremios.toLocaleString()})`)
            }
        } catch (err) {
            console.error("❌ Error en manejarBusqueda:", err)
            setError(`Error al cargar los datos: ${err instanceof Error ? err.message : String(err)}`)
            toast.error("Error al cargar los datos")
        } finally {
            setEstaCargando(false)
        }
    }, [
        fechaSeleccionada,
        moduloSeleccionado,
        cargarDatosHistoricos,
        configurarListenerAciertos,
        obtenerDatosEnTiempoReal,
    ])

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

    const actualizarAciertos = useCallback(async () => {
        setEstaCargandoAciertos(true)
        try {
            console.log("🔄 Actualizando aciertos desde base de datos...")
            const aciertosData = await obtenerAciertosDesdeDB(fechaSeleccionada)

            setPasadores((prevPasadores) =>
                prevPasadores.map((pasador) => {
                    const nuevosPremios = aciertosData[pasador.nombre.toLowerCase()] || 0
                    const saldoAnteriorOriginal = pasador.saldoAnterior

                    const saldosCalculados = calcularSaldos(
                        saldoAnteriorOriginal,
                        pasador.jugado,
                        pasador.comisionPasador,
                        nuevosPremios,
                        pasador.pagado,
                        pasador.cobrado,
                    )

                    return {
                        ...pasador,
                        premioTotal: nuevosPremios,
                        ...saldosCalculados,
                    }
                }),
            )

            const totalAciertos = Object.keys(aciertosData).length
            const totalPremios = Object.values(aciertosData).reduce((sum: number, premio: number) => sum + premio, 0)

            if (totalAciertos > 0) {
                toast.success(`✅ Aciertos actualizados: ${totalAciertos} pasadores (Total: $${totalPremios.toLocaleString()})`)
            } else {
                toast("ℹ️ No se encontraron aciertos para la fecha seleccionada")
            }

            setUltimaActualizacion(new Date())
        } catch (error) {
            console.error("Error al actualizar aciertos:", error)
            toast.error("Error al actualizar aciertos")
        } finally {
            setEstaCargandoAciertos(false)
        }
    }, [fechaSeleccionada])

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
                    Listado Diario - SALDO ACTUAL CORREGIDO ✅
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
                            <div className="text-xs text-gray-600">S. Actual ✅</div>
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
                            <div className="text-xs text-gray-600">Cobrado</div>
                            <div className="font-bold text-sm text-green-600">{formatearMoneda(totalesModulo.cobrado)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-600">Pagado</div>
                            <div className="font-bold text-sm text-red-600">{formatearMoneda(totalesModulo.pagado)}</div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-xs text-green-800">
                            <strong>✅ LÓGICA CORREGIDA:</strong>
                            <br />🔒 <strong>Saldo Anterior:</strong> Se mantiene sin cambios del día anterior
                            <br />📊 <strong>Saldo Actual:</strong> SOLO operaciones del día (Jugado - Comisión - Premios)
                            <br />💯 <strong>Saldo Total:</strong> Anterior + Actual + Pagos - Cobros
                            <br />
                            ⚠️ <strong>Los pagos y cobros NO afectan el saldo actual, solo el saldo total</strong>
                            <br />💰 <strong>Pagos se SUMAN</strong> (dinero que entra) | 💸 <strong>Cobros se RESTAN</strong> (dinero
                            que sale)
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
                            {format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                                ? "Tiempo real ✅ | SALDO ACTUAL CORREGIDO ✅"
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
                                                <TableHead className="text-right text-white font-bold">S. Actual ✅</TableHead>
                                                <TableHead className="text-right text-white font-bold">S. Total</TableHead>
                                                <TableHead className="text-right text-white font-bold">Cobrado</TableHead>
                                                <TableHead className="text-right text-white font-bold">Pagado</TableHead>
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
                                                        <div className="text-xs text-gray-500">Solo operaciones del día</div>
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-bold ${pasador.saldoTotal >= 0 ? "text-purple-700" : "text-red-600"}`}
                                                    >
                                                        {formatearMoneda(pasador.saldoTotal)}
                                                        <div className="text-xs text-gray-500">Incluye pagos/cobros</div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600 font-semibold">
                                                        {formatearMoneda(pasador.cobrado)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-red-600 font-semibold">
                                                        {formatearMoneda(pasador.pagado)}
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
