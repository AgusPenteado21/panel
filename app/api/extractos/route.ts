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
    // 🚫 TUCUMAN REMOVIDO DEL SCRAPING AUTOMÁTICO - SOLO MANUAL
    // TUCUMAN: "https://vivitusuerte.com/pizarra/tucuman",
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

// 🆕 FUNCIÓN ESPECÍFICA PARA NEUQUÉN
function extraerNumerosNeuquen($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🏔️ EXTRACCIÓN ESPECÍFICA NEUQUÉN: ${turno}`)

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

// 🆕 FUNCIÓN ESPECÍFICA PARA MISIONES
function extraerNumerosMisiones($: cheerio.CheerioAPI, turno: string): string[] {
    console.log(`🌿 EXTRACCIÓN ESPECÍFICA MISIONES: ${turno}`)

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

// FUNCIÓN ULTRA ESPECÍFICA - Solo extrae si encuentra EXACTAMENTE el turno solicitado
function extraerNumerosUltraEspecificos($: cheerio.CheerioAPI, turno: string, provincia: string): string[] {
    console.log(`🎯 EXTRACCIÓN ULTRA ESPECÍFICA: ${provincia} - ${turno}`)

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

        console.log(`\n🔍 PROCESANDO: ${provincia} - ${turno}`)

        // Obtener HTML de la pizarra
        const pizarraHtml = await obtenerConTiempoLimite(url)

        if (!pizarraHtml.ok) {
            console.error(`❌ Error HTTP ${pizarraHtml.status} para ${url}`)
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
        return numerosReordenados
    } catch (error) {
        console.error(`❌ ERROR: ${provincia} - ${turno}:`, error)
        return null
    }
}

// 🔥 FUNCIÓN PRINCIPAL CORREGIDA - SIN FILTROS RESTRICTIVOS
async function obtenerResultadosConfiables(): Promise<any[]> {
    console.log("🚀 INICIANDO EXTRACCIÓN ULTRA CONFIABLE - TODOS LOS RESULTADOS")

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

    // Procesar cada provincia (incluyendo las nuevas) - 🚫 TUCUMÁN EXCLUIDO
    for (const [provinciaKey, pizarraUrl] of Object.entries(URLS_PIZARRAS)) {
        console.log(`\n🏛️ === PROVINCIA: ${provinciaKey} ===`)

        const provinciaData = {
            loteria: provinciaKey === "NACION" ? "Nacional" : provinciaKey === "PROVINCIA" ? "Provincial" : provinciaKey,
            provincia: provinciaKey,
            sorteos: {} as { [key: string]: string[] },
        }

        let tieneResultadosValidos = false

        // Procesar cada turno
        for (const turno of turnos) {
            // 🔥 SOLO MANTENER FILTROS ESPECÍFICOS CONOCIDOS - ELIMINAR FILTROS PARA NEUQUÉN Y MISIONES
            if (provinciaKey === "MONTEVIDEO") {
                if (turno !== "Matutina" && turno !== "Nocturna") continue
                if (turno === "Matutina" && diaSemana > 5) continue
                if (turno === "Nocturna" && diaSemana === 0) continue
            }

            // 🚫 TUCUMÁN YA NO ESTÁ EN URLS_PIZARRAS, PERO POR SEGURIDAD:
            // if (provinciaKey === "TUCUMAN" && turno === "Previa") continue

            console.log(`🔍 Intentando obtener: ${provinciaKey} - ${turno}`)

            // Solo procesar si el sorteo finalizó
            if (esSorteoFinalizado(turno, fechaActual)) {
                const numeros = await obtenerResultadoEspecifico(provinciaKey, turno)

                // SOLO agregar si se encontraron números válidos
                if (numeros !== null && numeros.length > 0) {
                    // Agregar a API - FORMATO CORRECTO PARA LA INTERFAZ EXISTENTE
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

                    // Agregar a Firebase
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

        // Solo agregar provincia si tiene resultados válidos
        if (tieneResultadosValidos) {
            resultadosParaFirebase.resultados.push(provinciaData)
        }
    }

    // 🆕 INCLUIR TUCUMÁN MANUAL SI YA EXISTE EN FIREBASE
    console.log("\n🏔️ === VERIFICANDO TUCUMÁN MANUAL ===")
    try {
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            const data = docSnap.data()
            let tucumanExistente: any = null

            // Buscar Tucumán en la estructura anidada por fecha
            if (data[fechaDisplay]) {
                const datosDelDia = data[fechaDisplay] as ResultadoDia
                tucumanExistente = datosDelDia.resultados.find((r: any) => r.provincia === "TUCUMAN")
            }

            if (tucumanExistente && tucumanExistente.sorteos) {
                console.log("✅ TUCUMÁN encontrado en Firebase - Agregando a resultados")

                // Agregar Tucumán a resultados para Firebase
                resultadosParaFirebase.resultados.push(tucumanExistente)

                // Agregar cada sorteo de Tucumán a la API
                Object.entries(tucumanExistente.sorteos).forEach(([turno, numeros]) => {
                    resultadosApi.push({
                        id: `TUCUMAN-${turno}-${fechaDisplay}`,
                        fecha: fechaDisplay,
                        dia: nombreDia,
                        sorteo: turno,
                        loteria: "TUCUMAN",
                        provincia: "TUCUMAN",
                        numeros: numeros,
                        pizarraLink: "https://www.laquinieladetucuman.com.ar/",
                        necesita: "No",
                        confirmado: "Sí", // Marcado como confirmado porque fue cargado manualmente
                    })
                })

                console.log(`✅ TUCUMÁN AGREGADO: ${Object.keys(tucumanExistente.sorteos).length} sorteos`)
            } else {
                console.log("ℹ️ TUCUMÁN no encontrado en Firebase - Esperando carga manual")
            }
        }
    } catch (error) {
        console.error("❌ Error al verificar Tucumán:", error)
    }

    // Guardar en Firebase solo si hay resultados
    if (resultadosParaFirebase.resultados.length > 0) {
        try {
            const docRef = doc(db, "extractos", fechaKeyFirebase)
            // 🔥 ESTRUCTURA CORREGIDA: Guardar anidado por fecha como espera el Dart
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
    console.log("=== 🚀 API ULTRA CONFIABLE ===")

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
            // IMPORTANTE: Devolver directamente el array de resultados, sin envolverlo en un objeto
            return NextResponse.json(resultados, { headers: corsHeaders })
        }

        // 🔥 CONSULTA CORREGIDA: Buscar en la estructura anidada por fecha
        console.log(`📂 Consultando Firebase: ${fechaKeyFirebase}`)
        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let extractosFormateados: any[] = []

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

        // IMPORTANTE: Devolver directamente el array de resultados, sin envolverlo en un objeto
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
    console.log("📝 Actualización manual")

    try {
        const { provincia, turno, fecha, numeros } = await request.json()

        if (!provincia || !turno || !fecha || !numeros || !Array.isArray(numeros) || numeros.length !== 20) {
            throw new Error("Datos incompletos o inválidos")
        }

        const fechaObj = parse(fecha, "dd/MM/yyyy", new Date())
        const fechaArgentina = toZonedTime(fechaObj, "America/Argentina/Buenos_Aires")
        const fechaKeyFirebase = format(fechaArgentina, "yyyy-MM-dd")
        const nombreDia = format(fechaArgentina, "EEEE", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())

        const docRef = doc(db, "extractos", fechaKeyFirebase)
        const docSnap = await getDoc(docRef)

        let datosDia: ResultadoDia

        // 🔥 LECTURA CORREGIDA: Buscar en estructura anidada
        if (docSnap.exists()) {
            const data = docSnap.data()
            if (data[fecha]) {
                // Estructura anidada por fecha
                datosDia = data[fecha] as ResultadoDia
            } else {
                // Crear nueva estructura
                datosDia = {
                    fecha: fecha,
                    dia: nombreDia,
                    resultados: [],
                }
            }
        } else {
            datosDia = {
                fecha: fecha,
                dia: nombreDia,
                resultados: [],
            }
        }

        // 🆕 PRESERVAR OTROS RESULTADOS DEL DÍA AL GUARDAR TUCUMÁN
        // Si ya existen otros resultados scrapeados, mantenerlos
        if (docSnap.exists()) {
            const data = docSnap.data()
            if (data[fecha]) {
                const datosExistentes = data[fecha] as ResultadoDia
                // Mantener todas las provincias que NO sean la que estamos actualizando
                datosDia.resultados = datosExistentes.resultados.filter((r: any) => r.provincia !== provincia)
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

console.log("app/api/extractos/route.ts cargado.")
