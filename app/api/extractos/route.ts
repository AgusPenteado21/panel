import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { parse, format, startOfDay, isAfter } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { es } from "date-fns/locale"
import { db } from "@/lib/firebase" // Asegúrate que esta ruta a tu config de Firebase es correcta
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

const PLACEHOLDER_RESULT = "----" // Placeholder para resultados no disponibles

// Función para obtener la fecha actual en Argentina
function obtenerFechaArgentina() {
    const fechaActual = new Date()
    try {
        const fechaArgentina = toZonedTime(fechaActual, "America/Argentina/Buenos_Aires")
        return fechaArgentina
    } catch (error) {
        console.error("Error al usar toZonedTime, usando offset manual:", error)
        return new Date(fechaActual.getTime() - 3 * 60 * 60 * 1000)
    }
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
    TUCUMAN: "https://vivitusuerte.com/pizarra/tucuman",
}

const HORARIOS_SORTEOS = {
    Previa: "10:15",
    Primera: "12:00",
    Matutina: "15:00",
    Vespertina: "18:00",
    Nocturna: "21:00",
}

// Funciones auxiliares
async function obtenerConTiempoLimite(url: string, opciones: RequestInit = {}): Promise<Response> {
    const controlador = new AbortController()
    const id = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_FETCH)

    try {
        const timestamp = Date.now()
        const urlConTimestamp = `${url}${url.includes("?") ? "&" : "?"}_t=${timestamp}`
        const respuesta = await fetch(urlConTimestamp, {
            ...opciones,
            signal: controlador.signal,
            cache: "no-store",
            headers: {
                ...opciones.headers,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        })
        clearTimeout(id)
        return respuesta
    } catch (error) {
        clearTimeout(id)
        console.error(`Error en obtenerConTiempoLimite para ${url}:`, error)
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

function esSorteoFinalizado(turno: string, fecha: Date): boolean {
    const ahora = obtenerFechaArgentina()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)

    const hoyArgentina = startOfDay(obtenerFechaArgentina())
    if (isAfter(hoyArgentina, fecha)) {
        return true
    }

    // Considerar finalizado 15 minutos después de la hora del sorteo
    return tiempoActual > tiempoSorteo + 15
}

function reordenarNumeros(numeros: string[]): string[] {
    // Si tenemos exactamente 20 números, no reordenar, mantener el orden original
    if (numeros.length === 20 && numeros.every((num) => num !== PLACEHOLDER_RESULT && /^\d{4}$/.test(num))) {
        console.log("Manteniendo orden original de 20 números válidos")
        return numeros
    }

    // Si tenemos menos de 20 números válidos, completar con placeholders al final
    if (numeros.length < 20) {
        const numerosCompletos = [...numeros]
        while (numerosCompletos.length < 20) {
            numerosCompletos.push(PLACEHOLDER_RESULT)
        }
        console.log(`Completando ${20 - numeros.length} posiciones con placeholders`)
        return numerosCompletos
    }

    // Solo aplicar reordenamiento si es necesario (para casos específicos)
    const numerosOrdenados = Array(20).fill(PLACEHOLDER_RESULT)
    numeros.forEach((num, index) => {
        if (index < 20) {
            // Aplicar reordenamiento solo si es realmente necesario
            const nuevoIndice = index % 2 === 0 ? index / 2 : 10 + Math.floor(index / 2)
            if (nuevoIndice < 20) {
                numerosOrdenados[nuevoIndice] = num
            }
        }
    })
    return numerosOrdenados
}

function verificarNumerosValidos(numeros: string[]): boolean {
    // Filtrar placeholders antes de verificar patrones
    const numerosReales = numeros.filter((num) => num !== PLACEHOLDER_RESULT && /^\d{4}$/.test(num))

    if (numerosReales.length === 0) return false // Si no hay números reales, no es válido

    // Si tenemos al menos 15 números reales de 20, considerarlo válido
    if (numerosReales.length >= 15) {
        console.log(`Validación exitosa: ${numerosReales.length} números válidos de ${numeros.length}`)
        return true
    }

    // Para menos de 15 números, aplicar validación de patrones más flexible
    let patronesSimples = 0
    for (let i = 0; i < numerosReales.length; i++) {
        const numStr = numerosReales[i]
        const num = Number.parseInt(numStr, 10)

        if (num <= 20 && numStr.charAt(0) === "0") {
            patronesSimples++
        }
        if (/^(\d)\1{3}$/.test(numStr)) {
            patronesSimples++
        }
        if (i > 0) {
            const numAnterior = Number.parseInt(numerosReales[i - 1], 10)
            if (num === numAnterior + 1 || num === numAnterior - 1) {
                patronesSimples++
            }
        }
    }

    const esValido = patronesSimples <= numerosReales.length * 0.5 // Umbral más flexible
    console.log(`Validación: ${numerosReales.length} números, ${patronesSimples} patrones simples, válido: ${esValido}`)
    return esValido
}

function extraerNumerosReales(texto: string): string[] {
    const todosLosNumeros = texto.match(/\b\d{4}\b/g) || []
    return todosLosNumeros.filter((num) => {
        const numInt = Number.parseInt(num, 10)
        if (numInt <= 20 && num.charAt(0) === "0") return false
        if (/^(\d)\1{3}$/.test(num)) return false
        return true
    })
}

// Función mejorada para extraer números de la página
function extraerNumerosDesdeHTML($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`Buscando números para turno: ${turno}`)

    // Estrategia 1: Buscar tablas con números (más específica)
    const tablas = $("table").toArray()
    for (const tabla of tablas) {
        const $tabla = $(tabla)
        const textoTabla = $tabla.text().toLowerCase()

        // Verificar si la tabla contiene el nombre del turno
        if (textoTabla.includes(turno.toLowerCase())) {
            console.log(`Encontrada tabla que contiene "${turno}"`)

            // Extraer números de las celdas de manera más ordenada
            const numeros: string[] = []

            // Primero intentar extraer por filas
            $tabla.find("tr").each((_, fila) => {
                const $fila = $(fila)
                $fila.find("td, th").each((_, celda) => {
                    const texto = $(celda).text().trim()
                    if (/^\d{4}$/.test(texto)) {
                        numeros.push(texto)
                    }
                })
            })

            // Si no hay suficientes números en celdas, buscar en todo el texto de la tabla
            if (numeros.length < 10) {
                const numerosEnTexto = textoTabla.match(/\b\d{4}\b/g) || []
                numeros.push(...numerosEnTexto.filter((num) => !numeros.includes(num)))
            }

            if (numeros.length >= 10) {
                console.log(`Encontrados ${numeros.length} números en tabla para turno ${turno}`)
                return numeros.slice(0, 20) // Tomar máximo 20
            }
        }
    }

    // Estrategia 2: Buscar por clases CSS específicas de resultados
    const selectoresResultados = [
        ".numeros",
        ".resultados",
        ".sorteo",
        ".lottery-numbers",
        ".numbers",
        ".results",
        ".draw-results",
        ".winning-numbers",
    ]

    for (const selector of selectoresResultados) {
        const elementos = $(selector).toArray()
        for (const elemento of elementos) {
            const $elemento = $(elemento)
            const textoElemento = $elemento.text()

            if (textoElemento.toLowerCase().includes(turno.toLowerCase())) {
                const numerosExtraidos = textoElemento.match(/\b\d{4}\b/g) || []
                if (numerosExtraidos.length >= 10) {
                    console.log(`Encontrados ${numerosExtraidos.length} números en elemento con clase ${selector}`)
                    return numerosExtraidos.slice(0, 20)
                }
            }
        }
    }

    // Estrategia 3: Buscar secciones por encabezados (mejorada)
    const encabezados = $("h1, h2, h3, h4, h5, h6").toArray()
    for (const encabezado of encabezados) {
        const $encabezado = $(encabezado)
        const textoEncabezado = $encabezado.text().toLowerCase()

        if (textoEncabezado.includes(turno.toLowerCase())) {
            console.log(`Encontrado encabezado que contiene "${turno}": ${textoEncabezado}`)

            // Buscar en el contenedor padre del encabezado
            let $contenedor = $encabezado.parent()
            let texto = $contenedor.text()

            // Si el contenedor padre no tiene suficientes números, buscar en el siguiente elemento
            let numerosExtraidos = texto.match(/\b\d{4}\b/g) || []
            if (numerosExtraidos.length < 10) {
                $contenedor = $encabezado.next()
                for (let i = 0; i < 3 && $contenedor.length; i++) {
                    texto += " " + $contenedor.text()
                    $contenedor = $contenedor.next()
                }
                numerosExtraidos = texto.match(/\b\d{4}\b/g) || []
            }

            if (numerosExtraidos.length >= 10) {
                console.log(`Encontrados ${numerosExtraidos.length} números después de encabezado`)
                return numerosExtraidos.slice(0, 20)
            }
        }
    }

    // Estrategia 4: Búsqueda por segmentación de texto (corregida para evitar el error de iteración)
    const textoCompleto = $("body").text()
    const turnosConocidos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    // Encontrar el índice del turno actual (búsqueda más precisa)
    const regex = new RegExp(`\\b${turno}\\b`, "gi")
    let match: RegExpExecArray | null
    let matches: { index: number }[] = []

    // Usar exec en un bucle en lugar de matchAll para compatibilidad
    while ((match = regex.exec(textoCompleto)) !== null) {
        matches.push({ index: match.index })
    }

    for (const match of matches) {
        const indiceActual = match.index

        // Encontrar el índice del siguiente turno
        let indiceSiguiente = textoCompleto.length
        for (const otroTurno of turnosConocidos) {
            if (otroTurno !== turno) {
                const indiceOtro = textoCompleto.toLowerCase().indexOf(otroTurno.toLowerCase(), indiceActual + turno.length)
                if (indiceOtro !== -1 && indiceOtro < indiceSiguiente) {
                    indiceSiguiente = indiceOtro
                }
            }
        }

        // Extraer el texto entre el turno actual y el siguiente (máximo 1000 caracteres)
        const longitudSegmento = Math.min(indiceSiguiente - indiceActual, 1000)
        const textoSegmento = textoCompleto.substring(indiceActual, indiceActual + longitudSegmento)
        const numerosExtraidos = textoSegmento.match(/\b\d{4}\b/g) || []

        if (numerosExtraidos.length >= 10) {
            console.log(`Encontrados ${numerosExtraidos.length} números en segmento de texto para turno ${turno}`)
            return numerosExtraidos.slice(0, 20)
        }
    }

    console.log(`No se encontraron números suficientes para el turno ${turno}`)
    return []
}

