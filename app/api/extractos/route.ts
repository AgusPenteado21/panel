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

// Constantes - TUCUMÁN REMOVIDO DE URLS_PIZARRAS
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
    // TUCUMAN REMOVIDO - Ahora se maneja manualmente
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

    // Considerar finalizado 30 minutos después de la hora del sorteo para mayor seguridad
    return tiempoActual > tiempoSorteo + 30
}

// FUNCIÓN ESPECÍFICA PARA NEUQUÉN
function extraerNumerosNeuquen($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🏔️ EXTRACCIÓN ESPECÍFICA NEUQUÉN: ${turno}`)

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
                console.log(`✅ NEUQUÉN: Encontrado en tabla específica`)
                return numeros.slice(0, 20)
            }
        }
    }

    return extraerNumerosUltraEspecificos($, turno, "NEUQUEN")
}

// FUNCIÓN ESPECÍFICA PARA MISIONES
function extraerNumerosMisiones($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🌿 EXTRACCIÓN ESPECÍFICA MISIONES: ${turno}`)

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
                    console.log(`✅ MISIONES: Encontrado en sección específica`)
                    return numeros.slice(0, 20)
                }
            }
        }
    }

    return extraerNumerosUltraEspecificos($, turno, "MISIONES")
}

// FUNCIÓN ULTRA ESPECÍFICA - Solo extrae si encuentra EXACTAMENTE el turno solicitado
function extraerNumerosUltraEspecificos($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    console.log(`🎯 EXTRACCIÓN ULTRA ESPECÍFICA: ${provincia} - ${turno}`)

    const turnosConocidos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]
    const otrosTurnos = turnosConocidos.filter((t) => t !== turno)

    console.log(`📋 Estrategia 1: Contenedores exclusivos para ${turno}`)
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
            console.log(`⚠️ Elemento contiene otros turnos, DESCARTANDO`)
            continue
        }

        const numeros = textoElemento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            console.log(`✅ ENCONTRADO en contenedor exclusivo: ${numeros.length} números`)
            return numeros.slice(0, 20)
        }
    }

    console.log(`📝 Estrategia 2: Segmentación ultra precisa`)
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
        console.log(`📄 Segmento aislado: "${segmento.substring(0, 80)}..."`)

        const numeros = segmento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) {
            console.log(`✅ ENCONTRADO en segmento aislado: ${numeros.length} números`)
            return numeros.slice(0, 20)
        }
    }

    console.log(`🗂️ Estrategia 3: Tablas ultra específicas`)
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

    const numerosValidos = numeros.filter((num) => /^\d{4}$/.test(num) && num !== PLACEHOLDER_RESULT)
    if (numerosValidos.length < 18) {
        console.log(`❌ Muy pocos números válidos: ${numerosValidos.length}`)
        return false
    }

    let patronesSospechosos = 0
    for (const num of numerosValidos) {
        const numInt = Number.parseInt(num)
        if (numInt <= 30) patronesSospechosos++
        if (/^(\d)\1{3}$/.test(num)) patronesSospechosos++
        if (numInt <= 50 && num.startsWith("0")) patronesSospechosos++
    }

    const porcentajeSospechosos = (patronesSospechosos / numerosValidos.length) * 100
    if (porcentajeSospechosos > 15) {
        console.log(`❌ Demasiados patrones sospechosos: ${porcentajeSospechosos.toFixed(1)}%`)
        return false
    }

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

