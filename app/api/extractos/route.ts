import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { parse, format, startOfDay } from "date-fns"
import { toZonedTime, formatInTimeZone } from "date-fns-tz"
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
        const respuesta = await fetch(url, {
            ...opciones,
            signal: controlador.signal,
            cache: "no-store",
            headers: {
                ...opciones.headers,
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
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

function esSorteoFinalizado(turno: string): boolean {
    const ahora = new Date()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)

    console.log(
        `Verificando si el sorteo ${turno} está finalizado. Hora actual: ${tiempoActual}, Hora del sorteo: ${tiempoSorteo}`,
    )

    return tiempoActual > tiempoSorteo
}

async function obtenerResultadosPizarra(provincia: string, turno: string): Promise<string[]> {
    try {
        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`URL no encontrada para provincia: ${provincia}`)
            return Array(20).fill("0000")
        }

        console.log(`Obteniendo resultados de ${url} para ${provincia} - ${turno}`)
        const pizarraHtml = await obtenerConTiempoLimite(url)
        if (!pizarraHtml.ok) {
            throw new Error(`Error HTTP: ${pizarraHtml.status}`)
        }

        const contenidoPizarra = await pizarraHtml.text()
        const $ = cheerio.load(contenidoPizarra)
        let numeros: string[] = Array(20).fill("0000")

        if (provincia === "MONTEVIDEO") {
            console.log(`Buscando sección para ${provincia} - ${turno}`)
            const $posiblesSecciones = $("div.card, div.container, div.row, div.col, table, tbody, tr")

            let seccionEncontrada = false
            $posiblesSecciones.each((_, section) => {
                const $section = $(section)
                const textoSeccion = $section.text().toLowerCase()

                if (textoSeccion.includes("montevideo") && textoSeccion.includes(turno.toLowerCase())) {
                    console.log(`Sección encontrada para Montevideo - ${turno}`)
                    seccionEncontrada = true
                    let numerosEncontrados: string[] = []

                    // Buscar números en la sección encontrada
                    $section.find("td").each((_, td) => {
                        const numero = $(td).text().trim()
                        if (/^\d{1,4}$/.test(numero)) {
                            numerosEncontrados.push(numero.padStart(4, "0"))
                        }
                    })

                    // Si no se encuentran suficientes números en las celdas, buscar en todo el texto de la sección
                    if (numerosEncontrados.length < 20) {
                        const numerosEnTexto = textoSeccion.match(/\d{1,4}/g) || []
                        numerosEncontrados = numerosEncontrados
                            .concat(numerosEnTexto.map((num) => num.padStart(4, "0")))
                            .slice(0, 20)
                    }

                    // Rellenar con ceros si no se encontraron 20 números
                    while (numerosEncontrados.length < 20) {
                        numerosEncontrados.push("0000")
                    }

                    numeros = numerosEncontrados
                    console.log(`Números encontrados para Montevideo - ${turno}: ${numeros.join(", ")}`)
                    return false // Salir del bucle each
                }
            })

            // Si no se encontró la sección específica, realizar una búsqueda general
            if (!seccionEncontrada) {
                console.log("Realizando búsqueda general para Montevideo")
                const todosLosNumeros =
                    $("body")
                        .text()
                        .match(/\d{1,4}/g) || []
                numeros = todosLosNumeros.map((n) => n.padStart(4, "0")).slice(0, 20)
                while (numeros.length < 20) {
                    numeros.push("0000")
                }
            }

            console.log(`Números finales para Montevideo - ${turno}: ${numeros.join(", ")}`)
        } else {
            let $seccionTurno = $()

            if (turno === "Previa") {
                $seccionTurno = $("*")
                    .filter((_, el) => $(el).text().trim().toLowerCase().includes("previa"))
                    .first()
            } else {
                $seccionTurno = $("*")
                    .filter((_, el) => {
                        const texto = $(el).text().trim().toLowerCase()
                        return !texto.includes("previa") && texto.includes(turno.toLowerCase())
                    })
                    .first()
            }

            console.log(`Sección encontrada para ${provincia} - ${turno}:`, $seccionTurno.length > 0)

            if ($seccionTurno.length > 0) {
                console.log(`Contenido de la sección para ${provincia} - ${turno}:\n`, $seccionTurno.html() || "")

                const numerosEncontrados: string[] = []
                let elementoActual = $seccionTurno
                let intentos = 0
                const maxIntentos = 10

                while (numerosEncontrados.length < 20 && intentos < maxIntentos && elementoActual.length > 0) {
                    const texto = elementoActual.text() || ""
                    console.log(`Texto analizado: "${texto}"`)
                    const numerosEnTexto = texto.match(/\d{3,4}/g) || []
                    console.log(`Números encontrados en el texto: ${numerosEnTexto.join(", ")}`)
                    numerosEnTexto.forEach((numero: string) => {
                        if (numerosEncontrados.length < 20) {
                            numerosEncontrados.push(numero.padStart(4, "0"))
                        }
                    })

                    elementoActual = elementoActual.next()
                    intentos++
                }

                numerosEncontrados.forEach((num, index) => {
                    if (index < 20) {
                        numeros[index] = num
                    }
                })
            }

            if (numeros.filter((n) => n !== "0000").length < 20) {
                console.log(`Buscando números adicionales para ${provincia} - ${turno}`)
                const todosLosNumeros =
                    $("body")
                        .text()
                        .match(/\d{3,4}/g) || []
                console.log(`Todos los números encontrados en el cuerpo: ${todosLosNumeros.join(", ")}`)
                todosLosNumeros.forEach((num, index) => {
                    if (index < 20 && numeros[index] === "0000") {
                        numeros[index] = num.padStart(4, "0")
                    }
                })
            }
        }

        // Reordenar los números según el patrón deseado
        const numerosOrdenados = Array(20).fill("0000")
        numeros.forEach((num, index) => {
            const nuevoIndice = index % 2 === 0 ? index / 2 : 10 + Math.floor(index / 2)
            numerosOrdenados[nuevoIndice] = num
        })

        console.log(`Números finales para ${provincia} - ${turno}: ${numerosOrdenados.join(", ")}`)
        return numerosOrdenados
    } catch (error) {
        console.error(`Error al obtener resultados de la pizarra para ${provincia} - ${turno}:`, error)
        return Array(20).fill("0000")
    }
}

