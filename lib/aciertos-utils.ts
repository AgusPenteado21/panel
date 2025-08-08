import { Timestamp, collection, doc, setDoc } from "firebase/firestore"
import { format } from "date-fns"
import { db } from "@/lib/firebase" // Importación de la instancia de db

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
        console.log(`🚫 JUGADA ANULADA DETECTADA Y EXCLUIDA: Secuencia: ${jugadaData["secuencia"] ?? "N/A"}`)
    }
    return anulada
}

// Función para normalizar strings (eliminar acentos y convertir a mayúsculas)
const normalizeString = (str: string): string => {
    return str
        .normalize("NFD") // Normaliza a forma de descomposición canónica
        .replace(/[\u0300-\u036f]/g, "") // Elimina diacríticos (acentos)
        .replace(/[^\w\s]/gi, "") // Elimina caracteres no alfanuméricos (excepto espacios)
        .replace(/ñ/gi, "n") // Reemplaza ñ por n
        .toUpperCase()
        .trim()
}

// 1. Nombres Canónicos de Loterías: Mapea cualquier variación a un nombre único, consistente, en MAYÚSCULAS y sin espacios extra.
// Incluye normalización de acentos y Ñ, y mapeo de variaciones.
const canonicalLotteryNames: Record<string, string> = {
    // Sorteos de Lotería
    LAPREVIA: "PREVIA",
    "LA PREVIA": "PREVIA",
    PREVIA: "PREVIA",
    PRIMERA: "PRIMERA",
    MATUTINA: "MATUTINA",
    VESPERTINA: "VESPERTINA",
    NOCTURNA: "NOCTURNA",
    // Provincias/Regiones
    "SAN LUIS": "SAN LUIS",
    "SAN LUI": "SAN LUIS",
    JUJUY: "JUJUY",
    JUJU: "JUJUY",
    FORMOSA: "FORMOSA",
    "ENTRE RIOS": "ENTRE RIOS",
    ENTRE: "ENTRE RIOS",
    CORDOBA: "CORDOBA",
    CORDOB: "CORDOBA",
    CORRIENTES: "CORRIENTES",
    CORRIE: "CORRIENTES",
    MENDOZA: "MENDOZA",
    MENDOZ: "MENDOZA",
    MONTEVIDEO: "MONTEVIDEO",
    URUGUA: "MONTEVIDEO",
    "RIO NEGRO": "RIO NEGRO",
    RIONEG: "RIO NEGRO",
    SANTIAGO: "SANTIAGO",
    SANTIA: "SANTIAGO",
    TUCUMAN: "TUCUMAN",
    TUCUMA: "TUCUMAN",
    MISIONES: "MISIONES",
    MISION: "MISIONES",
    NEUQUEN: "NEUQUEN",
    NEUQUE: "NEUQUEN",
    NEUQUÉN: "NEUQUEN",
    CHACO: "CHACO",
    "SANTA FE": "SANTA FE",
    SANTA: "SANTA FE",
    SALTA: "SALTA", // Añadido Salta
    // Nacional/Provincial
    NACIONAL: "NACIONAL",
    NACION: "NACIONAL",
    PROVINCIAL: "PROVINCIAL",
    PROVIN: "PROVINCIAL",
    PROVINCIA: "PROVINCIAL",
    // Genérico "Todas"
    TODAS: "TODAS",
    "TODAS LAS LOTERIAS": "TODAS",
}

// Función auxiliar para obtener el nombre canónico (normaliza acentos y Ñ)
export const getCanonicalName = (name: string): string => {
    if (!name) return ""
    const normalizedName = normalizeString(name).toUpperCase().trim()
    return canonicalLotteryNames[normalizedName] || normalizedName
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
    SALTA: "Salta",
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
        "SALTA",
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
        "SALTA",
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
        "SALTA",
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
        "SALTA",
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
        "SALTA",
    ],
}

// Función para verificar coincidencia de lotería
export const verificarCoincidenciaLoteria = (loteriaJugada: string, loteriaResultado: string): boolean => {
    const canonicalJugada = getCanonicalName(loteriaJugada)
    const canonicalResultado = getCanonicalName(loteriaResultado)

    console.log(`🔍 VERIFICACIÓN DE COINCIDENCIA DE LOTERÍA:`)
    console.log(`   Lotería jugada: "${loteriaJugada}" (normalizada: "${canonicalJugada}")`)
    console.log(`   Lotería resultado: "${loteriaResultado}" (normalizada: "${canonicalResultado}")`)

    // Verificar si son exactamente iguales (ej. "PREVIA" === "PREVIA")
    if (canonicalJugada === canonicalResultado) {
        console.log(`   🎰 LOTERÍA: "${loteriaJugada}" vs "${loteriaResultado}" -> true (Coincidencia exacta)`)
        return true
    }

    // Verificar si la lotería jugada es "TODAS" o está vacía (lo que significa todas las loterías)
    if (canonicalJugada === "TODAS" || canonicalJugada === "") {
        console.log(`   🎰 LOTERÍA: "${loteriaJugada}" vs "${loteriaResultado}" -> true (TODAS o Vacía)`)
        return true
    }

    // Caso especial: PRIMERA y PROVINCIAL deben coincidir siempre si una es la otra
    if (
        (canonicalJugada === 'PRIMERA' && canonicalResultado === 'PROVINCIAL') ||
        (canonicalJugada === 'PROVINCIAL' && canonicalResultado === 'PRIMERA')
    ) {
        console.log('   ✅ Coincidencia especial: PRIMERA coincide con PROVINCIAL');
        return true;
    }

    // Verificar si la lotería jugada es una clave principal y la lotería resultado está en su lista de equivalentes
    // Ej: loteriaJugada="PREVIA", loteriaResultado="PROVINCIAL" -> true
    if (loteriasEquivalentes[canonicalJugada]?.includes(canonicalResultado)) {
        console.log(`   🎰 LOTERÍA: "${loteriaJugada}" vs "${loteriaResultado}" -> true (Equivalencia directa)`)
        return true
    }

    // Verificar si la lotería resultado es una clave principal y la lotería jugada está en su lista de equivalentes (verificación inversa)
    // Ej: loteriaResultado="PREVIA", loteriaJugada="PROVINCIAL" -> true
    if (loteriasEquivalentes[canonicalResultado]?.includes(canonicalJugada)) {
        console.log(`   🎰 LOTERÍA: "${loteriaJugada}" vs "${loteriaResultado}" -> true (Equivalencia inversa)`)
        return true
    }

    console.log(`   🎰 LOTERÍA: "${loteriaJugada}" vs "${loteriaResultado}" -> false`)
    return false
}

