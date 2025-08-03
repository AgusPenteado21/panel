import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from "firebase/firestore"
import { format } from "date-fns"

// Helper para parsear valores a double de forma segura
const parsearDouble = (valor: any): number => {
    if (valor == null) return 0.0
    if (typeof valor === "number") return valor
    if (typeof valor === "string") {
        return Number.parseFloat(valor.replace(",", ".")) || 0.0
    }
    return 0.0
}

// Función para verificar si una jugada está anulada
export const esJugadaAnulada = (jugadaData: Record<string, any>): boolean => {
    const anulada = jugadaData["anulada"] === true
    if (anulada) {
        // console.log(`🚫 JUGADA ANULADA DETECTADA Y EXCLUIDA: Secuencia: ${jugadaData['secuencia'] ?? 'N/A'}`);
    }
    return anulada
}

// 1. Nombres Canónicos de Loterías: Mapea cualquier variación a un nombre único, consistente, en MAYÚSCULAS y sin espacios extra.
const canonicalLotteryNames: Record<string, string> = {
    // Sorteos de Lotería
    LAPREVIA: "PREVIA",
    "LA PREVIA": "PREVIA",
    PREVIA: "PREVIA", // Asegurar que el nombre canónico también esté aquí
    PRIMERA: "PRIMERA",
    MATUTINA: "MATUTINA",
    VESPERTINA: "VESPERTINA",
    NOCTURNA: "NOCTURNA",

    // Provincias/Regiones
    "SAN LUIS": "SAN LUIS",
    "SAN LUI": "SAN LUIS", // Variación
    JUJUY: "JUJUY",
    JUJU: "JUJUY", // Variación
    FORMOSA: "FORMOSA",
    "ENTRE RIOS": "ENTRE RIOS",
    ENTRE: "ENTRE RIOS", // Variación
    CORDOBA: "CORDOBA",
    CORDOB: "CORDOBA", // Variación
    CORRIENTES: "CORRIENTES",
    CORRIE: "CORRIENTES", // Variación
    MENDOZA: "MENDOZA",
    MENDOZ: "MENDOZA", // Variación
    MONTEVIDEO: "MONTEVIDEO",
    URUGUA: "MONTEVIDEO", // Variación (asumiendo que URUGUA mapea a MONTEVIDEO)
    "RIO NEGRO": "RIO NEGRO",
    RIONEG: "RIO NEGRO", // Variación
    SANTIAGO: "SANTIAGO",
    SANTIA: "SANTIAGO", // Variación
    TUCUMAN: "TUCUMAN",
    TUCUMA: "TUCUMAN", // Variación
    MISIONES: "MISIONES",
    MISION: "MISIONES", // Variación
    NEUQUEN: "NEUQUEN",
    NEUQUE: "NEUQUEN", // Variación
    CHACO: "CHACO", // Añadido Chaco
    "SANTA FE": "SANTA FE", // Añadido Santa Fe
    SANTA: "SANTA FE", // Variación

    // Nacional/Provincial
    NACIONAL: "NACIONAL",
    NACION: "NACIONAL", // Variación
    PROVINCIAL: "PROVINCIAL",
    PROVIN: "PROVINCIAL", // Variación
    PROVINCIA: "PROVINCIAL", // Variación

    // Genérico "Todas"
    TODAS: "TODAS",
    "TODAS LAS LOTERIAS": "TODAS",
}

// Función auxiliar para obtener el nombre canónico
const getCanonicalName = (name: string): string => {
    const upperTrimmed = name.toUpperCase().trim()
    return canonicalLotteryNames[upperTrimmed] ?? upperTrimmed
}

// 2. Mapa de Nombres para Mostrar: Mapea nombres canónicos en MAYÚSCULAS a nombres amigables para el usuario.
const displayNamesMap: Record<string, string> = {
    PREVIA: "Previa",
    PRIMERA: "Primera",
    MATUTINA: "Matutina",
    VESPERTINA: "Vespertina",
    NOCTURNA: "Nocturna",
    "SAN LUIS": "San Luis",
    JUJUY: "Jujuy",
    FORMOSA: "Formosa",
    "ENTRE RIOS": "Entre Ríos",
    CORDOBA: "Córdoba",
    CORRIENTES: "Corrientes",
    MENDOZA: "Mendoza",
    MONTEVIDEO: "Montevideo",
    "RIO NEGRO": "Río Negro",
    SANTIAGO: "Santiago",
    TUCUMAN: "Tucumán",
    MISIONES: "Misiones",
    NEUQUEN: "Neuquén",
    NACIONAL: "Nacional",
    PROVINCIAL: "Provincial",
    CHACO: "Chaco",
    "SANTA FE": "Santa Fe",
    TODAS: "Todas las Loterías",
}

// 3. Loterías Equivalentes: Utiliza nombres canónicos en MAYÚSCULAS.
const loteriasEquivalentes: Record<string, string[]> = {
    PREVIA: [
        "NACIONAL",
        "PROVINCIAL",
        "SANTA FE",
        "ENTRE RIOS",
        "CORDOBA",
        "CHACO",
        "CORRIENTES",
        "MENDOZA",
        "MONTEVIDEO",
        "RIO NEGRO",
        "SANTIAGO",
        "TUCUMAN",
        "MISIONES",
        "NEUQUEN",
        "SAN LUIS",
        "JUJUY",
        "FORMOSA",
    ],
    PRIMERA: [
        "NACIONAL",
        "PROVINCIAL",
        "SANTA FE",
        "ENTRE RIOS",
        "CORDOBA",
        "CHACO",
        "CORRIENTES",
        "MENDOZA",
        "MONTEVIDEO",
        "RIO NEGRO",
        "SANTIAGO",
        "TUCUMAN",
        "MISIONES",
        "NEUQUEN",
        "SAN LUIS",
        "JUJUY",
        "FORMOSA",
    ],
    MATUTINA: [
        "NACIONAL",
        "PROVINCIAL",
        "SANTA FE",
        "ENTRE RIOS",
        "CORDOBA",
        "CHACO",
        "CORRIENTES",
        "MENDOZA",
        "MONTEVIDEO",
        "RIO NEGRO",
        "SANTIAGO",
        "TUCUMAN",
        "MISIONES",
        "NEUQUEN",
        "SAN LUIS",
        "JUJUY",
        "FORMOSA",
    ],
    VESPERTINA: [
        "NACIONAL",
        "PROVINCIAL",
        "SANTA FE",
        "ENTRE RIOS",
        "CORDOBA",
        "CHACO",
        "CORRIENTES",
        "MENDOZA",
        "MONTEVIDEO",
        "RIO NEGRO",
        "SANTIAGO",
        "TUCUMAN",
        "MISIONES",
        "NEUQUEN",
        "SAN LUIS",
        "JUJUY",
        "FORMOSA",
    ],
    NOCTURNA: [
        "NACIONAL",
        "PROVINCIAL",
        "SANTA FE",
        "ENTRE RIOS",
        "CORDOBA",
        "CHACO",
        "CORRIENTES",
        "MENDOZA",
        "MONTEVIDEO",
        "RIO NEGRO",
        "SANTIAGO",
        "TUCUMAN",
        "MISIONES",
        "NEUQUEN",
        "SAN LUIS",
        "JUJUY",
        "FORMOSA",
    ],
}

