"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import Navbar from "../../components/Navbar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCcw, CalendarIcon, FileText, Download, AlertTriangle } from 'lucide-react'
import * as XLSX from "xlsx"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, startOfDay, endOfDay, isFuture, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog" // Importar componentes de Dialog
import DailyRecordsModal from "@/components/daily-records-modal" // Importar el nuevo componente modal

// Interfaz para los documentos de la colección 'pasadores'
interface PasadorMeta {
    id: string // El ID del documento en Firestore
    displayId: string
    nombre: string
    comision: number // Porcentaje de comisión
    modulo: number
    posicionEnModulo: number
}

// Interfaz para los documentos de la colección 'saldos_diarios'
interface SaldoDiarioDoc {
    id: string // Añadir ID para poder referenciar el documento al editar
    pasador_id: string
    pasador_nombre: string
    display_id: string
    fecha: string // Formato "yyyy-MM-dd"
    timestamp: string // Formato "dd/MM/yy HH:mm"
    saldo_anterior: number
    saldo_actual: number // Movimiento neto del día
    saldo_final: number // Saldo acumulado al final del día
    saldo_total: number // Generalmente igual a saldo_final
    ventas_online: number // Corresponde a 'jugado'
    comision_pasador: number
    total_pagos: number // Corresponde a 'pagado'
    total_cobros: number // Corresponde a 'cobrado'
    total_ganado: number // Corresponde a 'premioTotal'
    modulo: number
    posicion_en_modulo: number
}

// Interfaz para los datos agregados en el ranking (lo que se muestra en la tabla)
interface PlanillaRanking {
    id: string
    displayId: string
    nombre: string
    pasadorSaldo: number // Saldo inicial del primer día + el movimiento neto total del rango
    pagado: number // Suma de total_pagos en el rango
    cobrado: number // Suma de total_cobros en el rango
    juego: number // Suma de ventas_online en el rango
    cant: number // Número de días con actividad
    comisionPasador: number // Suma de comision_pasador en el rango
    juegoNeto: number // Calculado: juego - comisionPasador
    aciertos: number // Suma de total_ganado en el rango
    subTotalNeto: number // Calculado: juegoNeto - aciertos
    totalMovimientoDiario: number // Suma de saldo_actual en el rango
    totalSaldosAnteriores: number // Suma de saldo_anterior en el rango
    diasTrabajados: number // Número de días con actividad
    promedioJuego: number // Calculado: juego / diasTrabajados
    promedioJuegoNeto: number // Calculado: juegoNeto / diasTrabajados
    fechaDeA: string // Fecha de fin del rango
    modulo: number // Añadido para el filtrado
}

