import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { parse, format, startOfDay, isAfter } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { es } from "date-fns/locale"
import { db } from "@/lib/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"

// Interfaces y tipos
interface ResultadoDia {
    fecha: string
    dia: string
    resultados: {
        loteria: string
        provincia: string
        sorteos: {
            [key: string]: string[]
        }
    }[]
}

interface ResultadosPorDia {
    [key: string]: ResultadoDia
}

interface Resultado {
    loteria: string
    provincia: string
    sorteos: {
        [key: string]: string[]
    }
}

// Añadimos la interfaz Extracto aquí para consistencia y tipado
interface Extracto {
    id: string
    fecha: string // "dd/MM/yyyy"
    dia: string
    sorteo: string // "Previa", "Primera", etc.
    loteria: string // "Nacional", "Provincial", etc.
    numeros: string[]
    pizarraLink: string
    necesita: string
    confirmado: string
    provincia?: string // "NACION", "PROVINCIA", etc.
}

const PLACEHOLDER_RESULT = "----" // Placeholder para resultados no disponibles

function obtenerFechaArgentinaRobusta(): Date {
    try {
        const ahoraUTC = new Date()
        const offsetArgentina = -3 * 60 // Argentina es UTC-3 (en minutos)
        const offsetLocal = ahoraUTC.getTimezoneOffset() // Offset del servidor en minutos
        const diferenciaMinutos = offsetLocal + offsetArgentina
        const fechaArgentina = new Date(ahoraUTC.getTime() + diferenciaMinutos * 60 * 1000)
        return fechaArgentina
    } catch (error) {
        console.error("❌ Error total en fecha Argentina:", error)
        const fallback = new Date(Date.now() - 3 * 60 * 60 * 1000)
        return fallback
    }
}

function parsearFechaConsulta(fechaString: string): Date {
    try {
        const [year, month, day] = fechaString.split("-").map(Number)
        const fechaArgentina = new Date()
        fechaArgentina.setFullYear(year, month - 1, day)
        fechaArgentina.setHours(12, 0, 0, 0) // Mediodía Argentina
        const offsetArgentina = -3 * 60 // UTC-3 en minutos
        const offsetLocal = fechaArgentina.getTimezoneOffset()
        const diferenciaMinutos = offsetLocal + offsetArgentina
        const fechaFinal = new Date(fechaArgentina.getTime() + diferenciaMinutos * 60 * 1000)
        return startOfDay(fechaFinal)
    } catch (error) {
        console.error("❌ Error parseando fecha consulta:", error)
        return startOfDay(new Date(fechaString))
    }
}

function formatearFechaArgentina(fecha: Date, formato: string): string {
    try {
        const fechaArgentina = new Date(fecha)
        const resultado = format(fechaArgentina, formato, { locale: es })
        return resultado
    } catch (error) {
        console.error("❌ Error formateando fecha:", error)
        return format(fecha, formato, { locale: es })
    }
}

function detectarEntorno(): string {
    const esRailway = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
    const esVercel = process.env.VERCEL !== undefined
    return esRailway ? "railway" : esVercel ? "vercel" : "local"
}

// Constantes
const TIEMPO_ESPERA_FETCH = 60000 // 60 segundos
const URLS_PIZARRAS = {
    NACION: "https://vivitusuerte.com/pizarra/ciudad",
    PROVINCIA: "https://vivitusuerte.com/pizarra/provincia",
    CORDOBA: "https://vivitusuerte.com/pizarra/cordoba",
    "SANTA FE": "https://vivitusuerte.com/pizarra/santa+fe",
    "ENTRE RIOS": "https://vivitusuerte.com/pizarra/entre+rios",
    MENDOZA: "https://vivitusuerte.com/pizarra/mendoza",
    CORRIENTES: "https://vivitusuerte.com/pizarra/corrientes",
    CHACO: "https://vivitusuerte.com/pizarra/chaco",
    MONTEVIDEO: "https://vivitusuerte.com/pizarra/montevideo",
    "RIO NEGRO": "https://vivitusuerte.com/pizarra/rio+negro",
    SANTIAGO: "https://vivitusuerte.com/pizarra/santiago",
    NEUQUEN: "https://vivitusuerte.com/pizarra/neuquen",
    MISIONES: "https://vivitusuerte.com/pizarra/misiones",
    FORMOSA: "https://vivitusuerte.com/pizarra/formosa",
    JUJUY: "https://vivitusuerte.com/pizarra/jujuy",
    SALTA: "https://vivitusuerte.com/pizarra/salta",
    "SAN LUIS": "https://vivitusuerte.com/pizarra/san+luis",
}