// Verificar acierto específico (quiniela normal) - AHORA DEVUELVE UNA LISTA DE ACIERTOS
export const verificarAciertoEspecifico = (
    numeroApostado: string,
    posicion: string,
    numerosGanadores: string[],
    monto: number,
    provincia: string,
    loteriaResultadoDisplay: string,
    sorteoKey: string,
    secuencia: string,
): Array<Record<string, any>> => { // Cambiado a Array<Record<string, any>>
    console.log(`🎯 JUGADA: ${numeroApostado} - ${sorteoKey} - [${numerosGanadores.join(", ")}] - Posición: ${posicion}`)

    const aciertosEncontrados: Array<Record<string, any>> = [] // Lista para almacenar todos los aciertos

    const trimmedPosicion = posicion.trim()
    const posicionApostada = Number.parseInt(trimmedPosicion) || 1
    let finRango: number

    // Lógica corregida para determinar el rango de búsqueda según la posición apostada
    if (posicionApostada === 1) {
        finRango = 1 // A la cabeza: solo buscar en la posición 0 (primer número)
        console.log("   🎯 BÚSQUEDA A LA CABEZA: Solo posición 0")
    } else if (posicionApostada === 5) {
        finRango = 6 // A los 5: buscar en las posiciones 0-5 (primeros 6 números)
        console.log("   🎯 BÚSQUEDA A LOS 5: Posiciones 0-5 (primeros 6 números)")
    } else if (posicionApostada === 10) {
        finRango = 11 // A los 10: buscar en las posiciones 0-10 (primeros 11 números)
        console.log("   🎯 BÚSQUEDA A LOS 10: Posiciones 0-10 (primeros 11 números)")
    } else {
        finRango = 20 // A los 20 o cualquier otra posición: buscar en las posiciones 0-19 (primeros 20 números)
        console.log("   🎯 BÚSQUEDA A LOS 20: Posiciones 0-19")
    }

    // Obtener el nombre canónico del sorteoKey
    const canonicalSorteoKey = getCanonicalName(sorteoKey)

    for (let i = 0; i < finRango && i < numerosGanadores.length; i++) {
        const numeroGanador = String(numerosGanadores[i]).padStart(4, "0")
        // Usar Math.min para evitar errores si numeroApostado es más largo que numeroGanador
        const ultimasCifras = numeroGanador.substring(Math.max(0, numeroGanador.length - numeroApostado.length))

        console.log(`   Pos ${i + 1}: ${numeroGanador} → últimas ${numeroApostado.length} cifras: ${ultimasCifras}`)

        if (numeroApostado === ultimasCifras) { // Usar === para coincidencia exacta de las últimas cifras
            console.log("   🎉 ¡ACIERTO ENCONTRADO EN POSICIÓN " + (i + 1) + "!")
            console.log("   🎉 ¡ACIERTO CONFIRMADO!")
            aciertosEncontrados.push({ // Añadir el acierto a la lista
                numero: numeroApostado,
                posicion: trimmedPosicion, // Posición apostada
                monto: monto,
                provincia: provincia,
                loteria: loteriaResultadoDisplay,
                numeroGanador: ultimasCifras,
                numeroGanadorCompleto: numeroGanador,
                posicionAcierto: i + 1, // Posición real donde salió
                sorteo: sorteoKey,
                secuencia: secuencia,
                tipo: "NUEVA JUGADA",
                cifrasCoincidentes: numeroApostado.length,
                sorteoCanonico: canonicalSorteoKey,
            })
        }
    }
    if (aciertosEncontrados.length === 0) {
        console.log("   ❌ No hay acierto en el rango especificado")
    }
    return aciertosEncontrados // Devolver la lista de aciertos
}