async function procesarSorteo(
    provincia: string,
    turno: string,
    fechaFormateada: string,
    nombreDia: string,
    pizarraUrl: string,
    resultadosPorDia: ResultadosPorDia,
    diaSemana: number,
) {
    if (esSorteoFinalizado(turno)) {
        console.log(`Procesando ${provincia} - ${turno}`)
        console.time(`obtenerResultadosPizarra-${provincia}-${turno}`)
        const numeros = await obtenerResultadosPizarra(provincia, turno)
        console.timeEnd(`obtenerResultadosPizarra-${provincia}-${turno}`)

        if (numeros.some((n) => n !== "0000")) {
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

            // Actualizar Firebase en tiempo real
            try {
                const fechaKey = format(parse(fechaFormateada, "dd/MM/yyyy", new Date()), "yyyy-MM-dd")
                const docRef = doc(db, "extractos", fechaKey)
                await setDoc(docRef, { [fechaFormateada]: resultadosPorDia[fechaFormateada] }, { merge: true })
                console.log(`Resultados actualizados en Firebase para ${provincia} - ${turno}`)
            } catch (error) {
                console.error(`Error al actualizar resultados en Firebase para ${provincia} - ${turno}:`, error)
            }
        } else {
            console.log(`No se encontraron números válidos para ${provincia} - ${turno}`)
        }
    } else {
        console.log(`Sorteo ${turno} aún no finalizado para ${provincia}`)
    }
}

