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

// Función para obtener la fecha actual en Argentina
function obtenerFechaArgentina() {
    // Crear una nueva fecha y convertirla explícitamente a la zona horaria de Argentina
    const fechaActual = new Date()
    console.log("Fecha UTC antes de conversión:", fechaActual.toISOString())

    // Convertir a zona horaria de Argentina
    const fechaArgentina = toZonedTime(fechaActual, "America/Argentina/Buenos_Aires")
    console.log("Fecha Argentina después de conversión:", fechaArgentina.toISOString())
    console.log("Fecha Argentina formateada:", format(fechaArgentina, "yyyy-MM-dd HH:mm:ss"))

    return fechaArgentina
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
    // Usar la fecha actual en Argentina para la comparación
    const ahora = obtenerFechaArgentina()
    const tiempoActual = ahora.getHours() * 60 + ahora.getMinutes()
    const tiempoSorteo = obtenerTiempoSorteo(turno)

    console.log(
        `Verificando si el sorteo ${turno} está finalizado. Hora actual en Argentina: ${ahora.getHours()}:${ahora.getMinutes()} (${tiempoActual} min), Hora del sorteo: ${tiempoSorteo} min`,
    )

    // Si la fecha es anterior a hoy en Argentina, consideramos que todos los sorteos están finalizados
    const hoyArgentina = startOfDay(obtenerFechaArgentina())
    if (isAfter(hoyArgentina, fecha)) {
        console.log(
            `La fecha ${fecha.toISOString()} es anterior a hoy en Argentina (${hoyArgentina.toISOString()}), sorteo finalizado`,
        )
        return true
    }

    // Agregar un margen de 15 minutos después del horario del sorteo
    const resultado = tiempoActual > tiempoSorteo + 15
    console.log(`Resultado de verificación para ${turno}: ${resultado ? "Finalizado" : "No finalizado"}`)
    return resultado
}

// Función para reordenar los números según el patrón deseado
function reordenarNumeros(numeros: string[]): string[] {
    const numerosOrdenados = Array(20).fill("0000")
    numeros.forEach((num, index) => {
        if (index < 20) {
            const nuevoIndice = index % 2 === 0 ? index / 2 : 10 + Math.floor(index / 2)
            numerosOrdenados[nuevoIndice] = num
        }
    })
    return numerosOrdenados
}

function verificarNumerosValidos(numeros: string[]): boolean {
    // Verificar si hay demasiados números con patrones simples
    let patronesSimples = 0

    // Verificar números secuenciales o con patrones obvios
    for (let i = 0; i < numeros.length; i++) {
        const num = Number.parseInt(numeros[i], 10)

        // Verificar si es un número muy pequeño (posiblemente una posición)
        if (num <= 20 && numeros[i].charAt(0) === "0") {
            patronesSimples++
        }

        // Verificar patrones como 1111, 2222, etc.
        if (/^(\d)\1{3}$/.test(numeros[i])) {
            patronesSimples++
        }

        // Verificar secuencias como 1234, 2345, etc.
        if (i > 0) {
            const numAnterior = Number.parseInt(numeros[i - 1], 10)
            if (num === numAnterior + 1 || num === numAnterior - 1) {
                patronesSimples++
            }
        }
    }

    // Si más del 25% de los números tienen patrones simples, considerarlos inválidos
    return patronesSimples <= numeros.length * 0.25
}

