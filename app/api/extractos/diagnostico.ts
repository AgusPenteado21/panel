// app/api/extractos/diagnostico.ts
import { NextResponse } from "next/server"
import { format } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { es } from "date-fns/locale"

// Endpoint de diagnóstico para verificar problemas de zona horaria
export async function GET(request: Request) {
    try {
        // Obtener fecha UTC
        const fechaUTC = new Date()

        // Obtener fecha en Argentina usando diferentes métodos
        const fechaArgentina1 = toZonedTime(fechaUTC, "America/Argentina/Buenos_Aires")

        // Método alternativo usando offset manual
        const fechaArgentina2 = new Date(fechaUTC.getTime() - (3 * 60 * 60 * 1000)) // -3 horas para Argentina

        // Información del servidor
        const zonaHoraServidor = Intl.DateTimeFormat().resolvedOptions().timeZone
        const offsetServidor = new Date().getTimezoneOffset()

        // Formatear fechas de diferentes maneras
        const formatosArgentina = {
            iso: fechaArgentina1.toISOString(),
            fechaCompleta: format(fechaArgentina1, "yyyy-MM-dd HH:mm:ss"),
            soloFecha: format(fechaArgentina1, "yyyy-MM-dd"),
            formatoDisplay: format(fechaArgentina1, "dd/MM/yyyy", { locale: es }),
            diaSemana: format(fechaArgentina1, "EEEE", { locale: es }),
        }

        // Método alternativo
        const formatosArgentinaAlt = {
            iso: fechaArgentina2.toISOString(),
            fechaCompleta: format(fechaArgentina2, "yyyy-MM-dd HH:mm:ss"),
            soloFecha: format(fechaArgentina2, "yyyy-MM-dd"),
            formatoDisplay: format(fechaArgentina2, "dd/MM/yyyy", { locale: es }),
            diaSemana: format(fechaArgentina2, "EEEE", { locale: es }),
        }

        // Información de variables de entorno
        const variablesEntorno = {
            NODE_ENV: process.env.NODE_ENV,
            TZ: process.env.TZ,
        }

        // Crear respuesta con toda la información de diagnóstico
        return NextResponse.json({
            servidor: {
                zonaHoraria: zonaHoraServidor,
                offsetMinutos: offsetServidor,
                variablesEntorno,
            },
            fechaUTC: {
                iso: fechaUTC.toISOString(),
                fechaCompleta: format(fechaUTC, "yyyy-MM-dd HH:mm:ss"),
            },
            fechaArgentina: formatosArgentina,
            fechaArgentinaAlternativa: formatosArgentinaAlt,
            timestamp: Date.now(),
        })
    } catch (error) {
        console.error("Error en diagnóstico:", error)
        return NextResponse.json({
            error: "Error al realizar diagnóstico",
            mensaje: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
    }
}