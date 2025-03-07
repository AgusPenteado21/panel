// app/api/extractos/forzar-fecha.ts
import { NextResponse } from "next/server"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Endpoint para forzar la fecha actual de Argentina
export async function GET(request: Request) {
    try {
        // Obtener fecha UTC
        const fechaUTC = new Date()

        // Método directo: Usar offset manual para Argentina (-3 horas)
        const fechaArgentina = new Date(fechaUTC.getTime() - (3 * 60 * 60 * 1000))

        // Formatear la fecha para mostrar
        const fechaDisplay = format(fechaArgentina, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fechaArgentina, "EEEE", { locale: es })
        const nombreDiaCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)

        return NextResponse.json({
            fechaActual: {
                utc: fechaUTC.toISOString(),
                argentina: fechaArgentina.toISOString(),
                display: fechaDisplay,
                dia: nombreDiaCapitalizado,
            },
            mensaje: "Usa esta fecha para mostrar en tus resultados",
        }, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        })
    } catch (error) {
        console.error("Error al forzar fecha:", error)
        return NextResponse.json({
            error: "Error al forzar fecha",
            mensaje: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
    }
}