async function obtenerResultadosPizarra(provincia: string, turno: string): Promise<string[]> {
    try {
        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`URL no encontrada para provincia: ${provincia}`)
            return Array(20).fill(PLACEHOLDER_RESULT)
        }

        console.log(`Obteniendo resultados de ${url} para ${provincia} - ${turno}`)
        const pizarraHtml = await obtenerConTiempoLimite(url)

        if (!pizarraHtml.ok) {
            throw new Error(`Error HTTP: ${pizarraHtml.status}`)
        }

        const contenidoPizarra = await pizarraHtml.text()
        const $ = cheerio.load(contenidoPizarra)

        // Usar la función mejorada para extraer números
        let numerosExtraidos = extraerNumerosDesdeHTML($, turno)

        // Si no se encontraron números con la función mejorada, intentar con métodos específicos por provincia
        if (numerosExtraidos.length === 0) {
            if (provincia === "MONTEVIDEO") {
                const textoCompleto = $("body").text()
                const textoLower = textoCompleto.toLowerCase()

                if (turno === "Matutina") {
                    const indiceMatutina = textoLower.indexOf("matutina")
                    const indiceNocturna = textoLower.indexOf("nocturna")
                    if (indiceMatutina !== -1) {
                        const finSeccion =
                            indiceNocturna !== -1 && indiceNocturna > indiceMatutina ? indiceNocturna : textoLower.length
                        const textoMatutina = textoCompleto.substring(indiceMatutina, finSeccion)
                        numerosExtraidos = extraerNumerosReales(textoMatutina)
                    }
                } else if (turno === "Nocturna") {
                    const indiceNocturna = textoLower.indexOf("nocturna")
                    if (indiceNocturna !== -1) {
                        const textoNocturna = textoCompleto.substring(indiceNocturna)
                        numerosExtraidos = extraerNumerosReales(textoNocturna)
                    }
                }
            } else {
                // Intentar extraer números de manera más agresiva
                // Buscar cualquier elemento que contenga el nombre del turno
                $(`*:contains("${turno}")`).each((_, el) => {
                    if (numerosExtraidos.length === 0) {
                        const $el = $(el)
                        // Verificar que el elemento contenga exactamente el nombre del turno
                        if (new RegExp(`\\b${turno}\\b`, "i").test($el.text())) {
                            // Buscar en el elemento y sus hijos
                            const texto = $el.text()
                            const numerosEncontrados = extraerNumerosReales(texto)
                            if (numerosEncontrados.length >= 10) {
                                numerosExtraidos = numerosEncontrados
                            }
                        }
                    }
                })

                // Si aún no hay números, buscar en toda la página
                if (numerosExtraidos.length === 0) {
                    const textoCompleto = $("body").text()
                    numerosExtraidos = extraerNumerosReales(textoCompleto)
                }
            }
        }

        // Si no se encontraron números suficientes, retornar un array vacío
        if (numerosExtraidos.length < 10) {
            console.log(`No se encontraron suficientes números para ${provincia} - ${turno}.`)
            return []
        }

        // Preparar el array final de números
        let numerosFinales: string[]

        if (numerosExtraidos.length >= 20) {
            numerosFinales = numerosExtraidos.slice(0, 20)
        } else {
            // Resultados parciales
            console.log(
                `Resultados parciales para ${provincia} - ${turno}: ${numerosExtraidos.length} números. Completando con placeholders.`,
            )
            numerosFinales = [
                ...numerosExtraidos.slice(0, 20),
                ...Array(Math.max(0, 20 - numerosExtraidos.length)).fill(PLACEHOLDER_RESULT),
            ]
        }

        const numerosOrdenados = reordenarNumeros(numerosFinales)

        if (numerosOrdenados.every((n) => n === PLACEHOLDER_RESULT)) {
            console.log(`No se encontraron números válidos (todos '${PLACEHOLDER_RESULT}') para ${provincia} - ${turno}.`)
            return []
        }

        console.log(`Números finales para ${provincia} - ${turno}: ${numerosOrdenados.join(", ")}`)
        return numerosOrdenados
    } catch (error) {
        console.error(`Error al obtener resultados de la pizarra para ${provincia} - ${turno}:`, error)
        return []
    }
}

