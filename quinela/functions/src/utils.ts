// functions/src/utils.ts
import * as admin from 'firebase-admin';
import { format, startOfDay, endOfDay } from 'date-fns';

// Re-declarar interfaces necesarias para las funciones
interface PasadorData {
    id: string;
    displayId: string;
    nombre: string;
    comision: number; // Porcentaje de comisión
    modulo: number;
    posicionEnModulo: number;
}

interface JugadaData {
    totalMonto: number | string;
    fechaHora: admin.firestore.Timestamp;
    anulada?: boolean;
    // ... otros campos de jugada
}

interface PagoCobroData {
    monto: number | string;
    pasadorId: string;
    fecha: string; // yyyy-MM-dd
}

interface ExtractoData {
    [fecha: string]: {
        resultados: any[]
    }
}

// Re-declarar SaldoDiarioAgregado para la consistencia de la estructura de resumen
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

// const db = admin.firestore(); // <--- ELIMINAR ESTA LÍNEA

export const esJugadaAnulada = (jugada: any): boolean => {
    return jugada.anulada === true;
};

export const extraerResultados = (extractoData: ExtractoData, fechaFormateada: string): any[] => {
    const fechaKey = format(new Date(fechaFormateada.split('/').reverse().join('-')), "yyyy-MM-dd");
    return extractoData[fechaKey]?.resultados || [];
};

export const procesarJugadasYEncontrarAciertos = (jugadas: JugadaData[], resultadosExtracto: any[]): Record<string, Record<string, any[]>> => {
    const aciertos: Record<string, Record<string, any[]>> = {};
    if (resultadosExtracto.length > 0 && jugadas.length > 0) {
        aciertos['simulacion'] = { 'premio': [{ monto: 100 }] };
    }
    return aciertos;
};

export const calcularTotalGanado = (pasadorId: string, fecha: Date, aciertos: Record<string, Record<string, any[]>>): number => {
    let total = 0;
    for (const sorteoKey in aciertos) {
        for (const premioKey in aciertos[sorteoKey]) {
            aciertos[sorteoKey][premioKey].forEach(p => {
                total += p.monto || 0;
            });
        }
    }
    return total;
};

export const calcularSaldosServer = (
    saldoCierreDiaAnterior: number,
    jugado: number,
    comision: number,
    premios: number,
    pagosInmutables: number,
    cobrosInmutables: number,
) => {
    const saldoActualDelDia = jugado - comision - premios;
    let saldoTotalCalculado = saldoCierreDiaAnterior + saldoActualDelDia + pagosInmutables - cobrosInmutables;
    saldoTotalCalculado = Math.round(saldoTotalCalculado * 100) / 100; // Redondeo

    return {
        saldoAnterior: saldoCierreDiaAnterior,
        saldoActual: saldoActualDelDia,
        saldoTotal: saldoTotalCalculado,
        saldoFinal: saldoTotalCalculado,
    };
};

