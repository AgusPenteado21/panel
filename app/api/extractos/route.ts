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
    fecha: string
    dia: string
    sorteo: string
    loteria: string
    numeros: string[]
    pizarraLink: string
    necesita: string
    confirmado: string
    provincia?: string
}

const PLACEHOLDER_RESULT = "----" // Placeholder para resultados no disponibles

// 🔥 FUNCIÓN ULTRA ROBUSTA PARA RAILWAY
function obtenerFechaArgentinaRobusta(): Date {
    try {
        console.log("🌍 === DIAGNÓSTICO DE ZONA HORARIA ===")
        const ahoraUTC = new Date()
        console.log(`🕐 UTC Original: ${ahoraUTC.toISOString()}`)
        console.log(`🕐 UTC toString: ${ahoraUTC.toString()}`)
        // 🆕 MÉTODO 1: Offset manual directo (más confiable)
        const offsetArgentina = -3 * 60 // Argentina es UTC-3 (en minutos)
        const offsetLocal = ahoraUTC.getTimezoneOffset() // Offset del servidor en minutos
        console.log(`⏰ Offset Argentina: ${offsetArgentina} minutos`)
        console.log(`⏰ Offset Servidor: ${offsetLocal} minutos`)
        // Calcular diferencia total
        const diferenciaMinutos = offsetLocal + offsetArgentina
        const fechaArgentina = new Date(ahoraUTC.getTime() + diferenciaMinutos * 60 * 1000)
        console.log(`🇦🇷 Argentina Calculada: ${fechaArgentina.toISOString()}`)
        console.log(`🇦🇷 Argentina toString: ${fechaArgentina.toString()}`)
        // 🆕 MÉTODO 2: Verificación con Intl (backup)
        let fechaIntl: Date | null = null
        try {
            const formatter = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Argentina/Buenos_Aires",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            })
            const parts = formatter.formatToParts(ahoraUTC)
            const partsObj = parts.reduce((acc, part) => {
                acc[part.type] = part.value
                return acc
            }, {} as any)
            fechaIntl = new Date(
                `${partsObj.year}-${partsObj.month}-${partsObj.day}T${partsObj.hour}:${partsObj.minute}:${partsObj.second}`,
            )
            console.log(`🌐 Intl Argentina: ${fechaIntl.toISOString()}`)
        } catch (error) {
            console.log(`⚠️ Intl falló: ${error}`)
        }
        // 🆕 MÉTODO 3: Verificación con date-fns (backup)
        let fechaDateFns: Date | null = null
        try {
            fechaDateFns = toZonedTime(ahoraUTC, "America/Argentina/Buenos_Aires")
            console.log(`📅 date-fns Argentina: ${fechaDateFns.toISOString()}`)
        } catch (error) {
            console.log(`⚠️ date-fns falló: ${error}`)
        }
        // 🔥 DECISIÓN: Usar el método manual como principal
        const fechaFinal = fechaArgentina
        console.log(`✅ FECHA FINAL SELECCIONADA: ${fechaFinal.toISOString()}`)
        console.log(`📅 Formateada: ${format(fechaFinal, "dd/MM/yyyy HH:mm:ss", { locale: es })}`)
        console.log(`📅 Solo fecha: ${format(fechaFinal, "yyyy-MM-dd")}`)
        return fechaFinal
    } catch (error) {
        console.error("❌ Error total en fecha Argentina:", error)
        // Último recurso: UTC-3 fijo
        const fallback = new Date(Date.now() - 3 * 60 * 60 * 1000)
        console.log(`🆘 FALLBACK: ${fallback.toISOString()}`)
        return fallback
    }
}

// 🆕 FUNCIÓN PARA PARSEAR FECHA DE CONSULTA (yyyy-MM-dd)
function parsearFechaConsulta(fechaString: string): Date {
    try {
        console.log(`📥 PARSEANDO FECHA CONSULTA: ${fechaString}`)
        // Parsear como fecha local Argentina
        const [year, month, day] = fechaString.split("-").map(Number)
        // Crear fecha en zona horaria Argentina (mediodía para evitar problemas de borde)
        const fechaArgentina = new Date()
        fechaArgentina.setFullYear(year, month - 1, day)
        fechaArgentina.setHours(12, 0, 0, 0) // Mediodía Argentina
        // Ajustar a zona horaria Argentina
        const offsetArgentina = -3 * 60 // UTC-3 en minutos
        const offsetLocal = fechaArgentina.getTimezoneOffset()
        const diferenciaMinutos = offsetLocal + offsetArgentina
        const fechaFinal = new Date(fechaArgentina.getTime() + diferenciaMinutos * 60 * 1000)
        console.log(`📅 Fecha parseada: ${fechaString} → ${fechaFinal.toISOString()}`)
        console.log(`📅 Fecha display: ${format(fechaFinal, "dd/MM/yyyy")}`)
        return startOfDay(fechaFinal)
    } catch (error) {
        console.error("❌ Error parseando fecha consulta:", error)
        return startOfDay(new Date(fechaString))
    }
}