async function procesarSorteo(
    provincia: string,
    turno: string,
    fechaFormateada: string,
    nombreDia: string,
    resultadosPorDia: ResultadosPorDia,
    diaSemana: number,
    fecha: Date,
) {
    if (provincia === "MONTEVIDEO") {
        if (turno === "Matutina" && diaSemana > 5) return
        if (turno === "Nocturna" && diaSemana === 0) return
        if (turno !== "Matutina" && turno !== "Nocturna") return
    }
    if (provincia === "TUCUMAN" && turno === "Previa") return

    if (esSorteoFinalizado(turno, fecha)) {
        console.log(`Procesando ${provincia} - ${turno}`)
        const numeros = await obtenerResultadosPizarra(provincia, turno)

        // Solo agregar si se encontraron números reales y son válidos
        if (numeros.length > 0 && numeros.some((n) => n !== PLACEHOLDER_RESULT) && verificarNumerosValidos(numeros)) {
            if (!resultadosPorDia[fechaFormateada]) {
                resultadosPorDia[fechaFormateada] = {
                    fecha: fechaFormateada,
                    dia: nombreDia,
                    resultados: [],
                }
            }

            let provinciaResultado = resultadosPorDia[fechaFormateada].resultados.find((r) => r.provincia === provincia)
            if (!provinciaResultado) {
                provinciaResultado = {
                    loteria: provincia === "NACION" ? "Nacional" : provincia === "PROVINCIA" ? "Provincial" : provincia,
                    provincia: provincia,
                    sorteos: {},
                }
                resultadosPorDia[fechaFormateada].resultados.push(provinciaResultado)
            }
            provinciaResultado.sorteos[turno] = numeros
            console.log(`Resultados agregados para ${provincia} - ${turno}: ${numeros.join(", ")}`)
        } else {
            console.log(`Resultados no disponibles o inválidos para ${provincia} - ${turno}. No se agregarán.`)
        }
    } else {
        console.log(`Sorteo ${turno} aún no finalizado para ${provincia}`)
    }
}

