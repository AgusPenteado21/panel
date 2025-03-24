const functions = require("firebase-functions")
const admin = require("firebase-admin")

admin.initializeApp()

// Función que se ejecuta cada minuto para verificar y actualizar el estado de las loterías
exports.actualizarEstadoLoterias = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
    const db = admin.firestore()
    const now = new Date()

    // Obtener la hora actual en formato HH:mm
    const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

    // Verificar si es domingo (0 es domingo en JavaScript)
    const esDomingo = now.getDay() === 0

    console.log(`Ejecutando verificación de horarios a las ${horaActual}. Es domingo: ${esDomingo}`)

    try {
        // Obtener los horarios de cierre
        const horariosDoc = await db.collection("horarios").doc("quinela").get()

        if (!horariosDoc.exists) {
            console.log("No se encontró el documento de horarios")
            return null
        }

        const horarios = horariosDoc.data()

        // Obtener la configuración actual de loterías
        const loteriasDoc = await db.collection("configuracion").doc("loterias").get()

        if (!loteriasDoc.exists) {
            console.log("No se encontró el documento de configuración de loterías")
            return null
        }

        const loteriasConfig = loteriasDoc.data()

        if (!loteriasConfig || !loteriasConfig.loterias || !Array.isArray(loteriasConfig.loterias)) {
            console.log("Formato de configuración de loterías inválido")
            return null
        }

        // Mapeo de IDs de lotería a nombres de sección
        const loteriaToSection = {
            laprevia: "LAPREVIA",
            primera: "PRIMERA",
            matutina: "MATUTINA",
            vespertina: "VESPERTINA",
            nocturna: "NOCTURNA",
        }

        // Clonar el array de loterías para modificarlo
        const loteriasActualizadas = [...loteriasConfig.loterias]
        let cambiosRealizados = false

        // Verificar cada lotería
        for (let i = 0; i < loteriasActualizadas.length; i++) {
            const loteria = loteriasActualizadas[i]
            const seccionNombre = loteriaToSection[loteria.id]

            if (!seccionNombre || !horarios[seccionNombre]) {
                continue // Saltar si no encontramos el horario para esta lotería
            }

            const horarioCierre = horarios[seccionNombre]

            // Determinar si la lotería debe estar habilitada o no
            let debeEstarHabilitada = true

            // Si es domingo, todas las loterías deben estar deshabilitadas
            if (esDomingo) {
                debeEstarHabilitada = false
            } else {
                // Comparar la hora actual con la hora de cierre
                debeEstarHabilitada = horaActual < horarioCierre
            }

            // Si el estado actual no coincide con el estado que debería tener, actualizarlo
            if (loteria.habilitada !== debeEstarHabilitada) {
                console.log(`Actualizando lotería ${loteria.id} de ${loteria.habilitada} a ${debeEstarHabilitada}`)
                loteriasActualizadas[i] = {
                    ...loteria,
                    habilitada: debeEstarHabilitada,
                }
                cambiosRealizados = true
            }
        }

        // Si se realizaron cambios, actualizar la base de datos
        if (cambiosRealizados) {
            await db.collection("configuracion").doc("loterias").update({
                loterias: loteriasActualizadas,
                actualizado: admin.firestore.FieldValue.serverTimestamp(),
            })
            console.log("Configuración de loterías actualizada correctamente")
        } else {
            console.log("No se requieren cambios en la configuración de loterías")
        }

        return null
    } catch (error) {
        console.error("Error al actualizar el estado de las loterías:", error)
        return null
    }
})

// Función que se ejecuta a la medianoche para habilitar todas las loterías para el nuevo día
exports.habilitarLoteriasNuevoDia = functions.pubsub
    .schedule("0 0 * * 1-6") // A las 00:00 de lunes a sábado
    .timeZone("America/Argentina/Buenos_Aires") // Ajusta a tu zona horaria
    .onRun(async (context) => {
        const db = admin.firestore()

        try {
            // Obtener la configuración actual de loterías
            const loteriasDoc = await db.collection("configuracion").doc("loterias").get()

            if (!loteriasDoc.exists) {
                console.log("No se encontró el documento de configuración de loterías")
                return null
            }

            const loteriasConfig = loteriasDoc.data()

            if (!loteriasConfig || !loteriasConfig.loterias || !Array.isArray(loteriasConfig.loterias)) {
                console.log("Formato de configuración de loterías inválido")
                return null
            }

            // Habilitar todas las loterías para el nuevo día
            const loteriasActualizadas = loteriasConfig.loterias.map((loteria) => ({
                ...loteria,
                habilitada: true,
            }))

            // Actualizar la base de datos
            await db.collection("configuracion").doc("loterias").update({
                loterias: loteriasActualizadas,
                actualizado: admin.firestore.FieldValue.serverTimestamp(),
            })

            console.log("Todas las loterías habilitadas para el nuevo día")
            return null
        } catch (error) {
            console.error("Error al habilitar las loterías para el nuevo día:", error)
            return null
        }
    })