// 🆕 FUNCIÓN PARA FORMATEAR FECHAS CONSISTENTE
function formatearFechaArgentina(fecha: Date, formato: string): string {
    try {
        // Asegurar que estamos trabajando con fecha Argentina
        const fechaArgentina = new Date(fecha)
        const resultado = format(fechaArgentina, formato, { locale: es })
        console.log(`📅 FORMATO: ${fecha.toISOString()} → ${formato} → ${resultado}`)
        return resultado
    } catch (error) {
        console.error("❌ Error formateando fecha:", error)
        return format(fecha, formato, { locale: es })
    }
}

// 🆕 FUNCIÓN PARA DETECTAR ENTORNO
function detectarEntorno(): string {
    const entorno = process.env.NODE_ENV || "development"
    const esRailway = process.env.RAILWAY_ENVIRONMENT_NAME !== undefined
    const esVercel = process.env.VERCEL !== undefined
    // 🔥 INFORMACIÓN ESPECÍFICA DE RAILWAY
    const railwayRegion = process.env.RAILWAY_REGION || "unknown"
    const railwayService = process.env.RAILWAY_SERVICE_NAME || "unknown"
    console.log(`🌍 ENTORNO DETECTADO:`)
    console.log(`  - NODE_ENV: ${entorno}`)
    console.log(`  - Railway: ${esRailway}`)
    console.log(`  - Railway Region: ${railwayRegion}`)
    console.log(`  - Railway Service: ${railwayService}`)
    console.log(`  - Vercel: ${esVercel}`)
    console.log(`  - TZ: ${process.env.TZ || "No definida"}`)
    console.log(`  - Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
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
}
const HORARIOS_SORTEOS = {
    Previa: "10:15",
    Primera: "12:00",
    Matutina: "15:00",
    Vespertina: "18:00",
    Nocturna: "21:00",
}

// 🔥 FUNCIÓN CORREGIDA CON HEADERS COMPATIBLES
async function obtenerConTiempoLimite(url: string, opciones: RequestInit = {}): Promise<Response> {
    const controlador = new AbortController()
    const id = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_FETCH)
    try {
        const timestamp = Date.now()
        const urlConTimestamp = `${url}${url.includes("?") ? "&" : "?"}_t=${timestamp}`
        // 🔥 HEADERS CORREGIDOS - ESTRUCTURA COMPATIBLE
        const entorno = detectarEntorno()
        // Headers base comunes
        const headersBase: Record<string, string> = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        }
        // Headers específicos por entorno
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
        // Combinar headers
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
        console.log(`🌐 FETCH ${url}: Status ${respuesta.status} (${entorno})`)
        return respuesta
    } catch (error) {
        clearTimeout(id)
        console.error(`❌ Error en obtenerConTiempoLimite para ${url}:`, error)
        throw error
    }
}

function obtenerTiempoSorteo(turno: string): number {
    const horario = HORARIOS_SORTEOS[turno as keyof typeof HORARIOS_SORTEOS]
    if (!horario) {
        console.error(`Horario no definido para el turno: ${turno}`)
        return -1
    }
    const [horas, minutos] = horario.split(":").map(Number)
    if (isNaN(horas) || isNaN(minutos)) {
        console.error(`Formato de horario inválido para el turno: ${turno}`)
        return -1
    }
    return horas * 60 + minutos
}

// 🔥 FUNCIÓN MEJORADA CON LOGS DETALLADOS
function esSorteoFinalizado(turno: string, fecha: Date): boolean {
    const ahora = obtenerFechaArgentinaRobusta()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)
    const hoyArgentina = startOfDay(obtenerFechaArgentinaRobusta())

    // 🔥 LOGS DETALLADOS PARA DEBUG
    console.log(`⏰ VERIFICANDO SORTEO: ${turno}`)
    console.log(
        `  - Hora actual: ${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, "0")} (${tiempoActual} min)`,
    )
    console.log(
        `  - Hora sorteo: ${Math.floor(tiempoSorteo / 60)}:${(tiempoSorteo % 60).toString().padStart(2, "0")} (${tiempoSorteo} min)`,
    )
    console.log(`  - Fecha consulta: ${formatearFechaArgentina(fecha, "dd/MM/yyyy")}`)
    console.log(`  - Hoy Argentina: ${formatearFechaArgentina(hoyArgentina, "dd/MM/yyyy")}`)

    if (isAfter(hoyArgentina, fecha)) {
        console.log(`  ✅ FINALIZADO: Fecha pasada`)
        return true
    }

    // Considerar finalizado 30 minutos después de la hora del sorteo para mayor seguridad
    const finalizado = tiempoActual > tiempoSorteo + 30
    console.log(
        `  ${finalizado ? "✅" : "⏰"} ${finalizado ? "FINALIZADO" : "PENDIENTE"}: ${tiempoActual} > ${tiempoSorteo + 30}`,
    )
    return finalizado
}

// 🔥 FUNCIÓN CORREGIDA PARA DETECTAR NÚMEROS CON FORMATO ESPACIADO
function extraerNumerosFormato5($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    console.log(`🔢 EXTRACCIÓN FORMATO 5 NÚMEROS: ${provincia} - ${turno}`)
    const textoCompleto = $("body").text()
    // Buscar el turno específico en el texto
    const regexTurno = new RegExp(`\\b${turno}\\b`, "gi")
    let match: RegExpExecArray | null
    while ((match = regexTurno.exec(textoCompleto)) !== null) {
        const indiceInicio = match.index
        // Buscar en los próximos 1000 caracteres después del turno (aumentado para capturar más)
        const segmento = textoCompleto.substring(indiceInicio, indiceInicio + 1000)
        console.log(`📄 Segmento analizado: "${segmento.substring(0, 200)}..."`)
        // 🔥 PATRÓN CORREGIDO: Buscar secuencias como "1." seguido de espacios/saltos y luego números de 4-5 dígitos
        // Patrón: número + punto + espacios/saltos + número de 4-5 dígitos
        const patronEspaciado = /(\d+)\.\s*\s*(\d{4,5})/g
        const numerosEncontrados: string[] = []
        let matchPatron: RegExpExecArray | null
        console.log(`🔍 Buscando patrón espaciado en segmento...`)
        while ((matchPatron = patronEspaciado.exec(segmento)) !== null) {
            const posicion = matchPatron[1] // El número antes del punto (1, 2, 3, etc.)
            const numero = matchPatron[2] // El número de 4-5 dígitos
            console.log(`🎯 Encontrado: Posición ${posicion} → Número ${numero}`)
            if (numero.length === 4) {
                numerosEncontrados.push(numero)
            } else if (numero.length === 5) {
                // 🔥 CORRECCIÓN: Si tiene 5 dígitos, tomar los ÚLTIMOS 4
                const ultimosCuatro = numero.substring(numero.length - 4)
                numerosEncontrados.push(ultimosCuatro)
                console.log(`🔄 Número de 5 dígitos: ${numero} → ${ultimosCuatro}`)
            }
        }
        console.log(`🔢 Números extraídos del patrón espaciado:`, numerosEncontrados)
        if (numerosEncontrados.length >= 18) {
            console.log(`✅ FORMATO ESPACIADO: Encontrados ${numerosEncontrados.length} números válidos`)
            return numerosEncontrados.slice(0, 20)
        }

        // 🆕 PATRÓN ALTERNATIVO 1: Formato concatenado original "1.XXXX2.XXXX"
        const patronConcatenado = /(\d+\.\d{4,5})+/g
        const matchesConcatenados = segmento.match(patronConcatenado)
        if (matchesConcatenados) {
            console.log(`🔗 Patrones concatenados encontrados:`, matchesConcatenados)
            for (const patron of matchesConcatenados) {
                // Extraer números después de cada punto
                const numerosEnPatron = patron.match(/\.(\d{4,5})/g)
                if (numerosEnPatron) {
                    for (const numeroConPunto of numerosEnPatron) {
                        const numero = numeroConPunto.substring(1) // Quitar el punto
                        if (numero.length === 4) {
                            numerosEncontrados.push(numero)
                        } else if (numero.length === 5) {
                            // 🔥 CORRECCIÓN: Si tiene 5 dígitos, tomar los ÚLTIMOS 4
                            const ultimosCuatro = numero.substring(numero.length - 4)
                            numerosEncontrados.push(ultimosCuatro)
                            console.log(`🔄 Número de 5 dígitos: ${numero} → ${ultimosCuatro}`)
                        }
                    }
                }
            }
            if (numerosEncontrados.length >= 18) {
                console.log(`✅ FORMATO CONCATENADO: Encontrados ${numerosEncontrados.length} números válidos`)
                return numerosEncontrados.slice(0, 20)
            }
        }

        // 🆕 PATRÓN ALTERNATIVO 2: Números concatenados sin puntos
        const patronSinPuntos = /\d{80,100}/g
        const matchesSinPuntos = segmento.match(patronSinPuntos)
        if (matchesSinPuntos) {
            console.log(`🔗 Patrones sin puntos encontrados:`, matchesSinPuntos)
            for (const secuenciaConcatenada of matchesSinPuntos) {
                // Dividir en grupos de 4 dígitos
                const numerosSinPuntos: string[] = []
                for (let i = 0; i < secuenciaConcatenada.length - 3; i += 4) {
                    const numero = secuenciaConcatenada.substring(i, i + 4)
                    if (/^\d{4}$/.test(numero)) {
                        numerosSinPuntos.push(numero)
                    }
                }
                console.log(`🔢 Números de secuencia sin puntos:`, numerosSinPuntos.slice(0, 10))
                if (numerosSinPuntos.length >= 18) {
                    console.log(`✅ SIN PUNTOS: Encontrados ${numerosSinPuntos.length} números válidos`)
                    return numerosSinPuntos.slice(0, 20)
                }
            }
        }
    }
    console.log(`❌ FORMATO 5: No se encontraron números para ${provincia} - ${turno}`)
    return []
}

// 🆕 FUNCIÓN ESPECÍFICA PARA NEUQUÉN CON FORMATO ESPACIADO
function extraerNumerosNeuquen($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🏔️ EXTRACCIÓN ESPECÍFICA NEUQUÉN: ${turno}`)
    // 🔥 PRIMERO: Intentar formato espaciado (nuevo)
    const numerosFormato5 = extraerNumerosFormato5($, turno, "NEUQUEN")
    if (numerosFormato5.length >= 18) {
        return numerosFormato5
    }

    // Neuquén puede tener estructura HTML diferente
    // Estrategia 1: Buscar por clases específicas de Neuquén
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
                console.log(`✅ NEUQUÉN: Encontrado con selector ${selector}`)
                return numeros.slice(0, 20)
            }
        }
    }

    // Estrategia 2: Buscar en tablas específicas de Neuquén
    const tablasNeuquen = $("table").toArray()
    for (const tabla of tablasNeuquen) {
        const $tabla = $(tabla)
        const textoTabla = $tabla.text().toLowerCase()
        // Verificar si contiene "neuquén" y el turno
        if (textoTabla.includes("neuqu") && textoTabla.includes(turno.toLowerCase())) {
            const numeros: string[] = []
            $tabla.find("td, th").each((_, celda) => {
                const texto = $(celda).text().trim()
                if (/^\d{4}$/.test(texto)) {
                    numeros.push(texto)
                }
            })
            if (numeros.length >= 18) {
                console.log(`✅ NEUQUÉN: Encontrado en tabla específica`)
                return numeros.slice(0, 20)
            }
        }
    }

    // Estrategia 3: Usar la función ultra específica general
    return extraerNumerosUltraEspecificos($, turno, "NEUQUEN")
}