// Horarios de sorteos generales (por defecto)
const HORARIOS_SORTEOS = {
    Previa: "10:15",
    Primera: "12:00",
    Matutina: "15:00",
    Vespertina: "18:00",
    Nocturna: "21:00",
}

// Nuevo: Horarios de sorteos específicos por provincia y turno
const LOTTERY_SPECIFIC_DRAW_TIMES: {
    [provincia: string]: {
        [turno: string]: string
    }
} = {
    FORMOSA: {
        Matutina: "14:00", // Formosa Matutina sortea a las 14:00
    },
    SALTA: {
        Previa: "10:15", // Ejemplo: Salta Previa
        Primera: "12:00", // Ejemplo: Salta Primera
        Matutina: "14:30", // Ejemplo: Salta Matutina
        Vespertina: "17:30", // Ejemplo: Salta Vespertina
        Nocturna: "20:30", // Ejemplo: Salta Nocturna
    },
}

const DEFAULT_DISPLAY_OFFSET_MINUTES = 15 // Por defecto, 15 minutos después del sorteo

const LOTTERY_DISPLAY_CUTOFF_OVERRIDES: {
    [provincia: string]: {
        [turno: string]: { displayOffsetMinutes: number }
    }
} = {
    SALTA: {
        Previa: { displayOffsetMinutes: 5 }, // Salta Previa aparece 5 minutos después del sorteo
        Primera: { displayOffsetMinutes: 10 }, // Salta Primera aparece 10 minutos después del sorteo
        Matutina: { displayOffsetMinutes: 10 }, // Salta Matutina aparece 10 minutos después del sorteo
        Vespertina: { displayOffsetMinutes: 10 }, // Salta Vespertina aparece 10 minutos después del sorteo
        Nocturna: { displayOffsetMinutes: 10 }, // Salta Nocturna aparece 10 minutos después del sorteo
    },
    FORMOSA: {
        Matutina: { displayOffsetMinutes: 5 }, // Formosa Matutina aparece 5 minutos después de su sorteo (14:00 + 5 min = 14:05)
    },
}

const MANUAL_ENTRY_LOTTERIES_ON_SUNDAY: { [provincia: string]: string[] } = {
    JUJUY: ["Primera", "Matutina"], // Jujuy Primera y Matutina son manuales los domingos
    SALTA: ["Matutina", "Vespertina"], // Salta Matutina y Vespertina son manuales los domingos
    SANTIAGO: ["Matutina", "Vespertina"], // Santiago Matutina y Vespertina son manuales los domingos
}

async function obtenerConTiempoLimite(url: string, opciones: RequestInit = {}): Promise<Response> {
    const controlador = new AbortController()
    const id = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_FETCH)
    try {
        const timestamp = Date.now()
        const urlConTimestamp = `${url}${url.includes("?") ? "&" : "?"}_t=${timestamp}`

        const entorno = detectarEntorno()

        const headersBase: Record<string, string> = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        }

        let headersEspecificos: Record<string, string> = {}
        if (entorno === "railway") {
            headersEspecificos = {
                "User-Agent":
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                DNT: "1",
                Connection: "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        } else {
            headersEspecificos = {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        }

        const headersFinales = {
            ...headersBase,
            ...headersEspecificos,
            ...opciones.headers,
        }

        const respuesta = await fetch(urlConTimestamp, {
            ...opciones,
            signal: controlador.signal,
            cache: "no-store",
            headers: headersFinales,
        })
        clearTimeout(id)
        return respuesta
    } catch (error) {
        clearTimeout(id)
        console.error(`❌ Error en obtenerConTiempoLimite para ${url}:`, error)
        throw error
    }
}

