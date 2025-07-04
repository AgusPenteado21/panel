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

// 🔧 FUNCIÓN CORREGIDA: Obtener aciertos desde la base de datos
const obtenerAciertosDesdeDB = async (fechaSeleccionada: Date): Promise<Record<string, number>> => {
    try {
        console.log("🔄 Obteniendo aciertos desde la base de datos...")
        const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

        // Obtener todos los documentos de la colección aciertos
        const aciertosRef = collection(db, "aciertos")
        const aciertosSnapshot = await getDocs(aciertosRef)
        const aciertosData: Record<string, number> = {}

        // Procesar cada documento de aciertos (cada documento es un pasador)
        aciertosSnapshot.forEach((doc) => {
            const data = doc.data()

            // 🔧 VERIFICAR ESPECÍFICAMENTE LA FECHA SELECCIONADA
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

// 🔧 FUNCIÓN CORREGIDA: Verificar si es un nuevo día sin actividad
const esNuevoDiaSinActividad = (
    fechaSeleccionada: Date,
    ventasOnline: number,
    totalPagos: number,
    totalCobros: number,
    totalGanado: number,
): boolean => {
    const ahora = new Date()
    const esHoy = format(fechaSeleccionada, "yyyy-MM-dd") === format(ahora, "yyyy-MM-dd")

    // 🔧 SI NO ES HOY, NUNCA ES "NUEVO DÍA"
    if (!esHoy) {
        console.log(
            `📅 Fecha seleccionada ${format(fechaSeleccionada, "yyyy-MM-dd")} no es hoy, no aplicar lógica de nuevo día`,
        )
        return false
    }

    console.log("📅 Es hoy, verificando si es nuevo día sin actividad...")

    // Verificar si es muy temprano en el día (antes de las 6 AM)
    const horaActual = ahora.getHours()
    if (horaActual < 6) {
        console.log(`🌅 Es muy temprano (${horaActual}h), considerando como nuevo día`)
        return true
    }

    // Verificar si no hay actividad significativa
    const sinActividad = ventasOnline === 0 && totalPagos === 0 && totalCobros === 0 && totalGanado === 0
    if (sinActividad) {
        console.log("🆕 No hay actividad significativa, considerando como nuevo día")
        return true
    }

    console.log("📝 Hay actividad, no es nuevo día")
    return false
}

// 🔧 FUNCIÓN CORREGIDA: Obtener saldo anterior específico para la fecha
const obtenerSaldoAnterior = async (pasadorId: string, fechaSeleccionada: Date): Promise<number> => {
    try {
        // Calcular la fecha anterior
        const fechaAnterior = new Date(fechaSeleccionada)
        fechaAnterior.setDate(fechaAnterior.getDate() - 1)
        const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd")

        console.log(`🔍 Buscando saldo anterior para pasador ${pasadorId} en fecha ${fechaAnteriorStr}`)

        // Buscar el saldo específico del día anterior
        const saldosDiariosRef = collection(db, "saldos_diarios")
        const saldosDiariosSnapshot = await getDocs(saldosDiariosRef)

        let saldoAnterior = 0
        saldosDiariosSnapshot.forEach((docSnapshot) => {
            const docId = docSnapshot.id
            if (docId === `${pasadorId}_${fechaAnteriorStr}`) {
                const data = docSnapshot.data()
                saldoAnterior = typeof data.saldo_final === "number" ? data.saldo_final : 0
                console.log(`✅ Saldo anterior encontrado para ${pasadorId}: ${saldoAnterior}`)
            }
        })

        if (saldoAnterior === 0) {
            console.log(`⚠️ No se encontró saldo anterior para ${pasadorId} en ${fechaAnteriorStr}, usando 0`)
        }

        return saldoAnterior
    } catch (error) {
        console.error(`❌ Error al obtener saldo anterior para ${pasadorId}:`, error)
        return 0
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

    // Referencias para cleanup
    const unsubscribersRef = useRef<(() => void)[]>([])
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // 🔧 FUNCIÓN PRINCIPAL CORREGIDA
    const manejarBusqueda = useCallback(async () => {
        setEstaCargando(true)
        setError(null)

        // Limpiar listeners anteriores
        unsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
        unsubscribersRef.current = []

        try {
            console.log(`🚀 Iniciando búsqueda para fecha: ${format(fechaSeleccionada, "yyyy-MM-dd")}`)

            // 1. Obtener pasadores básicos
            const pasadoresRef = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresRef)
            const listaPasadores: Pasador[] = []

            // 2. Procesar cada pasador y obtener su saldo anterior específico
            for (const docSnapshot of pasadoresSnapshot.docs) {
                const data = docSnapshot.data()

                // 🔧 OBTENER SALDO ANTERIOR ESPECÍFICO PARA LA FECHA SELECCIONADA
                const saldoAnterior = await obtenerSaldoAnterior(docSnapshot.id, fechaSeleccionada)

                listaPasadores.push({
                    id: docSnapshot.id,
                    displayId:
                        data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                    nombre: data.nombre || "Sin nombre",
                    saldoFinal: 0,
                    saldoAnterior: saldoAnterior, // 🔧 USAR SALDO ESPECÍFICO DE LA FECHA ANTERIOR
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
                    comisionPorcentaje: data.comision || 0,
                    modulo: data.modulo || 70,
                    posicionEnModulo: data.posicionEnModulo || 1,
                })
            }

            // 3. Ordenar por módulo y posición
            listaPasadores.sort((a, b) => {
                if (a.modulo !== b.modulo) return a.modulo - b.modulo
                return a.posicionEnModulo - b.posicionEnModulo
            })

            console.log(`✅ ${listaPasadores.length} pasadores cargados con saldos anteriores específicos`)

            // 4. Obtener aciertos específicos para la fecha seleccionada
            const aciertosData = await obtenerAciertosDesdeDB(fechaSeleccionada)

            // 5. Actualizar pasadores con aciertos
            const pasadoresFinales = listaPasadores.map((pasador) => {
                const premioTotal = aciertosData[pasador.nombre.toLowerCase()] || 0
                return {
                    ...pasador,
                    premioTotal: premioTotal,
                    saldoFinal: pasador.saldoAnterior, // Inicializar con saldo anterior
                    saldoTotal: pasador.saldoAnterior, // Inicializar con saldo anterior
                }
            })

            setPasadores(pasadoresFinales)

            // 6. Configurar módulos
            const modulosUnicos = Array.from(new Set(pasadoresFinales.map((p) => p.modulo.toString()))).sort(
                (a, b) => Number.parseInt(a) - Number.parseInt(b),
            )
            setModulos(modulosUnicos)
            if (modulosUnicos.length > 0 && !modulosUnicos.includes(moduloSeleccionado)) {
                setModuloSeleccionado(modulosUnicos[0])
            }

            // 7. 🔧 SOLO CONFIGURAR LISTENERS EN TIEMPO REAL SI ES HOY
            const esHoy = format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

            if (esHoy) {
                console.log("📅 Es hoy, configurando listeners en tiempo real...")

                // Configurar listeners para datos en tiempo real
                pasadoresFinales.forEach((pasador) => {
                    const unsubscribe = obtenerDatosEnTiempoReal(pasador)
                    unsubscribersRef.current.push(unsubscribe)
                })

                // Configurar listener para aciertos en tiempo real
                const unsubscribeAciertos = configurarListenerAciertos()
                unsubscribersRef.current.push(unsubscribeAciertos)
            } else {
                console.log("📅 No es hoy, cargando datos históricos sin listeners...")

                // Para fechas pasadas, cargar datos históricos una sola vez
                await cargarDatosHistoricos(pasadoresFinales, fechaSeleccionada)
            }

            setUltimaActualizacion(new Date())
            console.log("✅ Búsqueda completada exitosamente")

            // Mostrar resumen de aciertos
            const totalAciertos = Object.keys(aciertosData).length
            const totalPremios = Object.values(aciertosData).reduce((sum: number, premio: number) => sum + premio, 0)
            if (totalAciertos > 0) {
                toast.success(`✅ ${totalAciertos} pasadores con aciertos (Total: $${totalPremios.toLocaleString()})`, {
                    duration: 5000,
                })
            }
        } catch (err) {
            console.error("❌ Error en manejarBusqueda:", err)
            setError(`Error al cargar los datos: ${err instanceof Error ? err.message : String(err)}`)
            toast.error("Error al cargar los datos")
        } finally {
            setEstaCargando(false)
        }
    }, [fechaSeleccionada, moduloSeleccionado])

    // 🔧 NUEVA FUNCIÓN: Cargar datos históricos para fechas pasadas
    const cargarDatosHistoricos = async (pasadoresList: Pasador[], fecha: Date) => {
        try {
            const fechaString = format(fecha, "yyyy-MM-dd")
            console.log(`📚 Cargando datos históricos para ${fechaString}`)

            // Cargar datos históricos de cada pasador
            for (const pasador of pasadoresList) {
                // Obtener jugadas históricas
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

                // Obtener pagos y cobros históricos
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

                // 🔧 CALCULAR SALDO FINAL HISTÓRICO (sin lógica de "nuevo día")
                const saldoFinal =
                    pasador.saldoAnterior +
                    ventasOnlineAcumuladas -
                    comisionCalculada -
                    pasador.premioTotal +
                    totalPagos -
                    totalCobros

                console.log(`📊 Datos históricos para ${pasador.nombre}:`)
                console.log(`Saldo anterior: ${pasador.saldoAnterior}`)
                console.log(`Jugado: ${ventasOnlineAcumuladas}`)
                console.log(`Comisión: ${comisionCalculada}`)
                console.log(`Premios: ${pasador.premioTotal}`)
                console.log(`Pagos: ${totalPagos}`)
                console.log(`Cobros: ${totalCobros}`)
                console.log(`Saldo final: ${saldoFinal}`)

                // Actualizar el pasador con datos históricos
                setPasadores((prevPasadores) =>
                    prevPasadores.map((p) => {
                        if (p.id === pasador.id) {
                            return {
                                ...p,
                                jugado: ventasOnlineAcumuladas,
                                pagado: totalPagos,
                                cobrado: totalCobros,
                                comisionPasador: comisionCalculada,
                                saldoFinal: saldoFinal,
                                saldoTotal: saldoFinal,
                            }
                        }
                        return p
                    }),
                )
            }

            console.log("✅ Datos históricos cargados completamente")
        } catch (error) {
            console.error("❌ Error al cargar datos históricos:", error)
        }
    }

    // Función para configurar listener de aciertos en tiempo real (solo para hoy)
    const configurarListenerAciertos = useCallback(() => {
        const aciertosRef = collection(db, "aciertos")
        const fechaString = format(fechaSeleccionada, "yyyy-MM-dd")

        const unsubscribeAciertos = onSnapshot(aciertosRef, async (aciertosSnapshot) => {
            console.log("🔄 Detectado cambio en aciertos, actualizando...")
            try {
                const aciertosData: Record<string, number> = {}

                // Procesar cambios en aciertos
                aciertosSnapshot.forEach((doc) => {
                    const data = doc.data()

                    // Verificar si hay datos para la fecha seleccionada
                    if (data[fechaString]) {
                        const pasadorNombre = data[fechaString].aciertos?.[0]?.pasador || ""
                        const totalGanado = data[fechaString].totalGanado || 0

                        if (pasadorNombre && totalGanado > 0) {
                            console.log(`💰 Aciertos actualizados en tiempo real para ${pasadorNombre}: $${totalGanado}`)
                            aciertosData[pasadorNombre.toLowerCase()] = totalGanado
                        }
                    }
                })

                // Actualizar estado con nuevos aciertos
                setPasadores((prevPasadores) =>
                    prevPasadores.map((pasador) => {
                        const nuevosAciertos = aciertosData[pasador.nombre.toLowerCase()] || 0

                        // 🔧 VERIFICAR SI ES UN NUEVO DÍA SIN ACTIVIDAD (solo para hoy)
                        const esNuevoDia = esNuevoDiaSinActividad(
                            fechaSeleccionada,
                            pasador.jugado,
                            pasador.pagado,
                            pasador.cobrado,
                            nuevosAciertos,
                        )

                        let saldoActualizado: number
                        if (esNuevoDia) {
                            saldoActualizado = 0
                            console.log(`🆕 NUEVO DÍA DETECTADO para ${pasador.nombre}: Saldo final = 0`)
                        } else {
                            saldoActualizado =
                                pasador.saldoAnterior +
                                pasador.jugado -
                                pasador.comisionPasador -
                                nuevosAciertos +
                                pasador.pagado -
                                pasador.cobrado
                            console.log(`💰 FÓRMULA CORREGIDA para ${pasador.nombre}:`)
                            console.log(
                                `${pasador.saldoAnterior} + ${pasador.jugado} - ${pasador.comisionPasador} - ${nuevosAciertos} + ${pasador.pagado} - ${pasador.cobrado} = ${saldoActualizado}`,
                            )
                        }

                        return {
                            ...pasador,
                            premioTotal: nuevosAciertos,
                            saldoFinal: saldoActualizado,
                            saldoTotal: saldoActualizado,
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

    // Función optimizada para obtener datos en tiempo real (solo para hoy)
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

            // Listener para jugadas
            const unsubscribeJugadas = onSnapshot(jugadasQuery, async (jugadasSnapshot) => {
                let ventasOnlineAcumuladas = 0
                jugadasSnapshot.forEach((docSnapshot) => {
                    const jugada = docSnapshot.data()
                    if (jugada.anulada !== true) {
                        ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0
                    }
                })

                // Obtener pagos y cobros
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

                    // 🔧 VERIFICAR SI ES UN NUEVO DÍA SIN ACTIVIDAD (solo para hoy)
                    const esNuevoDia = esNuevoDiaSinActividad(
                        fechaSeleccionada,
                        ventasOnlineAcumuladas,
                        totalPagos,
                        totalCobros,
                        pasador.premioTotal,
                    )

                    let saldoFinal: number
                    if (esNuevoDia) {
                        saldoFinal = 0
                        console.log(`🆕 NUEVO DÍA DETECTADO para ${pasador.nombre}: Saldo final = 0`)
                        console.log(`📊 Saldo anterior se mantiene: ${pasador.saldoAnterior}`)
                    } else {
                        saldoFinal =
                            pasador.saldoAnterior +
                            ventasOnlineAcumuladas -
                            comisionCalculada -
                            pasador.premioTotal +
                            totalPagos -
                            totalCobros
                        console.log(`💰 FÓRMULA CORREGIDA para ${pasador.nombre}:`)
                        console.log(
                            `Saldo: ${pasador.saldoAnterior} + ${ventasOnlineAcumuladas} - ${comisionCalculada} - ${pasador.premioTotal} + ${totalPagos} - ${totalCobros} = ${saldoFinal}`,
                        )
                    }

                    // Actualizar estado (manteniendo premioTotal actual)
                    setPasadores((prevPasadores) =>
                        prevPasadores.map((p) => {
                            if (p.id === pasador.id) {
                                const pasadorActualizado = {
                                    ...p,
                                    jugado: ventasOnlineAcumuladas,
                                    pagado: totalPagos,
                                    cobrado: totalCobros,
                                    comisionPasador: comisionCalculada,
                                    saldoFinal: saldoFinal,
                                    saldoTotal: saldoFinal,
                                }

                                // Guardar en Firebase de forma asíncrona
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

    // useEffect optimizado
    useEffect(() => {
        manejarBusqueda()

        // Cleanup al desmontar
        return () => {
            unsubscribersRef.current.forEach((unsubscribe) => unsubscribe())
            unsubscribersRef.current = []
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [manejarBusqueda])

    // Función para actualizar aciertos manualmente
    const actualizarAciertos = useCallback(async () => {
        setEstaCargandoAciertos(true)
        try {
            console.log("🔄 Actualizando aciertos desde base de datos...")
            const aciertosData = await obtenerAciertosDesdeDB(fechaSeleccionada)

            setPasadores((prevPasadores) =>
                prevPasadores.map((pasador) => {
                    const nuevosPremios = aciertosData[pasador.nombre.toLowerCase()] || 0

                    // 🔧 VERIFICAR SI ES UN NUEVO DÍA SIN ACTIVIDAD (solo para hoy)
                    const esNuevoDia = esNuevoDiaSinActividad(
                        fechaSeleccionada,
                        pasador.jugado,
                        pasador.pagado,
                        pasador.cobrado,
                        nuevosPremios,
                    )

                    let saldoActualizado: number
                    if (esNuevoDia) {
                        saldoActualizado = 0
                    } else {
                        saldoActualizado =
                            pasador.saldoAnterior +
                            pasador.jugado -
                            pasador.comisionPasador -
                            nuevosPremios +
                            pasador.pagado -
                            pasador.cobrado
                    }

                    return {
                        ...pasador,
                        premioTotal: nuevosPremios,
                        saldoFinal: saldoActualizado,
                        saldoTotal: saldoActualizado,
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

    // Memoizar cálculos pesados
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

    // Calcular totales del módulo actual
    const totalesModulo = useMemo(() => {
        return pasadoresFiltrados.reduce(
            (acc, pasador) => ({
                saldoTotal: acc.saldoTotal + pasador.saldoTotal,
                jugado: acc.jugado + pasador.jugado,
                cobrado: acc.cobrado + pasador.cobrado,
                pagado: acc.pagado + pasador.pagado,
                comision: acc.comision + pasador.comisionPasador,
                premios: acc.premios + pasador.premioTotal,
            }),
            {
                saldoTotal: 0,
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
                    Listado Diario - Fechas Corregidas ✅
                </h1>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-4 mb-4 border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
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

                    {/* Resumen de totales del módulo */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Saldo Total</div>
                            <div className={`font-bold text-sm ${totalesModulo.saldoTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {formatearMoneda(totalesModulo.saldoTotal)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Jugado</div>
                            <div className="font-bold text-sm text-indigo-600">{formatearMoneda(totalesModulo.jugado)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Cobrado</div>
                            <div className="font-bold text-sm text-blue-600">{formatearMoneda(totalesModulo.cobrado)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Pagado</div>
                            <div className="font-bold text-sm text-purple-600">{formatearMoneda(totalesModulo.pagado)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Comisión</div>
                            <div className="font-bold text-sm text-orange-600">{formatearMoneda(totalesModulo.comision)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-600">Total Ganado</div>
                            <div className="font-bold text-sm text-green-600">{formatearMoneda(totalesModulo.premios)}</div>
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
                                ? "Tiempo real ✅ | Nuevo día = 0 🆕"
                                : "Datos históricos 📚"}
                        </span>
                    </div>
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
                        <div className="text-center">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                            <p className="text-blue-600 font-medium">Cargando datos desde base de datos...</p>
                        </div>
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
                                                        {pasador.saldoFinal === 0 &&
                                                            format(fechaSeleccionada, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && (
                                                                <div className="inline-block ml-1">
                                                                    <div
                                                                        className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"
                                                                        title="Nuevo día"
                                                                    ></div>
                                                                </div>
                                                            )}
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
                                                        {pasador.pagado > 0 && (
                                                            <div className="inline-block ml-1">
                                                                <div className="h-2 w-2 bg-green-500 rounded-full" title="Pagos SUMAN al saldo"></div>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-indigo-600">
                                                        {formatearMoneda(pasador.jugado)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-orange-600">
                                                        {formatearMoneda(pasador.comisionPasador)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-bold ${pasador.premioTotal > 0 ? "text-green-600" : "text-gray-400"}`}
                                                    >
                                                        {formatearMoneda(pasador.premioTotal)}
                                                        {pasador.premioTotal > 0 && (
                                                            <div className="inline-block ml-1">
                                                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                                            </div>
                                                        )}
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