export const verificarAciertoRedoblona = (
    jugadaData: Record<string, any>,
    numerosGanadores: string[],
): Record<string, any> | null => {
    console.log("=== VERIFICANDO REDOBLONA CON LOGS DE DEPURACIÓN ===")
    console.log("Estructura completa de jugadaData:", JSON.stringify(jugadaData, null, 2))
    console.log("=== NÚMEROS GANADORES COMPLETOS ===")
    for (let i = 0; i < numerosGanadores.length; i++) {
        const numeroCompleto = String(numerosGanadores[i]).padStart(4, "0")
        console.log(`Posición ${i + 1}: ${numeroCompleto}`)
    }

    const jugadas = jugadaData["jugadas"] as Array<Record<string, any>>
    if (!jugadas || jugadas.length === 0) {
        console.log('❌ No se encontró el array "jugadas" en la estructura o está vacío')
        return null
    }

    const jugadaConRedoblonas = jugadas.find(
        (j) => j.redoblonas && Array.isArray(j.redoblonas) && j.redoblonas.length > 0,
    )

    if (!jugadaConRedoblonas) {
        console.log("❌ No se encontró ninguna jugada con redoblonas en el array")
        return null
    }

    const numeroOriginalApostado =
        jugadaConRedoblonas["originalNumero"]?.toString() ?? jugadaConRedoblonas["numero"]?.toString() ?? ""
    const posicionOriginalApostadaRaw =
        jugadaConRedoblonas["originalPosicion"]?.toString() ?? jugadaConRedoblonas["posicion"]?.toString() ?? "1"
    const posicionOriginalApostada = posicionOriginalApostadaRaw.trim()

    console.log("=== DATOS DE LA JUGADA ORIGINAL ===")
    console.log(`Número original apostado: ${numeroOriginalApostado}`)
    console.log(`Posición original apostada: ${posicionOriginalApostada}`)

    // 1. VERIFICAR QUE EL NÚMERO ORIGINAL ACIERTE EN SU RANGO (Lógica de Flutter)
    const posOriginal = Number.parseInt(posicionOriginalApostada) || 1
    let finRangoOriginal: number
    if (posOriginal === 1) {
        finRangoOriginal = 1 // Solo posición 0
    } else if (posOriginal === 5) {
        finRangoOriginal = 6 // Posiciones 0-5 (primeros 6)
    } else if (posOriginal === 10) {
        finRangoOriginal = 11 // Posiciones 0-10 (primeros 11)
    } else {
        finRangoOriginal = 20 // Posiciones 0-19 (primeros 20)
    }

    console.log("=== VERIFICACIÓN DEL NÚMERO ORIGINAL ===")
    console.log(`Buscando número original ${numeroOriginalApostado} en rango 0-${finRangoOriginal - 1}`)

    let originalNumeroGanador: string | null = null
    let originalPosicionAcierto: number | null = null

    for (let i = 0; i < finRangoOriginal && i < numerosGanadores.length; i++) {
        const numeroGanadorActual = String(numerosGanadores[i]).padStart(4, "0")
        const ultimasCifrasOriginal =
            numeroGanadorActual.length >= numeroOriginalApostado.length
                ? numeroGanadorActual.substring(numeroGanadorActual.length - numeroOriginalApostado.length)
                : numeroGanadorActual

        console.log(`Posición ${i + 1}: ${numeroGanadorActual}, últimas cifras: ${ultimasCifrasOriginal}`)
        console.log(`Comparando: ${numeroOriginalApostado} == ${ultimasCifrasOriginal}`)

        if (numeroOriginalApostado === ultimasCifrasOriginal) {
            console.log(`✅ Número original ${numeroOriginalApostado} acierta en posición ${i + 1}`)
            originalNumeroGanador = numeroGanadorActual
            originalPosicionAcierto = i
            break
        }
    }

    if (originalNumeroGanador === null) {
        console.log(`❌ Número original ${numeroOriginalApostado} no acierta en rango 0-${finRangoOriginal - 1}`)
        return null
    }
    console.log(`✅ Número original acierta en posición ${originalPosicionAcierto! + 1}`)

    // 2. VERIFICAR LAS REDOBLONAS (Lógica de Flutter)
    const redoblonas = jugadaConRedoblonas.redoblonas as Array<Record<string, any>>
    console.log("=== VERIFICACIÓN DE REDOBLONAS ===")
    console.log(`Redoblonas encontradas: ${redoblonas.length}`)
    console.log("Datos de redoblonas:", JSON.stringify(redoblonas, null, 2))

    let redoblonaNumeroApostadoGanador: string | null = null
    let redoblonaNumeroGanador: string | null = null
    let redoblonaPosicionAcierto: number | null = null
    let redoblonaPosicionApostadaGanador: string | null = null

    for (let redoblonaIndex = 0; redoblonaIndex < redoblonas.length; redoblonaIndex++) {
        const redoblona = redoblonas[redoblonaIndex]
        const numeroRedoblonaApostado = redoblona.numero?.toString() ?? ""
        const posicionRedoblonaApostadaRaw = redoblona.posicion?.toString() ?? ""
        const posicionRedoblonaApostada = posicionRedoblonaApostadaRaw.trim()

        console.log(`=== VERIFICANDO REDOBLONA ${redoblonaIndex + 1} ===`)
        console.log(`Número redoblona apostado: ${numeroRedoblonaApostado}`)
        console.log(`Posición redoblona apostada: ${posicionRedoblonaApostada}`)

        const posRedoblona = Number.parseInt(posicionRedoblonaApostada) || 20
        let inicioRango, finRango
        if (posRedoblona === 5) {
            inicioRango = 0 // del 1 al 6 (índices 0-5)
            finRango = 6
        } else if (posRedoblona === 10) {
            inicioRango = 0 // del 1 al 11 (índices 0-10)
            finRango = 11
        } else if (posRedoblona === 20) {
            inicioRango = 0 // del 1 al 20 (índices 0-19)
            finRango = 20
        } else {
            console.log(`❌ Posición de redoblona no válida: ${posicionRedoblonaApostada}`)
            continue
        }

        console.log(`Buscando ${numeroRedoblonaApostado} en rango: índice ${inicioRango} a ${finRango - 1}`)

        for (let i = inicioRango; i < finRango && i < numerosGanadores.length; i++) {
            const numeroGanadorRango = String(numerosGanadores[i]).padStart(4, "0")
            const ultimasCifrasRango =
                numeroGanadorRango.length >= numeroRedoblonaApostado.length
                    ? numeroGanadorRango.substring(numeroGanadorRango.length - numeroRedoblonaApostado.length)
                    : numeroGanadorRango

            console.log(`=== COMPARACIÓN DETALLADA POSICIÓN ${i + 1} ===`)
            console.log(`Número ganador completo: ${numeroGanadorRango}`)
            console.log(`Últimas ${numeroRedoblonaApostado.length} cifras: ${ultimasCifrasRango}`)
            console.log(`Número apostado: ${numeroRedoblonaApostado}`)
            console.log(`¿Coinciden? ${numeroRedoblonaApostado} == ${ultimasCifrasRango}`)

            if (numeroRedoblonaApostado === ultimasCifrasRango) {
                console.log(`🎯 ¡REDOBLONA ACERTADA! ${numeroRedoblonaApostado} encontrado en posición ${i + 1}`)
                redoblonaNumeroApostadoGanador = numeroRedoblonaApostado
                redoblonaNumeroGanador = numeroGanadorRango
                redoblonaPosicionAcierto = i
                redoblonaPosicionApostadaGanador = posicionRedoblonaApostada
                break // Found a winning redoblona, no need to check others
            }
        }
        if (redoblonaNumeroApostadoGanador !== null) {
            break // If one redoblona won, the whole redoblona bet wins.
        }
    }

    if (redoblonaNumeroApostadoGanador === null) {
        console.log("❌ Ninguna redoblona acertó")
        console.log("=== RESUMEN DE VERIFICACIÓN FALLIDA ===")
        console.log(`Se verificaron ${redoblonas.length} redoblonas`)
        for (let i = 0; i < redoblonas.length; i++) {
            const redoblona = redoblonas[i]
            console.log(`Redoblona ${i + 1}: ${redoblona["numero"]} a los ${redoblona["posicion"]} - NO ACERTÓ`)
        }
        return null
    }

    console.log("=== RESUMEN DE VERIFICACIÓN DE REDOBLONA EXITOSA ===")
    console.log(
        `Original: ${numeroOriginalApostado} (apostado) acierta con ${originalNumeroGanador} en pos ${originalPosicionAcierto! + 1}`,
    )
    console.log(
        `Redoblona: ${redoblonaNumeroApostadoGanador} (apostado) acierta con ${redoblonaNumeroGanador} en pos ${redoblonaPosicionAcierto! + 1} (a los ${redoblonaPosicionApostadaGanador})`,
    )

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

    if (!multiplicadores[cifrasCoincidentes] || !multiplicadores[cifrasCoincidentes]![posicion]) {
        return 0.0
    }
    return multiplicadores[cifrasCoincidentes]![posicion]!
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

    console.log("Calculando multiplicador para NUEVA TRIPLONA:")
    console.log(`Tipo de acierto: ${tipoAcierto}`)
    console.log(`En orden: ${enOrden}`)
    console.log(`Posición: ${posicion}`)

    if (tipoAcierto && pagosTriplona[tipoAcierto]) {
        console.log(`Usando multiplicador para ${tipoAcierto}: ${pagosTriplona[tipoAcierto]}`)
        return pagosTriplona[tipoAcierto]!
    }

    if (enOrden && posicion <= 3) {
        console.log(`Usando multiplicador para 3 a los 3 en orden: ${pagosTriplona["3 a los 3 en orden"]}`)
        return pagosTriplona["3 a los 3 en orden"]!
    } else if (posicion <= 3) {
        console.log(`Usando multiplicador para 3 a los 3: ${pagosTriplona["3 a los 3"]}`)
        return pagosTriplona["3 a los 3"]!
    } else if (posicion <= 4) {
        console.log(`Usando multiplicador para 3 a los 4: ${pagosTriplona["3 a los 4"]}`)
        return pagosTriplona["3 a los 4"]!
    } else if (posicion <= 7) {
        console.log(`Usando multiplicador para 3 a los 7: ${pagosTriplona["3 a los 7"]}`)
        return pagosTriplona["3 a los 7"]!
    } else if (posicion <= 10) {
        console.log(`Usando multiplicador para 3 a los 10: ${pagosTriplona["3 a los 10"]}`)
        return pagosTriplona["3 a los 10"]!
    } else if (posicion <= 15) {
        console.log(`Usando multiplicador para 3 a los 15: ${pagosTriplona["3 a los 15"]}`)
        return pagosTriplona["3 a los 15"]!
    } else {
        console.log(`Usando multiplicador para 3 a los 20: ${pagosTriplona["3 a los 20"]}`)
        return pagosTriplona["3 a los 20"]!
    }
}

export const obtenerPremioQuintina = (aciertos: number): number => {
    const pagosQuintina: Record<number, number> = {
        3: 2000.0,
        4: 13000.0,
        5: 200000.0,
    }
    console.log("Calculando premio para NUEVA QUINTINA:")
    console.log(`Aciertos: ${aciertos}`)
    if (pagosQuintina[aciertos]) {
        console.log(`Premio para ${aciertos} aciertos: ${pagosQuintina[aciertos]}`)
        return pagosQuintina[aciertos]!
    }
    return 0.0
}