// Función para verificar coincidencia de lotería
export const verificarCoincidenciaLoteria = (loteriaJugada: string, loteriaResultado: string): boolean => {
    const canonicalJugada = getCanonicalName(loteriaJugada)
    const canonicalResultado = getCanonicalName(loteriaResultado)

    // Verificar coincidencia directa
    if (canonicalJugada === canonicalResultado) {
        return true
    }

    // Verificar si es "TODAS" o está vacío (lo que significa todas las loterías)
    if (canonicalJugada === "TODAS" || canonicalJugada === "") {
        return true
    }

    // Verificar si la lotería jugada es una clave principal y la lotería resultado está en su lista de equivalentes
    if (loteriasEquivalentes[canonicalJugada]?.includes(canonicalResultado)) {
        return true
    }

    // Verificar si la lotería resultado es una clave principal y la lotería jugada está en su lista de equivalentes (verificación inversa)
    if (loteriasEquivalentes[canonicalResultado]?.includes(canonicalJugada)) {
        return true
    }

    return false
}

// Verificar acierto específico (quiniela normal)
export const verificarAciertoEspecifico = (
    numeroApostado: string,
    posicion: string,
    numerosGanadores: string[],
    monto: number,
    provincia: string, // Ya es el nombre para mostrar
    loteriaResultado: string, // Ya es el nombre para mostrar
    sorteo: string, // Ya es el nombre para mostrar
    secuencia: string,
): Record<string, any> | null => {
    const posicionApostada = Number.parseInt(posicion) || 1
    let finRango: number
    if (posicionApostada === 1) {
        finRango = 1 // A la cabeza: solo buscar en la posición 0 (primer número)
    } else if (posicionApostada === 5) {
        finRango = 6 // A los 5: buscar en las posiciones 0-5 (primeros 6 números)
    } else if (posicionApostada === 10) {
        finRango = 11 // A los 10: buscar en las posiciones 0-10 (primeros 11 números)
    } else {
        finRango = 20 // A los 20 o cualquier otra posición: buscar en las posiciones 0-19 (primeros 20 números)
    }
    for (let i = 0; i < finRango && i < numerosGanadores.length; i++) {
        const numeroGanador = String(numerosGanadores[i]).padStart(4, "0")
        let ultimasCifras: string
        if (numeroGanador.length >= numeroApostado.length) {
            ultimasCifras = numeroGanador.substring(numeroGanador.length - numeroApostado.length)
        } else {
            ultimasCifras = numeroGanador
        }
        if (numeroApostado === ultimasCifras) {
            return {
                numero: numeroApostado,
                posicion: posicion,
                monto: monto,
                provincia: provincia,
                loteria: loteriaResultado,
                numeroGanador: ultimasCifras,
                numeroGanadorCompleto: numeroGanador,
                posicionAcierto: i + 1,
                sorteo: sorteo,
                secuencia: secuencia,
                tipo: "NUEVA JUGADA",
                cifrasCoincidentes: numeroApostado.length,
            }
        }
    }
    return null
}

