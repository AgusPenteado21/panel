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

const PLACEHOLDER_RESULT = "----"

function obtenerFechaArgentina() {
    const fechaActual = new Date()
    try {
        const fechaArgentina = toZonedTime(fechaActual, "America/Argentina/Buenos_Aires")
        return fechaArgentina
    } catch (error) {
        return new Date(fechaActual.getTime() - 3 * 60 * 60 * 1000)
    }
}

const TIEMPO_ESPERA_FETCH = 60000
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
        throw error
    }
}

function obtenerTiempoSorteo(turno: string): number {
    const horario = HORARIOS_SORTEOS[turno as keyof typeof HORARIOS_SORTEOS]
    if (!horario) return -1
    const [horas, minutos] = horario.split(":").map(Number)
    if (isNaN(horas) || isNaN(minutos)) return -1
    return horas * 60 + minutos
}

function esSorteoFinalizado(turno: string, fecha: Date): boolean {
    const ahora = obtenerFechaArgentina()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)
    const hoyArgentina = startOfDay(obtenerFechaArgentina())

    if (isAfter(hoyArgentina, fecha)) return true
    return tiempoActual > tiempoSorteo + 30
}

function extraerNumerosNeuquen($: cheerio.CheerioAPI, turno: string): string[] {
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
            if (numeros.length >= 18) return numeros.slice(0, 20)
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
                if (/^\d{4}$/.test(texto)) numeros.push(texto)
            })
            if (numeros.length >= 18) return numeros.slice(0, 20)
        }
    }

    return extraerNumerosUltraEspecificos($, turno, "NEUQUEN")
}

function extraerNumerosMisiones($: cheerio.CheerioAPI, turno: string): string[] {
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
            if (numeros.length >= 18) return numeros.slice(0, 20)
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
            if (numeros.length >= 18) return numeros.slice(0, 20)
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
                if (numeros.length >= 18) return numeros.slice(0, 20)
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

        if (contieneOtroTurno) continue

        const numeros = textoElemento.match(/\b\d{4}\b/g) || []
        if (numeros.length >= 18) return numeros.slice(0, 20)
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
        if (numeros.length >= 18) return numeros.slice(0, 20)
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
                if (/^\d{4}$/.test(texto)) numeros.push(texto)
            })
            if (numeros.length >= 18) return numeros.slice(0, 20)
        }
    }

    return []
}

function validarResultadosUltraEstricto(numeros: string[], provincia: string, turno: string): boolean {
    if (numeros.length < 18) return false
    const numerosValidos = numeros.filter((num) => /^\d{4}$/.test(num) && num !== PLACEHOLDER_RESULT)
    if (numerosValidos.length < 18) return false

    let patronesSospechosos = 0
    for (const num of numerosValidos) {
        const numInt = Number.parseInt(num)
        if (numInt <= 30) patronesSospechosos++
        if (/^(\d)\1{3}$/.test(num)) patronesSospechosos++
        if (numInt <= 50 && num.startsWith("0")) patronesSospechosos++
    }

    const porcentajeSospechosos = (patronesSospechosos / numerosValidos.length) * 100
    if (porcentajeSospechosos > 15) return false

    const numerosUnicos = new Set(numerosValidos)
    if (numerosUnicos.size < numerosValidos.length * 0.9) return false

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

async function obtenerResultadoEspecifico(provincia: string, turno: string): Promise<string[] | null> {
    try {
        if (provincia === "TUCUMAN") return null

        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) return null

        const pizarraHtml = await obtenerConTiempoLimite(url)
        if (!pizarraHtml.ok) return null

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

        if (numeros.length === 0) return null

        const numerosCompletos = [...numeros.slice(0, 20)]
        while (numerosCompletos.length < 20) {
            numerosCompletos.push(PLACEHOLDER_RESULT)
        }

        const numerosReordenados = reordenarNumeros(numerosCompletos)

        if (!validarResultadosUltraEstricto(numerosReordenados, provincia, turno)) return null

        return numerosReordenados
    } catch (error) {
        return null
    }
}