async function obtenerResultadosPizarraDirecto(): Promise<any[]> {
    console.log("Obteniendo resultados directamente de las pizarras")
    const resultadosApi: any[] = [] // Para la respuesta de la API
    const fechaActual = obtenerFechaArgentina()
    const diaSemana = fechaActual.getDay()

    const fechaKeyFirebase = format(fechaActual, "yyyy-MM-dd")
    const fechaDisplay = format(fechaActual, "dd/MM/yyyy", { locale: es })
    const nombreDiaCap = format(fechaActual, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

    if (diaSemana === 0) {
        // Domingo
        console.log("Hoy es domingo. No hay sorteos.")
        return resultadosApi
    }

    const sorteosTurnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    // Estructura para guardar en Firebase
    const resultadosDelDiaParaFirebase: ResultadoDia = {
        fecha: fechaDisplay,
        dia: nombreDiaCap,
        resultados: [],
    }

    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
        let provinciaDataParaFirebase:
            | { loteria: string; provincia: string; sorteos: { [key: string]: string[] } }
            | undefined = resultadosDelDiaParaFirebase.resultados.find((r) => r.provincia === provinciaKey)

        if (!provinciaDataParaFirebase) {
            provinciaDataParaFirebase = {
                loteria: provinciaKey === "NACION" ? "Nacional" : provinciaKey === "PROVINCIA" ? "Provincial" : provinciaKey,
                provincia: provinciaKey,
                sorteos: {},
            }
            resultadosDelDiaParaFirebase.resultados.push(provinciaDataParaFirebase)
        }

        for (const turno of sorteosTurnos) {
            // Lógica de omisión de sorteos
            if (provinciaKey === "MONTEVIDEO") {
                if (turno !== "Matutina" && turno !== "Nocturna") continue
                if (turno === "Matutina" && diaSemana > 5) continue // Matutina L-V
                if (turno === "Nocturna" && diaSemana === 0) continue // Nocturna L-S (diaSemana 0 es Domingo)
            }
            if (provinciaKey === "TUCUMAN" && turno === "Previa") continue

            if (esSorteoFinalizado(turno, fechaActual)) {
                console.log(`Obteniendo resultados para ${provinciaKey} - ${turno}`)
                const numeros = await obtenerResultadosPizarra(provinciaKey, turno)

                // Solo agregar si se encontraron números válidos
                if (numeros.length > 0 && numeros.some((n) => n !== PLACEHOLDER_RESULT) && verificarNumerosValidos(numeros)) {
                    // Para la API
                    resultadosApi.push({
                        id: `${provinciaKey}-${turno}-${fechaDisplay}`,
                        sorteo: turno.toUpperCase(),
                        loteria: provinciaDataParaFirebase.loteria,
                        provincia: provinciaKey,
                        numeros: numeros,
                        pizarraLink: pizarraUrl || "",
                        fecha: fechaDisplay,
                        dia: nombreDiaCap,
                    })
                    // Para Firebase
                    provinciaDataParaFirebase.sorteos[turno] = numeros
                } else {
                    console.log(
                        `Resultados no disponibles o inválidos para ${provinciaKey} - ${turno} en obtenerResultadosPizarraDirecto.`,
                    )
                }
            }
        }
    }

    // Guardar en Firebase solo si hay resultados válidos para alguna provincia
    if (resultadosDelDiaParaFirebase.resultados.some((p) => Object.keys(p.sorteos).length > 0)) {
        try {
            const docRef = doc(db, "extractos", fechaKeyFirebase)
            // Guardar bajo la estructura { "dd/MM/yyyy": ResultadoDia }
            await setDoc(docRef, { [fechaDisplay]: resultadosDelDiaParaFirebase }, { merge: true })
            console.log(
                `Resultados guardados/actualizados en Firebase para ${fechaKeyFirebase} bajo la clave ${fechaDisplay}`,
            )
        } catch (error) {
            console.error("Error al guardar resultados en Firebase:", error)
        }
    } else {
        console.log("No se encontraron resultados válidos para guardar en Firebase hoy.")
    }

    return resultadosApi
}