function obtenerTiempoSorteo(turno: string, provinciaKey?: string): number {
    let horario: string | undefined
    if (provinciaKey && LOTTERY_SPECIFIC_DRAW_TIMES[provinciaKey]?.[turno]) {
        horario = LOTTERY_SPECIFIC_DRAW_TIMES[provinciaKey][turno]
    } else {
        horario = HORARIOS_SORTEOS[turno as keyof typeof HORARIOS_SORTEOS]
    }

    if (!horario) {
        console.error(`Horario no definido para el turno: ${turno} (Provincia: ${provinciaKey || "N/A"})`)
        return -1
    }

    const [horas, minutos] = horario.split(":").map(Number)
    if (isNaN(horas) || isNaN(minutos)) {
        console.error(`Formato de horario inválido para el turno: ${turno} (${horario})`)
        return -1
    }

    return horas * 60 + minutos
}

function esSorteoFinalizado(turno: string, fecha: Date, provinciaKey?: string): boolean {
    const ahora = obtenerFechaArgentinaRobusta()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno, provinciaKey)

    let effectiveDisplayOffsetMinutes = DEFAULT_DISPLAY_OFFSET_MINUTES

    if (provinciaKey && LOTTERY_DISPLAY_CUTOFF_OVERRIDES[provinciaKey]) {
        const provinceOverrides = LOTTERY_DISPLAY_CUTOFF_OVERRIDES[provinciaKey]
        if (provinceOverrides[turno]) {
            effectiveDisplayOffsetMinutes = provinceOverrides[turno].displayOffsetMinutes
        }
    }

    const hoyArgentina = startOfDay(obtenerFechaArgentinaRobusta())

    if (isAfter(hoyArgentina, fecha)) {
        return true
    }

    const finalizado = tiempoActual > tiempoSorteo + effectiveDisplayOffsetMinutes
    return finalizado
}

function extraerNumerosFormato5($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    const textoCompleto = $("body").text()
    const regexTurno = new RegExp(`\\b${turno}\\b`, "gi")
    let match: RegExpExecArray | null

    while ((match = regexTurno.exec(textoCompleto)) !== null) {
        const indiceInicio = match.index
        const segmento = textoCompleto.substring(indiceInicio, indiceInicio + 1000)

        const patronEspaciado = /(\d+)\.\s*(\d{4,5})/g
        const numerosEncontrados: string[] = []
        let matchPatron: RegExpExecArray | null

        while ((matchPatron = patronEspaciado.exec(segmento)) !== null) {
            const numero = matchPatron[2]
            if (numero.length === 4) {
                numerosEncontrados.push(numero)
            } else if (numero.length === 5) {
                const ultimosCuatro = numero.substring(numero.length - 4)
                numerosEncontrados.push(ultimosCuatro)
            }
        }

        if (numerosEncontrados.length >= 18) {
            return numerosEncontrados.slice(0, 20)
        }

        const patronConcatenado = /(\d+\.\d{4,5})+/g
        const matchesConcatenados = segmento.match(patronConcatenado)
        if (matchesConcatenados) {
            for (const patron of matchesConcatenados) {
                const numerosEnPatron = patron.match(/\.(\d{4,5})/g)
                if (numerosEnPatron) {
                    for (const numeroConPunto of numerosEnPatron) {
                        const numero = numeroConPunto.substring(1)
                        if (numero.length === 4) {
                            numerosEncontrados.push(numero)
                        } else if (numero.length === 5) {
                            const ultimosCuatro = numero.substring(numero.length - 4)
                            numerosEncontrados.push(ultimosCuatro)
                        }
                    }
                }
            }
            if (numerosEncontrados.length >= 18) {
                return numerosEncontrados.slice(0, 20)
            }
        }

        const patronSinPuntos = /\d{80,100}/g
        const matchesSinPuntos = segmento.match(patronSinPuntos)
        if (matchesSinPuntos) {
            for (const secuenciaConcatenada of matchesSinPuntos) {
                const numerosSinPuntos: string[] = []
                for (let i = 0; i < secuenciaConcatenada.length - 3; i += 4) {
                    const numero = secuenciaConcatenada.substring(i, i + 4)
                    if (/^\d{4}$/.test(numero)) {
                        numerosSinPuntos.push(numero)
                    }
                }
                if (numerosSinPuntos.length >= 18) {
                    return numerosSinPuntos.slice(0, 20)
                }
            }
        }
    }
    return []
}