// Verificar acierto de redoblona
export const verificarAciertoRedoblona = (
    jugadaData: Record<string, any>,
    numerosGanadores: string[],
): Record<string, any> | null => {
    const jugadas = jugadaData["jugadas"] as Array<Record<string, any>>
    if (!jugadas || jugadas.length === 0) return null

    const jugadaConRedoblonas = jugadas.find(
        (j) => j.redoblonas && Array.isArray(j.redoblonas) && j.redoblonas.length > 0,
    )
    if (!jugadaConRedoblonas) return null

    const numeroOriginalApostado =
        jugadaConRedoblonas["originalNumero"]?.toString() ?? jugadaConRedoblonas["numero"]?.toString() ?? ""
    const posicionOriginalApostada =
        jugadaConRedoblonas["originalPosicion"]?.toString() ?? jugadaConRedoblonas["posicion"]?.toString() ?? "1"

    // 1. VERIFICAR QUE EL NÚMERO ORIGINAL ACIERTE EN SU RANGO
    const posOriginal = Number.parseInt(posicionOriginalApostada) || 1
    let finRangoOriginal: number
    if (posOriginal === 1) {
        finRangoOriginal = 1
    } else if (posOriginal === 5) {
        finRangoOriginal = 6
    } else if (posOriginal === 10) {
        finRangoOriginal = 11
    } else {
        finRangoOriginal = 20
    }

    let originalNumeroGanador: string | null = null
    let originalPosicionAcierto: number | null = null
    for (let i = 0; i < finRangoOriginal && i < numerosGanadores.length; i++) {
        const numeroGanadorActual = String(numerosGanadores[i]).padStart(4, "0")
        const ultimasCifrasOriginal =
            numeroGanadorActual.length >= numeroOriginalApostado.length
                ? numeroGanadorActual.substring(numeroGanadorActual.length - numeroOriginalApostado.length)
                : numeroGanadorActual
        if (numeroOriginalApostado === ultimasCifrasOriginal) {
            originalNumeroGanador = numeroGanadorActual
            originalPosicionAcierto = i
            break
        }
    }

    if (originalNumeroGanador === null) {
        return null
    }

    // 2. VERIFICAR LAS REDOBLONAS
    const redoblonas = jugadaConRedoblonas.redoblonas as Array<Record<string, any>>
    let redoblonaNumeroApostadoGanador: string | null = null
    let redoblonaNumeroGanador: string | null = null
    let redoblonaPosicionAcierto: number | null = null
    let redoblonaPosicionApostadaGanador: string | null = null

    for (const redoblona of redoblonas) {
        const numeroRedoblonaApostado = redoblona.numero?.toString() ?? ""
        const posicionRedoblonaApostada = redoblona.posicion?.toString() ?? ""
        const posRedoblona = Number.parseInt(posicionRedoblonaApostada) || 20

        let inicioRango: number, finRango: number
        if (posRedoblona === 5) {
            inicioRango = 0
            finRango = 6
        } else if (posRedoblona === 10) {
            inicioRango = 0
            finRango = 11
        } else if (posRedoblona === 20) {
            inicioRango = 0
            finRango = 20
        } else {
            continue
        }

        for (let i = inicioRango; i < finRango && i < numerosGanadores.length; i++) {
            const numeroGanadorRango = String(numerosGanadores[i]).padStart(4, "0")
            const ultimasCifrasRango =
                numeroGanadorRango.length >= numeroRedoblonaApostado.length
                    ? numeroGanadorRango.substring(numeroGanadorRango.length - numeroRedoblonaApostado.length)
                    : numeroGanadorRango
            if (numeroRedoblonaApostado === ultimasCifrasRango) {
                redoblonaNumeroApostadoGanador = numeroRedoblonaApostado
                redoblonaNumeroGanador = numeroGanadorRango
                redoblonaPosicionAcierto = i
                redoblonaPosicionApostadaGanador = posicionRedoblonaApostada
                break
            }
        }
        if (redoblonaNumeroApostadoGanador !== null) {
            break
        }
    }

    if (redoblonaNumeroApostadoGanador === null) {
        return null
    }

    return {
        originalNumeroApostado: numeroOriginalApostado,
        originalPosicionApostada: posicionOriginalApostada,
        originalNumeroGanador: originalNumeroGanador,
        originalPosicionAcierto: originalPosicionAcierto,
        redoblonaNumeroApostado: redoblonaNumeroApostadoGanador,
        redoblonaPosicionApostada: redoblonaPosicionApostadaGanador,
        redoblonaNumeroGanador: redoblonaNumeroGanador,
        redoblonaPosicionAcierto: redoblonaPosicionAcierto,
    }
}

// Multiplicadores de premios
export const obtenerMultiplicador = (cifrasCoincidentes: number, posicion: number): number => {
    const multiplicadores: Record<number, Record<number, number>> = {
        1: { 1: 7.0, 5: 7.0, 10: 7.0, 20: 7.0 }, // Una cifra
        2: { 1: 70, 5: 14, 10: 7, 20: 3.5 }, // Dos cifras
        3: { 1: 600, 5: 120, 10: 60, 20: 30 }, // Tres cifras
        4: { 1: 3500, 5: 700, 10: 350, 20: 175 }, // Cuatro cifras
    }
    return multiplicadores[cifrasCoincidentes]?.[posicion] || 0.0
}

export const obtenerMultiplicadorTriplona = (tipoAcierto: string, enOrden: boolean, posicion: number): number => {
    const pagosTriplona: Record<string, number> = {
        "3 a los 3 en orden": 400000.0,
        "3 a los 3": 200000.0,
        "3 a los 4": 35000.0,
        "3 a los 7": 20000.0,
        "3 a los 10": 8000.0,
        "3 a los 15": 3500.0,
        "3 a los 20": 3000.0,
    }
    if (tipoAcierto && pagosTriplona[tipoAcierto]) {
        return pagosTriplona[tipoAcierto]
    }
    if (enOrden && posicion <= 3) {
        return pagosTriplona["3 a los 3 en orden"]!
    } else if (posicion <= 3) {
        return pagosTriplona["3 a los 3"]!
    } else if (posicion <= 4) {
        return pagosTriplona["3 a los 4"]!
    } else if (posicion <= 7) {
        return pagosTriplona["3 a los 7"]!
    } else if (posicion <= 10) {
        return pagosTriplona["3 a los 10"]!
    } else if (posicion <= 15) {
        return pagosTriplona["3 a los 15"]!
    } else {
        return pagosTriplona["3 a los 20"]!
    }
}

export const obtenerPremioQuintina = (aciertos: number): number => {
    const pagosQuintina: Record<number, number> = {
        3: 2000.0,
        4: 13000.0,
        5: 200000.0,
    }
    return pagosQuintina[aciertos] || 0.0
}

export const obtenerPremioBorratina = (aciertos: number): number => {
    const pagosBorratina: Record<number, number> = {
        6: 210.0,
        7: 1920.0,
        8: 48000.0,
    }
    return pagosBorratina[aciertos] || 0.0
}

export const calcularPremioRedoblona = (
    posicionOriginal: string,
    posicionRedoblona: string,
    montoApostado: number,
): number => {
    const pagosRedoblonas: Record<string, Record<string, number>> = {
        "1": {
            "5": 1280.0,
            "10": 640.0,
            "20": 336.84,
        },
        "5": {
            "5": 256.0,
            "10": 128.0,
            "20": 64.0,
        },
        "10": {
            "10": 64.0,
            "20": 32.0,
        },
        "20": {
            "20": 16.0,
        },
    }
    posicionOriginal = posicionOriginal.trim()
    posicionRedoblona = posicionRedoblona.trim()

    if (pagosRedoblonas[posicionOriginal] && pagosRedoblonas[posicionOriginal]![posicionRedoblona]) {
        const multiplicador = pagosRedoblonas[posicionOriginal]![posicionRedoblona]!
        const premioFinal = multiplicador * montoApostado
        return premioFinal
    }
    return 0.0
}