// Modificar para aceptar 'db' como argumento
export async function recalculateAndSaveRealtimeSummary(db: admin.firestore.Firestore, pasadorId: string, fechaString: string): Promise<void> { // <--- CAMBIO AQUÍ
    try {
        const fecha = new Date(fechaString);
        console.log(`⚙️ [CF] Recalculando resumen en tiempo real para Pasador: ${pasadorId}, Fecha: ${fechaString}`);

        const pasadorDoc = await db.collection('pasadores').doc(pasadorId).get();
        if (!pasadorDoc.exists) {
            console.warn(`[CF] Pasador ${pasadorId} no encontrado. Saltando recalculación.`);
            return;
        }
        const pasadorData = pasadorDoc.data() as PasadorData;

        const fechaAnterior = new Date(fecha);
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaAnteriorStr = format(fechaAnterior, "yyyy-MM-dd");
        const saldoAnteriorDoc = await db.collection('saldos_diarios').doc(`${pasadorId}_${fechaAnteriorStr}`).get();
        const saldoAnteriorReal = saldoAnteriorDoc.exists ? (saldoAnteriorDoc.data()?.saldo_total || saldoAnteriorDoc.data()?.saldo_final || 0) : 0;

        const jugadasRef = db.collection(`JUGADAS DE ${pasadorData.nombre}`);
        const jugadasQuery = jugadasRef
            .where("fechaHora", ">=", admin.firestore.Timestamp.fromDate(startOfDay(fecha)))
            .where("fechaHora", "<=", admin.firestore.Timestamp.fromDate(endOfDay(fecha)));
        const jugadasSnapshot = await jugadasQuery.get();
        let ventasOnlineAcumuladas = 0;
        const jugadasData: JugadaData[] = [];
        jugadasSnapshot.forEach(doc => {
            const jugada = doc.data() as JugadaData;
            if (!esJugadaAnulada(jugada)) {
                ventasOnlineAcumuladas += Number(jugada.totalMonto) || 0;
                jugadasData.push(jugada);
            }
        });

        const pagosQuery = db.collection('pagos')
            .where('pasadorId', '==', pasadorId)
            .where('fecha', '==', fechaString);
        const cobrosQuery = db.collection('cobros')
            .where('pasadorId', '==', pasadorId)
            .where('fecha', '==', fechaString);

        const [pagosSnapshot, cobrosSnapshot] = await Promise.all([pagosQuery.get(), cobrosQuery.get()]);

        let totalPagos = 0;
        pagosSnapshot.forEach(doc => {
            const data = doc.data() as PagoCobroData;
            totalPagos += typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
        });

        let totalCobros = 0;
        cobrosSnapshot.forEach(doc => {
            const data = doc.data() as PagoCobroData;
            totalCobros += typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
        });

        const extractoDocRef = db.collection("extractos").doc(fechaString);
        const extractoSnapshot = await extractoDocRef.get();
        let resultadosExtracto: any[] = [];
        if (extractoSnapshot.exists) {
            const extractoData = extractoSnapshot.data() as ExtractoData;
            const fechaFormateada = format(fecha, "dd/MM/yyyy");
            resultadosExtracto = extraerResultados(extractoData, fechaFormateada);
        }

        const aciertosCalculados = procesarJugadasYEncontrarAciertos(jugadasData, resultadosExtracto);
        const premioTotalCalculado = calcularTotalGanado(pasadorId, fecha, aciertosCalculados);

        const comisionCalculada = (pasadorData.comision / 100) * ventasOnlineAcumuladas;
        const saldosCalculados = calcularSaldosServer(
            saldoAnteriorReal,
            ventasOnlineAcumuladas,
            comisionCalculada,
            premioTotalCalculado,
            totalPagos,
            totalCobros
        );

        const docId = `${pasadorId}_${fechaString}`;
        const realtimeSummary: SaldoDiarioAgregado = {
            pasador_id: pasadorId,
            pasador_nombre: pasadorData.nombre,
            fecha: fechaString,
            timestamp: format(new Date(), "dd/MM/yy HH:mm"),
            saldo_anterior: saldoAnteriorReal,
            saldo_actual: saldosCalculados.saldoActual,
            saldo_final: saldosCalculados.saldoTotal,
            saldo_total: saldosCalculados.saldoTotal,
            ventas_online: ventasOnlineAcumuladas,
            comision_pasador: comisionCalculada,
            total_pagos: totalPagos,
            total_cobros: totalCobros,
            total_ganado: premioTotalCalculado,
            modulo: pasadorData.modulo,
            posicion_en_modulo: pasadorData.posicionEnModulo,
            display_id: pasadorData.displayId,
        };

        await db.collection('daily_realtime_summaries').doc(docId).set(realtimeSummary, { merge: true });
        console.log(`✅ [CF] Resumen en tiempo real guardado para ${pasadorData.nombre} en ${fechaString}`);

    } catch (error) {
        console.error(`❌ [CF] Error al recalcular y guardar resumen en tiempo real para ${pasadorId} en ${fechaString}:`, error);
        throw error;
    }
}

// Modificar para aceptar 'db' como argumento
export async function triggerRecalculationForAllPasadores(db: admin.firestore.Firestore, fechaString: string): Promise<void> { // <--- CAMBIO AQUÍ
    console.log(`⚙️ [CF] Disparando recalculación para TODOS los pasadores en fecha: ${fechaString}`);
    const pasadoresSnapshot = await db.collection('pasadores').get();
    const recalculationPromises: Promise<void>[] = [];

    for (const doc of pasadoresSnapshot.docs) {
        recalculationPromises.push(recalculateAndSaveRealtimeSummary(db, doc.id, fechaString)); // <--- PASAR 'db' AQUÍ
    }

    await Promise.allSettled(recalculationPromises);
    console.log(`✅ [CF] Recalculación masiva completada para ${pasadoresSnapshot.docs.length} pasadores.`);
}