function extraerNumerosNeuquen($: cheerio.CheerioAPI, turno: string): string[] {
    const numerosFormato5 = extraerNumerosFormato5($, turno, "NEUQUEN")
    if (numerosFormato5.length >= 18) {
        return numerosFormato5
    }

    const selectoresNeuquen = [
        `.neuquen-${turno.toLowerCase()}`,
        `.sorteo-${turno.toLowerCase()}`,
        `[data-sorteo="${turno}"]`,
        `.resultado-${turno.toLowerCase()}`,
    ]
    for (const selector of selectoresNeuquen) {
        const elemento = $(selector)
        if (elemento.length > 0) {
            const numeros = elemento.text().match(/\b\d{4}\b/g) || []
            if (numeros.length >= 18) {
                return numeros.slice(0, 20)
            }
        }
    }

    const tablasNeuquen = $("table").toArray()
    for (const tabla of tablasNeuquen) {
        const $tabla = $(tabla)
        const textoTabla = $tabla.text().toLowerCase()
        if (textoTabla.includes("neuqu") && textoTabla.includes(turno.toLowerCase())) {
            const numeros: string[] = []
            $tabla.find("td, th").each((_, celda) => {
                const texto = $(celda).text().trim()
                if (/^\d{4}$/.test(texto)) {
                    numeros.push(texto)
                }
            })
            if (numeros.length >= 18) {
                return numeros.slice(0, 20)
            }
        }
    }
    return extraerNumerosUltraEspecificos($, turno, "NEUQUEN")
}

function extraerNumerosMisiones($: cheerio.CheerioAPI, turno: string): string[] {
    const numerosFormato5 = extraerNumerosFormato5($, turno, "MISIONES")
    if (numerosFormato5.length >= 18) {
        return numerosFormato5
    }

    const selectoresMisiones = [
        `.misiones-${turno.toLowerCase()}`,
        `.sorteo-${turno.toLowerCase()}`,
        `[data-provincia="misiones"][data-turno="${turno}"]`,
        `.resultado-misiones-${turno.toLowerCase()}`,
    ]
    for (const selector of selectoresMisiones) {
        const elemento = $(selector)
        if (elemento.length > 0) {
            const numeros = elemento.text().match(/\b\d{4}\b/g) || []
            if (numeros.length >= 18) {
                return numeros.slice(0, 20)
            }
        }
    }

    const idsMisiones = [
        `#misiones-${turno.toLowerCase()}`,
        `#sorteo-misiones-${turno.toLowerCase()}`,
        `#resultado-${turno.toLowerCase()}-misiones`,
    ]
    for (const id of idsMisiones) {
        const elemento = $(id)
        if (elemento.length > 0) {
            const numeros = elemento.text().match(/\b\d{4}\b/g) || []
            if (numeros.length >= 18) {
                return numeros.slice(0, 20)
            }
        }
    }

    const seccionesMisiones = $("div, section, article").toArray()
    for (const seccion of seccionesMisiones) {
        const $seccion = $(seccion)
        const textoSeccion = $seccion.text().toLowerCase()
        if (textoSeccion.includes("misiones") && textoSeccion.includes(turno.toLowerCase())) {
            const otrosTurnos = ["previa", "primera", "matutina", "vespertina", "nocturna"].filter(
                (t) => t !== turno.toLowerCase(),
            )
            const contieneOtroTurno = otrosTurnos.some(
                (otroTurno) =>
                    textoSeccion.includes(otroTurno) &&
                    textoSeccion.indexOf(otroTurno) !== textoSeccion.indexOf(turno.toLowerCase()),
            )
            if (!contieneOtroTurno) {
                const numeros = textoSeccion.match(/\b\d{4}\b/g) || []
                if (numeros.length >= 18) {
                    return numeros.slice(0, 20)
                }
            }
        }
    }
    return extraerNumerosUltraEspecificos($, turno, "MISIONES")
}