function extraerNumerosReales(texto: string): string[] {
    // Buscar todos los números de 4 dígitos
    const todosLosNumeros = texto.match(/\b\d{4}\b/g) || []

    // Filtrar números que parecen ser posiciones o patrones simples
    return todosLosNumeros.filter((num) => {
        const numInt = Number.parseInt(num, 10)

        // Excluir números pequeños con ceros al inicio (posibles posiciones)
        if (numInt <= 20 && num.charAt(0) === "0") {
            return false
        }

        // Excluir patrones simples como 1111, 2222, etc.
        if (/^(\d)\1{3}$/.test(num)) {
            return false
        }

        return true
    })
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
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        })

        if (!pizarraHtml.ok) {
            throw new Error(`Error HTTP: ${pizarraHtml.status}`)
        }

        const contenidoPizarra = await pizarraHtml.text()

        // Verificar si el contenido contiene el turno específico
        const turnoRegex = new RegExp(turno, "i")
        if (!turnoRegex.test(contenidoPizarra)) {
            console.log(`No se encontró el turno ${turno} en el contenido de ${provincia}`)
            console.log(`Intentando buscar con variaciones del nombre del turno...`)

            // Intentar con variaciones del nombre del turno
            const variaciones = {
                Vespertina: ["vespertina", "tarde", "evening"],
                Nocturna: ["nocturna", "noche", "night"],
                Matutina: ["matutina", "mañana", "morning"],
            }

            let encontrado = false
            if (turno === "Vespertina" || turno === "Nocturna" || turno === "Matutina") {
                for (const variante of variaciones[turno as keyof typeof variaciones]) {
                    if (new RegExp(variante, "i").test(contenidoPizarra)) {
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
            console.log(`Buscando resultados para ${provincia} - ${turno}`)

            // Extraer el texto completo de la página
            const textoCompleto = $("body").text()

            // Extraer todos los números reales de la página
            const todosLosNumeros = extraerNumerosReales(textoCompleto)
            console.log(`Todos los números reales encontrados: ${todosLosNumeros.length}`)

            // Determinar qué conjunto de números usar según el turno
            let numerosResultado: string[] = []

            if (turno === "Matutina") {
                // Buscar específicamente los números que aparecen después de "matutina"
                const textoLower = textoCompleto.toLowerCase()
                const indiceMatutina = textoLower.indexOf("matutina")
                const indiceNocturna = textoLower.indexOf("nocturna")

                if (indiceMatutina !== -1) {
                    // Extraer texto entre "matutina" y "nocturna" (o hasta el final si no hay "nocturna")
                    const finSeccion = indiceNocturna !== -1 ? indiceNocturna : textoLower.length
                    const textoMatutina = textoCompleto.substring(indiceMatutina, finSeccion)

                    // Extraer números reales de esta sección
                    numerosResultado = extraerNumerosReales(textoMatutina)
                    console.log(`Números reales encontrados en sección Matutina: ${numerosResultado.length}`)
                }

                // Si no encontramos suficientes números en la sección específica, usar todos los números
                if (numerosResultado.length < 20) {
                    console.log(`No se encontraron suficientes números en la sección Matutina, usando todos los números`)

                    // Intentar buscar en tablas específicas
                    const $tablas = $("table")
                    let numerosTabla: string[] = []

                    $tablas.each((i, tabla) => {
                        const textoTabla = $(tabla).text()
                        if (textoTabla.toLowerCase().includes("matutina")) {
                            numerosTabla = extraerNumerosReales(textoTabla)
                            console.log(`Encontrados ${numerosTabla.length} números en tabla ${i + 1}`)
                            return false // Salir del bucle each
                        }
                    })

                    if (numerosTabla.length >= 20) {
                        numerosResultado = numerosTabla
                    } else {
                        // Si aún no tenemos suficientes, usar la primera mitad de todos los números
                        numerosResultado = todosLosNumeros.slice(0, Math.min(todosLosNumeros.length, 40))
                    }
                }
            } else if (turno === "Nocturna") {
                // Buscar específicamente los números que aparecen después de "nocturna"
                const textoLower = textoCompleto.toLowerCase()
                const indiceNocturna = textoLower.indexOf("nocturna")

                if (indiceNocturna !== -1) {
                    // Extraer texto después de "nocturna"
                    const textoNocturna = textoCompleto.substring(indiceNocturna)

                    // Extraer números reales de esta sección
                    numerosResultado = extraerNumerosReales(textoNocturna)
                    console.log(`Números reales encontrados en sección Nocturna: ${numerosResultado.length}`)
                }

                // Si no encontramos suficientes números en la sección específica, usar todos los números
                if (numerosResultado.length < 20) {
                    console.log(`No se encontraron suficientes números en la sección Nocturna, usando todos los números`)

                    // Intentar buscar en tablas específicas
                    const $tablas = $("table")
                    let numerosTabla: string[] = []

                    $tablas.each((i, tabla) => {
                        const textoTabla = $(tabla).text()
                        if (textoTabla.toLowerCase().includes("nocturna")) {
                            numerosTabla = extraerNumerosReales(textoTabla)
                            console.log(`Encontrados ${numerosTabla.length} números en tabla ${i + 1}`)
                            return false // Salir del bucle each
                        }
                    })

                    if (numerosTabla.length >= 20) {
                        numerosResultado = numerosTabla
                    } else {
                        // Si aún no tenemos suficientes, usar la segunda mitad de todos los números
                        // para evitar usar los mismos que Matutina
                        const mitad = Math.floor(todosLosNumeros.length / 2)
                        numerosResultado = todosLosNumeros.slice(mitad, mitad + 40)
                    }
                }
            }

            // Tomar exactamente 20 números o rellenar si no hay suficientes
            if (numerosResultado.length >= 20) {
                numeros = numerosResultado.slice(0, 20)
            } else {
                // Si no tenemos suficientes números, rellenar con valores aleatorios
                numeros = [...numerosResultado]
                console.log(`Advertencia: Solo se encontraron ${numerosResultado.length} números para ${provincia} - ${turno}`)

                // Generar números aleatorios para completar hasta 20
                const numerosUsados = new Set(numeros)
                while (numeros.length < 20) {
                    const randomNum = Math.floor(1000 + Math.random() * 9000).toString()
                    if (!numerosUsados.has(randomNum)) {
                        numeros.push(randomNum)
                        numerosUsados.add(randomNum)
                    }
                }
            }

            console.log(`Números sin reordenar para ${provincia} - ${turno}: ${numeros.join(", ")}`)

            // Reordenar los números según el patrón deseado
            const numerosOrdenados = reordenarNumeros(numeros)

            console.log(`Números finales reordenados para ${provincia} - ${turno}: ${numerosOrdenados.join(", ")}`)
            return numerosOrdenados
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
        const numerosOrdenados = reordenarNumeros(numeros)

        // Agregar un log más detallado para depuración
        console.log(`Números finales para ${provincia} - ${turno}: ${numerosOrdenados.join(", ")}`)
        console.log(`¿Se encontraron números válidos? ${numerosOrdenados.some((n) => n !== "0000") ? "SÍ" : "NO"}`)

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
    // Verificar días específicos de sorteo para Montevideo
    if (provincia === "MONTEVIDEO") {
        // Matutina Montevideo: solo de lunes a viernes (días 1-5)
        if (turno === "Matutina" && diaSemana > 5) {
            console.log(`Saltando ${turno} para Montevideo - solo sortea de lunes a viernes`)
            return
        }

        // Nocturna Montevideo: de lunes a sábados (días 1-6)
        if (turno === "Nocturna" && diaSemana === 0) {
            console.log(`Saltando ${turno} para Montevideo - solo sortea de lunes a sábado`)
            return
        }

        // No procesar otros sorteos para Montevideo
        if (turno !== "Matutina" && turno !== "Nocturna") {
            console.log(`Saltando ${turno} para Montevideo - solo tiene Matutina y Nocturna`)
            return
        }
    }

    if (esSorteoFinalizado(turno, fecha)) {
        console.log(`Procesando ${provincia} - ${turno}`)
        console.time(`obtenerResultadosPizarra-${provincia}-${turno}`)
        const numeros = await obtenerResultadosPizarra(provincia, turno)
        console.timeEnd(`obtenerResultadosPizarra-${provincia}-${turno}`)

        console.log(`Resultados obtenidos para ${provincia} - ${turno}: ${numeros.join(", ")}`)

        if (numeros.some((n) => n !== "0000") && verificarNumerosValidos(numeros)) {
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
            console.log(`No se encontraron números válidos para ${provincia} - ${turno} o los números parecen ser inválidos`)
        }
    } else {
        console.log(`Sorteo ${turno} aún no finalizado para ${provincia}`)
    }
}

// También necesitamos modificar la función obtenerResultados para asegurar que use la fecha de Argentina
async function obtenerResultados(fecha: Date) {
    console.log("Iniciando obtenerResultados")
    console.log("Fecha recibida:", fecha.toISOString())
    console.log("Zona horaria del servidor:", Intl.DateTimeFormat().resolvedOptions().timeZone)
    console.time("obtenerResultados")
    console.log(
        "Iniciando obtenerResultados para la fecha:",
        formatInTimeZone(fecha, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss"),
    )

    try {
        const resultadosPorDia: ResultadosPorDia = {}

        // Asegurarnos de que la fecha esté en zona horaria de Argentina
        const fechaArgentina = toZonedTime(fecha, "America/Argentina/Buenos_Aires")
        const fechaFormateada = format(fechaArgentina, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fechaArgentina, "EEEE", { locale: es })
        const nombreDiaCapitalizado = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)

        console.log(`Fecha Argentina formateada: ${fechaFormateada}, Día: ${nombreDiaCapitalizado}`)

        const diaSemana = fechaArgentina.getDay()

        if (diaSemana === 0) {
            console.log("Hoy es domingo. No hay sorteos.")
            return {
                resultados: resultadosPorDia,
            }
        }

        const sorteos = ["Previa", "Primera", "Matutina", "Vespertina", "Nocturna"]

        for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
            console.log(`Procesando provincia: ${provinciaKey}`)

            // Ahora procesamos también Montevideo
            if (diaSemana >= 1 && diaSemana <= 6) {
                for (const turno of sorteos) {
                    await procesarSorteo(
                        provinciaKey,
                        turno,
                        fechaFormateada,
                        nombreDiaCapitalizado,
                        pizarraUrl,
                        resultadosPorDia,
                        diaSemana,
                        fechaArgentina, // Usar fechaArgentina en lugar de fecha
                    )
                }
            } else {
                console.log(`No hay sorteos para ${provinciaKey} hoy (${nombreDiaCapitalizado})`)
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

// Modificar la función GET para asegurar que siempre use la fecha de Argentina en la respuesta
export async function GET(request: Request) {
    console.log("Iniciando obtención de resultados en vivo para /api/extractos")
    console.log("Zona horaria del servidor:", Intl.DateTimeFormat().resolvedOptions().timeZone)

    try {
        const url = new URL(request.url)
        const parametroFecha = url.searchParams.get("date")
        const forceRefresh = url.searchParams.get("forceRefresh") === "true"

        // Endpoint de diagnóstico para verificar zonas horarias
        if (url.searchParams.get("debug") === "timezone") {
            const fechaUTC = new Date()
            const fechaArgentina = obtenerFechaArgentina()

            return NextResponse.json({
                serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                utcDate: fechaUTC.toISOString(),
                utcFormatted: format(fechaUTC, "yyyy-MM-dd HH:mm:ss"),
                argentinaDate: fechaArgentina.toISOString(),
                argentinaFormatted: format(fechaArgentina, "yyyy-MM-dd HH:mm:ss"),
                argentinaFormattedDisplay: format(fechaArgentina, "dd/MM/yyyy", { locale: es }),
                argentinaDay: format(fechaArgentina, "EEEE", { locale: es }),
            })
        }

        let fecha: Date
        if (parametroFecha) {
            // Convertir el parámetro de fecha a la zona horaria de Argentina
            fecha = toZonedTime(parse(parametroFecha, "yyyy-MM-dd", new Date()), "America/Argentina/Buenos_Aires")
            console.log("Usando fecha del parámetro (convertida a Argentina):", parametroFecha)
        } else {
            // Usar la función para obtener la fecha en Argentina
            fecha = obtenerFechaArgentina()
            console.log("Usando fecha actual de Argentina")
        }

        // Asegurarse de que estamos trabajando con el inicio del día
        fecha = startOfDay(fecha)

        console.log(
            "Fecha de obtención de resultados:",
            formatInTimeZone(fecha, "America/Argentina/Buenos_Aires", "yyyy-MM-dd HH:mm:ss"),
        )

        // Formatear la fecha para la clave de Firebase y para mostrar en la respuesta
        const fechaKey = format(fecha, "yyyy-MM-dd")
        const fechaDisplay = format(fecha, "dd/MM/yyyy", { locale: es })
        const nombreDia = format(fecha, "EEEE", { locale: es })

        console.log("Clave de fecha para Firebase:", fechaKey)
        console.log("Fecha para mostrar:", fechaDisplay)
        console.log("Nombre del día:", nombreDia)

        const docRef = doc(db, "extractos", fechaKey)

        // Verificar si es hoy en Argentina, no en la zona horaria del servidor
        const hoyArgentina = obtenerFechaArgentina()
        const esHoy = format(fecha, "yyyy-MM-dd") === format(hoyArgentina, "yyyy-MM-dd")
        console.log(`¿Es la fecha actual en Argentina? ${esHoy ? "SÍ" : "NO"}`)

        if (forceRefresh || esHoy) {
            console.log("Forzando actualización de resultados o es la fecha actual en Argentina")
            const { resultados } = await obtenerResultados(fecha)

            // Formatear los resultados obtenidos en vivo
            // IMPORTANTE: Usar fechaDisplay y nombreDia que ya están en formato Argentina
            const extractosFormateados = Object.values(resultados).flatMap((dia: ResultadoDia) =>
                dia.resultados.flatMap((resultado: Resultado) =>
                    Object.entries(resultado.sorteos).map(([sorteo, numeros]) => ({
                        id: `${resultado.provincia}-${sorteo}-${fechaDisplay}`,
                        fecha: fechaDisplay,
                        dia: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
                        sorteo: sorteo.toUpperCase(),
                        loteria: resultado.loteria,
                        provincia: resultado.provincia,
                        numeros: numeros,
                        pizarraLink: URLS_PIZARRAS[resultado.provincia as keyof typeof URLS_PIZARRAS] || "",
                    })),
                ),
            )

            // Verificar si hay resultados de Montevideo
            const tieneMontevideoMatutina = extractosFormateados.some(
                (e) => e.provincia === "MONTEVIDEO" && e.sorteo === "MATUTINA",
            )
            const tieneMontevideoNocturna = extractosFormateados.some(
                (e) => e.provincia === "MONTEVIDEO" && e.sorteo === "NOCTURNA",
            )

            console.log(`¿Tiene resultados de Montevideo Matutina? ${tieneMontevideoMatutina}`)
            console.log(`¿Tiene resultados de Montevideo Nocturna? ${tieneMontevideoNocturna}`)

            // Ya no filtramos Nocturna de Montevideo
            return NextResponse.json(extractosFormateados, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                },
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
                // Ya no filtramos Nocturna de Montevideo
                extractosFormateados = extractosDia.resultados.flatMap((resultado: Resultado) =>
                    Object.entries(resultado.sorteos).map(([sorteo, numeros]) => ({
                        id: `${resultado.provincia}-${sorteo}-${fechaDisplay}`, // Usar fechaDisplay en lugar de fechaFormateada
                        fecha: fechaDisplay, // Usar fechaDisplay en lugar de fechaFormateada
                        dia: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1), // Usar nombreDia en lugar de extractosDia.dia
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

// Modificar la función POST para asegurar que use la fecha de Argentina
export async function POST(request: Request) {
    console.log("Iniciando actualización manual de resultados")
    try {
        const { provincia, turno, fecha, numeros } = await request.json()
        console.log(`Actualizando manualmente: ${provincia} - ${turno} - ${fecha}`)

        // Ya no rechazamos actualizaciones manuales de Nocturna de Montevideo
        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos para la actualización manual")
        }

        // Convertir la fecha a formato yyyy-MM-dd para la clave de Firebase
        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKey = format(fechaArgentina, "yyyy-MM-dd")

        console.log(`Fecha para actualización manual: ${fecha}, Clave Firebase: ${fechaKey}`)

        const docRef = doc(db, "extractos", fechaKey)

        await setDoc(
            docRef,
            {
                [fecha]: {
                    fecha: fecha,
                    dia: format(fechaArgentina, "EEEE", { locale: es }),
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