// 🆕 FUNCIÓN ESPECÍFICA PARA MISIONES CON FORMATO ESPACIADO
function extraerNumerosMisiones($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🌿 EXTRACCIÓN ESPECÍFICA MISIONES: ${turno}`)
    // 🔥 PRIMERO: Intentar formato espaciado (nuevo)
    const numerosFormato5 = extraerNumerosFormato5($, turno, "MISIONES")
    if (numerosFormato5.length >= 18) {
        return numerosFormato5
    }

    // Misiones puede tener estructura HTML diferente
    // Estrategia 1: Buscar por clases específicas de Misiones
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
                console.log(`✅ MISIONES: Encontrado con selector ${selector}`)
                return numeros.slice(0, 20)
            }
        }
    }

    // Estrategia 2: Buscar en divs con ID específicos de Misiones
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
                console.log(`✅ MISIONES: Encontrado con ID ${id}`)
                return numeros.slice(0, 20)
            }
        }
    }

    // Estrategia 3: Buscar en secciones que contengan "Misiones"
    const seccionesMisiones = $("div, section, article").toArray()
    for (const seccion of seccionesMisiones) {
        const $seccion = $(seccion)
        const textoSeccion = $seccion.text().toLowerCase()
        if (textoSeccion.includes("misiones") && textoSeccion.includes(turno.toLowerCase())) {
            // Verificar que no contenga otros turnos
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
                    console.log(`✅ MISIONES: Encontrado en sección específica`)
                    return numeros.slice(0, 20)
                }
            }
        }
    }

    // Estrategia 4: Usar la función ultra específica general
    return extraerNumerosUltraEspecificos($, turno, "MISIONES")
}

// 🔥 FUNCIÓN ULTRA ESPECÍFICA MEJORADA CON FORMATO ESPACIADO
function extraerNumerosUltraEspecificos($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    console.log(`🎯 EXTRACCIÓN ULTRA ESPECÍFICA: ${provincia} - ${turno}`)
    // 🔥 PRIMERO: Intentar formato espaciado
    const numerosFormato5 = extraerNumerosFormato5($, turno, provincia)
    if (numerosFormato5.length >= 18) {
        return numerosFormato5
    }

    const turnosConocidos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
    const otrosTurnos = turnosConocidos.filter((t) => t !== turno)

    // ESTRATEGIA 1: Buscar contenedores que SOLO contengan nuestro turno
    console.log(`📋 Estrategia 1: Contenedores exclusivos para ${turno}`)
    // Buscar todos los elementos que contengan el turno
    const elementosConTurno = $(`*:contains("${turno}")`).toArray()
    for (const elemento of elementosConTurno) {
        const $elemento = $(elemento)
        const textoElemento = $elemento.text()

        // Verificar que contenga EXACTAMENTE nuestro turno (palabra completa)
        const regexTurnoExacto = new RegExp(`\\b${turno}\\b`, "i")
        if (!regexTurnoExacto.test(textoElemento)) continue

        // CRÍTICO: Verificar que NO contenga ningún otro turno
        const contieneOtroTurno = otrosTurnos.some((otroTurno) => {
            const regexOtroTurno = new RegExp(`\\b${otroTurno}\\b`, "i")
            return regexOtroTurno.test(textoElemento)
        })
        if (contieneOtroTurno) {
            console.log(`⚠️ Elemento contiene otros turnos, DESCARTANDO`)
            continue
        }

        // Extraer SOLO números de 4 dígitos de este elemento específico
        const numeros = textoElemento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            console.log(`✅ ENCONTRADO en contenedor exclusivo: ${numeros.length} números`)
            return numeros.slice(0, 20)
        }
    }

    // ESTRATEGIA 2: Segmentación ULTRA precisa del texto completo
    console.log(`📝 Estrategia 2: Segmentación ultra precisa`)
    const textoCompleto = $("body").text()
    const regexTurno = new RegExp(`\\b${turno}\\b`, "gi")
    let match: RegExpExecArray | null
    while ((match = regexTurno.exec(textoCompleto)) !== null) {
        const indiceInicio = match.index
        // Encontrar el PRIMER otro turno que aparezca después
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
        // Si no hay otro turno después, limitar a 400 caracteres
        if (!siguienteTurnoEncontrado) {
            indiceFin = Math.min(indiceInicio + 400, textoCompleto.length)
        }

        // Extraer SOLO el segmento entre nuestro turno y el siguiente
        const segmento = textoCompleto.substring(indiceInicio, indiceFin)
        console.log(`📄 Segmento aislado: "${segmento.substring(0, 80)}..."`)
        const numeros = segmento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            console.log(`✅ ENCONTRADO en segmento aislado: ${numeros.length} números`)
            return numeros.slice(0, 20)
        }
    }

    // ESTRATEGIA 3: Tablas con verificación ULTRA estricta
    console.log(`🗂️ Estrategia 3: Tablas ultra específicas`)
    const tablas = $("table").toArray()
    for (const tabla of tablas) {
        const $tabla = $(tabla)
        const textoTabla = $tabla.text()

        // Debe contener EXACTAMENTE nuestro turno
        const regexTurnoExacto = new RegExp(`\\b${turno}\\b`, "i")
        if (!regexTurnoExacto.test(textoTabla)) continue

        // NO debe contener otros turnos
        const contieneOtrosTurnos = otrosTurnos.some((otroTurno) => {
            const regexOtroTurno = new RegExp(`\\b${otroTurno}\\b`, "i")
            return regexOtroTurno.test(textoTabla)
        })
        if (!contieneOtrosTurnos) {
            // Tabla EXCLUSIVA para nuestro turno
            const numeros: string[] = []
            $tabla.find("td, th").each((_, celda) => {
                const texto = $(celda).text().trim()
                if (/^\d{4}$/.test(texto)) {
                    numeros.push(texto)
                }
            })
            if (numeros.length >= 18) {
                console.log(`✅ ENCONTRADO en tabla exclusiva: ${numeros.length} números`)
                return numeros.slice(0, 20)
            }
        }
    }

    console.log(`❌ NO se encontraron números específicos para ${provincia} - ${turno}`)
    return []
}

// Validación ULTRA estricta - Solo acepta resultados muy confiables
function validarResultadosUltraEstricto(numeros: string[], provincia: string, turno: string): boolean {
    console.log(`🔍 Validación ultra estricta: ${provincia} - ${turno}`)
    if (numeros.length < 18) {
        console.log(`❌ Muy pocos números: ${numeros.length}`)
        return false
    }

    // Filtrar números válidos (4 dígitos, no placeholders)
    const numerosValidos = numeros.filter((num) => /^\d{4}$/.test(num) && num !== PLACEHOLDER_RESULT)
    if (numerosValidos.length < 18) {
        console.log(`❌ Muy pocos números válidos: ${numerosValidos.length}`)
        return false
    }

    // Verificar patrones sospechosos
    let patronesSospechosos = 0
    for (const num of numerosValidos) {
        const numInt = Number.parseInt(num)
        // Números muy bajos (posibles errores)
        if (numInt <= 30) patronesSospechosos++
        // Números repetitivos (1111, 2222, etc.)
        if (/^(\d)\1{3}$/.test(num)) patronesSospechosos++
        // Secuencias obvias (0001, 0002, etc.)
        if (numInt <= 50 && num.startsWith("0")) patronesSospechosos++
    }

    // Máximo 15% de patrones sospechosos
    const porcentajeSospechosos = (patronesSospechosos / numerosValidos.length) * 100
    if (porcentajeSospechosos > 15) {
        console.log(`❌ Demasiados patrones sospechosos: ${porcentajeSospechosos.toFixed(1)}%`)
        return false
    }

    // Verificar diversidad de números
    const numerosUnicos = new Set(numerosValidos)
    if (numerosUnicos.size < numerosValidos.length * 0.9) {
        console.log(`❌ Demasiados números repetidos`)
        return false
    }

    console.log(`✅ Validación exitosa: ${numerosValidos.length} números válidos`)
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

// 🆕 FUNCIÓN PRINCIPAL MEJORADA - Incluye lógica específica para nuevas provincias
async function obtenerResultadoEspecifico(provincia: string, turno: string): Promise<string[] | null> {
    try {
        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`❌ URL no encontrada para: ${provincia}`)
            return null
        }

        console.log(`
🔍 PROCESANDO: ${provincia} - ${turno}`)

        // 🔥 RETRY LOGIC PARA RAILWAY
        let intentos = 0
        const maxIntentos = 3
        let pizarraHtml: Response | null = null
        while (intentos < maxIntentos && !pizarraHtml?.ok) {
            try {
                intentos++
                console.log(`🔄 Intento ${intentos}/${maxIntentos} para ${provincia}`)
                pizarraHtml = await obtenerConTiempoLimite(url)
                if (!pizarraHtml.ok) {
                    console.error(`❌ Error HTTP ${pizarraHtml.status} para ${url} (intento ${intentos})`)
                    if (intentos < maxIntentos) {
                        await new Promise((resolve) => setTimeout(resolve, 2000)) // Esperar 2 segundos
                    }
                }
            } catch (error) {
                console.error(`❌ Error en intento ${intentos} para ${provincia}:`, error)
                if (intentos < maxIntentos) {
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                }
            }
        }

        if (!pizarraHtml?.ok) {
            console.error(`❌ Falló después de ${maxIntentos} intentos: ${provincia}`)
            return null
        }

        const contenidoPizarra = await pizarraHtml.text()
        const $ = cheerio.load(contenidoPizarra)
        let numeros: string[] = []

        // 🆕 USAR FUNCIONES ESPECÍFICAS PARA NUEVAS PROVINCIAS
        if (provincia === "NEUQUEN") {
            numeros = extraerNumerosNeuquen($, turno)
        } else if (provincia === "MISIONES") {
            numeros = extraerNumerosMisiones($, turno)
        } else {
            // Usar extracción ULTRA específica para provincias existentes
            numeros = extraerNumerosUltraEspecificos($, turno, provincia)
        }

        if (numeros.length === 0) {
            console.log(`❌ NO se encontraron números para ${provincia} - ${turno}`)
            return null
        }

        // Completar a 20 números si es necesario
        const numerosCompletos = [...numeros.slice(0, 20)]
        while (numerosCompletos.length < 20) {
            numerosCompletos.push(PLACEHOLDER_RESULT)
        }

        // APLICAR EL REORDENAMIENTO ESPECÍFICO
        const numerosReordenados = reordenarNumeros(numerosCompletos)

        // Validación ultra estricta
        if (!validarResultadosUltraEstricto(numerosReordenados, provincia, turno)) {
            console.log(`❌ VALIDACIÓN FALLÓ para ${provincia} - ${turno}`)
            return null
        }

        console.log(`✅ ÉXITO: ${provincia} - ${turno} → Números válidos encontrados`)
        console.log(`📊 NÚMEROS: ${numerosReordenados.slice(0, 10).join(", ")}...`)
        return numerosReordenados
    } catch (error) {
        console.error(`❌ ERROR: ${provincia} - ${turno}:`, error)
        return null
    }
}

// 🔥 FUNCIÓN PRINCIPAL CORREGIDA - SIN FILTROS RESTRICTIVOS GLOBALES DE DOMINGO
async function obtenerResultadosConfiables(): Promise<Extracto[]> {
    // Changed return type to Extracto[]
    console.log("🚀 INICIANDO EXTRACCIÓN ULTRA CONFIABLE - TODOS LOS RESULTADOS")
    // 🔥 DETECTAR ENTORNO AL INICIO
    const entorno = detectarEntorno()
    console.log(`🌍 EJECUTÁNDOSE EN: ${entorno.toUpperCase()}`)

    const fechaActual = obtenerFechaArgentinaRobusta()
    const diaSemana = fechaActual.getDay() // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const fechaDisplay = formatearFechaArgentina(fechaActual, "dd/MM/yyyy")
    const nombreDia = formatearFechaArgentina(fechaActual, "EEEE").replace(/^\w/, (c) => c.toUpperCase())
    const fechaKeyFirebase = formatearFechaArgentina(fechaActual, "yyyy-MM-dd")

    console.log(`📅 PROCESANDO FECHA: ${fechaDisplay} (${nombreDia})`)
    console.log(`📅 KEY FIREBASE: ${fechaKeyFirebase}`)

    const scrapedResults: Extracto[] = [] // Changed to Extracto[]

    const allTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    // Procesar cada provincia (incluyendo las nuevas)
    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
        console.log(`
🏛️ === PROVINCIA: ${provinciaKey} ===`)
        const provinciaData = {
            loteria: provinciaKey === "NACION" ? "Nacional" : provinciaKey === "PROVINCIA" ? "Provincial" : provinciaKey,
            provincia: provinciaKey,
            sorteos: {} as { [key: string]: string[] },
        }
        let tieneResultadosValidos = false
        let turnosParaProvincia: string[] = []

        // Determinar qué turnos son relevantes para esta provincia y día
        if (provinciaKey === "MONTEVIDEO") {
            if (diaSemana === 0) {
                // Domingo
                turnosParaProvincia = []
            } else if (diaSemana === 6) {
                // Sábado
                turnosParaProvincia = ["Nocturna"]
            } else {
                // Lunes-Viernes
                turnosParaProvincia = ["Matutina", "Nocturna"]
            }
        } else if (provinciaKey === "SANTIAGO") {
            // Santiago del Estero
            if (diaSemana === 0) {
                // Domingo
                turnosParaProvincia = ["Matutina", "Vespertina"]
            } else {
                // Lunes-Sábado
                turnosParaProvincia = allTurnos
            }
        } else {
            // Otras provincias
            if (diaSemana === 0) {
                // Domingo
                turnosParaProvincia = [] // No hay sorteos para otras provincias los domingos
            } else {
                // Lunes-Sábado
                turnosParaProvincia = allTurnos
            }
        }

        // Procesar cada turno relevante para la provincia y el día
        for (const turno of turnosParaProvincia) {
            console.log(`🔍 Intentando obtener: ${provinciaKey} - ${turno}`)
            // Solo procesar si el sorteo finalizó
            if (esSorteoFinalizado(turno, fechaActual)) {
                const numeros = await obtenerResultadoEspecifico(provinciaKey, turno)
                // SOLO agregar si se encontraron números válidos
                if (numeros !== null && numeros.length > 0) {
                    // Agregar a API - FORMATO CORRECTO PARA LA INTERFAZ EXISTENTE
                    scrapedResults.push({
                        // Changed to scrapedResults
                        id: `${provinciaKey}-${turno}-${fechaDisplay}`,
                        fecha: fechaDisplay,
                        dia: nombreDia,
                        sorteo: turno,
                        loteria: provinciaData.loteria,
                        provincia: provinciaKey,
                        numeros: numeros,
                        pizarraLink: pizarraUrl,
                        necesita: "No",
                        confirmado: "No",
                    })
                    // No necesitamos agregar a provinciaData.sorteos aquí si solo vamos a devolver scrapedResults
                    // y la lógica de Firebase se manejará en la función GET principal.
                    tieneResultadosValidos = true
                    console.log(`✅ AGREGADO A SCRAPED RESULTS: ${provinciaKey} - ${turno}`)
                } else {
                    console.log(`⏭️ OMITIDO: ${provinciaKey} - ${turno} (sin resultados confiables)`)
                }
            } else {
                console.log(`⏰ NO FINALIZADO: ${provinciaKey} - ${turno}`)
            }
        }
    }

    console.log(`
🏁 COMPLETADO SCRAPING: ${scrapedResults.length} resultados 100% CONFIABLES`)
    console.log(
        `📊 SCRAPED RESULTS:`,
        scrapedResults.map((r) => `${r.provincia}-${r.sorteo}`),
    )
    return scrapedResults
}

export async function GET(request: Request) {
    console.log("=== 🚀 API ULTRA CONFIABLE - RAILWAY OPTIMIZADA ===")
    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"
        console.log(`📥 PARÁMETROS: fecha=${parametroFecha}, forceRefresh=${forceRefresh}`)

        const fechaActualArgentina = obtenerFechaArgentinaRobusta()
        let fechaConsulta: Date
        if (parametroFecha) {
            // 🔥 USAR FUNCIÓN ROBUSTA PARA PARSEAR FECHA
            fechaConsulta = parsearFechaConsulta(parametroFecha)
            console.log(`📅 FECHA PARSEADA: ${parametroFecha} → ${fechaConsulta.toISOString()}`)
        } else {
            fechaConsulta = startOfDay(fechaActualArgentina)
            console.log(`📅 FECHA ACTUAL: ${fechaConsulta.toISOString()}`)
        }

        const fechaKeyFirebase = formatearFechaArgentina(fechaConsulta, "yyyy-MM-dd")
        const fechaDisplayConsulta = formatearFechaArgentina(fechaConsulta, "dd/MM/yyyy")

        // 🔥 COMPARACIÓN ROBUSTA DE FECHAS
        const fechaHoyKey = formatearFechaArgentina(startOfDay(fechaActualArgentina), "yyyy-MM-dd")
        const esHoyEnArgentina = fechaKeyFirebase === fechaHoyKey
        console.log(`📅 KEY FIREBASE CONSULTA: ${fechaKeyFirebase}`)
        console.log(`📅 KEY FIREBASE HOY: ${fechaHoyKey}`)
        console.log(`📅 FECHA DISPLAY: ${fechaDisplayConsulta}`)
        console.log(`📅 ES HOY: ${esHoyEnArgentina}`)

        let extractosFromFirebase: Extracto[] = []
        console.log(`📂 Consultando Firebase: ${fechaKeyFirebase}`)
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            const data = docSnap.data()
            console.log(`📋 Datos encontrados en Firebase para ${fechaKeyFirebase}:`, Object.keys(data))
            // 🔥 BUSCAR EN LA ESTRUCTURA ANIDADA POR FECHA
            let resultadosData: ResultadoDia | null = null
            // Buscar por fecha exacta
            if (data[fechaDisplayConsulta]) {
                resultadosData = data[fechaDisplayConsulta] as ResultadoDia
                console.log(`✅ Encontrado con fecha exacta: ${fechaDisplayConsulta}`)
            }
            // Buscar cualquier fecha en formato dd/MM/yyyy
            else {
                const fechasEncontradas = Object.keys(data).filter((key) => key.includes("/"))
                console.log(`🔍 Fechas encontradas en documento:`, fechasEncontradas)
                if (fechasEncontradas.length > 0) {
                    // 🆕 BUSCAR LA FECHA MÁS CERCANA A LA SOLICITADA
                    let fechaMasCercana = fechasEncontradas[0]
                    let menorDiferencia = Number.MAX_SAFE_INTEGER
                    for (const fechaEncontrada of fechasEncontradas) {
                        try {
                            const fechaEncontradaObj = parse(fechaEncontrada, "dd/MM/yyyy", new Date())
                            const diferencia = Math.abs(fechaEncontradaObj.getTime() - fechaConsulta.getTime())
                            if (diferencia < menorDiferencia) {
                                menorDiferencia = diferencia
                                fechaMasCercana = fechaEncontrada
                            }
                        } catch (error) {
                            console.log(`⚠️ Error parseando fecha ${fechaEncontrada}:`, error)
                        }
                    }
                    resultadosData = data[fechaMasCercana] as ResultadoDia
                    console.log(`✅ Usando fecha más cercana: ${fechaMasCercana}`)
                }
            }

            if (resultadosData && resultadosData.resultados) {
                console.log(`📊 Procesando ${resultadosData.resultados.length} provincias desde Firebase`)
                extractosFromFirebase = resultadosData.resultados.flatMap((resultado: any) => {
                    const sorteos = Object.entries(resultado.sorteos || {})
                    console.log(`🏛️ ${resultado.provincia}: ${sorteos.length} sorteos`)
                    return sorteos.map(([turno, numeros]) => ({
                        id: `${resultado.provincia}-${turno}-${resultadosData.fecha}`,
                        fecha: resultadosData.fecha,
                        dia: resultadosData.dia,
                        sorteo: turno,
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros as string[], // <--- FIX: Cast 'numeros' to string[]
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                        necesita: "No",
                        confirmado: "No",
                    }))
                })
                console.log(`✅ ${extractosFromFirebase.length} resultados formateados desde Firebase`)
            } else {
                console.log(`❌ No se encontraron resultados válidos en la estructura de Firebase para ${fechaKeyFirebase}`)
            }
        } else {
            console.log(`❌ No existe documento para ${fechaKeyFirebase} en Firebase`)
        }

        let finalResults: Extracto[] = [...extractosFromFirebase] // Empezar con los resultados de Firebase
        const resultsMap = new Map<string, Extracto>(finalResults.map((r) => [r.id, r]))

        // Si es hoy o se fuerza, hacer scraping y MERGEAR con los resultados de Firebase
        if (forceRefresh || esHoyEnArgentina) {
            console.log(forceRefresh ? "🔄 FORZANDO ACTUALIZACIÓN (Scraping)" : "📅 CONSULTANDO HOY (Scraping)")
            const scrapedResults = await obtenerResultadosConfiables() // Esto realiza el scraping
            console.log(`📤 ${scrapedResults.length} resultados de scraping obtenidos`)

            // Fusionar los resultados del scraping en el mapa, sobrescribiendo si el ID ya existe
            for (const scraped of scrapedResults) {
                resultsMap.set(scraped.id, scraped)
            }
            finalResults = Array.from(resultsMap.values())
            console.log(`✅ Resultados finales después de la fusión con scraping: ${finalResults.length}`)
        } else {
            console.log(`⏭️ No se realiza scraping: No es hoy y no se forzó la actualización.`)
        }

        console.log(`📤 DEVOLVIENDO ${finalResults.length} resultados finales`)
        return NextResponse.json(finalResults, { headers: corsHeaders })
    } catch (error) {
        console.error("❌ Error en GET:", error)
        return NextResponse.json([], { status: 200, headers: corsHeaders })
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    console.log("📝 Actualización manual")
    try {
        const { provincia, turno, fecha, numeros } = await request.json()
        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos")
        }

        // 🔥 USAR FUNCIONES ROBUSTAS PARA FECHAS
        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = formatearFechaArgentina(fechaArgentina, "yyyy-MM-dd")
        const nombreDia = formatearFechaArgentina(fechaArgentina, "EEEE").replace(/^\w/, (c) => c.toUpperCase())

        console.log(`📅 POST - Fecha recibida: ${fecha}`)
        console.log(`📅 POST - Key Firebase: ${fechaKeyFirebase}`)
        console.log(`📅 POST - Nombre día: ${nombreDia}`)

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let datosDia: ResultadoDia

        // 🔥 LECTURA CORREGIDA: Buscar en estructura anidada
        if (docSnap.exists()) {
            const data = docSnap.data()
            if (data[fecha]) {
                // Estructura anidada por fecha
                datosDia = data[fecha] as ResultadoDia
                console.log(`📋 POST - Datos existentes encontrados para ${fecha}`)
            } else {
                // Crear nueva estructura
                datosDia = {
                    fecha: fecha,
                    dia: nombreDia,
                    resultados: [],
                }
                console.log(`📋 POST - Creando nueva estructura para ${fecha}`)
            }
        } else {
            datosDia = {
                fecha: fecha,
                dia: nombreDia,
                resultados: [],
            }
            console.log(`📋 POST - Creando documento nuevo para ${fechaKeyFirebase}`)
        }

        // Buscar si ya existe la provincia
        let provinciaResultado = datosDia.resultados.find((r) => r.provincia === provincia)
        if (!provinciaResultado) {
            // Si no existe la provincia, crearla
            provinciaResultado = {
                loteria: provincia === "NACION" ? "Nacional" : provincia === "PROVINCIA" ? "Provincial" : provincia,
                provincia: provincia,
                sorteos: {},
            }
            datosDia.resultados.push(provinciaResultado)
            console.log(`📋 POST - Provincia ${provincia} creada`)
        }

        // 🔥 CRÍTICO: PRESERVAR TODOS LOS SORTEOS EXISTENTES DE LA PROVINCIA
        // Solo actualizar el turno específico, mantener los demás
        provinciaResultado.sorteos[turno] = numeros
        console.log(
            `✅ Guardando ${provincia} - ${turno}. Sorteos totales de ${provincia}:`,
            Object.keys(provinciaResultado.sorteos),
        )

        // 🔥 GUARDADO CORREGIDO: Mantener estructura anidada por fecha
        const dataParaGuardar = {
            [fecha]: datosDia,
        }
        await setDoc(docRef, dataParaGuardar, { merge: true })

        console.log(`✅ Manual: ${provincia} - ${turno}`)
        return NextResponse.json({ success: true, message: "Actualizado manualmente" }, { headers: corsHeaders })
    } catch (error) {
        console.error("❌ Error manual:", error)
        return NextResponse.json(
            {
                error: "Error al actualizar",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500, headers: corsHeaders },
        )
    }
}

console.log("app/api/extractos/route.ts cargado - RAILWAY OPTIMIZADO CON DETECCIÓN FORMATO ESPACIADO.")