function extraerNumerosUltraEspecificos($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    const turnosConocidos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
    const otrosTurnos = turnosConocidos.filter((t) => t !== turno)

    const elementosConTurno = $(`*:contains("${turno}")`).toArray()
    for (const elemento of elementosConTurno) {
        const $elemento = $(elemento)
        const textoElemento = $elemento.text()

        const regexTurnoExacto = new RegExp(`\\b${turno}\\b`, "i")
        if (!regexTurnoExacto.test(textoElemento)) continue

        const contieneOtroTurno = otrosTurnos.some((otroTurno) => {
            const regexOtroTurno = new RegExp(`\\b${otroTurno}\\b`, "i")
            return regexOtroTurno.test(textoElemento)
        })

        if (contieneOtroTurno) {
            continue
        }

        const numeros = textoElemento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            return numeros.slice(0, 20)
        }
    }

    const textoCompleto = $("body").text()
    const regexTurno = new RegExp(`\\b${turno}\\b`, "gi")
    let match: RegExpExecArray | null

    while ((match = regexTurno.exec(textoCompleto)) !== null) {
        const indiceInicio = match.index
        let indiceFin = textoCompleto.length
        let siguienteTurnoEncontrado = false
        for (const otroTurno of otrosTurnos) {
            const regexOtroTurno = new RegExp(`\\b${otroTurno}\\b`, "i")
            const matchOtro = regexOtroTurno.exec(textoCompleto.substring(indiceInicio + turno.length))
            if (matchOtro) {
                const indiceOtro = indiceInicio + turno.length + matchOtro.index
                if (indiceOtro < indiceFin) {
                    indiceFin = indiceOtro
                    siguienteTurnoEncontrado = true
                }
            }
        }

        if (!siguienteTurnoEncontrado) {
            indiceFin = Math.min(indiceInicio + 400, textoCompleto.length)
        }

        const segmento = textoCompleto.substring(indiceInicio, indiceFin)
        const numeros = segmento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            return numeros.slice(0, 20)
        }
    }

    const tablas = $("table").toArray()
    for (const tabla of tablas) {
        const $tabla = $(tabla)
        const textoTabla = $tabla.text()

        const regexTurnoExacto = new RegExp(`\\b${turno}\\b`, "i")
        if (!regexTurnoExacto.test(textoTabla)) continue

        const contieneOtrosTurnos = otrosTurnos.some((otroTurno) => {
            const regexOtroTurno = new RegExp(`\\b${otroTurno}\\b`, "i")
            return regexOtroTurno.test(textoTabla)
        })

        if (!contieneOtrosTurnos) {
            const numeros: string[] = []
            $tabla.find("td, th").each((_, celda) => {
                const texto = $(celda).text().trim()
                if (/^\d{4}$/.test(texto)) {
                    numeros.push(texto)
                }
            })
            if (numeros.length >= 18) {
                return numeros.slice(0, 20)
            }
        }
    }
    return []
}

function validarResultadosUltraEstricto(numeros: string[], provincia: string, turno: string): boolean {
    if (numeros.length < 18) {
        return false
    }

    const numerosValidos = numeros.filter((num) => /^\d{4}$/.test(num) && num !== PLACEHOLDER_RESULT)

    if (numerosValidos.length < 18) {
        return false
    }

    let patronesSospechosos = 0
    for (const num of numerosValidos) {
        const numInt = Number.parseInt(num)
        if (numInt <= 30) {
            patronesSospechosos++
        }
        if (/^(\d)\1{3}$/.test(num)) {
            patronesSospechosos++
        }
        if (numInt <= 50 && num.startsWith("0")) {
            patronesSospechosos++
        }
    }

    const porcentajeSospechosos = (patronesSospechosos / numerosValidos.length) * 100
    if (porcentajeSospechosos > 15) {
        return false
    }

    const numerosUnicos = new Set(numerosValidos)
    if (numerosUnicos.size < numerosValidos.length * 0.9) {
        return false
    }

    return true
}

function reordenarNumeros(numeros: string[]): string[] {
    const numerosOrdenados = Array(20).fill(PLACEHOLDER_RESULT)
    numeros.forEach((num, index) => {
        if (index < 20) {
            const nuevoIndice = index % 2 === 0 ? index / 2 : 10 + Math.floor(index / 2)
            numerosOrdenados[nuevoIndice] = num
        }
    })
    return numerosOrdenados
}