export async function GET(request: Request) {
    console.log("Iniciando GET /api/extractos")
    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date") // Espera yyyy-MM-dd
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"

        const fechaActualArgentina = obtenerFechaArgentina()

        let fechaConsulta: Date
        if (parametroFecha) {
            // Parsea yyyy-MM-dd y lo lleva al inicio del día en zona Argentina
            fechaConsulta = startOfDay(
                toZonedTime(parse(parametroFecha, "yyyy-MM-dd", new Date()), "America/Argentina/Buenos_Aires"),
            )
        } else {
            fechaConsulta = startOfDay(fechaActualArgentina)
        }

        const fechaKeyFirebase = format(fechaConsulta, "yyyy-MM-dd")
        const fechaDisplayConsulta = format(fechaConsulta, "dd/MM/yyyy", { locale: es })
        const nombreDiaConsulta = format(fechaConsulta, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

        const esHoyEnArgentina =
            format(fechaConsulta, "yyyy-MM-dd") === format(startOfDay(fechaActualArgentina), "yyyy-MM-dd")

        if (forceRefresh || esHoyEnArgentina) {
            console.log(
                forceRefresh ? "Forzando actualización de resultados." : "Consultando resultados para hoy en Argentina.",
            )
            const resultadosVivos = await obtenerResultadosPizarraDirecto() // Esta función ya maneja la fecha actual de Argentina

            if (resultadosVivos.length === 0 && esHoyEnArgentina && fechaConsulta.getDay() !== 0 /* No es Domingo */) {
                return NextResponse.json(
                    { message: "No hay resultados disponibles aún para hoy o no hay sorteos programados." },
                    {
                        status: 200,
                        headers: corsHeaders,
                    },
                )
            }
            return NextResponse.json(resultadosVivos, { headers: corsHeaders })
        }

        // Si no es hoy ni forzado, obtener de Firebase
        console.log(`Consultando Firebase para fecha: ${fechaKeyFirebase} (display: ${fechaDisplayConsulta})`)
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let extractosFormateadosApi: any[] = []

        if (docSnap.exists()) {
            const data = docSnap.data()
            // La data está guardada como { "dd/MM/yyyy": ResultadoDia }
            const extractosDia = data[fechaDisplayConsulta] as ResultadoDia // Usar fechaDisplayConsulta como clave

            if (extractosDia && extractosDia.resultados) {
                extractosFormateadosApi = extractosDia.resultados.flatMap((resultado) =>
                    Object.entries(resultado.sorteos).map(([turno, numeros]) => ({
                        id: `${resultado.provincia}-${turno}-${extractosDia.fecha}`,
                        fecha: extractosDia.fecha,
                        dia: extractosDia.dia,
                        sorteo: turno.toUpperCase(),
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                    })),
                )
                console.log(`Extractos encontrados en Firebase para ${fechaDisplayConsulta}`)
            } else {
                console.log(
                    `Estructura no esperada o sin resultados en Firebase para la clave ${fechaDisplayConsulta} dentro del documento ${fechaKeyFirebase}.`,
                )
            }
        } else {
            console.log(`No se encontraron extractos en Firebase para la fecha: ${fechaKeyFirebase}`)
        }

        if (extractosFormateadosApi.length === 0) {
            let mensaje = "No se encontraron resultados para la fecha seleccionada."
            if (fechaConsulta.getDay() === 0) mensaje = "Domingo. No hay sorteos programados para este día."
            return NextResponse.json({ message: mensaje }, { status: 200, headers: corsHeaders })
        }

        return NextResponse.json(extractosFormateadosApi, { headers: corsHeaders })
    } catch (error) {
        console.error("Error en GET /api/extractos:", error)
        return NextResponse.json(
            {
                error: "Error al obtener los resultados",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 },
        )
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
    // Esta función es para actualización manual, mantenerla simple o deprecarl si no se usa.
    console.log("Iniciando POST /api/extractos (actualización manual)")
    try {
        const { provincia, turno, fecha, numeros } = await request.json() // fecha en dd/MM/yyyy
        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos para la actualización manual")
        }

        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = format(fechaArgentina, "yyyy-MM-dd") // yyyy-MM-dd para el nombre del doc
        const nombreDiaCap = format(fechaArgentina, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let datosDia: ResultadoDia

        if (docSnap.exists() && docSnap.data()[fecha]) {
            datosDia = docSnap.data()[fecha] as ResultadoDia
        } else {
            datosDia = {
                fecha: fecha, // dd/MM/yyyy
                dia: nombreDiaCap,
                resultados: [],
            }
        }

        let provinciaResultado = datosDia.resultados.find((r) => r.provincia === provincia)
        if (!provinciaResultado) {
            provinciaResultado = {
                loteria: provincia === "NACION" ? "Nacional" : provincia === "PROVINCIA" ? "Provincial" : provincia,
                provincia: provincia,
                sorteos: {},
            }
            datosDia.resultados.push(provinciaResultado)
        }
        provinciaResultado.sorteos[turno] = numeros

        // Guardar bajo la clave "dd/MM/yyyy" dentro del documento "yyyy-MM-dd"
        await setDoc(docRef, { [fecha]: datosDia }, { merge: true })

        console.log(`Resultados actualizados manualmente para ${provincia} - ${turno} en fecha ${fecha}`)
        return NextResponse.json(
            { success: true, message: "Resultados actualizados manualmente" },
            { headers: corsHeaders },
        )
    } catch (error) {
        console.error("Error en actualización manual:", error)
        return NextResponse.json(
            {
                error: "Error al actualizar manualmente",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 },
        )
    }
}

console.log("app/api/extractos/route.ts cargado.")
