'use server'

import { db } from "@/lib/firebase"
import { collection, getDocs, doc, query, where, setDoc, Timestamp, getDoc } from "firebase/firestore"
import { format, startOfDay, endOfDay } from "date-fns"
import {
    esJugadaAnulada,
    extraerResultados,
    procesarJugadasYEncontrarAciertos,
    calcularTotalGanado,
    guardarAciertosEnFirestore,
} from "@/lib/aciertos-utils" // Asegúrate de que esta ruta sea correcta

// Interfaces necesarias (copiadas de page.tsx para que el Server Action las conozca)
interface Pasador {
    id: string
    displayId: string
    nombre: string
    saldoFinal: number
    saldoAnterior: number
    saldoActual: number
    saldoTotal: number
    cobrado: number
    pagado: number
    jugado: number
    aciertos: Record<string, Record<string, any[]>> // Tipo corregido
    aciertosBorratinas: number[]
    acreditacionComision: number
    anulacionVentaOnline: number
    borratinaOnline: number
    cobroAlCliente: number
    comisionPasador: number
    pagoACliente: number
    pagoAciertosBorras: number
    pagoPremioBorratina: number
    pagoPremioBorratinas: number
    pagoQuiniela: number
    quintinaOnline: number
    triplonaOnline: number
    ventasOnline: number
    fecha: string
    timestamp: string
    premioTotal: number
    comisionPorcentaje: number
    modulo: number
    posicionEnModulo: number
}

interface ExtractoData {
    [fecha: string]: {
        resultados: any[]
    }
}

// Interfaz para el documento de saldo diario agregado
interface SaldoDiarioAgregado {
    pasador_id: string;
    pasador_nombre: string;
    fecha: string; // yyyy-MM-dd
    timestamp: string; // dd/MM/yy HH:mm
    saldo_anterior: number;
    saldo_actual: number; // Movimiento neto del día
    saldo_final: number; // Saldo total final del día
    saldo_total: number; // (Alias de saldo_final)
    ventas_online: number;
    comision_pasador: number;
    total_pagos: number;
    total_cobros: number;
    total_ganado: number; // Premios
    modulo: number;
    posicion_en_modulo: number;
    display_id: string;
}

// Función calcular saldos (ahora ejecutada en el servidor)
const calcularSaldosServer = (
    saldoCierreDiaAnterior: number,
    jugado: number,
    comision: number,
    premios: number,
    pagosInmutables: number,
    cobrosInmutables: number,
) => {
    const saldoActualDelDia = jugado - comision - premios
    let saldoTotalCalculado = saldoCierreDiaAnterior + saldoActualDelDia + pagosInmutables - cobrosInmutables
    saldoTotalCalculado = Math.round(saldoTotalCalculado * 100) / 100; // Redondeo

    return {
        saldoAnterior: saldoCierreDiaAnterior,
        saldoActual: saldoActualDelDia,
        saldoTotal: saldoTotalCalculado,
        saldoFinal: saldoTotalCalculado,
    }
}

// Función interna para crear/actualizar registros de saldos diarios (ahora paralelizada)
// Esta función será la encargada de PERSISTIR los datos agregados.
async function _crearRegistrosFaltantesEnSaldosDiarios(pasadores: Pasador[], fecha: Date): Promise<void> {
    try {
        const fechaStr = format(fecha, "yyyy-MM-dd")
        const savePromises = pasadores.map(pasador => {
            const docId = `${pasador.id}_${fechaStr}`
            return setDoc(
                doc(db, "saldos_diarios", docId),
                {
                    pasador_id: pasador.id,
                    pasador_nombre: pasador.nombre,
                    fecha: fechaStr,
                    timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                    saldo_anterior: pasador.saldoAnterior,
                    saldo_actual: pasador.saldoActual,
                    saldo_final: pasador.saldoTotal,
                    saldo_total: pasador.saldoTotal, // Alias para compatibilidad
                    ventas_online: pasador.jugado,
                    comision_pasador: pasador.comisionPasador,
                    total_pagos: pasador.pagado,
                    total_cobros: pasador.cobrado,
                    total_ganado: pasador.premioTotal,
                    modulo: pasador.modulo,
                    posicion_en_modulo: pasador.posicionEnModulo,
                    display_id: pasador.displayId,
                },
                { merge: true },
            )
        });
        await Promise.allSettled(savePromises); // Ejecutar todas las escrituras en paralelo
        console.log(`💾 [Server] Registros diarios guardados/actualizados para ${pasadores.length} pasadores en ${fechaStr}`);
    } catch (error) {
        console.error(`❌ [Server] Error al crear registros faltantes en saldos_diarios:`, error)
    }
}