async function obtenerResultadosConfiables(): Promise<Extracto[]> {
    const fechaActual = obtenerFechaArgentinaRobusta()
    const diaSemana = fechaActual.getDay() // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const fechaDisplay = formatearFechaArgentina(fechaActual, "dd/MM/yyyy")
    const nombreDia = formatearFechaArgentina(fechaActual, "EEEE").replace(/^\w/, (c) => c.toUpperCase())

    const scrapedResults: Extracto[] = []
    const allTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
        let turnosParaProvincia: string[] = []

        if (provinciaKey === "MONTEVIDEO") {
            if (diaSemana === 0) {
                turnosParaProvincia = []
            } else if (diaSemana === 6) {
                turnosParaProvincia = ["Nocturna"]
            } else {
                turnosParaProvincia = ["Matutina", "Nocturna"]
            }
        } else if (provinciaKey === "SANTIAGO") {
            if (diaSemana === 0) {
                turnosParaProvincia = ["Matutina", "Vespertina"]
            } else {
                turnosParaProvincia = allTurnos
            }
        } else if (provinciaKey === "SALTA") {
            if (diaSemana === 0) {
                turnosParaProvincia = ["Matutina", "Vespertina"]
            } else {
                turnosParaProvincia = ["Primera", "Matutina", "Vespertina", "Nocturna"]
            }
        } else if (provinciaKey === "JUJUY") {
            turnosParaProvincia = allTurnos
        } else {
            if (diaSemana === 0) {
                turnosParaProvincia = []
            } else {
                turnosParaProvincia = allTurnos
            }
        }

        for (const turno of turnosParaProvincia) {
            const isManualEntryToday =
                diaSemana === 0 && // Solo aplica a domingos
                MANUAL_ENTRY_LOTTERIES_ON_SUNDAY[provinciaKey] &&
                MANUAL_ENTRY_LOTTERIES_ON_SUNDAY[provinciaKey].includes(turno)

            if (isManualEntryToday) {
                continue
            }

            if (esSorteoFinalizado(turno, fechaActual, provinciaKey)) {
                const numeros = await obtenerResultadoEspecifico(provinciaKey, turno)
                if (numeros !== null && numeros.length > 0) {
                    scrapedResults.push({
                        id: `${provinciaKey}-${turno}-${fechaDisplay}`,
                        fecha: fechaDisplay,
                        dia: nombreDia,
                        sorteo: turno,
                        loteria:
                            provinciaKey === "NACION" ? "Nacional" : provinciaKey === "PROVINCIA" ? "Provincial" : provinciaKey,
                        provincia: provinciaKey,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[provinciaKey as keyof typeof URLS_PIZARRAS] || "",
                        necesita: "No",
                        confirmado: "No",
                    })
                }
            }
        }
    }
    return scrapedResults
}