// FUNCIÓN PRINCIPAL SIN TUCUMÁN
async function obtenerResultadoEspecifico(provincia: string, turno: string): Promise<string[] | null> {
    try {
        // TUCUMÁN YA NO SE PROCESA AQUÍ - Se maneja manualmente
        if (provincia === "TUCUMAN") {
            console.log(`🏔️ TUCUMÁN OMITIDO - Se maneja manualmente`)
            return null
        }

        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`❌ URL no encontrada para: ${provincia}`)
            return null
        }

        console.log(`\n🔍 PROCESANDO: ${provincia} - ${turno}`)

        const pizarraHtml = await obtenerConTiempoLimite(url)
        if (!pizarraHtml.ok) {
            console.error(`❌ Error HTTP ${pizarraHtml.status} para ${url}`)
            return null
        }

        const contenidoPizarra = await pizarraHtml.text()
        const $ = cheerio.load(contenidoPizarra)

        let numeros: string[] = []

        if (provincia === "NEUQUEN") {
            numeros = extraerNumerosNeuquen($, turno)
        } else if (provincia === "MISIONES") {
            numeros = extraerNumerosMisiones($, turno)
        } else {
            numeros = extraerNumerosUltraEspecificos($, turno, provincia)
        }

        if (numeros.length === 0) {
            console.log(`❌ NO se encontraron números para ${provincia} - ${turno}`)
            return null
        }

        const numerosCompletos = [...numeros.slice(0, 20)]
        while (numerosCompletos.length < 20) {
            numerosCompletos.push(PLACEHOLDER_RESULT)
        }

        const numerosReordenados = reordenarNumeros(numerosCompletos)

        if (!validarResultadosUltraEstricto(numerosReordenados, provincia, turno)) {
            console.log(`❌ VALIDACIÓN FALLÓ para ${provincia} - ${turno}`)
            return null
        }

        console.log(`✅ ÉXITO: ${provincia} - ${turno} → Números válidos encontrados`)
        return numerosReordenados
    } catch (error) {
        console.error(`❌ ERROR: ${provincia} - ${turno}:`, error)
        return null
    }
}