// --- Esta función se convierte en el "motor" de agregación, ideal para un Cron Job o Cloud Function ---
// Su rol es CALCULAR y GUARDAR los resúmenes diarios, no directamente servir al cliente.
export async function _recalculateAndSaveDailySummaries(fechaString: string): Promise<void> {
    try {
        const fecha = new Date(fechaString);
        console.log(`⚙️ [Backend Aggregation] INICIANDO CÁLCULO Y GUARDADO de resúmenes para fecha: ${fechaString}`);

        // 1. Obtener extractos (resultados de sorteos)
        const extractoDocRef = doc(db, "extractos", fechaString);
        const extractoSnapshot = await getDoc(extractoDocRef);
        let resultadosExtracto: any[] = [];
        if (extractoSnapshot.exists()) {
            const extractoData = extractoSnapshot.data() as ExtractoData;
            const fechaFormateada = format(fecha, "dd/MM/yyyy");
            resultadosExtracto = extraerResultados(extractoData, fechaFormateada);
            console.log(`📚 [Backend Aggregation] Extractos cargados: ${resultadosExtracto.length} resultados`);
        } else {
            console.log("[Backend Aggregation] Extracto no encontrado para la fecha.");
        }

        // 2. Obtener lista de pasadores
        const pasadoresRef = collection(db, "pasadores");
        const pasadoresSnapshot = await getDocs(pasadoresRef);
        const listaPasadores: Pasador[] = [];
        console.log(`[Backend Aggregation] Total pasadores encontrados: ${pasadoresSnapshot.docs.length}`);

        // 3. Obtener todos los saldos diarios del día anterior en una sola consulta
        const fechaAnterior = new Date(fecha);
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd");

        const saldosDiariosRef = collection(db, "saldos_diarios");
        const qSaldosAnteriores = query(saldosDiariosRef, where("fecha", "==", fechaAnteriorStr));
        const saldosAnterioresSnapshot = await getDocs(qSaldosAnteriores);
        const saldosAnterioresMap = new Map<string, number>();
        saldosAnterioresSnapshot.forEach(doc => {
            const data = doc.data();
            saldosAnterioresMap.set(data.pasador_id, data.saldo_total || data.saldo_final || 0);
        });
        console.log(`[Backend Aggregation] Saldos anteriores del día ${fechaAnteriorStr} cargados: ${saldosAnterioresMap.size} registros.`);

        // 4. Fetch all payments and cobros for the selected date in one go
        const pagosQuery = query(collection(db, "pagos"), where("fecha", "==", fechaString));
        const cobrosQuery = query(collection(db, "cobros"), where("fecha", "==", fechaString));
        const [allPagosSnapshot, allCobrosSnapshot] = await Promise.all([getDocs(pagosQuery), getDocs(cobrosQuery)]);

        const allPagosMap = new Map<string, number>();
        allPagosSnapshot.forEach(doc => {
            const data = doc.data();
            const pasadorId = data.pasadorId;
            const monto = typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
            allPagosMap.set(pasadorId, (allPagosMap.get(pasadorId) || 0) + monto);
        });
        const allCobrosMap = new Map<string, number>();
        allCobrosSnapshot.forEach(doc => {
            const data = doc.data();
            const pasadorId = data.pasadorId;
            const monto = typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
            allCobrosMap.set(pasadorId, (allCobrosMap.get(pasadorId) || 0) + monto);
        });
        console.log(`[Backend Aggregation] Pagos y Cobros cargados: ${allPagosSnapshot.docs.length} pagos, ${allCobrosSnapshot.docs.length} cobros.`);

        // 5. Preparar promesas para obtener todas las jugadas concurrentemente
        const jugadasPromises: Promise<{ pasadorId: string; jugadas: Record<string, any>[] }>[] = [];
        const pasadoresDataMap = new Map<string, any>();

        for (const docSnapshot of pasadoresSnapshot.docs) {
            const data = docSnapshot.data();
            const pasadorId = docSnapshot.id;
            pasadoresDataMap.set(pasadorId, data);

            const jugadasRef = collection(db, `JUGADAS DE ${data.nombre}`);
            const jugadasQuery = query(
                jugadasRef,
                where("fechaHora", ">=", Timestamp.fromDate(startOfDay(fecha))),
                where("fechaHora", "<=", Timestamp.fromDate(endOfDay(fecha))),
            );
            jugadasPromises.push(
                getDocs(jugadasQuery).then(snapshot => {
                    const jugadasData: Record<string, any>[] = [];
                    snapshot.forEach(docSnapshot => {
                        const jugada = docSnapshot.data();
                        if (!esJugadaAnulada(jugada)) {
                            jugadasData.push(jugada);
                        }
                    });
                    return { pasadorId, jugadas: jugadasData };
                })
            );
        }

        const allJugadasResults = await Promise.all(jugadasPromises);
        const jugadasMap = new Map<string, Record<string, any>[]>();
        allJugadasResults.forEach(result => jugadasMap.set(result.pasadorId, result.jugadas));
        console.log(`[Backend Aggregation] Todas las jugadas para ${allJugadasResults.length} pasadores cargadas concurrentemente.`);

        const aciertosSavePromises: Promise<void>[] = [];

        // 6. Procesar los datos de cada pasador y preparar la lista final para guardar
        for (const docSnapshot of pasadoresSnapshot.docs) {
            const data = docSnapshot.data();
            const pasadorId = docSnapshot.id;

            const saldoAnteriorReal = saldosAnterioresMap.get(pasadorId) || 0;
            const jugadasData = jugadasMap.get(pasadorId) || [];

            let ventasOnlineAcumuladas = jugadasData.reduce((sum, jugada) => sum + (Number(jugada.totalMonto) || 0), 0);

            const totalPagos = allPagosMap.get(pasadorId) || 0;
            const totalCobros = allCobrosMap.get(pasadorId) || 0;

            const aciertosCalculados = procesarJugadasYEncontrarAciertos(jugadasData, resultadosExtracto);
            const premioTotalCalculado = calcularTotalGanado(pasadorId, fecha, aciertosCalculados);

            aciertosSavePromises.push(guardarAciertosEnFirestore(data.nombre, aciertosCalculados, fecha));

            const comisionCalculada = (data.comision / 100) * ventasOnlineAcumuladas;
            const saldosCalculados = calcularSaldosServer(
                saldoAnteriorReal,
                ventasOnlineAcumuladas,
                comisionCalculada,
                premioTotalCalculado,
                totalPagos,
                totalCobros,
            );

            listaPasadores.push({
                id: pasadorId,
                displayId: data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                nombre: data.nombre || "Sin nombre",
                jugado: ventasOnlineAcumuladas,
                pagado: totalPagos,
                cobrado: totalCobros,
                comisionPasador: comisionCalculada,
                premioTotal: premioTotalCalculado,
                comisionPorcentaje: data.comision || 0,
                modulo: data.modulo || 70,
                posicionEnModulo: data.posicionEnModulo || 1,
                fecha: fechaString,
                timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                aciertos: aciertosCalculados,
                aciertosBorratinas: [], acreditacionComision: 0, anulacionVentaOnline: 0, borratinaOnline: 0,
                cobroAlCliente: 0, pagoACliente: 0, pagoAciertosBorras: 0, pagoPremioBorratina: 0,
                pagoPremioBorratinas: 0, pagoQuiniela: 0, quintinaOnline: 0, triplonaOnline: 0, ventasOnline: 0,
                ...saldosCalculados,
            });
        }
        console.log(`[Backend Aggregation] Lista de pasadores procesada (length): ${listaPasadores.length}`);

        await Promise.allSettled(aciertosSavePromises);
        console.log(`[Backend Aggregation] Todas las promesas de guardar aciertos ejecutadas.`);

        listaPasadores.sort((a, b) => {
            if (a.modulo !== b.modulo) return a.modulo - b.modulo;
            return a.posicionEnModulo - b.posicionEnModulo;
        });

        // ¡Aquí se guardan los resúmenes diarios agregados!
        await _crearRegistrosFaltantesEnSaldosDiarios(listaPasadores, fecha);

        console.log("✅ [Backend Aggregation] CÁLCULO Y GUARDADO de resúmenes diarios completado exitosamente");

    } catch (error) {
        console.error("❌ [Backend Aggregation] Error al calcular y guardar resúmenes diarios:", error);
        throw new Error(`Error al calcular y guardar los datos: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- NUEVA SERVER ACTION PARA OBTENER DATOS AGREGADOS ---
// Esta es la función que tu cliente llamará para fechas históricas.
export async function getAggregatedDailySummaries(fechaString: string): Promise<{ pasadores: Pasador[], modulos: string[] }> {
    "use cache" // Habilitar caché en el servidor para resultados para la misma fecha
    try {
        console.log(`🚀 [Server Action] Fetching AGGREGATED data for fecha: ${fechaString}`);
        const saldosDiariosRef = collection(db, "saldos_diarios");
        const q = query(saldosDiariosRef, where("fecha", "==", fechaString));
        const snapshot = await getDocs(q);

        const loadedPasadores: Pasador[] = [];
        snapshot.forEach(docSnapshot => {
            const data = docSnapshot.data() as SaldoDiarioAgregado;
            loadedPasadores.push({
                id: data.pasador_id,
                displayId: data.display_id,
                nombre: data.pasador_nombre,
                saldoFinal: data.saldo_final,
                saldoAnterior: data.saldo_anterior,
                saldoActual: data.saldo_actual,
                saldoTotal: data.saldo_total,
                cobrado: data.total_cobros,
                pagado: data.total_pagos,
                jugado: data.ventas_online,
                comisionPasador: data.comision_pasador,
                premioTotal: data.total_ganado,
                modulo: data.modulo,
                posicionEnModulo: data.posicion_en_modulo,
                fecha: data.fecha,
                timestamp: data.timestamp,
                // Campos que no se guardan en el resumen diario, mantener valores por defecto o inferidos
                aciertos: {}, // Esto se calcula on-demand si es necesario
                aciertosBorratinas: [], acreditacionComision: 0, anulacionVentaOnline: 0, borratinaOnline: 0,
                cobroAlCliente: 0, pagoACliente: 0, pagoAciertosBorras: 0, pagoPremioBorratina: 0,
                pagoPremioBorratinas: 0, pagoQuiniela: 0, quintinaOnline: 0, triplonaOnline: 0, ventasOnline: 0,
                comisionPorcentaje: 0, // No se guarda en el resumen, se inferiría del pasador
            });
        });

        loadedPasadores.sort((a, b) => {
            if (a.modulo !== b.modulo) return a.modulo - b.modulo;
            return a.posicionEnModulo - b.posicionEnModulo;
        });

        const modulosUnicos = Array.from(new Set(loadedPasadores.map((p) => p.modulo.toString()))).sort(
            (a, b) => Number.parseInt(a) - Number.parseInt(b),
        );

        console.log("✅ [Server Action] Carga de datos AGREGADOS completada exitosamente");
        return { pasadores: loadedPasadores, modulos: modulosUnicos };

    } catch (error) {
        console.error("❌ [Server Action] Error al cargar datos agregados:", error);
        throw new Error(`Error al cargar los datos agregados: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Función para guardar los saldos diarios en Firestore (ahora ejecutada en el servidor)
export async function guardarSaldosDiariosServer(pasador: Pasador, fechaString: string): Promise<boolean> {
    try {
        const docId = `${pasador.id}_${fechaString}`
        await setDoc(
            doc(db, "saldos_diarios", docId),
            {
                pasador_id: pasador.id,
                pasador_nombre: pasador.nombre,
                fecha: fechaString,
                timestamp: format(new Date(), "dd/MM/yy HH:mm"),
                saldo_anterior: pasador.saldoAnterior,
                saldo_actual: pasador.saldoActual,
                saldo_final: pasador.saldoTotal,
                saldo_total: pasador.saldoTotal,
                ventas_online: pasador.jugado,
                comision_pasador: pasador.comisionPasador,
                total_pagos: pasador.pagado,
                total_cobros: pasador.cobrado,
                total_ganado: pasador.premioTotal,
                modulo: pasador.modulo,
                posicion_en_modulo: pasador.posicionEnModulo,
                display_id: pasador.displayId,
            },
            { merge: true },
        )
        return true
    } catch (error) {
        console.error(`❌ [Server] Error al guardar saldos diarios:`, error)
        return false
    }
}
