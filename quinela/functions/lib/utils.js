"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularSaldosServer = exports.calcularTotalGanado = exports.procesarJugadasYEncontrarAciertos = exports.extraerResultados = exports.esJugadaAnulada = void 0;
exports.recalculateAndSaveRealtimeSummary = recalculateAndSaveRealtimeSummary;
exports.triggerRecalculationForAllPasadores = triggerRecalculationForAllPasadores;
// functions/src/utils.ts
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
// const db = admin.firestore(); // <--- ELIMINAR ESTA LÍNEA
const esJugadaAnulada = (jugada) => {
    return jugada.anulada === true;
};
exports.esJugadaAnulada = esJugadaAnulada;
const extraerResultados = (extractoData, fechaFormateada) => {
    const fechaKey = (0, date_fns_1.format)(new Date(fechaFormateada.split('/').reverse().join('-')), "yyyy-MM-dd");
    return extractoData[fechaKey]?.resultados || [];
};
exports.extraerResultados = extraerResultados;
const procesarJugadasYEncontrarAciertos = (jugadas, resultadosExtracto) => {
    const aciertos = {};
    if (resultadosExtracto.length > 0 && jugadas.length > 0) {
        aciertos['simulacion'] = { 'premio': [{ monto: 100 }] };
    }
    return aciertos;
};
exports.procesarJugadasYEncontrarAciertos = procesarJugadasYEncontrarAciertos;
const calcularTotalGanado = (pasadorId, fecha, aciertos) => {
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
exports.calcularTotalGanado = calcularTotalGanado;
const calcularSaldosServer = (saldoCierreDiaAnterior, jugado, comision, premios, pagosInmutables, cobrosInmutables) => {
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
exports.calcularSaldosServer = calcularSaldosServer;
// Modificar para aceptar 'db' como argumento
async function recalculateAndSaveRealtimeSummary(db, pasadorId, fechaString) {
    try {
        const fecha = new Date(fechaString);
        console.log(`⚙️ [CF] Recalculando resumen en tiempo real para Pasador: ${pasadorId}, Fecha: ${fechaString}`);
        const pasadorDoc = await db.collection('pasadores').doc(pasadorId).get();
        if (!pasadorDoc.exists) {
            console.warn(`[CF] Pasador ${pasadorId} no encontrado. Saltando recalculación.`);
            return;
        }
        const pasadorData = pasadorDoc.data();
        const fechaAnterior = new Date(fecha);
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaAnteriorStr = (0, date_fns_1.format)(fechaAnterior, "yyyy-MM-dd");
        const saldoAnteriorDoc = await db.collection('saldos_diarios').doc(`${pasadorId}_${fechaAnteriorStr}`).get();
        const saldoAnteriorReal = saldoAnteriorDoc.exists ? (saldoAnteriorDoc.data()?.saldo_total || saldoAnteriorDoc.data()?.saldo_final || 0) : 0;
        const jugadasRef = db.collection(`JUGADAS DE ${pasadorData.nombre}`);
        const jugadasQuery = jugadasRef
            .where("fechaHora", ">=", admin.firestore.Timestamp.fromDate((0, date_fns_1.startOfDay)(fecha)))
            .where("fechaHora", "<=", admin.firestore.Timestamp.fromDate((0, date_fns_1.endOfDay)(fecha)));
        const jugadasSnapshot = await jugadasQuery.get();
        let ventasOnlineAcumuladas = 0;
        const jugadasData = [];
        jugadasSnapshot.forEach(doc => {
            const jugada = doc.data();
            if (!(0, exports.esJugadaAnulada)(jugada)) {
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
            const data = doc.data();
            totalPagos += typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
        });
        let totalCobros = 0;
        cobrosSnapshot.forEach(doc => {
            const data = doc.data();
            totalCobros += typeof data.monto === "number" ? data.monto : Number.parseFloat(data.monto) || 0;
        });
        const extractoDocRef = db.collection("extractos").doc(fechaString);
        const extractoSnapshot = await extractoDocRef.get();
        let resultadosExtracto = [];
        if (extractoSnapshot.exists) {
            const extractoData = extractoSnapshot.data();
            const fechaFormateada = (0, date_fns_1.format)(fecha, "dd/MM/yyyy");
            resultadosExtracto = (0, exports.extraerResultados)(extractoData, fechaFormateada);
        }
        const aciertosCalculados = (0, exports.procesarJugadasYEncontrarAciertos)(jugadasData, resultadosExtracto);
        const premioTotalCalculado = (0, exports.calcularTotalGanado)(pasadorId, fecha, aciertosCalculados);
        const comisionCalculada = (pasadorData.comision / 100) * ventasOnlineAcumuladas;
        const saldosCalculados = (0, exports.calcularSaldosServer)(saldoAnteriorReal, ventasOnlineAcumuladas, comisionCalculada, premioTotalCalculado, totalPagos, totalCobros);
        const docId = `${pasadorId}_${fechaString}`;
        const realtimeSummary = {
            pasador_id: pasadorId,
            pasador_nombre: pasadorData.nombre,
            fecha: fechaString,
            timestamp: (0, date_fns_1.format)(new Date(), "dd/MM/yy HH:mm"),
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
    }
    catch (error) {
        console.error(`❌ [CF] Error al recalcular y guardar resumen en tiempo real para ${pasadorId} en ${fechaString}:`, error);
        throw error;
    }
}
// Modificar para aceptar 'db' como argumento
async function triggerRecalculationForAllPasadores(db, fechaString) {
    console.log(`⚙️ [CF] Disparando recalculación para TODOS los pasadores en fecha: ${fechaString}`);
    const pasadoresSnapshot = await db.collection('pasadores').get();
    const recalculationPromises = [];
    for (const doc of pasadoresSnapshot.docs) {
        recalculationPromises.push(recalculateAndSaveRealtimeSummary(db, doc.id, fechaString)); // <--- PASAR 'db' AQUÍ
    }
    await Promise.allSettled(recalculationPromises);
    console.log(`✅ [CF] Recalculación masiva completada para ${pasadoresSnapshot.docs.length} pasadores.`);
}
//# sourceMappingURL=utils.js.map