export const obtenerPremioBorratina = (aciertos: number): number => {
    const pagosBorratina: Record<number, number> = {
        6: 210.0,
        7: 1920.0,
        8: 48000.0,
    }
    console.log("Calculando premio para NUEVA BORRATINA:")
    console.log(`Aciertos: ${aciertos}`)
    if (pagosBorratina[aciertos]) {
        console.log(`Premio para ${aciertos} aciertos: ${pagosBorratina[aciertos]}`)
        return pagosBorratina[aciertos]!
    }
    return 0.0
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

    console.log("Calculando premio redoblona:")
    console.log(`Posición original: ${posicionOriginal}`)
    console.log(`Posición redoblona: ${posicionRedoblona}`)
    console.log(`Monto apostado: ${montoApostado}`)

    if (pagosRedoblonas[posicionOriginal] && pagosRedoblonas[posicionOriginal]![posicionRedoblona]) {
        const multiplicador = pagosRedoblonas[posicionOriginal]![posicionRedoblona]!
        const premioFinal = multiplicador * montoApostado
        console.log(`Multiplicador: ${multiplicador}`)
        console.log(`Premio final (proporcional): ${premioFinal}`)
        return premioFinal
    }

    console.log("No se encontró premio para esta combinación de redoblona")
    return 0.0
}

// Extraer resultados del extracto (adaptado de Flutter)
export const extraerResultados = (extractoData: Record<string, any>, fechaFormateada: string): any[] => {
    let resultados: any[] = []
    console.log("EXTRAYENDO RESULTADOS DEL EXTRACTO:")
    console.log(`Fecha formateada: ${fechaFormateada}`)
    console.log("Claves disponibles en el extracto:", Object.keys(extractoData))

    // Primero intentar con la fecha formateada
    if (extractoData[fechaFormateada]) {
        console.log(`Encontrada clave con fecha formateada: ${fechaFormateada}`)
        const datos = extractoData[fechaFormateada]
        if (typeof datos === "object" && datos !== null && "resultados" in datos) {
            resultados = (datos.resultados as any[]) || []
            console.log(`Resultados encontrados en fecha formateada: ${resultados.length}`)
        }
    }

    // Si no hay resultados, intentar con la clave 'resultados' directamente
    if (resultados.length === 0 && extractoData.resultados) {
        console.log('Usando clave "resultados" directamente')
        resultados = (extractoData.resultados as any[]) || []
        console.log(`Resultados encontrados en clave "resultados": ${resultados.length}`)
    }

    // Si aún no hay resultados, buscar en todas las claves
    if (resultados.length === 0) {
        console.log("Buscando resultados en todas las claves del extracto...")
        for (const key in extractoData) {
            if (Object.prototype.hasOwnProperty.call(extractoData, key)) {
                const value = extractoData[key]
                if (resultados.length === 0 && typeof value === "object" && value !== null && "resultados" in value) {
                    resultados = (value.resultados as any[]) || []
                    console.log(`Resultados encontrados en clave "${key}": ${resultados.length}`)
                    if (resultados.length > 0) break
                }
            }
        }
    }

    // Imprimir un resumen de los resultados encontrados
    if (resultados.length > 0) {
        console.log("RESUMEN DE RESULTADOS ENCONTRADOS:")
        console.log(`Total de resultados: ${resultados.length}`)
        for (let i = 0; i < resultados.length && i < 5; i++) {
            console.log(`Resultado ${i}:`, resultados[i])
        }
        if (resultados.length > 5) {
            console.log(`... y ${resultados.length - 5} más`)
        }

        // Verificar si hay sorteos en los resultados
        for (const resultado of resultados) {
            if (typeof resultado === "object" && resultado !== null && "sorteos" in resultado) {
                const sorteos = (resultado.sorteos as Record<string, any>) ?? {}
                console.log(`Sorteos disponibles: ${Object.keys(sorteos)}`)
                // Verificar si hay números en Primera
                if (sorteos.Primera) {
                    const numerosPrimera = sorteos.Primera as string[]
                    console.log(`Números en Primera: ${numerosPrimera}`)
                    // Verificar si hay algún número que termina en 49
                    for (const numero of numerosPrimera) {
                        const numeroStr = String(numero).padStart(4, "0")
                        if (numeroStr.endsWith("49")) {
                            console.log(`¡ENCONTRADO NÚMERO QUE TERMINA EN 49!: ${numeroStr}`)
                        }
                    }
                }
            }
        }
    } else {
        console.log("NO SE ENCONTRARON RESULTADOS EN EL EXTRACTO")
    }
    return resultados
}

