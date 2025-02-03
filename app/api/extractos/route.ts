import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { parse, format, startOfDay } from "date-fns"
import { toZonedTime, formatInTimeZone } from "date-fns-tz"
import { es } from "date-fns/locale"

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

async function obtenerConTiempoLimite(url: string, opciones: RequestInit = {}): Promise<Response> {
    const controlador = new AbortController()
    const id = setTimeout(() => controlador.abort(), TIEMPO_ESPERA_FETCH)

    try {
        const respuesta = await fetch(url, {
            ...opciones,
            signal: controlador.signal,
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

    return tiempoActual >= tiempoSorteo
}

async function obtenerResultadosPizarra(provincia: string, turno: string): Promise<string[]> {
    try {
        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`URL no encontrada para provincia: ${provincia}`)
            return Array(20).fill("0000")
        }

        console.log(`Obteniendo resultados de ${url} para ${provincia} - ${turno}`)
        const pizarraHtml = await obtenerConTiempoLimite(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            cache: "no-store",
        })
        if (!pizarraHtml.ok) {
            throw new Error(`Error HTTP: ${pizarraHtml.status}`)
        }

        const contenidoPizarra = await pizarraHtml.text()
        const $: cheerio.CheerioAPI = cheerio.load(contenidoPizarra)
        let numeros: string[] = Array(20).fill("0000")

        if (provincia === "MONTEVIDEO") {
            console.log(`Buscando sección para ${provincia} - ${turno}`)
            console.log("Estructura HTML de la página:")
            $("body > *").each((index, element) => {
                console.log(`Nivel ${index + 1}:`, $(element).prop("tagName"), $(element).attr("class") || "sin clase")
            })

            const $posiblesSecciones = $("div.card, div.container, div.row, div.col")
            console.log(`Posibles secciones encontradas: ${$posiblesSecciones.length}`)

            $posiblesSecciones.each((_, section) => {
                const $section = $(section)
                const textoSeccion = $section.text().toLowerCase()
                console.log(`Analizando sección: ${textoSeccion.slice(0, 100)}...`)

                if (textoSeccion.includes("montevideo") && textoSeccion.includes(turno.toLowerCase())) {
                    console.log(`Sección potencial encontrada para ${turno}`)

                    const $tablas = $section.find("table")
                    console.log(`Tablas encontradas en la sección: ${$tablas.length}`)

                    $tablas.each((_, tabla) => {
                        const $tabla = $(tabla)
                        const numerosTabla: string[] = []

                        $tabla.find("tr").each((index, fila) => {
                            if (index < 10) {
                                const $celdas = $(fila).find("td")
                                if ($celdas.length >= 2) {
                                    const num1 = $celdas.eq(0).text().trim()
                                    const num2 = $celdas.eq(1).text().trim()
                                    console.log(`Números encontrados en fila ${index + 1}: ${num1}, ${num2}`)
                                    if (/^\d{1,4}$/.test(num1)) numerosTabla.push(num1.padStart(4, "0"))
                                    if (/^\d{1,4}$/.test(num2)) numerosTabla.push(num2.padStart(4, "0"))
                                }
                            }
                        })

                        if (numerosTabla.length > 0) {
                            console.log(`Números válidos encontrados: ${numerosTabla.join(", ")}`)
                            numeros = numerosTabla.slice(0, 20)
                            while (numeros.length < 20) {
                                numeros.push("0000")
                            }
                            return false
                        }
                    })

                    if (numeros.some((n) => n !== "0000")) {
                        return false
                    }
                }
            })

            if (numeros.every((n) => n === "0000")) {
                console.log("Realizando búsqueda general de números")
                const todosLosNumeros = $("body").text().match(/\d{4}/g) || []
                console.log(`Todos los números de 4 dígitos encontrados: ${todosLosNumeros.join(", ")}`)
                numeros = todosLosNumeros.slice(0, 20).map((n) => n.padStart(4, "0"))
                while (numeros.length < 20) {
                    numeros.push("0000")
                }
            }
        } else {
            let $seccionTurno: cheerio.Cheerio<cheerio.AnyNode> | null = null

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

            console.log(`Sección encontrada para ${provincia} - ${turno}:`, $seccionTurno?.length > 0)

            if ($seccionTurno && $seccionTurno.length > 0) {
                console.log(`Contenido de la sección para ${provincia} - ${turno}:\n`, $seccionTurno.html() || "")

                const numerosEncontrados: string[] = []
                let elementoActual: cheerio.Cheerio<cheerio.AnyNode> = $seccionTurno
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

            const numerosOrdenados = Array(20).fill("0000")
            numeros.forEach((num, index) => {
                const nuevoIndice = index % 2 === 0 ? index / 2 : 10 + Math.floor(index / 2)
                numerosOrdenados[nuevoIndice] = num
            })

            numeros = numerosOrdenados
        }

        console.log(`Números finales para ${provincia} - ${turno}: ${numeros.join(", ")}`)
        return numeros
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
    resultados: any[],
    diaSemana: number,
) {
    if (esSorteoFinalizado(turno)) {
        console.log(`Procesando ${provincia} - ${turno}`)
        console.time(`obtenerResultadosPizarra-${provincia}-${turno}`)
        const numeros = await obtenerResultadosPizarra(provincia, turno)
        console.timeEnd(`obtenerResultadosPizarra-${provincia}-${turno}`)

        if (numeros.some((n) => n !== "0000")) {
            resultados.push({
                id: `${Date.now()}-${provincia}-${turno}`,
                fecha: fechaFormateada,
                dia: nombreDia,
                sorteo: turno,
                loteria: provincia,
                numeros,
                pizarraLink: pizarraUrl,
            })
            console.log(`Resultados agregados para ${provincia} - ${turno}: ${numeros.join(", ")}`)
        } else {
            console.log(`No se encontraron números válidos para ${provincia} - ${turno}`)
        }
    } else {
        console.log(`Sorteo ${turno} aún no finalizado para ${provincia}`)
    }
}

async function obtenerResultados(fecha: Date) {
    console.time("obtenerResultados")
    console.log(
        "Iniciando obtenerResultados para la fecha:",
        formatInTimeZone(fecha, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss"),
    )

    try {
        const resultados: {
            id: string
            fecha: string
            dia: string
            sorteo: string
            loteria: string
            numeros: string[]
            pizarraLink: string
        }[] = []

        const fechaFormateada = format(fecha, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fecha, "EEEE", { locale: es })
        const nombreDiaCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)

        const fechaFinal = fechaFormateada

        console.log(`Fecha formateada: ${fechaFinal}, Día: ${nombreDiaCapitalizado}`)

        const diaSemana = fecha.getDay()

        if (diaSemana === 0) {
            console.log("Hoy es domingo. No hay sorteos.")
            return { resultados }
        }

        const sorteos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

        for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
            console.log(`Procesando provincia: ${provinciaKey}`)

            if (provinciaKey === "MONTEVIDEO") {
                if (diaSemana >= 1 && diaSemana <= 5) {
                    const turnosMontevideoEspeciales = ["Matutina", "Nocturna"]
                    for (const turno of turnosMontevideoEspeciales) {
                        await procesarSorteo(
                            provinciaKey,
                            turno,
                            fechaFinal,
                            nombreDiaCapitalizado,
                            pizarraUrl,
                            resultados,
                            diaSemana,
                        )
                    }
                } else {
                    console.log(`No hay sorteos para ${provinciaKey} hoy (${nombreDiaCapitalizado})`)
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
                            resultados,
                            diaSemana,
                        )
                    }
                } else {
                    console.log(`No hay sorteos para ${provinciaKey} hoy (${nombreDiaCapitalizado})`)
                }
            }
        }

        console.log(`Total de resultados obtenidos: ${resultados.length}`)
        console.log("Resultados detallados:")
        resultados.forEach((r) => {
            console.log(`${r.loteria} - ${r.sorteo}: ${r.numeros.join(", ")}`)
        })

        return { resultados, timestamp: Date.now() }
    } catch (error) {
        console.error("Error en obtenerResultados:", error)
        throw error
    } finally {
        console.timeEnd("obtenerResultados")
    }
}

export async function GET(request: Request) {
    console.log("Iniciando obtención de resultados en vivo para /api/extractos")
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

        if (resultados.length === 0) {
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

        const resultadosFormateados = resultados.map((r) => ({
            ...r,
            numerosFormateados: r.numeros.join("\t"),
        }))

        console.log("Resultados finales enviados:")
        resultadosFormateados.forEach((r) => {
            console.log(`${r.loteria} - ${r.sorteo}: ${r.numerosFormateados}`)
        })

        return NextResponse.json(resultadosFormateados, { headers: cabeceras })
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