export async function GET(request: Request) {
    console.log("=== 🚀 API GET - RAILWAY OPTIMIZADA ===")
    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"

        const fechaActualArgentina = obtenerFechaArgentinaRobusta()
        let fechaConsulta: Date

        if (parametroFecha) {
            fechaConsulta = parsearFechaConsulta(parametroFecha)
        } else {
            fechaConsulta = startOfDay(fechaActualArgentina)
        }

        const fechaDisplayConsulta = format(fechaConsulta, "dd/MM/yyyy", { locale: es })
        const fechaKeyFirebase = format(fechaConsulta, "yyyy-MM-dd")

        const fechaHoyKey = formatearFechaArgentina(startOfDay(fechaActualArgentina), "yyyy-MM-dd")
        const esHoyEnArgentina = fechaKeyFirebase === fechaHoyKey

        console.log(`🔥 Firebase Project ID (from env): ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NOT SET"}`)
        console.log(`GET Request: Date=${fechaDisplayConsulta}, ForceRefresh=${forceRefresh}, IsToday=${esHoyEnArgentina}`)

        let extractosFromFirebase: Extracto[] = []
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            const data = docSnap.data()
            let resultadosData: ResultadoDia | null = null

            if (data[fechaDisplayConsulta]) {
                resultadosData = data[fechaDisplayConsulta] as ResultadoDia
            } else {
                const fechasEncontradas = Object.keys(data).filter((key) => key.includes("/"))
                if (fechasEncontradas.length > 0) {
                    let fechaMasCercanaKey = fechasEncontradas[0]
                    let menorDiferencia = Number.MAX_SAFE_INTEGER
                    for (const fechaEncontradaKey of fechasEncontradas) {
                        try {
                            const fechaEncontradaObj = parse(fechaEncontradaKey, "dd/MM/yyyy", new Date())
                            const diferencia = Math.abs(fechaEncontradaObj.getTime() - fechaConsulta.getTime())
                            if (diferencia < menorDiferencia) {
                                menorDiferencia = diferencia
                                fechaMasCercanaKey = fechaEncontradaKey
                            }
                        } catch (error) {
                            console.warn(`⚠️ Error parseando fecha ${fechaEncontradaKey}:`, error)
                        }
                    }
                    resultadosData = data[fechaMasCercanaKey] as ResultadoDia
                }
            }

            if (resultadosData && resultadosData.resultados) {
                extractosFromFirebase = resultadosData.resultados.flatMap((resultado: any) => {
                    const sorteos = Object.entries(resultado.sorteos || {})
                    return sorteos.map(([turno, numeros]) => ({
                        id: `${resultado.provincia}-${turno}-${resultadosData.fecha}`,
                        fecha: resultadosData.fecha,
                        dia: resultadosData.dia,
                        sorteo: turno,
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros as string[],
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                        necesita: "No",
                        confirmado: "No",
                    }))
                })
            }
        }

        let finalResults: Extracto[] = [...extractosFromFirebase]
        const resultsMap = new Map<string, Extracto>(finalResults.map((r) => [r.id, r]))

        if (forceRefresh || esHoyEnArgentina) {
            const scrapedResults = await obtenerResultadosConfiables()
            for (const scraped of scrapedResults) {
                resultsMap.set(scraped.id, scraped)
            }
            finalResults = Array.from(resultsMap.values())

            if (finalResults.length > 0) {
                const resultadosAgrupadosPorProvincia = new Map<string, Resultado>()
                for (const extracto of finalResults) {
                    let provinciaResultado = resultadosAgrupadosPorProvincia.get(extracto.provincia || "")
                    if (!provinciaResultado) {
                        provinciaResultado = {
                            loteria: extracto.loteria,
                            provincia: extracto.provincia || "",
                            sorteos: {},
                        }
                        resultadosAgrupadosPorProvincia.set(extracto.provincia || "", provinciaResultado)
                    }
                    provinciaResultado.sorteos[extracto.sorteo] = extracto.numeros
                }

                const resultadosParaGuardar: Resultado[] = Array.from(resultadosAgrupadosPorProvincia.values())
                const dataToSave: ResultadoDia = {
                    fecha: fechaDisplayConsulta,
                    dia: formatearFechaArgentina(fechaConsulta, "EEEE").replace(/^\w/, (c) => c.toUpperCase()),
                    resultados: resultadosParaGuardar,
                }

                const docRefToSave = doc(db, "extractos", fechaKeyFirebase)
                const dataObjectForFirebase = {
                    [fechaDisplayConsulta]: dataToSave,
                }
                await setDoc(docRefToSave, dataObjectForFirebase, { merge: true })
            }
        }

        return NextResponse.json(finalResults, { headers: corsHeaders })
    } catch (error) {
        console.error("❌ Error en GET:", error)
        return NextResponse.json([], { status: 200, headers: corsHeaders })
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // Removed DELETE
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    })
}

