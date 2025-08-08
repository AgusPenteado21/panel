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
exports.forceAciertosRecalculation = exports.onExtractoWrite = exports.onCobroWrite = exports.onPagoWrite = exports.onJugadaWrite = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const v2_1 = require("firebase-functions/v2");
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
// Importar las funciones y pasar 'db' al llamarlas
const utils_1 = require("./utils");
// Inicializa Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore(); // 'db' se inicializa correctamente aquí
// --- Triggers para Jugadas ---
// Usamos un comodín genérico para el nombre de la colección
const JUGADA_DOCUMENT_PATH = "{collectionName}/{jugadaId}";
const jugadaOptions = {
    document: JUGADA_DOCUMENT_PATH
};
exports.onJugadaWrite = v2_1.firestore.onDocumentWritten(jugadaOptions, async (event) => {
    const { collectionName, jugadaId: _jugadaId } = event.params;
    const jugadaData = event.data?.after.data() || event.data?.before.data();
    if (!jugadaData || !jugadaData.fechaHora) {
        console.log(`[CF:Jugada] No hay datos de jugada o fechaHora. Ignorando.`);
        return null;
    }
    // Extraer el nombre del pasador del nombre de la colección (ej: "JUGADAS DE Juan" -> "Juan")
    const pasadorNameMatch = collectionName.match(/^JUGADAS DE (.+)$/);
    if (!pasadorNameMatch || !pasadorNameMatch[1]) {
        console.warn(`[CF:Jugada] Nombre de pasador no pudo ser extraído de la colección: ${collectionName}. Ignorando.`);
        return null;
    }
    const pasadorName = pasadorNameMatch[1];
    const fecha = jugadaData.fechaHora.toDate();
    const fechaString = (0, date_fns_1.format)(fecha, "yyyy-MM-dd");
    const pasadorSnapshot = await db.collection('pasadores').where('nombre', '==', pasadorName).limit(1).get();
    if (pasadorSnapshot.empty) {
        console.warn(`[CF:Jugada] Pasador con nombre ${pasadorName} no encontrado. No se puede recalcular.`);
        return null;
    }
    const pasadorId = pasadorSnapshot.docs[0].id;
    await (0, utils_1.recalculateAndSaveRealtimeSummary)(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
    return null;
});
// --- Triggers para Pagos ---
const PAGO_DOCUMENT_PATH = "pagos/{pagoId}";
const pagoOptions = {
    document: PAGO_DOCUMENT_PATH
};
exports.onPagoWrite = v2_1.firestore.onDocumentWritten(pagoOptions, async (event) => {
    const pagoData = event.data?.after.data() || event.data?.before.data();
    if (!pagoData || !pagoData.pasadorId || !pagoData.fecha) {
        console.log(`[CF:Pago] No hay datos de pago, pasadorId o fecha. Ignorando.`);
        return null;
    }
    const pasadorId = pagoData.pasadorId;
    const fechaString = pagoData.fecha;
    await (0, utils_1.recalculateAndSaveRealtimeSummary)(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
    return null;
});
// --- Triggers para Cobros ---
const COBRO_DOCUMENT_PATH = "cobros/{cobroId}";
const cobroOptions = {
    document: COBRO_DOCUMENT_PATH
};
exports.onCobroWrite = v2_1.firestore.onDocumentWritten(cobroOptions, async (event) => {
    const cobroData = event.data?.after.data() || event.data?.before.data();
    if (!cobroData || !cobroData.pasadorId || !cobroData.fecha) {
        console.log(`[CF:Cobro] No hay datos de cobro, pasadorId o fecha. Ignorando.`);
        return null;
    }
    const pasadorId = cobroData.pasadorId;
    const fechaString = cobroData.fecha;
    await (0, utils_1.recalculateAndSaveRealtimeSummary)(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
    return null;
});
// --- Trigger para Extractos (afecta a todos los pasadores) ---
const EXTRACTO_DOCUMENT_PATH = "extractos/{fechaString}";
const extractoOptions = {
    document: EXTRACTO_DOCUMENT_PATH
};
exports.onExtractoWrite = v2_1.firestore.onDocumentWritten(extractoOptions, async (event) => {
    const { fechaString } = event.params;
    if (event.data?.after.exists) {
        console.log(`[CF:Extracto] Extracto para ${fechaString} modificado. Recalculando aciertos para todos los pasadores.`);
        await (0, utils_1.triggerRecalculationForAllPasadores)(db, fechaString); // <--- PASAR 'db' AQUÍ
    }
    else {
        console.log(`[CF:Extracto] Extracto para ${fechaString} eliminado. No se realiza acción.`);
    }
    return null;
});
// --- Callable Function para forzar recalculación de aciertos desde el cliente ---
exports.forceAciertosRecalculation = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'La función debe ser llamada por un usuario autenticado.');
    }
    const fechaString = request.data.fecha;
    if (!fechaString) {
        throw new functions.https.HttpsError('invalid-argument', 'Se requiere la fecha para la recalculación.');
    }
    try {
        await (0, utils_1.triggerRecalculationForAllPasadores)(db, fechaString); // <--- PASAR 'db' AQUÍ
        return { success: true, message: `Recalculación de aciertos iniciada para ${fechaString}` };
    }
    catch (error) {
        console.error("Error en forceAciertosRecalculation:", error);
        throw new functions.https.HttpsError('internal', 'Error al iniciar la recalculación de aciertos.', error);
    }
});
//# sourceMappingURL=index.js.map