// FUNCIÓN PRINCIPAL SIN TUCUMÁN
async function obtenerResultadosConfiables(): Promise<any[]> {
    console.log("🚀 INICIANDO EXTRACCIÓN ULTRA CONFIABLE - SIN TUCUMÁN")

    const fechaActual = obtenerFechaArgentina()
    const diaSemana = fechaActual.getDay()

    if (diaSemana === 0) {
        console.log("📅 Domingo - Sin sorteos")
        return []
    }

    const fechaDisplay = format(fechaActual, "dd/MM/yyyy", { locale: es })
    const nombreDia = format(fechaActual, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())
    const fechaKeyFirebase = format(fechaActual, "yyyy-MM-dd")

    const resultadosApi: any[] = []
    const resultadosParaFirebase: ResultadoDia = {
        fecha: fechaDisplay,
        dia: nombreDia,
        resultados: [],
    }

    const turnos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

    // Procesar cada provincia (EXCLUYENDO TUCUMÁN)
    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
        console.log(`\nProcessing province: ${provinciaKey}`)

        const provinciaData = {
            loteria: provinciaKey === "NACION" ? "Nacional" : provinciaKey === "PROVINCIA" ? "Provincial" : provinciaKey,
            provincia: provinciaKey,
            sorteos: {} as { [key: string]: string[] },
        }

        let tieneResultadosValidos = false

        for (const turno of turnos) {
            if (provinciaKey === "MONTEVIDEO") {
                if (turno !== "Matutina" && turno !== "Nocturna") continue
                if (turno === "Matutina" && diaSemana > 5) continue
                if (turno === "Nocturna" && diaSemana === 0) continue
            }

            console.log(`🔍 Intentando obtener: ${provinciaKey} - ${turno}`)

            if (esSorteoFinalizado(turno, fechaActual)) {
                const numeros = await obtenerResultadoEspecifico(provinciaKey, turno)

                if (numeros !== null && numeros.length > 0) {
                    resultadosApi.push({
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

                    provinciaData.sorteos[turno] = numeros
                    tieneResultadosValidos = true
                    console.log(`✅ AGREGADO A API Y FIREBASE: ${provinciaKey} - ${turno}`)
                } else {
                    console.log(`⏭️ OMITIDO: ${provinciaKey} - ${turno} (sin resultados confiables)`)
                }
            } else {
                console.log(`⏰ NO FINALIZADO: ${provinciaKey} - ${turno}`)
            }
        }

        if (tieneResultadosValidos) {
            resultadosParaFirebase.resultados.push(provinciaData)
        }
    }

    // Guardar en Firebase solo si hay resultados
    if (resultadosParaFirebase.resultados.length > 0) {
        try {
            const docRef = doc(db, "extractos", fechaKeyFirebase)
            const dataParaGuardar = {
                [fechaDisplay]: resultadosParaFirebase,
            }
            await setDoc(docRef, dataParaGuardar, { merge: true })
            console.log(`💾 Guardado en Firebase: ${resultadosApi.length} resultados CONFIABLES`)
        } catch (error) {
            console.error("❌ Error Firebase:", error)
        }
    }

    console.log(`\n🏁 COMPLETADO: ${resultadosApi.length} resultados 100% CONFIABLES`)
    console.log(
        `📊 RESULTADOS API:`,
        resultadosApi.map((r) => `${r.provincia}-${r.sorteo}`),
    )

    return resultadosApi
}

export async function GET(request: Request) {
    console.log("=== 🚀 API ULTRA CONFIABLE (SIN TUCUMÁN) ===")

    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"

        const fechaActualArgentina = obtenerFechaArgentina()
        let fechaConsulta: Date

        if (parametroFecha) {
            fechaConsulta = startOfDay(
                toZonedTime(parse(parametroFecha, "yyyy-MM-dd", new Date()), "America/Argentina/Buenos_Aires"),
            )
        } else {
            fechaConsulta = startOfDay(fechaActualArgentina)
        }

        const fechaKeyFirebase = format(fechaConsulta, "yyyy-MM-dd")
        const fechaDisplayConsulta = format(fechaConsulta, "dd/MM/yyyy", { locale: es })
        const esHoyEnArgentina =
            format(fechaConsulta, "yyyy-MM-dd") === format(startOfDay(fechaActualArgentina), "yyyy-MM-dd")

        // Si es hoy o se fuerza, hacer scraping
        if (forceRefresh || esHoyEnArgentina) {
            console.log(forceRefresh ? "🔄 FORZANDO ACTUALIZACIÓN" : "📅 CONSULTANDO HOY")
            const resultados = await obtenerResultadosConfiables()
            return NextResponse.json(resultados, { headers: corsHeaders })
        }

        // Consulta a Firebase
        console.log(`📂 Consultando Firebase: ${fechaKeyFirebase}`)
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let extractosFormateados: any[] = []

        if (docSnap.exists()) {
            const data = docSnap.data()
            console.log(`📋 Datos encontrados en Firebase para ${fechaKeyFirebase}:`, Object.keys(data))

            let resultadosData: ResultadoDia | null = null

            if (data[fechaDisplayConsulta]) {
                resultadosData = data[fechaDisplayConsulta] as ResultadoDia
                console.log(`✅ Encontrado con fecha exacta: ${fechaDisplayConsulta}`)
            } else {
                const fechasEncontradas = Object.keys(data).filter((key) => key.includes("/"))
                if (fechasEncontradas.length > 0) {
                    const primeraFecha = fechasEncontradas[0]
                    resultadosData = data[primeraFecha] as ResultadoDia
                    console.log(`✅ Usando primera fecha encontrada: ${primeraFecha}`)
                }
            }

            if (resultadosData && resultadosData.resultados) {
                console.log(`📊 Procesando ${resultadosData.resultados.length} provincias`)
                extractosFormateados = resultadosData.resultados.flatMap((resultado: any) => {
                    const sorteos = Object.entries(resultado.sorteos || {})
                    console.log(`🏛️ ${resultado.provincia}: ${sorteos.length} sorteos`)

                    return sorteos.map(([turno, numeros]) => ({
                        id: `${resultado.provincia}-${turno}-${resultadosData.fecha}`,
                        fecha: resultadosData.fecha,
                        dia: resultadosData.dia,
                        sorteo: turno,
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                        necesita: "No",
                        confirmado: "No",
                    }))
                })
                console.log(`✅ ${extractosFormateados.length} resultados formateados`)
            } else {
                console.log(`❌ No se encontraron resultados válidos en la estructura`)
            }
        } else {
            console.log(`❌ No existe documento para ${fechaKeyFirebase}`)
        }

        return NextResponse.json(extractosFormateados, { headers: corsHeaders })
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
    console.log("📝 Actualización manual (incluyendo Tucumán)")
    try {
        const { provincia, turno, fecha, numeros } = await request.json()

        console.log(`🔄 POST recibido:`, { provincia, turno, fecha, numeros: numeros?.length })

        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            console.error("❌ Datos incompletos:", { provincia, turno, fecha, numerosLength: numeros?.length })
            throw new Error("Datos incompletos o inválidos")
        }

        // Usar la misma lógica de fecha que el scraping automático
        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = format(fechaArgentina, "yyyy-MM-dd")
        const fechaDisplay = format(fechaArgentina, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fechaArgentina, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

        console.log(`📅 Procesando fecha: ${fecha} → Firebase key: ${fechaKeyFirebase} → Display: ${fechaDisplay}`)

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let resultadosParaFirebase: ResultadoDia

        if (docSnap.exists()) {
            const data = docSnap.data()
            console.log(`📋 Documento existente encontrado, claves:`, Object.keys(data))

            if (data[fechaDisplay]) {
                resultadosParaFirebase = data[fechaDisplay] as ResultadoDia
                console.log(`✅ Datos existentes para ${fechaDisplay}`)
            } else {
                console.log(`🆕 Creando nueva estructura para ${fechaDisplay}`)
                resultadosParaFirebase = {
                    fecha: fechaDisplay,
                    dia: nombreDia,
                    resultados: [],
                }
            }
        } else {
            console.log(`🆕 Creando nuevo documento para ${fechaKeyFirebase}`)
            resultadosParaFirebase = {
                fecha: fechaDisplay,
                dia: nombreDia,
                resultados: [],
            }
        }

        // Buscar o crear la provincia usando la misma lógica que el scraping
        let provinciaResultado = resultadosParaFirebase.resultados.find((r) => r.provincia === provincia)
        if (!provinciaResultado) {
            console.log(`🆕 Creando nueva provincia: ${provincia}`)
            provinciaResultado = {
                loteria: provincia === "NACION" ? "Nacional" : provincia === "PROVINCIA" ? "Provincial" : provincia,
                provincia: provincia,
                sorteos: {},
            }
            resultadosParaFirebase.resultados.push(provinciaResultado)
        } else {
            console.log(`✅ Provincia existente encontrada: ${provincia}`)
        }

        // Agregar el sorteo
        provinciaResultado.sorteos[turno] = numeros
        console.log(`💾 Agregando turno ${turno} con ${numeros.length} números`)

        // Usar exactamente la misma estructura que el scraping automático
        const dataParaGuardar = {
            [fechaDisplay]: resultadosParaFirebase,
        }

        console.log(`🔥 Guardando en Firebase con estructura:`, {
            fechaKey: fechaKeyFirebase,
            fechaDisplay: fechaDisplay,
            provincia: provincia,
            turno: turno,
            cantidadResultados: resultadosParaFirebase.resultados.length,
        })

        await setDoc(docRef, dataParaGuardar, { merge: true })

        console.log(`✅ Manual: ${provincia} - ${turno} guardado exitosamente en Firebase`)

        // Verificar que se guardó correctamente
        const verificacion = await getDoc(docRef)
        if (verificacion.exists()) {
            const datosVerificacion = verificacion.data()
            console.log(`🔍 Verificación - Datos guardados:`, Object.keys(datosVerificacion))
            if (datosVerificacion[fechaDisplay]) {
                console.log(`✅ Verificación exitosa - Fecha ${fechaDisplay} existe`)
                const resultadosVerificados = datosVerificacion[fechaDisplay].resultados
                const provinciaVerificada = resultadosVerificados.find((r: any) => r.provincia === provincia)
                if (provinciaVerificada && provinciaVerificada.sorteos[turno]) {
                    console.log(`✅ Verificación completa - ${provincia} ${turno} guardado correctamente`)
                } else {
                    console.error(`❌ Verificación falló - No se encontró ${provincia} ${turno}`)
                }
            } else {
                console.error(`❌ Verificación falló - No se encontró fecha ${fechaDisplay}`)
            }
        } else {
            console.error(`❌ Verificación falló - Documento no existe`)
        }

        return NextResponse.json(
            {
                success: true,
                message: "Actualizado manualmente",
                data: {
                    provincia,
                    turno,
                    fecha: fechaDisplay,
                    fechaKeyFirebase,
                    numerosGuardados: numeros.length,
                },
            },
            { headers: corsHeaders },
        )
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

console.log("app/api/extractos/route.ts cargado (SIN scraping de Tucumán).")