export default function RankingPlanillasPage() {
    const [rankingData, setRankingData] = useState<PlanillaRanking[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedDateDesde, setSelectedDateDesde] = useState<Date>(() => startOfDay(new Date()))
    const [selectedDateHasta, setSelectedDateHasta] = useState<Date>(() => endOfDay(new Date()))
    const [selectedModulo, setSelectedModulo] = useState<string>("Todos")
    const [modulos, setModulos] = useState<string[]>([])

    // Estado para el modal de edición
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [selectedPasadorForEdit, setSelectedPasadorForEdit] = useState<PlanillaRanking | null>(null)

    const formatearMoneda = useCallback((monto: number): string => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
        }).format(monto)
    }, [])

    const fetchRankingData = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        setRankingData([]) // Limpiar datos anteriores

        try {
            console.log(
                `Fetching ranking data from ${format(selectedDateDesde, "yyyy-MM-dd")} to ${format(selectedDateHasta, "yyyy-MM-dd")} for module: ${selectedModulo}`,
            )

            // 1. Obtener todos los pasadores (metadata)
            const pasadoresRef = collection(db, "pasadores")
            const pasadoresSnapshot = await getDocs(pasadoresRef)
            const allPasadoresMeta: PasadorMeta[] = pasadoresSnapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                    id: doc.id,
                    displayId:
                        data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                    nombre: data.nombre || "Sin nombre",
                    comision: data.comision || 0, // Asumiendo que 'comision' es el campo en la colección 'pasadores'
                    modulo: data.modulo || 70,
                    posicionEnModulo: data.posicionEnModulo || 1,
                }
            })

            // Extraer módulos únicos
            const uniqueModulos = Array.from(new Set(allPasadoresMeta.map((p) => p.modulo.toString()))).sort(
                (a, b) => Number.parseInt(a) - Number.parseInt(b),
            )
            setModulos(["Todos", ...uniqueModulos])
            if (selectedModulo !== "Todos" && !uniqueModulos.includes(selectedModulo)) {
                setSelectedModulo("Todos") // Reset if selected module no longer exists
            }

            const aggregatedRankingData: PlanillaRanking[] = []

            // 2. Para cada pasador, obtener y agregar sus saldos diarios en el rango
            for (const pasadorMeta of allPasadoresMeta) {
                const saldosDiariosRef = collection(db, "saldos_diarios")
                const q = query(
                    saldosDiariosRef,
                    where("pasador_id", "==", pasadorMeta.id),
                    where("fecha", ">=", format(selectedDateDesde, "yyyy-MM-dd")),
                    where("fecha", "<=", format(selectedDateHasta, "yyyy-MM-dd")),
                )
                const saldosSnapshot = await getDocs(q)

                let totalPagado = 0
                let totalCobrado = 0
                let totalJuego = 0
                let totalComisionPasador = 0
                let totalAciertos = 0
                let totalMovimientoDiario = 0
                let totalSaldosAnteriores = 0
                let diasActivos = 0
                let firstDaySaldoAnterior = 0

                const dailyRecords: SaldoDiarioDoc[] = []
                saldosSnapshot.forEach((doc) => {
                    const { id: dataId, ...restData } = doc.data() as SaldoDiarioDoc // Desestructura 'id' de los datos y renómbralo para evitar conflictos
                    dailyRecords.push({ id: doc.id, ...restData }) // Usa doc.id y el resto de los datos
                })

                // Ordenar registros por fecha para asegurar el saldo_final correcto del último día
                dailyRecords.sort((a, b) => {
                    const dateA = parseISO(a.fecha)
                    const dateB = parseISO(b.fecha)
                    return dateA.getTime() - dateB.getTime()
                })

                if (dailyRecords.length > 0) {
                    firstDaySaldoAnterior = dailyRecords[0].saldo_anterior || 0
                    dailyRecords.forEach((record) => {
                        totalPagado += record.total_pagos || 0
                        totalCobrado += record.total_cobros || 0
                        totalJuego += record.ventas_online || 0
                        totalComisionPasador += record.comision_pasador || 0
                        totalAciertos += record.total_ganado || 0
                        totalMovimientoDiario += record.saldo_actual || 0
                        totalSaldosAnteriores += record.saldo_anterior || 0
                        diasActivos++
                        // DEBUG: Log para aciertos (mantener para depuración si es necesario)
                        // if (pasadorMeta.nombre.toLowerCase().includes("gaston")) {
                        //   console.log(
                        //     `DEBUG: Aciertos para ${pasadorMeta.nombre} (${record.fecha}): total_ganado = ${record.total_ganado}`,
                        //   )
                        // }
                    })

                    const juegoNeto = totalJuego - totalComisionPasador
                    const subTotalNeto = juegoNeto - totalAciertos
                    const promedioJuego = diasActivos > 0 ? totalJuego / diasActivos : 0
                    const promedioJuegoNeto = diasActivos > 0 ? juegoNeto / diasActivos : 0
                    const calculatedPasadorSaldo = firstDaySaldoAnterior + totalMovimientoDiario

                    aggregatedRankingData.push({
                        id: pasadorMeta.id,
                        displayId: pasadorMeta.displayId,
                        nombre: pasadorMeta.nombre,
                        pasadorSaldo: calculatedPasadorSaldo,
                        pagado: totalPagado,
                        cobrado: totalCobrado,
                        juego: totalJuego,
                        cant: diasActivos,
                        comisionPasador: totalComisionPasador,
                        juegoNeto: juegoNeto,
                        aciertos: totalAciertos,
                        subTotalNeto: subTotalNeto,
                        totalMovimientoDiario: totalMovimientoDiario,
                        totalSaldosAnteriores: totalSaldosAnteriores,
                        diasTrabajados: diasActivos,
                        promedioJuego: promedioJuego,
                        promedioJuegoNeto: promedioJuegoNeto,
                        fechaDeA: format(selectedDateHasta, "dd/MM"),
                        modulo: pasadorMeta.modulo,
                    })
                }
            }

            const filteredAndSortedData =
                selectedModulo === "Todos"
                    ? aggregatedRankingData
                    : aggregatedRankingData.filter((data) => data.modulo.toString() === selectedModulo)

            // Aplicar el nuevo ordenamiento: primero los que jugaron, luego los que no, ambos alfabéticamente
            filteredAndSortedData.sort((a, b) => {
                const aPlayed = a.juego > 0 || a.diasTrabajados > 0 // Considerar 'juego' o 'diasTrabajados' como indicador de actividad
                const bPlayed = b.juego > 0 || b.diasTrabajados > 0

                if (aPlayed && !bPlayed) {
                    return -1 // a va antes que b
                }
                if (!aPlayed && bPlayed) {
                    return 1 // b va antes que a
                }
                // Si ambos jugaron o ambos no jugaron, ordenar alfabéticamente por nombre
                return a.nombre.localeCompare(b.nombre)
            })

            setRankingData(filteredAndSortedData)
            console.log("✅ Ranking data loaded successfully.")
        } catch (err) {
            console.error("❌ Error fetching ranking data:", err)
            setError(`Error al cargar los datos del ranking: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsLoading(false)
        }
    }, [selectedDateDesde, selectedDateHasta, selectedModulo])

    useEffect(() => {
        fetchRankingData()
    }, [fetchRankingData])

    const handleDateSelectDesde = (newDate: Date | undefined) => {
        if (newDate) {
            if (isFuture(newDate)) {
                setError("No se pueden seleccionar fechas futuras.")
                return
            }
            setSelectedDateDesde(startOfDay(newDate))
        }
    }

    const handleDateSelectHasta = (newDate: Date | undefined) => {
        if (newDate) {
            if (isFuture(newDate)) {
                setError("No se pueden seleccionar fechas futuras.")
                return
            }
            setSelectedDateHasta(endOfDay(newDate))
        }
    }

    // Función para abrir el modal de edición
    const handleEditClick = (pasador: PlanillaRanking) => {
        setSelectedPasadorForEdit(pasador)
        setIsEditModalOpen(true)
    }

    // Función para cerrar el modal y recargar datos
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false)
        setSelectedPasadorForEdit(null)
        fetchRankingData() // Recargar los datos del ranking después de cerrar el modal
    }

    // Cálculo de los totales generales
    const grandTotals = useMemo(() => {
        return rankingData.reduce(
            (acc, row) => ({
                pasadorSaldo: acc.pasadorSaldo + row.pasadorSaldo,
                pagado: acc.pagado + row.pagado,
                cobrado: acc.cobrado + row.cobrado,
                juego: acc.juego + row.juego,
                cant: acc.cant + row.cant,
                comisionPasador: acc.comisionPasador + row.comisionPasador,
                juegoNeto: acc.juegoNeto + row.juegoNeto,
                aciertos: acc.aciertos + row.aciertos,
                subTotalNeto: acc.subTotalNeto + row.subTotalNeto,
                totalMovimientoDiario: acc.totalMovimientoDiario + row.totalMovimientoDiario,
                totalSaldosAnteriores: acc.totalSaldosAnteriores + row.totalSaldosAnteriores,
                diasTrabajados: acc.diasTrabajados + row.diasTrabajados,
                promedioJuego: acc.promedioJuego + row.promedioJuego,
                promedioJuegoNeto: acc.promedioJuegoNeto + row.promedioJuegoNeto,
            }),
            {
                pasadorSaldo: 0,
                pagado: 0,
                cobrado: 0,
                juego: 0,
                cant: 0,
                comisionPasador: 0,
                juegoNeto: 0,
                aciertos: 0,
                subTotalNeto: 0,
                totalMovimientoDiario: 0,
                totalSaldosAnteriores: 0,
                diasTrabajados: 0,
                promedioJuego: 0,
                promedioJuegoNeto: 0,
            },
        )
    }, [rankingData])

    const exportToExcel = () => {
        const dataToExport = rankingData.map((row) => ({
            Pasador: row.nombre,
            "ID Pasador": row.displayId,
            "Pasador Saldo": formatearMoneda(row.pasadorSaldo),
            Pagado: formatearMoneda(row.pagado),
            Cobrado: formatearMoneda(row.cobrado),
            Juego: formatearMoneda(row.juego),
            Cant: row.cant,
            "Comisión Pasador": formatearMoneda(row.comisionPasador),
            "Juego Neto": formatearMoneda(row.juegoNeto),
            Aciertos: row.aciertos,
            "SubTotal Neto": formatearMoneda(row.subTotalNeto),
            "Mov. Neto Diario": formatearMoneda(row.totalMovimientoDiario),
            "Saldos Anteriores": formatearMoneda(row.totalSaldosAnteriores),
            "Días Trabajados": row.diasTrabajados,
            "Promedio Juego": formatearMoneda(row.promedioJuego),
            "Promedio Juego Neto": formatearMoneda(row.promedioJuegoNeto),
            "Fecha de A": row.fechaDeA,
            Módulo: row.modulo,
        }))

        // Añadir la fila de totales al exportar
        if (rankingData.length > 0) {
            dataToExport.push({
                Pasador: "TOTAL GENERAL",
                "ID Pasador": "",
                "Pasador Saldo": formatearMoneda(grandTotals.pasadorSaldo),
                Pagado: formatearMoneda(grandTotals.pagado),
                Cobrado: formatearMoneda(grandTotals.cobrado),
                Juego: formatearMoneda(grandTotals.juego),
                Cant: grandTotals.cant,
                "Comisión Pasador": formatearMoneda(grandTotals.comisionPasador),
                "Juego Neto": formatearMoneda(grandTotals.juegoNeto),
                Aciertos: grandTotals.aciertos,
                "SubTotal Neto": formatearMoneda(grandTotals.subTotalNeto),
                "Mov. Neto Diario": formatearMoneda(grandTotals.totalMovimientoDiario),
                "Saldos Anteriores": formatearMoneda(grandTotals.totalSaldosAnteriores),
                "Días Trabajados": grandTotals.diasTrabajados,
                "Promedio Juego": formatearMoneda(grandTotals.juego / (grandTotals.diasTrabajados || 1)),
                "Promedio Juego Neto": formatearMoneda(grandTotals.juegoNeto / (grandTotals.diasTrabajados || 1)),
                "Fecha de A": "",
                Módulo: 0,
            })
        }

        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ranking Planillas")
        XLSX.writeFile(workbook, "Ranking_Planillas.xlsx")
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <main className="container mx-auto p-2 sm:p-4">
                <Card className="shadow-xl border border-blue-200">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                        <CardTitle className="text-xl sm:text-2xl font-bold flex items-center">
                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                            Listado de Ranking de Planillas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                            <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-blue-200 w-full lg:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Desde:</span>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-[150px] justify-start text-left font-normal border-blue-300 hover:border-blue-500 hover:bg-blue-50",
                                                    !selectedDateDesde && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                                {selectedDateDesde ? format(selectedDateDesde, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDateDesde}
                                                onSelect={handleDateSelectDesde}
                                                initialFocus
                                                disabled={(date) => isFuture(date)}
                                                className="rounded-md"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Hasta:</span>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-[150px] justify-start text-left font-normal border-blue-300 hover:border-blue-500 hover:bg-blue-50",
                                                    !selectedDateHasta && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                                {selectedDateHasta ? format(selectedDateHasta, "dd/MM/yyyy") : <span>Seleccionar fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 border-blue-200 shadow-lg" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={selectedDateHasta}
                                                onSelect={handleDateSelectHasta}
                                                initialFocus
                                                disabled={(date) => isFuture(date)}
                                                className="rounded-md"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">Módulo:</span>
                                    <Select value={selectedModulo} onValueChange={setSelectedModulo}>
                                        <SelectTrigger className="w-[180px] border-blue-300 hover:border-blue-500 hover:bg-blue-50">
                                            <SelectValue placeholder="Seleccionar Módulo" />
                                        </SelectTrigger>
                                        <SelectContent className="border-blue-200 shadow-lg">
                                            {modulos.map((modulo) => (
                                                <SelectItem key={modulo} value={modulo}>
                                                    {modulo === "Todos" ? "Todos" : `Módulo ${modulo}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    onClick={fetchRankingData}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 lg:flex-none"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <RefreshCcw className="h-4 w-4 mr-2" />
                                    )}
                                    Consultar
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportToExcel}
                                    className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-500 bg-transparent flex-1 sm:flex-none"
                                >
                                    <Download className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Exportar</span>
                                </Button>
                            </div>
                        </div>
                        {error && (
                            <Alert variant="destructive" className="mb-4 bg-red-100 border-red-400 text-red-700 flex items-start">
                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                            </Alert>
                        )}
                        {isLoading ? (
                            <div className="text-center py-8">
                                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                                <p className="mt-2 text-sm text-blue-600">Cargando ranking de planillas...</p>
                            </div>
                        ) : rankingData.length > 0 ? (
                            <div className="rounded-lg overflow-x-auto shadow-md border border-blue-200 bg-white">
                                <Table className="w-full min-w-[1200px] [&_th]:p-1 [&_td]:p-1 sm:[&_th]:p-2 sm:[&_td]:p-2 [&_th]:text-xs [&_td]:text-xs">
                                    <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                                        <TableRow>
                                            <TableHead className="text-white font-bold min-w-[80px]">Pasador</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Pasador Saldo</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Pagado</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Cobrado</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Juego</TableHead>
                                            <TableHead className="text-white font-bold min-w-[50px]">Cant</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Comisión Pasador</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Juego Neto</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Aciertos</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">SubTotal Neto</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Mov. Neto Diario</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Saldos Anteriores</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Días Trabajados</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Promedio Juego</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Promedio Juego Neto</TableHead>
                                            <TableHead className="text-white font-bold min-w-[80px]">Fecha de A</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rankingData.map((row, index) => (
                                            <TableRow
                                                key={row.id}
                                                className={`${index % 2 === 0 ? "bg-blue-50" : "bg-white"} hover:bg-blue-100 transition-colors cursor-pointer`}
                                                onClick={() => handleEditClick(row)} // Hacer la fila clicable
                                            >
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3 text-sm font-bold">
                                                            {row.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-blue-800">{row.displayId}</div>
                                                            <div className="text-xs text-gray-600">{row.nombre}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium text-blue-800">{formatearMoneda(row.pasadorSaldo)}</TableCell>
                                                <TableCell className="text-indigo-600 font-medium">{formatearMoneda(row.pagado)}</TableCell>
                                                <TableCell className="text-green-600 font-medium">{formatearMoneda(row.cobrado)}</TableCell>
                                                <TableCell className="text-purple-700 font-medium">{formatearMoneda(row.juego)}</TableCell>
                                                <TableCell className="text-gray-800">{row.cant}</TableCell>
                                                <TableCell className="text-orange-700 font-medium">
                                                    {formatearMoneda(row.comisionPasador)}
                                                </TableCell>
                                                <TableCell className="text-blue-700 font-medium">{formatearMoneda(row.juegoNeto)}</TableCell>
                                                <TableCell className="text-green-700 font-medium">{formatearMoneda(row.aciertos)}</TableCell>
                                                <TableCell className="text-red-700 font-medium">{formatearMoneda(row.subTotalNeto)}</TableCell>
                                                <TableCell className="text-blue-700 font-medium">
                                                    {formatearMoneda(row.totalMovimientoDiario)}
                                                </TableCell>
                                                <TableCell className="text-gray-800">{formatearMoneda(row.totalSaldosAnteriores)}</TableCell>
                                                <TableCell className="text-gray-800">{row.diasTrabajados}</TableCell>
                                                <TableCell className="text-purple-700 font-medium">
                                                    {formatearMoneda(row.promedioJuego)}
                                                </TableCell>
                                                <TableCell className="text-indigo-700 font-medium">
                                                    {formatearMoneda(row.promedioJuegoNeto)}
                                                </TableCell>
                                                <TableCell className="text-gray-800">{row.fechaDeA}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    {/* Fila de totales generales */}
                                    <TableFooter className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white font-bold">
                                        <TableRow>
                                            <TableCell className="text-white font-bold text-sm py-2">TOTAL GENERAL</TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.pasadorSaldo)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.pagado)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.cobrado)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.juego)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">{grandTotals.cant}</TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.comisionPasador)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.juegoNeto)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.aciertos)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.subTotalNeto)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.totalMovimientoDiario)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.totalSaldosAnteriores)}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">{grandTotals.diasTrabajados}</TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.juego / (grandTotals.diasTrabajados || 1))}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2">
                                                {formatearMoneda(grandTotals.juegoNeto / (grandTotals.diasTrabajados || 1))}
                                            </TableCell>
                                            <TableCell className="text-white font-bold text-sm py-2"></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        ) : (
                            <Alert
                                variant="default"
                                className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700 flex items-start"
                            >
                                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <AlertDescription className="text-xs sm:text-sm">
                                    No se encontraron datos de ranking para los filtros seleccionados.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </main>
            {/* Modal de edición de registros diarios */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Editar Registros Diarios para {selectedPasadorForEdit?.nombre} ({selectedPasadorForEdit?.displayId})
                        </DialogTitle>
                    </DialogHeader>
                    {selectedPasadorForEdit && (
                        <DailyRecordsModal
                            pasadorId={selectedPasadorForEdit.id}
                            dateDesde={selectedDateDesde}
                            dateHasta={selectedDateHasta}
                            onClose={handleCloseEditModal}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