// Extraer resultados del extracto (adaptado de Flutter)
export const extraerResultados = (extractoData: Record<string, any>, fechaFormateada: string): any[] => {
    let resultados: any[] = []
    if (extractoData[fechaFormateada]) {
        const datos = extractoData[fechaFormateada]
        if (typeof datos === "object" && datos !== null && "resultados" in datos) {
            resultados = (datos.resultados as any[]) || []
        }
    }
    if (resultados.length === 0 && extractoData.resultados) {
        resultados = (extractoData.resultados as any[]) || []
    }
    if (resultados.length === 0) {
        for (const key in extractoData) {
            if (Object.prototype.hasOwnProperty.call(extractoData, key)) {
                const value = extractoData[key]
                if (typeof value === "object" && value !== null && "resultados" in value) {
                    resultados = (value.resultados as any[]) || []
                    if (resultados.length > 0) break
                }
            }
        }
    }
    return resultados
}

// Función principal para procesar jugadas y encontrar aciertos
export const procesarJugadasYEncontrarAciertos = (
    jugadasData: Record<string, any>[],
    resultadosExtracto: any[],
): Record<string, Record<string, any[]>> => {
    const aciertosAgrupados: Record<string, Record<string, any[]>> = {}

    for (const jugadaData of jugadasData) {
        if (esJugadaAnulada(jugadaData)) {
            continue
        }

        const secuencia = jugadaData.secuencia?.toString() ?? "Sin secuencia"
        const tipo = jugadaData.tipo?.toString() ?? "NUEVA JUGADA"

        // Obtener el nombre canónico de la lotería jugada (del nivel superior de la jugada)
        const canonicalLoteriaJugada = getCanonicalName(
            jugadaData.loteria?.toString() || jugadaData.loterias?.[0]?.toString() || "",
        )

        // Determinar las claves de sorteo a procesar para la jugada principal
        let sorteoKeysToProcessForParent: string[] = []
        if (drawNameToSorteoKeyMap[canonicalLoteriaJugada]) {
            sorteoKeysToProcessForParent.push(drawNameToSorteoKeyMap[canonicalLoteriaJugada]!)
        } else if (canonicalLoteriaJugada === "TODAS" || canonicalLoteriaJugada === "") {
            // Si la lotería principal es "TODAS" o está vacía, procesar todos los sorteos estándar
            sorteoKeysToProcessForParent = Object.values(drawNameToSorteoKeyMap)
        } else {
            // Si es un nombre de provincia o un nombre de lotería general, también procesar todos los sorteos estándar
            sorteoKeysToProcessForParent = Object.values(drawNameToSorteoKeyMap)
        }

        // PROCESAMIENTO ESPECIAL PARA REDOBLONAS
        if (tipo === "Jugada con redoblona") {
            const provinciasRaw = (jugadaData.provincias as any[]) || []
            const provincias = provinciasRaw.map((p) => p.toString())
            let montoIndividual = 0.0
            if (jugadaData.jugadas && Array.isArray(jugadaData.jugadas) && jugadaData.jugadas.length > 0) {
                montoIndividual = parsearDouble(jugadaData.jugadas[0].monto ?? "0")
            }
            if (montoIndividual === 0.0) {
                montoIndividual = parsearDouble(jugadaData.monto ?? "0")
            }

            for (const provinciaApostadaRaw of provincias) {
                const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada

                const resultadoProvincia = resultadosExtracto.find(
                    (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                )

                if (resultadoProvincia) {
                    const canonicalLoteriaResultado = getCanonicalName(resultadoProvincia.loteria?.toString() ?? "")
                    const displayLoteriaResultado = displayNamesMap[canonicalLoteriaResultado] ?? canonicalLoteriaResultado

                    // Verificar si la lotería de la jugada es compatible con la lotería del resultado
                    if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalLoteriaResultado)) {
                        continue // Saltar si no hay coincidencia de lotería principal
                    }

                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        // Usar sorteoKeysToProcessForParent
                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                        if (numerosGanadores.length > 0) {
                            const redoblonaGanadora = verificarAciertoRedoblona(jugadaData, numerosGanadores)
                            if (redoblonaGanadora) {
                                const jugadaOriginalData = jugadaData.jugadas?.find((j: any) => j.redoblonas) || jugadaData
                                const numeroOriginal =
                                    jugadaOriginalData.originalNumero?.toString() ?? jugadaOriginalData.numero?.toString() ?? ""
                                const posicionOriginal =
                                    jugadaOriginalData.originalPosicion?.toString() ?? jugadaOriginalData.posicion?.toString() ?? "1"
                                const redoblonasInfo = jugadaOriginalData.redoblonas || []
                                let premioRedoblona = 0.0
                                if (redoblonasInfo.length > 0) {
                                    const posicionRedoblona = redoblonasInfo[0].posicion?.toString() ?? "5"
                                    premioRedoblona = calcularPremioRedoblona(posicionOriginal, posicionRedoblona, montoIndividual)
                                }

                                const aciertoRedoblona = {
                                    numero: numeroOriginal,
                                    numeroRedoblona: redoblonaGanadora.redoblonaNumeroApostado?.toString() ?? "",
                                    posicion: posicionOriginal,
                                    posicionRedoblona: redoblonaGanadora.redoblonaPosicionApostada?.toString() ?? "",
                                    monto: montoIndividual,
                                    provincia: displayProvincia, // Usar nombre para mostrar
                                    loteria: displayLoteriaResultado, // Usar nombre para mostrar
                                    numeroGanador: numeroOriginal,
                                    numeroGanadorCompleto: numeroOriginal,
                                    sorteo: sorteoKey, // Ya es el nombre para mostrar
                                    secuencia: secuencia,
                                    tipo: "Jugada con redoblona",
                                    originalNumero: numeroOriginal,
                                    originalPosicion: posicionOriginal,
                                    redoblonas: redoblonasInfo,
                                    premioTotal: premioRedoblona,
                                    provinciaAcierto: displayProvincia, // Usar nombre para mostrar
                                    loteriaAcierto: displayLoteriaResultado, // Usar nombre para mostrar
                                    sorteoAcierto: sorteoKey,
                                    descripcionAcierto: `Redoblona acertó en ${sorteoKey} (${displayProvincia})`,
                                }

                                if (!aciertosAgrupados[displayProvincia]) {
                                    aciertosAgrupados[displayProvincia] = {}
                                }
                                if (!aciertosAgrupados[displayProvincia]![sorteoKey]) {
                                    aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                }
                                aciertosAgrupados[displayProvincia]![sorteoKey]!.push(aciertoRedoblona)
                            }
                        }
                    }
                }
            }
            continue // Saltar a la siguiente jugadaData ya que la redoblona fue manejada
        }

        // PROCESAMIENTO DE NUEVA JUGADA (NORMAL)
        if (tipo === "NUEVA JUGADA") {
            const jugadasArray = (jugadaData.jugadas as Array<Record<string, any>>) || []
            for (const jugadaIndividual of jugadasArray) {
                const numeroApostado = jugadaIndividual.numero?.toString() ?? ""
                const posicion = jugadaIndividual.posicion?.toString() ?? "1"
                const monto = parsearDouble(jugadaIndividual.monto ?? "0")
                const loteriaIndividualRaw = jugadaIndividual.loteria?.toString() ?? ""
                // Obtener el nombre canónico de la lotería individual
                const canonicalLoteriaIndividual = getCanonicalName(loteriaIndividualRaw)
                console.log(`--- Procesando Jugada Individual ---`)
                console.log(`Secuencia: ${secuencia}`)
                console.log(`Número Apostado: ${numeroApostado}, Posición: ${posicion}, Monto: ${monto}`)
                console.log(`Lotería Individual (Raw): "${loteriaIndividualRaw}" -> Canónica: "${canonicalLoteriaIndividual}"`)

                const provinciasRaw = (jugadaIndividual.provincias as any[]) || []
                const provincias = provinciasRaw.map((p) => p.toString())
                console.log(`Provincias Apostadas: ${provincias.join(", ")}`)

                if (numeroApostado === "" || monto <= 0) continue

                // Saltar si tiene redoblonas, ya que se maneja arriba
                if (
                    jugadaIndividual.redoblonas &&
                    Array.isArray(jugadaIndividual.redoblonas) &&
                    jugadaIndividual.redoblonas.length > 0
                ) {
                    continue
                }

                for (const provinciaApostadaRaw of provincias) {
                    const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                    const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada
                    console.log(
                        `  Provincia Apostada (Raw): "${provinciaApostadaRaw}" -> Canónica: "${canonicalProvinciaApostada}" -> Display: "${displayProvincia}"`,
                    )

                    const resultadoProvincia = resultadosExtracto.find(
                        (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                    )

                    if (resultadoProvincia) {
                        console.log(`    Resultado de Provincia Encontrado para: "${displayProvincia}"`)
                        const canonicalLoteriaResultado = getCanonicalName(resultadoProvincia.loteria?.toString() ?? "")
                        const displayLoteriaResultado = displayNamesMap[canonicalLoteriaResultado] ?? canonicalLoteriaResultado
                        console.log(
                            `    Lotería Resultado (Raw): "${resultadoProvincia.loteria?.toString() ?? ""}" -> Canónica: "${canonicalLoteriaResultado}" -> Display: "${displayLoteriaResultado}"`,
                        )
                        console.log(
                            `    Coincidencia de Lotería Principal (verificarCoincidenciaLoteria): ${verificarCoincidenciaLoteria(canonicalLoteriaIndividual, canonicalLoteriaResultado)}`,
                        )

                        // Verificar si la lotería de la jugada es compatible con la lotería del resultado
                        if (!verificarCoincidenciaLoteria(canonicalLoteriaIndividual, canonicalLoteriaResultado)) {
                            continue // Saltar si no hay coincidencia de lotería principal
                        }

                        const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}

                        // Determinar las claves de sorteo a procesar para esta jugada individual
                        let currentSorteoKeysForIndividualJugada: string[] = []

                        if (drawNameToSorteoKeyMap[canonicalLoteriaIndividual]) {
                            // Si la jugada individual especifica un sorteo específico (ej. "PRIMERA")
                            currentSorteoKeysForIndividualJugada.push(drawNameToSorteoKeyMap[canonicalLoteriaIndividual]!)
                        } else {
                            // Si la jugada individual no especifica un sorteo específico (está vacía o es una provincia),
                            // entonces debe verificar todos los sorteos estándar.
                            currentSorteoKeysForIndividualJugada = Object.values(drawNameToSorteoKeyMap)
                        }
                        console.log(
                            `    Sorteos a verificar para esta jugada individual: ${currentSorteoKeysForIndividualJugada.join(", ")}`,
                        )

                        for (const sorteoKey of currentSorteoKeysForIndividualJugada) {
                            const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                            if (numerosGanadores.length > 0) {
                                console.log(`      Verificando Sorteo: "${sorteoKey}"`)
                                console.log(`        Números Ganadores para ${sorteoKey}: [${numerosGanadores.join(", ")}]`)
                                const acierto = verificarAciertoEspecifico(
                                    numeroApostado,
                                    posicion,
                                    numerosGanadores,
                                    monto,
                                    displayProvincia, // Usar nombre para mostrar
                                    displayLoteriaResultado, // Usar nombre para mostrar
                                    sorteoKey, // Ya es el nombre para mostrar
                                    secuencia,
                                )
                                console.log(`        Acierto encontrado para ${sorteoKey}: ${acierto ? "Sí" : "No"}`)
                                if (acierto) {
                                    if (!aciertosAgrupados[displayProvincia]) {
                                        aciertosAgrupados[displayProvincia] = {}
                                    }
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey]) {
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    }
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                }
                            }
                        }
                    }
                }
            }
        } else if (tipo === "NUEVA TRIPLONA") {
            const numerosTriplona: string[] = []
            const extractNumbers = (source: any) => {
                if (Array.isArray(source)) {
                    for (const item of source) {
                        const numStr = String(item).trim()
                        if (numStr.includes("-")) {
                            numStr.split("-").forEach((part) => {
                                const cleanNum = part.trim().replace(/[^\d]/g, "")
                                if (cleanNum) numerosTriplona.push(cleanNum.padStart(2, "0"))
                            })
                        } else {
                            const cleanNum = numStr.replace(/[^\d]/g, "")
                            if (cleanNum) numerosTriplona.push(cleanNum.padStart(2, "0"))
                        }
                    }
                } else if (typeof source === "string") {
                    if (source.includes("-")) {
                        source.split("-").forEach((part) => {
                            const cleanNum = part.trim().replace(/[^\d]/g, "")
                            if (cleanNum) numerosTriplona.push(cleanNum.padStart(2, "0"))
                        })
                    } else if (source.length === 6) {
                        numerosTriplona.push(source.substring(0, 2), source.substring(2, 4), source.substring(4, 6))
                    } else {
                        const cleanNum = source.replace(/[^\d]/g, "")
                        if (cleanNum) numerosTriplona.push(cleanNum.padStart(2, "0"))
                    }
                }
            }
            if (jugadaData.jugadas && Array.isArray(jugadaData.jugadas) && jugadaData.jugadas.length > 0) {
                if (jugadaData.jugadas[0].numeros) {
                    extractNumbers(jugadaData.jugadas[0].numeros)
                }
            }
            if (numerosTriplona.length === 0 && jugadaData.numeros) {
                extractNumbers(jugadaData.numeros)
            }
            if (numerosTriplona.length === 0 && jugadaData.numero) {
                extractNumbers(jugadaData.numero)
            }

            if (numerosTriplona.length !== 3) continue

            const monto = parsearDouble(jugadaData.monto ?? jugadaData.totalMonto ?? "0")
            const provinciasRaw = (jugadaData.provincias as any[]) || []
            const provincias = provinciasRaw.map((p) => p.toString())

            for (const provinciaApostadaRaw of provincias) {
                const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada

                const resultadoProvincia = resultadosExtracto.find(
                    (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                )

                if (resultadoProvincia) {
                    const canonicalLoteriaResultado = getCanonicalName(resultadoProvincia.loteria?.toString() ?? "")
                    const displayLoteriaResultado = displayNamesMap[canonicalLoteriaResultado] ?? canonicalLoteriaResultado

                    // Verificar si la lotería de la jugada es compatible con la lotería del resultado
                    if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalLoteriaResultado)) {
                        continue // Saltar si no hay coincidencia de lotería principal
                    }

                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        // Usar sorteoKeysToProcessForParent
                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                        if (numerosGanadores.length >= 3) {
                            const ultimosDosDigitosGanadores: string[] = []
                            const numerosGanadoresCompletos: string[] = []
                            for (let i = 0; i < numerosGanadores.length && i < 20; i++) {
                                const numGanador = String(numerosGanadores[i]).padStart(4, "0")
                                const ultimosDosDigitos = numGanador.substring(numGanador.length - 2)
                                ultimosDosDigitosGanadores.push(ultimosDosDigitos)
                                numerosGanadoresCompletos.push(numGanador)
                            }

                            let aciertoEncontrado = false
                            if (numerosGanadores.length >= 3) {
                                const primerosTresUltimosDosDigitos = ultimosDosDigitosGanadores.slice(0, 3)
                                const primerosTresNumerosCompletos = numerosGanadoresCompletos.slice(0, 3)
                                let coincideEnOrden = true
                                for (let i = 0; i < 3; i++) {
                                    if (numerosTriplona[i] !== primerosTresUltimosDosDigitos[i]) {
                                        coincideEnOrden = false
                                        break
                                    }
                                }

                                if (coincideEnOrden) {
                                    const tipoAcierto = "3 a los 3 en orden"
                                    const acierto = {
                                        numero: numerosTriplona.join("-"),
                                        posicion: "3",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displayLoteriaResultado,
                                        numeroGanador: primerosTresUltimosDosDigitos.join("-"),
                                        numeroGanadorCompleto: primerosTresNumerosCompletos.join("-"),
                                        sorteo: sorteoKey, // Usar la clave de sorteo actual
                                        secuencia: secuencia,
                                        tipo: "NUEVA TRIPLONA",
                                        tipoAcierto: tipoAcierto,
                                        enOrden: true,
                                        aciertos: 3,
                                    }
                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                    aciertoEncontrado = true
                                }
                            }

                            if (!aciertoEncontrado) {
                                const posicionesAVerificar = [3, 4, 7, 10, 15, 20]
                                for (const posicion of posicionesAVerificar) {
                                    if (numerosGanadores.length >= posicion) {
                                        const ultimosDosDigitosHastaPosicion = ultimosDosDigitosGanadores.slice(0, posicion)
                                        const numerosGanadoresHastaPosicion = numerosGanadoresCompletos.slice(0, posicion)
                                        let todosCoincidenEnPosicion = true
                                        const numerosGanadoresCoincidentes: string[] = []
                                        const ultimosDosDigitosCoincidentes: string[] = []

                                        for (const numeroTriplona of numerosTriplona) {
                                            if (!ultimosDosDigitosHastaPosicion.includes(numeroTriplona)) {
                                                todosCoincidenEnPosicion = false
                                                break
                                            }
                                            const index = ultimosDosDigitosHastaPosicion.indexOf(numeroTriplona)
                                            numerosGanadoresCoincidentes.push(numerosGanadoresHastaPosicion[index])
                                            ultimosDosDigitosCoincidentes.push(ultimosDosDigitosHastaPosicion[index])
                                        }

                                        if (todosCoincidenEnPosicion) {
                                            const tipoAcierto = `3 a los ${posicion}`
                                            const acierto = {
                                                numero: numerosTriplona.join("-"),
                                                posicion: posicion.toString(),
                                                monto: monto,
                                                provincia: displayProvincia,
                                                loteria: displayLoteriaResultado,
                                                numeroGanador: ultimosDosDigitosCoincidentes.join("-"),
                                                numeroGanadorCompleto: numerosGanadoresCoincidentes.join("-"),
                                                sorteo: sorteoKey, // Usar la clave de sorteo actual
                                                secuencia: secuencia,
                                                tipo: "NUEVA TRIPLONA",
                                                tipoAcierto: tipoAcierto,
                                                enOrden: false,
                                                aciertos: 3,
                                            }
                                            if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                            if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                                aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                            aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                            aciertoEncontrado = true
                                            break
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (tipo === "NUEVA QUINTINA") {
            const todasLasQuintinas: string[][] = []
            if (jugadaData.numeros && Array.isArray(jugadaData.numeros)) {
                for (const num of jugadaData.numeros) {
                    const numStr = String(num).trim()
                    const numerosQuintina: string[] = []
                    if (numStr.includes(",")) {
                        numStr.split(",").forEach((part) => {
                            const cleanNum = part.trim().replace(/[^\d]/g, "")
                            if (cleanNum) numerosQuintina.push(cleanNum.padStart(2, "0"))
                        })
                    } else {
                        const cleanNum = numStr.replace(/[^\d]/g, "")
                        if (cleanNum) numerosQuintina.push(cleanNum.padStart(2, "0"))
                    }
                    if (numerosQuintina.length === 5) {
                        todasLasQuintinas.push(numerosQuintina)
                    }
                }
            }
            if (todasLasQuintinas.length === 0) continue

            const monto = parsearDouble(jugadaData.monto ?? jugadaData.totalMonto ?? "0")
            const provinciasRaw = (jugadaData.provincias as any[]) || []
            const provincias = provinciasRaw.map((p) => p.toString())

            for (const provinciaApostadaRaw of provincias) {
                const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada

                const resultadoProvincia = resultadosExtracto.find(
                    (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                )

                if (resultadoProvincia) {
                    const canonicalLoteriaResultado = getCanonicalName(resultadoProvincia.loteria?.toString() ?? "")
                    const displayLoteriaResultado = displayNamesMap[canonicalLoteriaResultado] ?? canonicalLoteriaResultado

                    // Verificar si la lotería de la jugada es compatible con la lotería del resultado
                    if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalLoteriaResultado)) {
                        continue // Saltar si no hay coincidencia de lotería principal
                    }

                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        // Usar sorteoKeysToProcessForParent
                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                        if (numerosGanadores.length >= 5) {
                            const ultimosDosDigitosGanadores: string[] = []
                            for (let i = 0; i < numerosGanadores.length && i < 18; i++) {
                                const numGanador = String(numerosGanadores[i]).padStart(4, "0")
                                const ultimosDosDigitos = numGanador.substring(numGanador.length - 2)
                                ultimosDosDigitosGanadores.push(ultimosDosDigitos)
                            }

                            for (const numerosQuintina of todasLasQuintinas) {
                                let aciertos = 0
                                const numerosCoincidentes: string[] = []
                                for (const numeroQuintina of numerosQuintina) {
                                    if (ultimosDosDigitosGanadores.includes(numeroQuintina)) {
                                        aciertos++
                                        numerosCoincidentes.push(numeroQuintina)
                                    }
                                }

                                if (aciertos >= 3) {
                                    const acierto = {
                                        numero: numerosQuintina.join(","),
                                        posicion: "20",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displayLoteriaResultado,
                                        numeroGanador: numerosCoincidentes.join(","),
                                        numeroGanadorCompleto: numerosCoincidentes.join(","),
                                        sorteo: sorteoKey, // Usar la clave de sorteo actual
                                        secuencia: secuencia,
                                        tipo: "NUEVA QUINTINA",
                                        tipoAcierto: `${aciertos} aciertos`,
                                        aciertos: aciertos,
                                        premio: obtenerPremioQuintina(aciertos),
                                    }
                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                }
                            }
                        }
                    }
                }
            }
        } else if (tipo === "NUEVA BORRATINA") {
            const todasLasBorratinas: string[][] = []
            if (jugadaData.numeros && Array.isArray(jugadaData.numeros)) {
                for (const num of jugadaData.numeros) {
                    const numStr = String(num).trim()
                    const numerosBorratina: string[] = []
                    if (numStr.includes(",")) {
                        numStr.split(",").forEach((part) => {
                            const cleanNum = part.trim().replace(/[^\d]/g, "")
                            if (cleanNum) numerosBorratina.push(cleanNum.padStart(2, "0"))
                        })
                    } else {
                        const cleanNum = numStr.replace(/[^\d]/g, "")
                        if (cleanNum) numerosBorratina.push(cleanNum.padStart(2, "0"))
                    }
                    if (numerosBorratina.length === 8) {
                        todasLasBorratinas.push(numerosBorratina)
                    }
                }
            }
            if (todasLasBorratinas.length === 0) continue

            const monto = parsearDouble(jugadaData.monto ?? jugadaData.totalMonto ?? "0")
            const provinciasRaw = (jugadaData.provincias as any[]) || []
            const provincias = provinciasRaw.map((p) => p.toString())

            for (const provinciaApostadaRaw of provincias) {
                const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada

                const resultadoProvincia = resultadosExtracto.find(
                    (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                )

                if (resultadoProvincia) {
                    const canonicalLoteriaResultado = getCanonicalName(resultadoProvincia.loteria?.toString() ?? "")
                    const displayLoteriaResultado = displayNamesMap[canonicalLoteriaResultado] ?? canonicalLoteriaResultado

                    // Verificar si la lotería de la jugada es compatible con la lotería del resultado
                    if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalLoteriaResultado)) {
                        continue // Saltar si no hay coincidencia de lotería principal
                    }

                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        // Usar sorteoKeysToProcessForParent
                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                        if (numerosGanadores.length >= 8) {
                            const ultimosDosDigitosGanadores: string[] = []
                            for (let i = 0; i < numerosGanadores.length && i < 20; i++) {
                                const numGanador = String(numerosGanadores[i]).padStart(4, "0")
                                const ultimosDosDigitos = numGanador.substring(numGanador.length - 2)
                                ultimosDosDigitosGanadores.push(ultimosDosDigitos)
                            }

                            for (const numerosBorratina of todasLasBorratinas) {
                                let aciertos = 0
                                const numerosCoincidentes: string[] = []
                                for (const numeroBorratina of numerosBorratina) {
                                    if (ultimosDosDigitosGanadores.includes(numeroBorratina)) {
                                        aciertos++
                                        numerosCoincidentes.push(numeroBorratina)
                                    }
                                }

                                if (aciertos >= 6) {
                                    const acierto = {
                                        numero: numerosBorratina.join(","),
                                        posicion: "20",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displayLoteriaResultado,
                                        numeroGanador: numerosCoincidentes.join(","),
                                        numeroGanadorCompleto: numerosCoincidentes.join(","),
                                        sorteo: sorteoKey, // Usar la clave de sorteo actual
                                        secuencia: secuencia,
                                        tipo: "NUEVA BORRATINA",
                                        tipoAcierto: `${aciertos} aciertos`,
                                        aciertos: aciertos,
                                        premio: obtenerPremioBorratina(aciertos),
                                    }
                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return aciertosAgrupados
}

// Calcular el total ganado de un grupo de aciertos
export const calcularTotalGanado = (aciertosAgrupados: Record<string, Record<string, any[]>>): number => {
    let totalGanado = 0.0
    for (const provinciaEntry of Object.values(aciertosAgrupados)) {
        for (const sorteoEntry of Object.values(provinciaEntry)) {
            for (const acierto of sorteoEntry) {
                const tipo = acierto.tipo ?? "NUEVA JUGADA"
                const monto = acierto.monto as number
                let premio = 0.0
                if (tipo === "NUEVA JUGADA") {
                    const cifrasCoincidentes = acierto.cifrasCoincidentes as number
                    const posicion = Number.parseInt(acierto.posicion)
                    premio = monto * obtenerMultiplicador(cifrasCoincidentes, posicion)
                } else if (tipo === "Jugada con redoblona") {
                    premio = (acierto.premioTotal as number) ?? 0.0
                } else if (tipo === "NUEVA TRIPLONA") {
                    const tipoAcierto = acierto.tipoAcierto ?? ""
                    const enOrden = acierto.enOrden ?? false
                    const posicion = Number.parseInt(acierto.posicion)
                    premio = obtenerMultiplicadorTriplona(tipoAcierto, enOrden, posicion)
                } else if (tipo === "NUEVA QUINTINA") {
                    const aciertosCount = acierto.aciertos as number
                    premio = obtenerPremioQuintina(aciertosCount)
                } else if (tipo === "NUEVA BORRATINA") {
                    const aciertosCount = acierto.aciertos as number
                    premio = obtenerPremioBorratina(aciertosCount)
                }
                totalGanado += premio
            }
        }
    }
    return totalGanado
}

// Guardar aciertos en Firestore en la nueva colección 'aciertos_calculados'
export const guardarAciertosEnFirestore = async (
    nombrePasador: string,
    aciertosAgrupados: Record<string, Record<string, any[]>>,
    fecha: Date,
): Promise<void> => {
    const fechaFormateada = format(fecha, "yyyy-MM-dd")
    // Cambiamos la colección a 'aciertos_calculados'
    // NOTE: `db` is not provided in the snippet, assuming it's imported correctly.
    // const aciertosCalculadosRef = collection(db, "aciertos_calculados")
    // The docId will be by pasador and date, so each day has a single updated record
    const docId = `${nombrePasador}_${fechaFormateada}`
    const aciertosParaGuardar: any[] = []
    let totalGanado = 0.0

    // Iterate and calculate totalGanado and aciertosParaGuardar
    for (const provinciaEntry of Object.values(aciertosAgrupados)) {
        for (const sorteoEntry of Object.values(provinciaEntry)) {
            for (const acierto of sorteoEntry) {
                const tipo = acierto.tipo ?? "NUEVA JUGADA"
                const monto = acierto.monto as number
                let premio = 0.0
                if (tipo === "NUEVA JUGADA") {
                    const cifrasCoincidentes = acierto.cifrasCoincidentes as number
                    premio = monto * obtenerMultiplicador(cifrasCoincidentes, Number.parseInt(acierto.posicion))
                } else if (tipo === "Jugada con redoblona") {
                    premio = (acierto.premioTotal as number) ?? 0.0
                } else if (tipo === "NUEVA TRIPLONA") {
                    const tipoAcierto = acierto.tipoAcierto ?? ""
                    const enOrden = acierto.enOrden ?? false
                    premio = obtenerMultiplicadorTriplona(tipoAcierto, enOrden, Number.parseInt(acierto.posicion))
                } else if (tipo === "NUEVA QUINTINA") {
                    const aciertosCount = acierto.aciertos as number
                    premio = obtenerPremioQuintina(aciertosCount)
                } else if (tipo === "NUEVA BORRATINA") {
                    const aciertosCount = acierto.aciertos as number
                    premio = obtenerPremioBorratina(aciertosCount)
                }
                totalGanado += premio
                const aciertoDatos = {
                    ...acierto,
                    id: acierto.id || Math.random().toString(36).substring(2, 11),
                    fecha: fecha, // Store as Date object
                    pasador: nombrePasador,
                    premio: premio,
                    ultimaActualizacion: Timestamp.now(),
                    sorteo: acierto["sorteo"], // This field should already be the normalized sorteo
                }
                aciertosParaGuardar.push(aciertoDatos)
            }
        }
    }

    // Guardar en la nueva colección 'aciertos_calculados'
    // await setDoc(
    //   doc(aciertosCalculadosRef, docId),
    //   {
    //     aciertos: aciertosParaGuardar, // Will be empty array if no aciertos
    //     totalAciertos: aciertosParaGuardar.length,
    //     totalGanado: totalGanado, // Will be 0 if no aciertos
    //     ultimaActualizacion: Timestamp.now(),
    //     pasadorId: nombrePasador,
    //     fechaConsulta: fechaFormateada, // Add the query date
    //   },
    //   { merge: true },
    // )
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Mapeo de sorteos a sus claves estandarizadas (utiliza nombres canónicos como claves)
const drawNameToSorteoKeyMap: Record<string, string> = {
    PREVIA: "Previa",
    PRIMERA: "Primera",
    MATUTINA: "Matutina",
    VESPERTINA: "Vespertina",
    NOCTURNA: "Nocturna",
}
