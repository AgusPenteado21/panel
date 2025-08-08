// functions/src/index.ts
import * as functions from 'firebase-functions';
import { firestore } from 'firebase-functions/v2';
import { Change, DocumentSnapshot, FirestoreEvent, DocumentOptions } from 'firebase-functions/v2/firestore';
import { CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';
// Importar las funciones y pasar 'db' al llamarlas
import { recalculateAndSaveRealtimeSummary, triggerRecalculationForAllPasadores } from './utils';

// Inicializa Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore(); // 'db' se inicializa correctamente aquí

// Definir interfaces para los parámetros de los triggers de Firestore
interface JugadaParams {
    collectionName: string; // Ahora el nombre completo de la colección (ej: "JUGADAS DE Juan")
    jugadaId: string;
}

interface ExtractoParams {
    fechaString: string;
}

// Definir interfaz para los datos de la función callable
interface ForceAciertosRecalculationData {
    fecha: string;
}

// --- Triggers para Jugadas ---
// Usamos un comodín genérico para el nombre de la colección
const JUGADA_DOCUMENT_PATH = "{collectionName}/{jugadaId}" as const;
const jugadaOptions: DocumentOptions<typeof JUGADA_DOCUMENT_PATH> = {
    document: JUGADA_DOCUMENT_PATH
};
export const onJugadaWrite = firestore.onDocumentWritten(
    jugadaOptions,
    async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, JugadaParams>) => {
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

        const fecha = (jugadaData.fechaHora as admin.firestore.Timestamp).toDate();
        const fechaString = format(fecha, "yyyy-MM-dd");

        const pasadorSnapshot = await db.collection('pasadores').where('nombre', '==', pasadorName).limit(1).get();
        if (pasadorSnapshot.empty) {
            console.warn(`[CF:Jugada] Pasador con nombre ${pasadorName} no encontrado. No se puede recalcular.`);
            return null;
        }
        const pasadorId = pasadorSnapshot.docs[0].id;

        await recalculateAndSaveRealtimeSummary(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
        return null;
    }
);

// --- Triggers para Pagos ---
const PAGO_DOCUMENT_PATH = "pagos/{pagoId}" as const;
const pagoOptions: DocumentOptions<typeof PAGO_DOCUMENT_PATH> = {
    document: PAGO_DOCUMENT_PATH
};
export const onPagoWrite = firestore.onDocumentWritten(
    pagoOptions,
    async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { pagoId: string }>) => {
        const pagoData = event.data?.after.data() || event.data?.before.data();

        if (!pagoData || !pagoData.pasadorId || !pagoData.fecha) {
            console.log(`[CF:Pago] No hay datos de pago, pasadorId o fecha. Ignorando.`);
            return null;
        }

        const pasadorId = pagoData.pasadorId;
        const fechaString = pagoData.fecha;

        await recalculateAndSaveRealtimeSummary(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
        return null;
    }
);

// --- Triggers para Cobros ---
const COBRO_DOCUMENT_PATH = "cobros/{cobroId}" as const;
const cobroOptions: DocumentOptions<typeof COBRO_DOCUMENT_PATH> = {
    document: COBRO_DOCUMENT_PATH
};
export const onCobroWrite = firestore.onDocumentWritten(
    cobroOptions,
    async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { cobroId: string }>) => {
        const cobroData = event.data?.after.data() || event.data?.before.data();

        if (!cobroData || !cobroData.pasadorId || !cobroData.fecha) {
            console.log(`[CF:Cobro] No hay datos de cobro, pasadorId o fecha. Ignorando.`);
            return null;
        }

        const pasadorId = cobroData.pasadorId;
        const fechaString = cobroData.fecha;

        await recalculateAndSaveRealtimeSummary(db, pasadorId, fechaString); // <--- PASAR 'db' AQUÍ
        return null;
    }
);

// --- Trigger para Extractos (afecta a todos los pasadores) ---
const EXTRACTO_DOCUMENT_PATH = "extractos/{fechaString}" as const;
const extractoOptions: DocumentOptions<typeof EXTRACTO_DOCUMENT_PATH> = {
    document: EXTRACTO_DOCUMENT_PATH
};
export const onExtractoWrite = firestore.onDocumentWritten(
    extractoOptions,
    async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ExtractoParams>) => {
        const { fechaString } = event.params;

        if (event.data?.after.exists) {
            console.log(`[CF:Extracto] Extracto para ${fechaString} modificado. Recalculando aciertos para todos los pasadores.`);
            await triggerRecalculationForAllPasadores(db, fechaString); // <--- PASAR 'db' AQUÍ
        } else {
            console.log(`[CF:Extracto] Extracto para ${fechaString} eliminado. No se realiza acción.`);
        }
        return null;
    }
);

// --- Callable Function para forzar recalculación de aciertos desde el cliente ---
export const forceAciertosRecalculation = functions.https.onCall(
    async (request: CallableRequest<ForceAciertosRecalculationData>) => {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'La función debe ser llamada por un usuario autenticado.');
        }

        const fechaString = request.data.fecha;
        if (!fechaString) {
            throw new functions.https.HttpsError('invalid-argument', 'Se requiere la fecha para la recalculación.');
        }

        try {
            await triggerRecalculationForAllPasadores(db, fechaString); // <--- PASAR 'db' AQUÍ
            return { success: true, message: `Recalculación de aciertos iniciada para ${fechaString}` };
        } catch (error) {
            console.error("Error en forceAciertosRecalculation:", error);
            throw new functions.https.HttpsError('internal', 'Error al iniciar la recalculación de aciertos.', error);
        }
    }
);
