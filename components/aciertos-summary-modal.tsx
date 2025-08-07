// components/aciertos-summary-modal.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { format } from "date-fns"
import { Loader2, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { procesarJugadasYEncontrarAciertos, calcularTotalGanado, extraerResultados } from "@/lib/ranking-aciertos-utils" // Importar las funciones de cálculo desde el nuevo archivo

interface AciertosSummaryModalProps {
    dateDesde: Date
    dateHasta: Date
    onClose: () => void
}

export default function AciertosSummaryModal({ dateDesde, dateHasta, onClose }: AciertosSummaryModalProps) {
    const [totalAciertosCalculado, setTotalAciertosCalculado] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const formatearMoneda = useCallback((monto: number): string => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 2,
        }).format(monto)
    }, [])

    const fetchAndCalculateAciertos = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        setTotalAciertosCalculado(0) // Reset total before fetching and calculating

        try {
            // 1. Obtener todas las jugadas en el rango de fechas
            const jugadasRef = collection(db, "jugadas")
            const jugadasQuery = query(
                jugadasRef,
                where("fecha", ">=", format(dateDesde, "yyyy-MM-dd")),
                where("fecha", "<=", format(dateHasta, "yyyy-MM-dd")),
            )
            const jugadasSnapshot = await getDocs(jugadasQuery)
            const jugadasData: Record<string, any>[] = jugadasSnapshot.docs.map((doc) => doc.data())

            // 2. Obtener todos los extractos (resultados) en el rango de fechas
            const extractosRef = collection(db, "extractos")
            const extractosQuery = query(
                extractosRef,
                where("fecha", ">=", format(dateDesde, "yyyy-MM-dd")),
                where("fecha", "<=", format(dateHasta, "yyyy-MM-dd")),
            )
            const extractosSnapshot = await getDocs(extractosQuery)
            let allResultados: any[] = []
            extractosSnapshot.forEach((doc) => {
                const extractoData = doc.data()
                const fechaExtracto = format(doc.get("fecha").toDate(), "yyyy-MM-dd") // Asumiendo que 'fecha' es un Timestamp
                const resultadosDelDia = extraerResultados(extractoData, fechaExtracto)
                allResultados = allResultados.concat(resultadosDelDia)
            })

            console.log("Jugadas fetched:", jugadasData.length)
            console.log("Resultados fetched:", allResultados.length)

            // 3. Procesar jugadas y encontrar aciertos
            const aciertosAgrupados = procesarJugadasYEncontrarAciertos(jugadasData, allResultados)

            // 4. Calcular el total ganado de todos los aciertos
            const totalGanado = calcularTotalGanado(aciertosAgrupados)

            setTotalAciertosCalculado(totalGanado)
            console.log("✅ Aciertos totales calculados exitosamente:", totalGanado)
        } catch (err) {
            console.error("❌ Error fetching and calculating aciertos summary:", err)
            setError(`Error al cargar y calcular el resumen de aciertos: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsLoading(false)
        }
    }, [dateDesde, dateHasta])

    useEffect(() => {
        fetchAndCalculateAciertos()
    }, [fetchAndCalculateAciertos])

    return (
        <div className="p-4">
            {isLoading ? (
                <div className="text-center py-8">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                    <p className="mt-2 text-sm text-blue-600">Calculando aciertos totales...</p>
                </div>
            ) : error ? (
                <Alert variant="destructive" className="mb-4 bg-red-100 border-red-400 text-red-700 flex items-start">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-red-600 flex-shrink-0 mt-0.5" />
                    <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Total de Aciertos ({format(dateDesde, "dd/MM/yyyy")} - {format(dateHasta, "dd/MM/yyyy")})
                        </h3>
                        <p className="text-5xl font-bold text-green-700">{formatearMoneda(totalAciertosCalculado)}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Suma de "Premios" (total_ganado) de todas las jugadas en el rango de fechas seleccionado.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button onClick={onClose} variant="outline">
                            Cerrar
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