export async function POST(request: Request) {
    console.log("📝 Iniciando actualización manual (POST) - RAILWAY OPTIMIZADA")
    console.log(`🔥 Firebase Project ID (from env): ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NOT SET"}`)

    try {
        const { provincia, turno, fecha, numeros } = await request.json()
        console.log(
            `📥 POST - Datos recibidos: Provincia=${provincia}, Turno=${turno}, Fecha=${fecha}, Numeros.length=${numeros.length}`,
        )

        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            console.error("❌ POST - Datos incompletos o inválidos recibidos.")
            throw new Error("Datos incompletos o inválidos")
        }

        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = formatearFechaArgentina(fechaArgentina, "yyyy-MM-dd")
        const nombreDia = formatearFechaArgentina(fechaArgentina, "EEEE").replace(/^\w/, (c) => c.toUpperCase())

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let datosDia: ResultadoDia
        if (docSnap.exists()) {
            const data = docSnap.data()
            console.log(
                `📋 POST - Documento Firebase existe para ${fechaKeyFirebase}. Data completa: ${JSON.stringify(data).substring(0, 500)}...`,
            )
            if (data[fecha]) {
                datosDia = data[fecha] as ResultadoDia
                console.log(
                    `📋 POST - Estructura anidada para fecha ${fecha} encontrada. Resultados existentes: ${datosDia.resultados.length} provincias.`,
                )
            } else {
                datosDia = {
                    fecha: fecha,
                    dia: nombreDia,
                    resultados: [],
                }
                console.log(
                    `📋 POST - Creando nueva estructura para fecha ${fecha} dentro del documento existente (clave de fecha no encontrada).`,
                )
            }
        } else {
            datosDia = {
                fecha: fecha,
                dia: nombreDia,
                resultados: [],
            }
            console.log(`📋 POST - Documento no existe. Creando nuevo documento para ${fechaKeyFirebase}.`)
        }

        let provinciaResultado = datosDia.resultados.find((r) => r.provincia === provincia)

        if (!provinciaResultado) {
            provinciaResultado = {
                loteria: provincia === "NACION" ? "Nacional" : provincia === "PROVINCIA" ? "Provincial" : provincia,
                provincia: provincia,
                sorteos: {},
            }
            datosDia.resultados.push(provinciaResultado)
            console.log(`📋 POST - Provincia ${provincia} no encontrada en resultados, agregando nueva provincia.`)
        } else {
            console.log(
                `📋 POST - Provincia ${provincia} encontrada en resultados. Sorteos existentes: ${Object.keys(provinciaResultado.sorteos).join(", ")}.`,
            )
        }

        provinciaResultado.sorteos[turno] = numeros

        console.log(
            `✅ POST - Sorteo ${turno} de ${provincia} actualizado en memoria. Números: ${numeros.slice(0, 5).join(", ")}...`,
        )
        console.log(
            `✅ POST - Estado actual de datosDia.resultados para ${provincia}: ${JSON.stringify(provinciaResultado.sorteos)}`,
        )

        const dataParaGuardar: ResultadoDia = {
            fecha: fecha,
            dia: nombreDia,
            resultados: datosDia.resultados,
        }

        console.log(
            `💾 POST - Datos FINALES a guardar en Firebase para ${fechaKeyFirebase} bajo clave ${fecha}: ${JSON.stringify(dataParaGuardar).substring(0, 1000)}...`,
        )
        await setDoc(docRef, dataParaGuardar, { merge: true })
        console.log(`✅ POST - Operación setDoc completada exitosamente para ${provincia} - ${turno}.`)

        return NextResponse.json({ success: true, message: "Actualizado manualmente" }, { headers: corsHeaders })
    } catch (error) {
        console.error("❌ POST - Error en la actualización manual:", error)
        return NextResponse.json(
            {
                error: "Error al actualizar",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500, headers: corsHeaders },
        )
    }
}

async function obtenerResultadoEspecifico(provinciaKey: string, turno: string): Promise<string[] | null> {
    try {
        const pizarraUrl = URLS_PIZARRAS[provinciaKey as keyof typeof URLS_PIZARRAS]
        if (!pizarraUrl) {
            console.error(`❌ URL no encontrada para la provincia: ${provinciaKey}`)
            return null
        }

        const respuesta = await obtenerConTiempoLimite(pizarraUrl)

        if (!respuesta.ok) {
            console.error(`❌ Error al obtener la pizarra para ${provinciaKey}: ${respuesta.status}`)
            return null
        }

        const html = await respuesta.text()
        const $ = cheerio.load(html)
        let numeros: string[] = []

        switch (provinciaKey) {
            case "NEUQUEN":
                numeros = extraerNumerosNeuquen($, turno)
                break
            case "MISIONES":
                numeros = extraerNumerosMisiones($, turno)
                break
            default:
                numeros = extraerNumerosUltraEspecificos($, turno, provinciaKey)
                break
        }

        if (validarResultadosUltraEstricto(numeros, provinciaKey, turno)) {
            return reordenarNumeros(numeros)
        } else {
            return null
        }
    } catch (error) {
        console.error(`❌ Error en obtenerResultadoEspecifico para ${provinciaKey} - ${turno}:`, error)
        return null
    }
}
