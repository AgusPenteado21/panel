import { NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { parse, format, startOfDay, isAfter } from "date-fns"
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
        const timestamp = Date.now()
        const urlConTimestamp = `${url}${url.includes("?") ? "&" : "?"}_t=${timestamp}`
        const respuesta = await fetch(urlConTimestamp, {
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

function esSorteoFinalizado(turno: string, fecha: Date): boolean {
    const ahora = toZonedTime(new Date(), "America/Argentina/Buenos_Aires")
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)

    console.log(
        `Verificando si el sorteo ${turno} está finalizado. Hora actual: ${ahora.getHours()}:${ahora.getMinutes()} (${tiempoActual} min), Hora del sorteo: ${tiempoSorteo} min`,
    )

    // Si la fecha es anterior a hoy, consideramos que todos los sorteos están finalizados
    if (isAfter(startOfDay(ahora), fecha)) {
        console.log(`La fecha ${fecha.toISOString()} es anterior a hoy, sorteo finalizado`)
        return true
    }

    // Agregar un margen de 15 minutos después del horario del sorteo
    const resultado = tiempoActual > (tiempoSorteo + 15)
    console.log(`Resultado de verificación para ${turno}: ${resultado ? "Finalizado" : "No finalizado"}`)
    return resultado
}

function parsearResultadosMontevideoEspecificos(contenido: string, turno: string): string[] {
    console.log(`Parseando resultados específicos de Montevideo para ${turno}`)
    const resultados: string[] = []
    const regex = new RegExp(`${turno}[\\s\\S]*?((?:\\d+\\.\\s*\\d{4}[\\s\\S]*?){20})`, "i")
    const match = contenido.match(regex)

    if (match) {
        console.log(`Sección de ${turno} encontrada:`, match[1])
        const numerosMatch = match[1].match(/\d+\.\s*(\d{4})/g)
        if (numerosMatch) {
            numerosMatch.forEach((num) => {
                const numero = num.split(".")[1].trim().padStart(4, "0")
                resultados.push(numero)
            })
        }
    } else {
        console.log(`No se encontró la sección de ${turno} en el contenido`)
    }

    console.log(`Resultados parseados para Montevideo ${turno}:`, resultados)
    return resultados.length === 20 ? resultados : Array(20).fill("0000")
}

async function obtenerResultadosPizarra(provincia: string, turno: string): Promise<string[]> {
    try {
        const url = URLS_PIZARRAS[provincia as keyof typeof URLS_PIZARRAS]
        if (!url) {
            console.error(`URL no encontrada para provincia: ${provincia}`)
            return Array(20).fill("0000")
        }

        console.log(`Obteniendo resultados de ${url} para ${provincia} - ${turno}`)

        // Agregar un parámetro de timestamp para evitar caché
        const timestamp = Date.now()
        const urlConTimestamp = `${url}?_t=${timestamp}`

        const pizarraHtml = await obtenerConTiempoLimite(urlConTimestamp, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })

        if (!pizarraHtml.ok) {
            throw new Error(`Error HTTP: ${pizarraHtml.status}`)
        }

        const contenidoPizarra = await pizarraHtml.text()

        // Verificar si el contenido contiene el turno específico
        const turnoRegex = new RegExp(turno, 'i')
        if (!turnoRegex.test(contenidoPizarra)) {
            console.log(`No se encontró el turno ${turno} en el contenido de ${provincia}`)
            console.log(`Intentando buscar con variaciones del nombre del turno...`)

            // Intentar con variaciones del nombre del turno
            const variaciones = {
                'Vespertina': ['vespertina', 'tarde', 'evening'],
                'Nocturna': ['nocturna', 'noche', 'night']
            }

            let encontrado = false
            if (turno === 'Vespertina' || turno === 'Nocturna') {
                for (const variante of variaciones[turno as keyof typeof variaciones]) {
                    if (new RegExp(variante, 'i').test(contenidoPizarra)) {
                        console.log(`Se encontró la variante "${variante}" para ${turno}`)
                        encontrado = true
                        break
                    }
                }
            }

            if (!encontrado) {
                console.log(`No se encontraron variaciones para ${turno} en el contenido`)
            }
        }

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
                console.log(`Realizando búsqueda general para Montevideo - ${turno}`)
                const todosLosNumeros =
                    $("body")
                        .text()
                        .match(/\d{1,4}/g) || []
                const numerosDelTurno = todosLosNumeros.filter((_, index) => {
                    // Para Matutina, tomar los primeros 20 números
                    // Para Nocturna, tomar los siguientes 20 números
                    return turno === "Matutina" ? index < 20 : index >= 20 && index < 40
                })
                numeros = numerosDelTurno.map((n) => n.padStart(4, "0"))
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
                console.log(`Contenido de la sección para ${provincia} - ${turno}:
`, $seccionTurno.html() || "")

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

                // Mantener el orden original de los números encontrados
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
                let indice = 0
                todosLosNumeros.forEach((num) => {
                    if (indice < 20 && numeros[indice] === "0000") {
                        numeros[indice] = num.padStart(4, "0")
                        indice++
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

        // Agregar un log más detallado para depuración
        console.log(`Números finales para ${provincia} - ${turno}: ${numerosOrdenados.join(", ")}`)
        console.log(`¿Se encontraron números válidos? ${numerosOrdenados.some(n => n !== "0000") ? "SÍ" : "NO"}`)

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
    fecha: Date,
) {
    if (esSorteoFinalizado(turno, fecha)) {
        console.log(`Procesando ${provincia} - ${turno}`)
        console.time(`obtenerResultadosPizarra-${provincia}-${turno}`)
        const numeros = await obtenerResultadosPizarra(provincia, turno)
        console.timeEnd(`obtenerResultadosPizarra-${provincia}-${turno}`)

        console.log(`Resultados obtenidos para ${provincia} - ${turno}: ${numeros.join(", ")}`)

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
                resultados: resultadosPorDia,
            }
        }

        const sorteos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

        for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
            console.log(`Procesando provincia: ${provinciaKey}`)

            // Temporalmente desactivamos el scraping de Montevideo
            if (provinciaKey === "MONTEVIDEO") {
                console.log(`Scraping de Montevideo temporalmente desactivado por mantenimiento`)
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
                            fecha,
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

// Modificar la función GET para forzar la actualización de resultados
export async function GET(request: Request) {
    console.log("Iniciando obtención de resultados en vivo para /api/extractos")

    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"

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

        const fechaKey = format(fecha, "yyyy-MM-dd")
        const docRef = doc(db, "extractos", fechaKey)

        // Si se fuerza la actualización o es la fecha actual, obtener resultados en vivo
        const esHoy = format(fecha, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

        if (forceRefresh || esHoy) {
            console.log("Forzando actualización de resultados o es la fecha actual")
            const { resultados } = await obtenerResultados(fecha)

            // Formatear los resultados obtenidos en vivo
            const extractosFormateados = Object.values(resultados).flatMap((dia: ResultadoDia) =>
                dia.resultados.flatMap((resultado: Resultado) =>
                    Object.entries(resultado.sorteos).map(([sorteo, numeros]) => ({
                        id: `${resultado.provincia}-${sorteo}-${dia.fecha}`,
                        fecha: dia.fecha,
                        dia: dia.dia,
                        sorteo: sorteo.toUpperCase(),
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                    })),
                ),
            )

            // Filtrar resultados de Montevideo según las restricciones
            const resultadosFiltrados = extractosFormateados.filter(
                (extracto: { provincia: string; sorteo: string }) => !(
                    extracto.provincia === "MONTEVIDEO" &&
                    (extracto.sorteo === "MATUTINA" || extracto.sorteo === "NOCTURNA")
                )
            );

            return NextResponse.json(resultadosFiltrados, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                }
            })
        }

        // Si no es forzado ni es hoy, obtener de Firebase
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
                // Filtrar los resultados para excluir Matutina y Nocturna de Montevideo
                const resultadosFiltrados = extractosDia.resultados.map((resultado: { provincia: string; sorteos: any }) => {
                    if (resultado.provincia === "MONTEVIDEO") {
                        // Crear una copia del objeto sin Matutina ni Nocturna
                        const nuevoSorteos = { ...resultado.sorteos };
                        delete nuevoSorteos["Matutina"];
                        delete nuevoSorteos["Nocturna"];
                        return {
                            ...resultado,
                            sorteos: nuevoSorteos
                        };
                    }
                    return resultado;
                }).filter((resultado: { provincia: string; sorteos: {} }) =>
                    // Eliminar resultados de Montevideo si no tienen sorteos después de filtrar
                    !(resultado.provincia === "MONTEVIDEO" && Object.keys(resultado.sorteos).length === 0)
                );

                extractosFormateados = resultadosFiltrados.flatMap((resultado: Resultado) =>
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
            // Si no hay datos en Firebase, obtener resultados en vivo

        }

        // Filtro adicional para asegurarnos de que no haya resultados de Matutina o Nocturna de Montevideo
        extractosFormateados = extractosFormateados.filter(
            (extracto: { provincia: string; sorteo: string }) => !(
                extracto.provincia === "MONTEVIDEO" &&
                (extracto.sorteo === "MATUTINA" || extracto.sorteo === "NOCTURNA")
            )
        );

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

export async function POST(request: Request) {
    console.log("Iniciando actualización manual de resultados")
    try {
        const { provincia, turno, fecha, numeros } = await request.json()
        console.log(`Actualizando manualmente: ${provincia} - ${turno} - ${fecha}`)

        // No permitir actualizaciones manuales de Matutina o Nocturna de Montevideo
        if (provincia === "MONTEVIDEO" && (turno === "Matutina" || turno === "Nocturna")) {
            throw new Error("Actualización de Matutina y Nocturna de Montevideo temporalmente desactivada")
        }

        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos para la actualización manual")
        }

        const fechaKey = format(parse(fecha, "dd/MM/yyyy", new Date()), "yyyy-MM-dd")
        const docRef = doc(db, "extractos", fechaKey)

        await setDoc(
            docRef,
            {
                [fecha]: {
                    fecha: fecha,
                    dia: format(parse(fecha, "dd/MM/yyyy", new Date()), "EEEE", { locale: es }),
                    resultados: [
                        {
                            loteria: provincia === "MONTEVIDEO" ? "Montevideo" : provincia,
                            provincia: provincia,
                            sorteos: {
                                [turno]: numeros,
                            },
                        },
                    ],
                },
            },
            { merge: true },
        )

        console.log("Resultados actualizados manualmente con éxito")
        return NextResponse.json({ success: true, message: "Resultados actualizados manualmente con éxito" })
    } catch (error) {
        console.error("Error al actualizar manualmente los resultados:", error)
        return NextResponse.json(
            {
                error: "Error al actualizar manualmente los resultados",
                detalles: error instanceof Error ? error.message : "Error desconocido",
            },
            { status: 500 },
        )
    }
}

console.log("route.ts file loaded successfully")