async function obtenerResultadosConfiables(): Promise<any[]> {
    const fechaActual = obtenerFechaArgentina()
    const diaSemana = fechaActual.getDay()

    if (diaSemana === 0) return []

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

    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
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
                }
            }
        }

        if (tieneResultadosValidos) {
            resultadosParaFirebase.resultados.push(provinciaData)
        }
    }

    if (resultadosParaFirebase.resultados.length > 0) {
        try {
            const docRef = doc(db, "extractos", fechaKeyFirebase)
            const dataParaGuardar = {
                [fechaDisplay]: resultadosParaFirebase,
            }
            await setDoc(docRef, dataParaGuardar, { merge: true })
        } catch (error) {
            // Error silencioso
        }
    }

    return resultadosApi
}

export async function GET(request: Request) {
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

        if (forceRefresh || esHoyEnArgentina) {
            const resultados = await obtenerResultadosConfiables()

            // Agregar datos de Tucumán desde Firebase
            const docRef = doc(db, "extractos", fechaKeyFirebase)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                const data = docSnap.data()
                const resultadosData = data[fechaDisplayConsulta] as ResultadoDia

                if (resultadosData?.resultados) {
                    const tucumanData = resultadosData.resultados.find((r) => r.provincia === "TUCUMAN")
                    if (tucumanData) {
                        Object.entries(tucumanData.sorteos).forEach(([turno, numeros]) => {
                            resultados.push({
                                id: `TUCUMAN-${turno}-${fechaDisplayConsulta}`,
                                fecha: fechaDisplayConsulta,
                                dia: resultadosData.dia,
                                sorteo: turno,
                                loteria: "TUCUMAN",
                                provincia: "TUCUMAN",
                                numeros: numeros,
                                pizarraLink: "",
                                necesita: "No",
                                confirmado: "No",
                            })
                        })
                    }
                }
            }

            return NextResponse.json(resultados, { headers: corsHeaders })
        }

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let extractosFormateados: any[] = []

        if (docSnap.exists()) {
            const data = docSnap.data()
            let resultadosData: ResultadoDia | null = null

            if (data[fechaDisplayConsulta]) {
                resultadosData = data[fechaDisplayConsulta] as ResultadoDia
            } else {
                const fechasEncontradas = Object.keys(data).filter((key) => key.includes("/"))
                if (fechasEncontradas.length > 0) {
                    const primeraFecha = fechasEncontradas[0]
                    resultadosData = data[primeraFecha] as ResultadoDia
                }
            }

            if (resultadosData?.resultados) {
                extractosFormateados = resultadosData.resultados.flatMap((resultado: any) => {
                    const sorteos = Object.entries(resultado.sorteos || {})
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
            }
        }

        return NextResponse.json(extractosFormateados, { headers: corsHeaders })
    } catch (error) {
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
    try {
        const { provincia, turno, fecha, numeros } = await request.json()

        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos")
        }

        // Validar que todos los números sean de 4 dígitos
        const todosValidos = numeros.every((num) => /^\d{4}$/.test(num))
        if (!todosValidos) {
            throw new Error("Todos los números deben ser de 4 dígitos")
        }

        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = format(fechaArgentina, "yyyy-MM-dd")
        const fechaDisplay = format(fechaArgentina, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fechaArgentina, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let resultadosParaFirebase: ResultadoDia

        if (docSnap.exists()) {
            const data = docSnap.data()
            if (data[fechaDisplay]) {
                resultadosParaFirebase = data[fechaDisplay] as ResultadoDia
            } else {
                resultadosParaFirebase = {
                    fecha: fechaDisplay,
                    dia: nombreDia,
                    resultados: [],
                }
            }
        } else {
            resultadosParaFirebase = {
                fecha: fechaDisplay,
                dia: nombreDia,
                resultados: [],
            }
        }

        let provinciaResultado = resultadosParaFirebase.resultados.find((r) => r.provincia === provincia)
        if (!provinciaResultado) {
            provinciaResultado = {
                loteria: provincia,
                provincia: provincia,
                sorteos: {},
            }
            resultadosParaFirebase.resultados.push(provinciaResultado)
        }

        provinciaResultado.sorteos[turno] = numeros

        const dataParaGuardar = {
            [fechaDisplay]: resultadosParaFirebase,
        }

        await setDoc(docRef, dataParaGuardar, { merge: true })

        // Verificación REAL - Leer inmediatamente desde Firebase
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Esperar 1 segundo para asegurar que se escribió

        const verificacionDoc = await getDoc(docRef)
        if (!verificacionDoc.exists()) {
            throw new Error("FALLO CRÍTICO: El documento no existe en Firebase después del guardado")
        }

        const datosVerificacion = verificacionDoc.data()
        console.log("🔍 VERIFICACIÓN - Estructura completa del documento:", JSON.stringify(datosVerificacion, null, 2))

        if (!datosVerificacion[fechaDisplay]) {
            console.log("❌ FALLO - Fechas disponibles:", Object.keys(datosVerificacion))
            throw new Error(
                `FALLO CRÍTICO: No se encontró la fecha ${fechaDisplay} en Firebase. Fechas disponibles: ${Object.keys(datosVerificacion).join(", ")}`,
            )
        }

        const resultadosVerificados = datosVerificacion[fechaDisplay].resultados
        console.log(
            "🔍 VERIFICACIÓN - Provincias en resultados:",
            resultadosVerificados.map((r: any) => r.provincia),
        )

        const provinciaVerificada = resultadosVerificados.find((r: any) => r.provincia === provincia)
        if (!provinciaVerificada) {
            console.log(
                "❌ FALLO - Provincias encontradas:",
                resultadosVerificados.map((r: any) => r.provincia),
            )
            throw new Error(
                `FALLO CRÍTICO: No se encontró ${provincia} en Firebase. Provincias encontradas: ${resultadosVerificados.map((r: any) => r.provincia).join(", ")}`,
            )
        }

        console.log("🔍 VERIFICACIÓN - Sorteos en provincia:", Object.keys(provinciaVerificada.sorteos))

        if (!provinciaVerificada.sorteos[turno]) {
            console.log("❌ FALLO - Sorteos encontrados:", Object.keys(provinciaVerificada.sorteos))
            throw new Error(
                `FALLO CRÍTICO: No se encontró el turno ${turno} en Firebase. Turnos encontrados: ${Object.keys(provinciaVerificada.sorteos).join(", ")}`,
            )
        }

        const numerosVerificados = provinciaVerificada.sorteos[turno]
        console.log("🔍 VERIFICACIÓN - Números guardados:", numerosVerificados)

        if (!Array.isArray(numerosVerificados) || numerosVerificados.length !== 20) {
            throw new Error(
                `FALLO CRÍTICO: Los números no se guardaron correctamente. Recibidos: ${numerosVerificados?.length || 0}/20`,
            )
        }

        // Verificar que los números son exactamente los que enviamos
        const numerosCoinciden = numeros.every((num, index) => numerosVerificados[index] === num)
        if (!numerosCoinciden) {
            console.log("❌ FALLO - Números enviados:", numeros)
            console.log("❌ FALLO - Números guardados:", numerosVerificados)
            throw new Error("FALLO CRÍTICO: Los números guardados no coinciden con los enviados")
        }

        console.log("✅ VERIFICACIÓN EXITOSA - Datos confirmados en Firebase")
        console.log(`📍 Documento: extractos/${fechaKeyFirebase}`)
        console.log(`📍 Fecha: ${fechaDisplay}`)
        console.log(`📍 Provincia: ${provincia}`)
        console.log(`📍 Turno: ${turno}`)
        console.log(`📍 Números: ${numerosVerificados.slice(0, 5).join(", ")}...`)

        return NextResponse.json(
            {
                success: true,
                message: "Guardado exitosamente",
            },
            { headers: corsHeaders },
        )
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500, headers: corsHeaders },
        )
    }
}