// Función principal para procesar jugadas y encontrar aciertos
export const procesarJugadasYEncontrarAciertos = (
    jugadasData: Record<string, any>[],
    resultadosExtracto: any[],
): Record<string, Record<string, any[]>> => {
    const aciertosAgrupados: Record<string, Record<string, any[]>> = {}

    console.log(`DEBUG: Iniciando procesarJugadasYEncontrarAciertos. Total jugadas: ${jugadasData.length}`)
    console.log(`DEBUG: Resultados de extracto disponibles: ${JSON.stringify(resultadosExtracto, null, 2)}`)

    // Mapeo de sorteos a sus claves estandarizadas (utiliza nombres canónicos como claves)
    const drawNameToSorteoKeyMap: Record<string, string> = {
        PREVIA: "Previa",
        PRIMERA: "Primera",
        MATUTINA: "Matutina",
        VESPERTINA: "Vespertina",
        NOCTURNA: "Nocturna",
    }

    for (const jugadaData of jugadasData) {
        console.log(`DEBUG: --- Procesando Jugada Principal (Secuencia: ${jugadaData.secuencia ?? "N/A"}) ---`)
        console.log(`DEBUG: Jugada Data Completa: ${JSON.stringify(jugadaData, null, 2)}`)

        if (esJugadaAnulada(jugadaData)) {
            console.log(`DEBUG: Jugada ${jugadaData.secuencia} anulada, saltando.`)
            continue
        }

        const secuencia = jugadaData.secuencia?.toString() ?? "Sin secuencia"
        const tipo = jugadaData.tipo?.toString() ?? "NUEVA JUGADA"

        // Obtener el nombre canónico de la lotería jugada (del nivel superior de la jugada)
        let loteriaPrincipalJugadaRaw = jugadaData.loteria?.toString() || ""
        if (
            loteriaPrincipalJugadaRaw === "" &&
            jugadaData.loterias &&
            Array.isArray(jugadaData.loterias) &&
            jugadaData.loterias.length > 0
        ) {
            loteriaPrincipalJugadaRaw = jugadaData.loterias[0]?.toString() || ""
        }
        const canonicalLoteriaJugada = getCanonicalName(loteriaPrincipalJugadaRaw)
        console.log(`DEBUG: Lotería Jugada Principal (Canónica): "${canonicalLoteriaJugada}"`)

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
        console.log(`DEBUG: Sorteos a procesar para jugada principal: ${sorteoKeysToProcessForParent.join(", ")}`)

        // PROCESAMIENTO DE NUEVA JUGADA (NORMAL)
        if (tipo === "NUEVA JUGADA") {
            const jugadasArray = (jugadaData.jugadas as Array<Record<string, any>>) || []
            console.log(`DEBUG: Tipo: Nueva Jugada. Total jugadas individuales: ${jugadasArray.length}`)

            for (const jugadaIndividual of jugadasArray) {
                console.log(`DEBUG:   --- Procesando Jugada Individual ---`)
                console.log(`DEBUG:   Jugada Individual Data: ${JSON.stringify(jugadaIndividual, null, 2)}`)
                console.log(
                    `DEBUG:   BET DETAILS: Numero: "${jugadaIndividual.numero?.toString() ?? ""}", Posicion: "${jugadaIndividual.posicion?.toString() ?? "1"}", Monto: ${parsearDouble(jugadaIndividual.monto ?? "0")}`,
                )

                const numeroApostado = jugadaIndividual.numero?.toString() ?? ""
                const posicion = jugadaIndividual.posicion?.toString() ?? "1"
                const monto = parsearDouble(jugadaIndividual.monto ?? "0")
                const loteriaIndividualRaw = jugadaIndividual.loteria?.toString() ?? ""

                // Obtener el nombre canónico de la lotería individual
                const canonicalLoteriaIndividual = getCanonicalName(loteriaIndividualRaw)
                console.log(`DEBUG:   Número Apostado: ${numeroApostado}, Posición: ${posicion}, Monto: ${monto}`)
                console.log(
                    `DEBUG:   Lotería Individual (Raw): "${loteriaIndividualRaw}" -> Canónica: "${canonicalLoteriaIndividual}"`,
                )

                const provinciasRaw = (jugadaIndividual.provincias as any[]) || []
                const provincias = provinciasRaw.map((p) => p.toString())
                console.log(`DEBUG:   Provincias Apostadas: ${provincias.join(", ")}`)

                if (numeroApostado === "" || monto <= 0) {
                    console.log(`DEBUG:   Número apostado vacío o monto <= 0. Saltando jugada individual.`)
                    continue
                }

                // Saltar si tiene redoblonas, ya que se maneja en la sección especial de redoblonas
                if (
                    jugadaIndividual.redoblonas &&
                    Array.isArray(jugadaIndividual.redoblonas) &&
                    jugadaIndividual.redoblonas.length > 0
                ) {
                    console.log(` ⏭️ SALTANDO JUGADA CON REDOBLONA - Se procesará en sección especial`)
                    continue
                }

                for (const provinciaApostadaRaw of provincias) {
                    const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                    const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada
                    console.log(
                        `DEBUG:     Procesando provincia apostada: "${provinciaApostadaRaw}" -> Canónica: "${canonicalProvinciaApostada}" -> Display: "${displayProvincia}"`,
                    )

                    const resultadoProvincia = resultadosExtracto.find(
                        (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                    )

                    if (resultadoProvincia) {
                        console.log(`DEBUG:       Resultados encontrados para provincia: "${displayProvincia}"`)
                        const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                        console.log(`DEBUG:       Sorteos del resultado: ${JSON.stringify(Object.keys(sorteosDelResultado))}`)

                        // Determinar las claves de sorteo a procesar para esta jugada individual
                        let currentSorteoKeysForIndividualJugada: string[] = []
                        if (drawNameToSorteoKeyMap[canonicalLoteriaIndividual]) {
                            // Si la jugada individual especifica un sorteo específico (ej. "PREVIA")
                            currentSorteoKeysForIndividualJugada.push(drawNameToSorteoKeyMap[canonicalLoteriaIndividual]!)
                        } else {
                            // Si la jugada individual no especifica un sorteo específico (está vacía o es una provincia),
                            // entonces debe verificar todos los sorteos estándar.
                            currentSorteoKeysForIndividualJugada = Object.values(drawNameToSorteoKeyMap)
                        }
                        console.log(
                            `DEBUG:       Sorteos a verificar para esta jugada individual: ${currentSorteoKeysForIndividualJugada.join(", ")}`,
                        )

                        for (const sorteoKey of currentSorteoKeysForIndividualJugada) {
                            const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []

                            if (numerosGanadores.length > 0) {
                                // Canonicalizar el sorteoKey para usar en la comparación de lotería
                                const canonicalSorteoKey = getCanonicalName(sorteoKey)
                                const displaySorteoKey = displayNamesMap[canonicalSorteoKey] ?? canonicalSorteoKey

                                console.log(`DEBUG:         Verificando Sorteo: "${sorteoKey}" (Canónica: "${canonicalSorteoKey}")`)
                                console.log(`DEBUG:           Números Ganadores para ${sorteoKey}: [${numerosGanadores.join(", ")}]`)
                                console.log(
                                    `DEBUG:           Coincidencia de Lotería (Jugada: "${canonicalLoteriaIndividual}", Resultado Sorteo: "${canonicalSorteoKey}"): ${verificarCoincidenciaLoteria(
                                        canonicalLoteriaIndividual,
                                        canonicalSorteoKey,
                                    )}`,
                                )

                                // Verificar si la lotería de la jugada es compatible con la lotería del sorteo del resultado
                                if (!verificarCoincidenciaLoteria(canonicalLoteriaIndividual, canonicalSorteoKey)) {
                                    console.log(`DEBUG:         No hay coincidencia de lotería para este sorteo. Saltando.`)
                                    continue // Saltar si no hay coincidencia de lotería para este sorteo específico
                                }

                                // AHORA ESPERAMOS UNA LISTA DE ACIERTOS
                                const aciertosEncontrados = verificarAciertoEspecifico(
                                    numeroApostado,
                                    posicion,
                                    numerosGanadores,
                                    monto,
                                    displayProvincia, // Usar nombre para mostrar
                                    displaySorteoKey, // Usar nombre para mostrar del sorteo del resultado
                                    sorteoKey, // Ya es el nombre para mostrar
                                    secuencia,
                                )

                                console.log(`DEBUG:         Aciertos encontrados para ${sorteoKey}: ${aciertosEncontrados.length > 0 ? "Sí" : "No"}`)

                                for (const acierto of aciertosEncontrados) { // Iterar sobre cada acierto encontrado
                                    const premioCalculado = monto * obtenerMultiplicador(acierto.cifrasCoincidentes, Number.parseInt(acierto.posicion));
                                    const aciertoConPremio = { ...acierto, premio: premioCalculado };

                                    if (!aciertosAgrupados[displayProvincia]) {
                                        aciertosAgrupados[displayProvincia] = {}
                                    }
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey]) {
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    }
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(aciertoConPremio)
                                    console.log(`DEBUG:           Acierto añadido a aciertosAgrupados con premio: ${premioCalculado}.`)
                                }
                            } else {
                                console.log(`DEBUG:         No hay números ganadores para el sorteo "${sorteoKey}".`)
                            }
                        }
                    } else {
                        console.log(`DEBUG:       No se encontraron resultados para provincia: "${displayProvincia}".`)
                    }
                }
            }
        }
        // PROCESAMIENTO ESPECIAL PARA REDOBLONAS (como en Flutter)
        else if (tipo === "Jugada con redoblona") {
            console.log("=== PROCESANDO JUGADA CON REDOBLONA (SECCIÓN ESPECIAL) ===")
            const provinciasRaw = (jugadaData.provincias as any[]) || []
            const provincias = provinciasRaw.map((p) => p.toString())

            let montoIndividual = 0.0
            if (jugadaData.jugadas && Array.isArray(jugadaData.jugadas) && jugadaData.jugadas.length > 0) {
                montoIndividual = parsearDouble(jugadaData.jugadas[0].monto ?? "0")
            }
            if (montoIndividual === 0.0) {
                montoIndividual = parsearDouble(jugadaData.monto ?? "0")
                console.log("⚠️ ADVERTENCIA: Usando monto principal en lugar de monto individual para redoblona")
            }
            console.log(`DEBUG: Tipo: Redoblona. Provincias: ${provincias.join(", ")}, Monto: ${montoIndividual}`)

            for (const provinciaApostadaRaw of provincias) {
                const canonicalProvinciaApostada = getCanonicalName(provinciaApostadaRaw)
                const displayProvincia = displayNamesMap[canonicalProvinciaApostada] ?? canonicalProvinciaApostada
                console.log(`DEBUG:   Procesando provincia apostada (Redoblona): "${displayProvincia}"`)

                const resultadoProvincia = resultadosExtracto.find(
                    (res) => getCanonicalName(res.provincia?.toString() ?? "") === canonicalProvinciaApostada,
                )

                if (resultadoProvincia) {
                    console.log(`DEBUG:     Resultados encontrados para provincia (Redoblona): "${displayProvincia}"`)
                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}
                    console.log(
                        `DEBUG:     Sorteos del resultado para Redoblona: ${JSON.stringify(Object.keys(sorteosDelResultado))}`,
                    )

                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []
                        const canonicalSorteoKey = getCanonicalName(sorteoKey)
                        const displaySorteoKey = displayNamesMap[canonicalSorteoKey] ?? canonicalSorteoKey

                        console.log(
                            `DEBUG:       Verificando sorteo (Redoblona): "${sorteoKey}". Números ganadores: ${numerosGanadores.join(", ")}`,
                        )
                        console.log(
                            `DEBUG:       Coincidencia de Lotería (Jugada: "${canonicalLoteriaJugada}", Resultado Sorteo: "${canonicalSorteoKey}"): ${verificarCoincidenciaLoteria(
                                canonicalLoteriaJugada,
                                canonicalSorteoKey,
                            )}`,
                        )

                        // Verificar si la lotería de la jugada es compatible con la lotería del sorteo del resultado
                        if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalSorteoKey)) {
                            console.log(`DEBUG:       No hay coincidencia de lotería para este sorteo. Saltando.`)
                            continue // Saltar si no hay coincidencia de lotería para este sorteo específico
                        }

                        if (numerosGanadores.length > 0) {
                            const redoblonaGanadora = verificarAciertoRedoblona(jugadaData, numerosGanadores)

                            if (redoblonaGanadora) {
                                console.log(`DEBUG:       Redoblona ganadora detectada en ${sorteoKey} (${displayProvincia})!`)

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
                                    provincia: displayProvincia,
                                    loteria: displaySorteoKey, // Usar el nombre para mostrar del sorteo del resultado
                                    numeroGanador: redoblonaGanadora.originalNumeroGanador, // Correctly from redoblonaGanadora
                                    numeroGanadorCompleto: redoblonaGanadora.redoblonaNumeroGanador, // Correctly from redoblonaGanadora
                                    sorteo: sorteoKey,
                                    secuencia: secuencia,
                                    tipo: "Jugada con redoblona",
                                    originalNumero: numeroOriginal,
                                    originalPosicion: posicionOriginal,
                                    redoblonas: redoblonasInfo,
                                    premioTotal: premioRedoblona, // Almacenar el premio aquí
                                    provinciaAcierto: displayProvincia,
                                    loteriaAcierto: displaySorteoKey,
                                    sorteoAcierto: sorteoKey,
                                    descripcionAcierto: `Redoblona acertó en ${sorteoKey} (${displayProvincia})`,
                                    // Agregar el nombre canónico del sorteoKey
                                    sorteoCanonico: canonicalSorteoKey,
                                }

                                if (!aciertosAgrupados[displayProvincia]) {
                                    aciertosAgrupados[displayProvincia] = {}
                                }
                                if (!aciertosAgrupados[displayProvincia]![sorteoKey]) {
                                    aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                }
                                aciertosAgrupados[displayProvincia]![sorteoKey]!.push(aciertoRedoblona)
                            } else {
                                console.log(`DEBUG:       No se detectó acierto de Redoblona en ${sorteoKey} (${displayProvincia}).`)
                            }
                        }
                    }
                } else {
                    console.log(`DEBUG:     No se encontraron resultados para provincia (Redoblona): "${displayProvincia}".`)
                }
            }
        }
        // Ahora procesar los otros tipos de jugadas (TRIPLONA, QUINTINA, BORRATINA)
        else if (tipo === "NUEVA TRIPLONA") {
            console.log("=== PROCESANDO NUEVA TRIPLONA ===")
            console.log("Datos de la jugada:", JSON.stringify(jugadaData, null, 2))

            let numerosTriplona: string[] = []

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
                        // Special case for 6-char string
                        numerosTriplona = [source.substring(0, 2), source.substring(2, 4), source.substring(4, 6)]
                    } else {
                        const cleanNum = source.replace(/[^\d]/g, "")
                        if (cleanNum) numerosTriplona.push(cleanNum.padStart(2, "0"))
                    }
                }
            }

            // Lógica de extracción de números como en Flutter
            if (jugadaData.jugadas && Array.isArray(jugadaData.jugadas) && jugadaData.jugadas.length > 0) {
                if (jugadaData.jugadas[0].numeros) {
                    console.log("Campo numeros encontrado en jugadas[0]:", jugadaData.jugadas[0].numeros)
                    extractNumbers(jugadaData.jugadas[0].numeros)
                }
            }
            if (numerosTriplona.length === 0 && jugadaData.numeros) {
                console.log("Campo numeros principal encontrado:", jugadaData.numeros)
                extractNumbers(jugadaData.numeros)
            }
            if (numerosTriplona.length === 0 && jugadaData.numero) {
                console.log("Campo numero principal encontrado:", jugadaData.numero)
                extractNumbers(jugadaData.numero)
            }

            console.log(`Números de NUEVA TRIPLONA procesados: ${numerosTriplona}`)

            if (numerosTriplona.length !== 3) {
                console.log(`❌ NUEVA TRIPLONA debe tener exactamente 3 números, encontrados: ${numerosTriplona.length}`)
                continue
            }

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
                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}

                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        const canonicalSorteoKey = getCanonicalName(sorteoKey)
                        const displaySorteoKey = displayNamesMap[canonicalSorteoKey] ?? canonicalSorteoKey

                        // Verificar si la lotería de la jugada es compatible con la lotería del sorteo del resultado
                        if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalSorteoKey)) {
                            console.log("❌ Las loterías no coinciden para NUEVA TRIPLONA")
                            continue // Saltar si no hay coincidencia de lotería principal
                        }

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

                            console.log(`Últimos dos dígitos de números ganadores: ${ultimosDosDigitosGanadores}`)
                            console.log(`Números de triplona a verificar: ${numerosTriplona}`)

                            let aciertoEncontrado = false

                            // Verificar primero si están en orden en los primeros 3
                            if (numerosGanadores.length >= 3) {
                                const primerosTresUltimosDosDigitos = ultimosDosDigitosGanadores.slice(0, 3)
                                const primerosTresNumerosCompletos = numerosGanadoresCompletos.slice(0, 3)
                                console.log(`Primeros 3 últimos dos dígitos: ${primerosTresUltimosDosDigitos}`)

                                let coincideEnOrden = true
                                for (let i = 0; i < 3; i++) {
                                    if (numerosTriplona[i] !== primerosTresUltimosDosDigitos[i]) {
                                        coincideEnOrden = false
                                        console.log(`❌ Número ${numerosTriplona[i]} no encontrado en posición 3`)
                                        break
                                    }
                                }

                                if (coincideEnOrden) {
                                    console.log("🎯 ¡DETECTADA COINCIDENCIA EN ORDEN EN LOS PRIMEROS 3!")
                                    const tipoAcierto = "3 a los 3 en orden"
                                    const premioCalculado = obtenerMultiplicadorTriplona(tipoAcierto, true, 3);
                                    const acierto = {
                                        numero: numerosTriplona.join("-"),
                                        posicion: "3",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displaySorteoKey, // Usar el nombre para mostrar del sorteo del resultado
                                        numeroGanador: primerosTresUltimosDosDigitos.join("-"),
                                        numeroGanadorCompleto: primerosTresNumerosCompletos.join("-"),
                                        sorteo: sorteoKey,
                                        secuencia: secuencia,
                                        tipo: "NUEVA TRIPLONA",
                                        tipoAcierto: tipoAcierto,
                                        enOrden: true,
                                        aciertos: 3,
                                        premio: premioCalculado, // Almacenar el premio
                                    }

                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                    console.log(`✅ Acierto NUEVA TRIPLONA agregado: ${numerosTriplona.join("-")} - ${tipoAcierto} con premio: ${premioCalculado}`)
                                    continue // Ya encontramos el mejor acierto posible, pasar a la siguiente provincia/sorteo
                                }
                            }

                            if (!aciertoEncontrado) {
                                const posicionesAVerificar = [3, 4, 7, 10, 15, 20]
                                for (const posicion of posicionesAVerificar) {
                                    if (numerosGanadores.length >= posicion) {
                                        const ultimosDosDigitosHastaPosicion = ultimosDosDigitosGanadores.slice(0, posicion)
                                        const numerosGanadoresHastaPosicion = numerosGanadoresCompletos.slice(0, posicion)
                                        console.log(`Verificando posición ${posicion} con números: ${ultimosDosDigitosHastaPosicion}`)

                                        let todosCoincidenEnPosicion = true
                                        const numerosGanadoresCoincidentes: string[] = []
                                        const ultimosDosDigitosCoincidentes: string[] = []

                                        for (const numeroTriplona of numerosTriplona) {
                                            if (!ultimosDosDigitosHastaPosicion.includes(numeroTriplona)) {
                                                todosCoincidenEnPosicion = false
                                                console.log(`❌ Número ${numeroTriplona} no encontrado en posición ${posicion}`)
                                                break
                                            }
                                            const index = ultimosDosDigitosHastaPosicion.indexOf(numeroTriplona)
                                            numerosGanadoresCoincidentes.push(numerosGanadoresHastaPosicion[index]!)
                                            ultimosDosDigitosCoincidentes.push(ultimosDosDigitosHastaPosicion[index]!)
                                            console.log(`✅ Número ${numeroTriplona} encontrado en índice ${index}`)
                                        }

                                        if (todosCoincidenEnPosicion) {
                                            console.log(`🎯 ¡DETECTADA COINCIDENCIA EN POSICIÓN ${posicion}!`)
                                            const tipoAcierto = `3 a los ${posicion}`
                                            const premioCalculado = obtenerMultiplicadorTriplona(tipoAcierto, false, posicion);
                                            const acierto = {
                                                numero: numerosTriplona.join("-"),
                                                posicion: posicion.toString(),
                                                monto: monto,
                                                provincia: displayProvincia,
                                                loteria: displaySorteoKey, // Usar el nombre para mostrar del sorteo del resultado
                                                numeroGanador: ultimosDosDigitosCoincidentes.join("-"),
                                                numeroGanadorCompleto: numerosGanadoresCoincidentes.join("-"),
                                                sorteo: sorteoKey,
                                                secuencia: secuencia,
                                                tipo: "NUEVA TRIPLONA",
                                                tipoAcierto: tipoAcierto,
                                                enOrden: false,
                                                aciertos: 3,
                                                premio: premioCalculado, // Almacenar el premio
                                            }

                                            if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                            if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                                aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                            aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                            console.log(`✅ Acierto NUEVA TRIPLONA agregado: ${numerosTriplona.join("-")} - ${tipoAcierto} con premio: ${premioCalculado}`)
                                            break // Encontramos un acierto, no necesitamos verificar posiciones mayores
                                        }
                                    }
                                }
                            }
                        } else {
                            console.log("❌ No hay suficientes números ganadores para verificar NUEVA TRIPLONA")
                        }
                    }
                }
            }
        } else if (tipo === "NUEVA QUINTINA") {
            console.log("=== PROCESANDO NUEVA QUINTINA ===")
            console.log("Datos de la jugada:", JSON.stringify(jugadaData, null, 2))

            const todasLasQuintinas: string[][] = []
            if (jugadaData.numeros && Array.isArray(jugadaData.numeros)) {
                console.log(`🔍 Procesando ${jugadaData.numeros.length} quintinas en cantidad`)
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
                        console.log(`✅ Quintina válida agregada: ${numerosQuintina.join(",")}`)
                    } else {
                        console.log(`❌ Quintina inválida (${numerosQuintina.length} números): ${numerosQuintina.join(",")}`)
                    }
                }
            }
            console.log(`Total de quintinas válidas encontradas: ${todasLasQuintinas.length}`)

            if (todasLasQuintinas.length === 0) {
                console.log("❌ No se encontraron quintinas válidas")
                continue
            }

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
                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}

                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        const canonicalSorteoKey = getCanonicalName(sorteoKey)
                        const displaySorteoKey = displayNamesMap[canonicalSorteoKey] ?? canonicalSorteoKey

                        // Verificar si la lotería de la jugada es compatible con la lotería del sorteo del resultado
                        if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalSorteoKey)) {
                            continue // Saltar si no hay coincidencia de lotería principal
                        }

                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []

                        if (numerosGanadores.length >= 5) {
                            const ultimosDosDigitosGanadores: string[] = []
                            // CORRECCIÓN: Iterar hasta 18 (índices 0-17) para quintina
                            for (let i = 0; i < numerosGanadores.length && i < 18; i++) {
                                const numGanador = String(numerosGanadores[i]).padStart(4, "0")
                                const ultimosDosDigitos = numGanador.substring(numGanador.length - 2)
                                ultimosDosDigitosGanadores.push(ultimosDosDigitos)
                            }

                            for (let quintinaIndex = 0; quintinaIndex < todasLasQuintinas.length; quintinaIndex++) {
                                const numerosQuintina = todasLasQuintinas[quintinaIndex]!
                                console.log(`🎯 Verificando quintina ${quintinaIndex + 1}: ${numerosQuintina.join(",")}`)

                                let aciertos = 0
                                const numerosCoincidentes: string[] = []
                                for (const numeroQuintina of numerosQuintina) {
                                    if (ultimosDosDigitosGanadores.includes(numeroQuintina)) {
                                        aciertos++
                                        numerosCoincidentes.push(numeroQuintina)
                                    }
                                }
                                console.log(`NUEVA QUINTINA ${quintinaIndex + 1}: ${aciertos} aciertos de 5 números`)

                                if (aciertos >= 3) {
                                    const premioCalculado = obtenerPremioQuintina(aciertos);
                                    const acierto = {
                                        numero: numerosQuintina.join(","),
                                        posicion: "20",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displaySorteoKey, // Usar el nombre para mostrar del sorteo del resultado
                                        numeroGanador: numerosCoincidentes.join(","),
                                        numeroGanadorCompleto: numerosCoincidentes.join(","),
                                        sorteo: sorteoKey,
                                        secuencia: secuencia,
                                        tipo: "NUEVA QUINTINA",
                                        tipoAcierto: `${aciertos} aciertos`,
                                        aciertos: aciertos,
                                        premio: premioCalculado, // Almacenar el premio
                                    }

                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                    console.log(`✅ Acierto NUEVA QUINTINA agregado: ${numerosQuintina.join(",")} - ${aciertos} aciertos con premio: ${premioCalculado}`)
                                }
                            }
                        }
                    }
                }
            }
        } else if (tipo === "NUEVA BORRATINA") {
            console.log("=== PROCESANDO NUEVA BORRATINA ===")
            console.log("Datos de la jugada:", JSON.stringify(jugadaData, null, 2))

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
                        console.log(`✅ Borratina válida agregada: ${numerosBorratina.join(",")}`)
                    } else {
                        console.log(`❌ Borratina inválida (${numerosBorratina.length} números): ${numerosBorratina.join(",")}`)
                    }
                }
            }
            console.log(`Total de borratinas válidas encontradas: ${todasLasBorratinas.length}`)

            if (todasLasBorratinas.length === 0) {
                console.log("❌ No se encontraron borratinas válidas")
                continue
            }

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
                    const sorteosDelResultado = (resultadoProvincia.sorteos as Record<string, any>) ?? {}

                    for (const sorteoKey of sorteoKeysToProcessForParent) {
                        const canonicalSorteoKey = getCanonicalName(sorteoKey)
                        const displaySorteoKey = displayNamesMap[canonicalSorteoKey] ?? canonicalSorteoKey

                        // Verificar si la lotería de la jugada es compatible con la lotería del sorteo del resultado
                        if (!verificarCoincidenciaLoteria(canonicalLoteriaJugada, canonicalSorteoKey)) {
                            continue // Saltar si no hay coincidencia de lotería principal
                        }

                        const numerosGanadores = (sorteosDelResultado[sorteoKey] as string[]) || []

                        if (numerosGanadores.length >= 8) {
                            const ultimosDosDigitosGanadores: string[] = []
                            // CORRECCIÓN: Iterar hasta 18 (índices 0-17) para borratina
                            for (let i = 0; i < numerosGanadores.length && i < 18; i++) {
                                const numGanador = String(numerosGanadores[i]).padStart(4, "0")
                                const ultimosDosDigitos = numGanador.substring(numGanador.length - 2)
                                ultimosDosDigitosGanadores.push(ultimosDosDigitos)
                            }

                            for (let borratinaIndex = 0; borratinaIndex < todasLasBorratinas.length; borratinaIndex++) {
                                const numerosBorratina = todasLasBorratinas[borratinaIndex]!
                                console.log(`🎯 Verificando borratina ${borratinaIndex + 1}: ${numerosBorratina.join(",")}`)

                                let aciertos = 0
                                const numerosCoincidentes: string[] = []
                                for (const numeroBorratina of numerosBorratina) {
                                    if (ultimosDosDigitosGanadores.includes(numeroBorratina)) {
                                        aciertos++
                                        numerosCoincidentes.push(numeroBorratina)
                                    }
                                }
                                console.log(`NUEVA BORRATINA ${borratinaIndex + 1}: ${aciertos} aciertos de 8 números`)

                                if (aciertos >= 6) {
                                    const premioCalculado = obtenerPremioBorratina(aciertos);
                                    const acierto = {
                                        numero: numerosBorratina.join(","),
                                        posicion: "20",
                                        monto: monto,
                                        provincia: displayProvincia,
                                        loteria: displaySorteoKey, // Usar el nombre para mostrar del sorteo del resultado
                                        numeroGanador: numerosCoincidentes.join(","),
                                        numeroGanadorCompleto: numerosCoincidentes.join(","),
                                        sorteo: sorteoKey,
                                        secuencia: secuencia,
                                        tipo: "NUEVA BORRATINA",
                                        tipoAcierto: `${aciertos} aciertos`,
                                        aciertos: aciertos,
                                        premio: premioCalculado, // Almacenar el premio
                                    }

                                    if (!aciertosAgrupados[displayProvincia]) aciertosAgrupados[displayProvincia] = {}
                                    if (!aciertosAgrupados[displayProvincia]![sorteoKey])
                                        aciertosAgrupados[displayProvincia]![sorteoKey] = []
                                    aciertosAgrupados[displayProvincia]![sorteoKey]!.push(acierto)
                                    console.log(`✅ Acierto NUEVA BORRATINA agregado: ${numerosBorratina.join(",")} - ${aciertos} aciertos con premio: ${premioCalculado}`)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    console.log("Final aciertosAgrupados:", JSON.stringify(aciertosAgrupados, null, 2)) // Log para depuración
    return aciertosAgrupados
}

// Calcular el total ganado de un grupo de aciertos
export const calcularTotalGanado = (pasadorId: string, selectedDate: Date, aciertosAgrupados: Record<string, Record<string, any[]>>): number => {
    let totalGanado = 0.0
    for (const provinciaEntry of Object.values(aciertosAgrupados)) {
        for (const sorteoEntry of Object.values(provinciaEntry)) {
            for (const acierto of sorteoEntry) {
                const tipo = acierto.tipo ?? "NUEVA JUGADA"
                let premio = (acierto.premio as number) ?? 0.0; // Usar el premio ya calculado
                if (tipo === "Jugada con redoblona") {
                    premio = (acierto.premioTotal as number) ?? 0.0; // Para redoblonas, usar premioTotal
                }
                console.log(
                    `Calculando premio para acierto: ${acierto.numero}, tipo: ${tipo}, premio: ${premio}`,
                )
                totalGanado += premio
            }
        }
    }
    console.log(`Total ganado calculado: ${totalGanado}`)
    return totalGanado
}

// Guardar aciertos en Firestore en la nueva colección 'aciertos_calculados'
export const guardarAciertosEnFirestore = async (
    nombrePasador: string,
    aciertosAgrupados: Record<string, Record<string, any[]>>,
    fecha: Date,
): Promise<void> => {
    const fechaFormateada = format(fecha, "yyyy-MM-dd")
    const aciertosCalculadosRef = collection(db, "aciertos_calculados")
    const docId = `${nombrePasador}_${fechaFormateada}`

    const aciertosParaGuardar: any[] = []
    let totalGanado = 0.0

    for (const provinciaEntry of Object.values(aciertosAgrupados)) {
        for (const sorteoEntry of Object.values(provinciaEntry)) {
            for (const acierto of sorteoEntry) {
                const tipo = acierto.tipo ?? "NUEVA JUGADA"
                let premio = (acierto.premio as number) ?? 0.0; // Usar el premio ya calculado
                if (tipo === "Jugada con redoblona") {
                    premio = (acierto.premioTotal as number) ?? 0.0; // Para redoblonas, usar premioTotal
                }
                totalGanado += premio

                const aciertoDatos = {
                    ...acierto,
                    id: acierto.id || Math.random().toString(36).substring(2, 11), // Generar ID si no existe
                    fecha: fecha, // Store as Date object
                    pasador: nombrePasador,
                    premio: premio,
                    ultimaActualizacion: Timestamp.now(),
                    sorteo: acierto["sorteo"],
                }
                aciertosParaGuardar.push(aciertoDatos)
            }
        }
    }

    await setDoc(
        doc(aciertosCalculadosRef, docId),
        {
            aciertos: aciertosParaGuardar,
            totalAciertos: aciertosParaGuardar.length,
            totalGanado: totalGanado,
            ultimaActualizacion: Timestamp.now(),
            pasadorId: nombrePasador,
            fechaConsulta: fechaFormateada,
        },
        { merge: true },
    )
    console.log(`💾 Aciertos guardados/actualizados en 'aciertos_calculados' para ${nombrePasador} en ${fechaFormateada}`)
}