async function obtenerResultados(fecha: Date) {
    console.log("Iniciando obtenerResultados")
    console.log("Fecha recibida:", fecha)
    console.log("Zona horaria del servidor:", Intl.DateTimeFormat().resolvedOptions().timeZone)
    console.time("obtenerResultados")
    console.log(
        "Iniciando obtenerResultados para la fecha:",
        formatInTimeZone(fecha, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss"),
    )

    try {
        const resultadosPorDia: ResultadosPorDia = {}

        const fechaFormateada = format(fecha, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fecha, "EEEE", { locale: es })
        const nombreDiaCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)

        const fechaFinal = fechaFormateada

        console.log(`Fecha formateada: ${fechaFinal}, Día: ${nombreDiaCapitalizado}`)

        const diaSemana = fecha.getDay()

        if (diaSemana === 0) {
            console.log("Hoy es domingo. No hay sorteos.")
            return {
                resultados: resultadosPorDia
            }
        }

        const sorteos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

        for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
            console.log(`Procesando provincia: ${provinciaKey}`)

            if (provinciaKey === "MONTEVIDEO") {
                if (diaSemana >= 1 && diaSemana <= 5) {
                    // Montevideo Matutina: de lunes a viernes
                    await procesarSorteo(
                        provinciaKey,
                        "Matutina",
                        fechaFinal,
                        nombreDiaCapitalizado,
                        pizarraUrl,
                        resultadosPorDia,
                        diaSemana,
                    )
                }
                if (diaSemana >= 1 && diaSemana <= 6) {
                    // Montevideo Nocturna: de lunes a sábado
                    await procesarSorteo(
                        provinciaKey,
                        "Nocturna",
                        fechaFinal,
                        nombreDiaCapitalizado,
                        pizarraUrl,
                        resultadosPorDia,
                        diaSemana,
                    )
                }
            } else {
                // Para otras provincias, procesar todos los sorteos de lunes a sábado
                if (diaSemana >= 1 && diaSemana <= 6) {
                    for (const turno of sorteos) {
                        await procesarSorteo(
                            provinciaKey,
                            turno,
                            fechaFinal,
                            nombreDiaCapitalizado,
                            pizarraUrl,
                            resultadosPorDia,
                            diaSemana,
                        )
                    }
                } else {
                    console.log(`No hay sorteos para ${provinciaKey} hoy (${nombreDiaCapitalizado})`)
                }
            }
        }

        return { resultados: resultadosPorDia, timestamp: Date.now() }
    } catch (error) {
        console.error("Error en obtenerResultados:", error)
        throw error
    } finally {
        console.timeEnd("obtenerResultados")
    }
}

export async function GET(request: Request) {
    console.log("Iniciando obtención de resultados en vivo para /api/extractos")
    console.log("Versión de Node.js:", process.version)
    console.log("Variables de entorno:", JSON.stringify(process.env, null, 2))
    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")

        let fecha: Date
        if (parametroFecha) {
            fecha = parse(parametroFecha, "yyyy-MM-dd", new Date())
        } else {
            fecha = new Date() // Usa la fecha actual
        }

        // Asegúrate de que la fecha esté en la zona horaria de Argentina
        fecha = toZonedTime(fecha, "America/Argentina/Buenos_Aires")
        fecha = startOfDay(fecha) // Asegura que estamos trabajando con el inicio del día

        console.log(
            "Fecha de obtención de resultados:",
            formatInTimeZone(fecha, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss"),
        )

        const { resultados } = await obtenerResultados(fecha)

        console.log(`Intentando obtener todos los extractos de Firebase`)
        const fechaKey = format(fecha, "yyyy-MM-dd")
        const docRef = doc(db, "extractos", fechaKey)
        const docSnap = await getDoc(docRef)

        let extractosFormateados = []

        if (docSnap.exists()) {
            console.log(`Extractos encontrados en Firebase para la fecha: ${fechaKey}`)
            const data = docSnap.data()
            console.log("Datos crudos de Firebase:", JSON.stringify(data, null, 2))

            // Asumiendo que la estructura es { "dd/mm/yyyy": { fecha, dia, resultados: [...] } }
            const fechaFormateada = Object.keys(data)[0] // Debería ser "dd/mm/yyyy"
            const extractosDia = data[fechaFormateada]

            if (extractosDia && extractosDia.resultados) {
                extractosFormateados = extractosDia.resultados.flatMap((resultado: Resultado) =>
                    Object.entries(resultado.sorteos).map(([sorteo, numeros]) => ({
                        id: `${resultado.provincia}-${sorteo}-${fechaFormateada}`,
                        fecha: fechaFormateada,
                        dia: extractosDia.dia,
                        sorteo: sorteo.toUpperCase(),
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                    })),
                )
            }

            console.log("Extractos formateados:", JSON.stringify(extractosFormateados, null, 2))
        } else {
            console.log(`No se encontraron extractos en Firebase para la fecha: ${fechaKey}`)
        }

        if (extractosFormateados.length === 0) {
            const diaSemana = fecha.getDay()
            let mensaje = "No se encontraron resultados para la fecha seleccionada."
            if (diaSemana === 0) {
                mensaje = "Hoy es domingo. No hay sorteos programados para este día."
            }
            console.log(mensaje)
            return NextResponse.json({ message: mensaje }, { status: 200 })
        }

        const cabeceras = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }

        console.log("Resultados finales enviados:", JSON.stringify(extractosFormateados, null, 2))

        return NextResponse.json(extractosFormateados, { headers: cabeceras })
    } catch (error) {
        console.error("Error al obtener los resultados en vivo:", error)
        return NextResponse.json(
            {
                error: "Error al obtener los resultados",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 },
        )
    }
}

console.log("route.ts file loaded successfully")