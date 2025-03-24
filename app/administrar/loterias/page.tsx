"use client"

import { useState, useEffect } from "react"
import { Check, X, Save, AlertCircle, Loader2, Calendar } from "lucide-react"
import Navbar from "@/app/components/Navbar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { toast } from "react-hot-toast"

interface Loteria {
    id: string
    nombre: string
    habilitada: boolean
    provincias: {
        [key: string]: boolean
    }
}

interface Provincia {
    id: string
    nombre: string
}

// Provincias completas incluyendo Río Negro
const provinciasCompletas: Provincia[] = [
    { id: "NACION", nombre: "Nacional" },
    { id: "PROVIN", nombre: "Provincial" },
    { id: "SANTA", nombre: "Santa Fe" },
    { id: "CORDOB", nombre: "Córdoba" },
    { id: "ENTRE", nombre: "Entre Ríos" },
    { id: "MENDOZ", nombre: "Mendoza" },
    { id: "CORRIE", nombre: "Corrientes" },
    { id: "CHACO", nombre: "Chaco" },
    { id: "URUGUA", nombre: "Uruguay" },
    { id: "RIONEG", nombre: "Río Negro" },
]

// Presets de configuración comunes
const presetsConfig = [
    {
        id: "uruguayOnly",
        nombre: "Solo Uruguay (Matutina y Nocturna)",
        descripcion: "Habilitar solo loterías de Uruguay en Matutina y Nocturna",
        configuracion: () => {
            const nuevasLoterias: Loteria[] = loteriasInicial.map((loteria) => ({
                ...loteria,
                habilitada: loteria.id === "matutina" || loteria.id === "nocturna",
                provincias: Object.fromEntries(
                    Object.entries(loteria.provincias).map(([provinciaId, _]) => [
                        provinciaId,
                        provinciaId === "URUGUA" && (loteria.id === "matutina" || loteria.id === "nocturna"),
                    ]),
                ),
            }))
            return nuevasLoterias
        },
    },
    {
        id: "deshabilitarTodas",
        nombre: "Deshabilitar todas las loterías",
        descripcion: "Deshabilitar todas las loterías y provincias",
        configuracion: () =>
            loteriasInicial.map((loteria) => ({
                ...loteria,
                habilitada: false,
                provincias: Object.fromEntries(
                    Object.entries(loteria.provincias).map(([provinciaId, _]) => [provinciaId, false]),
                ),
            })),
    },
    {
        id: "habilitarTodas",
        nombre: "Habilitar todas las loterías",
        descripcion: "Habilitar todas las loterías y sus provincias correspondientes",
        configuracion: () =>
            loteriasInicial.map((loteria) => ({
                ...loteria,
                habilitada: true,
                provincias: Object.fromEntries(
                    Object.entries(loteria.provincias).map(([provinciaId, _]) => [provinciaId, true]),
                ),
            })),
    },
]

// Mapeo de secciones a IDs de lotería
const sectionToLoteriaId = {
    LAPREVIA: "laprevia",
    PRIMERA: "primera",
    MATUTINA: "matutina",
    VESPERTINA: "vespertina",
    NOCTURNA: "nocturna",
}

// Estado inicial de loterías
const loteriasInicial: Loteria[] = [
    {
        id: "laprevia",
        nombre: "La Previa",
        habilitada: true,
        provincias: {
            NACION: true,
            PROVIN: true,
            SANTA: true,
            CORDOB: true,
            ENTRE: true,
            MENDOZ: true,
            CORRIE: true,
            CHACO: true,
            URUGUA: false,
            RIONEG: true,
        },
    },
    {
        id: "primera",
        nombre: "Primera",
        habilitada: true,
        provincias: {
            NACION: true,
            PROVIN: true,
            SANTA: true,
            CORDOB: true,
            ENTRE: true,
            MENDOZ: true,
            CORRIE: true,
            CHACO: true,
            URUGUA: false,
            RIONEG: true,
        },
    },
    {
        id: "matutina",
        nombre: "Matutina",
        habilitada: true,
        provincias: {
            NACION: true,
            PROVIN: true,
            SANTA: true,
            CORDOB: true,
            ENTRE: true,
            MENDOZ: true,
            CORRIE: true,
            CHACO: true,
            URUGUA: true,
            RIONEG: true,
        },
    },
    {
        id: "vespertina",
        nombre: "Vespertina",
        habilitada: true,
        provincias: {
            NACION: true,
            PROVIN: true,
            SANTA: true,
            CORDOB: true,
            ENTRE: true,
            MENDOZ: true,
            CORRIE: true,
            CHACO: true,
            URUGUA: false,
            RIONEG: true,
        },
    },
    {
        id: "nocturna",
        nombre: "Nocturna",
        habilitada: true,
        provincias: {
            NACION: true,
            PROVIN: true,
            SANTA: true,
            CORDOB: true,
            ENTRE: true,
            MENDOZ: true,
            CORRIE: true,
            CHACO: true,
            URUGUA: true,
            RIONEG: true,
        },
    },
]

export default function AdministrarLoterias() {
    const [loterias, setLoterias] = useState<Loteria[]>(loteriasInicial)
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false)
    // Cambiar la definición del estado cutoffTimes para que acepte un tipo más flexible
    const [cutoffTimes, setCutoffTimes] = useState<Record<string, string>>({
        LAPREVIA: "10:15",
        PRIMERA: "12:00",
        MATUTINA: "15:00",
        VESPERTINA: "18:00",
        NOCTURNA: "21:00",
    })
    const [tabActiva, setTabActiva] = useState("todas")
    const [presetSeleccionado, setPresetSeleccionado] = useState("")

    useEffect(() => {
        cargarConfiguracion()
        cargarHorarios()
    }, [])

    // Detectar cambios para mostrar alerta de cambios sin guardar
    useEffect(() => {
        if (!cargando) {
            setCambiosSinGuardar(true)
        }
    }, [loterias])

    const cargarConfiguracion = async () => {
        try {
            setCargando(true)

            // Leer exclusivamente de la colección "configuracion" y documento "loterias"
            const docRef = doc(db, "configuracion", "loterias")
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                console.log("Cargando desde configuracion/loterias")
                const data = docSnap.data()
                if (data.loterias) {
                    setLoterias(data.loterias)
                }
            } else {
                console.log("No se encontró el documento configuracion/loterias, usando valores iniciales")
            }

            setCambiosSinGuardar(false)
        } catch (error) {
            console.error("Error al cargar la configuración:", error)
            toast.error("Error al cargar la configuración")
        } finally {
            setCargando(false)
        }
    }

    // Modificar la función cargarHorarios para manejar correctamente los tipos
    const cargarHorarios = async () => {
        try {
            // Leer los horarios de cierre
            const docRef = doc(db, "horarios", "quinela")
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                console.log("Cargando horarios desde horarios/quinela")
                const data = docSnap.data()
                // Convertir explícitamente a Record<string, string>
                const horarios: Record<string, string> = {}

                // Asegurarse de que solo se asignen strings
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === "string") {
                        horarios[key] = value
                    }
                })

                setCutoffTimes(horarios)
            }
        } catch (error) {
            console.error("Error al cargar los horarios:", error)
        }
    }

    const guardarConfiguracion = async () => {
        try {
            setGuardando(true)

            // Guardar exclusivamente en la colección "configuracion" y documento "loterias"
            await setDoc(doc(db, "configuracion", "loterias"), {
                loterias,
                actualizado: new Date(),
            })

            toast.success("Configuración guardada correctamente")
            setCambiosSinGuardar(false)
        } catch (error) {
            console.error("Error al guardar la configuración:", error)
            toast.error("Error al guardar la configuración")
        } finally {
            setGuardando(false)
        }
    }

    const aplicarPreset = (presetId: string) => {
        if (!presetId) return

        const preset = presetsConfig.find((p) => p.id === presetId)
        if (!preset) return

        const nuevasLoterias = preset.configuracion()
        setLoterias(nuevasLoterias)
        setPresetSeleccionado("")
        toast.success(`Configuración "${preset.nombre}" aplicada con éxito`)
    }

    const cambiarEstadoLoteria = (id: string, habilitada: boolean) => {
        setLoterias((prev) =>
            prev.map((loteria) => {
                if (loteria.id === id) {
                    if (habilitada) {
                        // Si estamos habilitando la lotería, solo cambiamos su estado
                        return { ...loteria, habilitada }
                    } else {
                        // Si estamos deshabilitando la lotería, también deshabilitamos todas sus provincias
                        const provinciasDeshabilitadas = Object.fromEntries(
                            Object.keys(loteria.provincias).map((provinciaId) => [provinciaId, false]),
                        )
                        return {
                            ...loteria,
                            habilitada: false,
                            provincias: provinciasDeshabilitadas,
                        }
                    }
                }
                return loteria
            }),
        )
    }

    const habilitarTodas = () => {
        // Crear una copia de todas las loterías con todas habilitadas
        const loteriasTodas = loteriasInicial.map((loteria) => ({
            ...loteria,
            habilitada: true,
            // También habilitar todas las provincias
            provincias: Object.fromEntries(Object.keys(loteria.provincias).map((provinciaId) => [provinciaId, true])),
        }))

        setLoterias(loteriasTodas)
        toast.success("Todas las loterías y provincias habilitadas")
    }

    const deshabilitarTodas = () => {
        // Crear una copia de todas las loterías con todas deshabilitadas
        const loteriasTodas = loteriasInicial.map((loteria) => ({
            ...loteria,
            habilitada: false,
            // También deshabilitar todas las provincias
            provincias: Object.fromEntries(Object.keys(loteria.provincias).map((provinciaId) => [provinciaId, false])),
        }))

        setLoterias(loteriasTodas)
        toast.success("Todas las loterías y provincias deshabilitadas")
    }

    const cambiarEstadoProvincia = (loteriaId: string, provinciaId: string, habilitada: boolean) => {
        setLoterias((prev) =>
            prev.map((loteria) =>
                loteria.id === loteriaId
                    ? {
                        ...loteria,
                        provincias: {
                            ...loteria.provincias,
                            [provinciaId]: habilitada,
                        },
                    }
                    : loteria,
            ),
        )
    }

    const getProvinciasDisponibles = (loteriaId: string): Provincia[] => {
        // Matutina y Nocturna tienen todas las provincias incluyendo Uruguay
        if (loteriaId === "matutina" || loteriaId === "nocturna") {
            return provinciasCompletas
        }
        // Las demás loterías tienen todas las provincias excepto Uruguay
        return provinciasCompletas.filter((p) => p.id !== "URUGUA")
    }

    const toggleTodasProvincias = (loteriaId: string, habilitar: boolean) => {
        setLoterias((prev) =>
            prev.map((loteria) => {
                if (loteria.id === loteriaId) {
                    const nuevasProvincias = { ...loteria.provincias }
                    getProvinciasDisponibles(loteriaId).forEach((provincia) => {
                        nuevasProvincias[provincia.id] = habilitar
                    })
                    return { ...loteria, provincias: nuevasProvincias }
                }
                return loteria
            }),
        )
    }

    const loteriasVisibles =
        tabActiva === "todas"
            ? loterias
            : tabActiva === "habilitadas"
                ? loterias.filter((l) => l.habilitada)
                : loterias.filter((l) => !l.habilitada)

    // Modificar la parte donde se accede a cutoffTimes con una variable
    const sincronizarEstadoSegunHorarios = async () => {
        try {
            setGuardando(true)

            const now = new Date()
            const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
            const esDomingo = now.getDay() === 0

            // Actualizar el estado de las loterías según los horarios
            const loteriasActualizadas = loterias.map((loteria) => {
                const seccionNombre = Object.entries(sectionToLoteriaId).find(([_, id]) => id === loteria.id)?.[0]
                // Verificar que seccionNombre existe y es una clave válida en cutoffTimes
                const horarioCierre = seccionNombre && seccionNombre in cutoffTimes ? cutoffTimes[seccionNombre] : null

                // Determinar si la lotería debe estar habilitada o no
                let debeEstarHabilitada = true

                // Si es domingo, todas las loterías deben estar deshabilitadas
                if (esDomingo) {
                    debeEstarHabilitada = false
                } else if (horarioCierre) {
                    // Comparar la hora actual con la hora de cierre
                    debeEstarHabilitada = horaActual < horarioCierre
                }

                return {
                    ...loteria,
                    habilitada: debeEstarHabilitada,
                }
            })

            setLoterias(loteriasActualizadas)

            // Guardar los cambios automáticamente
            await setDoc(doc(db, "configuracion", "loterias"), {
                loterias: loteriasActualizadas,
                actualizado: new Date(),
            })

            toast.success("Estado de loterías sincronizado con los horarios")
            setCambiosSinGuardar(false)
        } catch (error) {
            console.error("Error al sincronizar el estado de las loterías:", error)
            toast.error("Error al sincronizar el estado de las loterías")
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Navbar />
            <div className="container mx-auto py-8 px-4">
                <div className="flex flex-col space-y-6">
                    {/* Encabezado y acciones principales */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900">Administración de Loterías</h1>
                                <p className="text-gray-500 mt-1">Configure la disponibilidad de loterías y sus provincias asociadas</p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    onClick={habilitarTodas}
                                    disabled={cargando || guardando}
                                    className="border-green-600 text-green-700 hover:bg-green-50"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Habilitar Todas
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={deshabilitarTodas}
                                    disabled={cargando || guardando}
                                    className="border-red-600 text-red-700 hover:bg-red-50"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Deshabilitar Todas
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={sincronizarEstadoSegunHorarios}
                                    disabled={cargando || guardando}
                                    className="border-blue-600 text-blue-700 hover:bg-blue-50"
                                >
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Sincronizar con Horarios
                                </Button>

                                <Button
                                    onClick={guardarConfiguracion}
                                    disabled={cargando || guardando || !cambiosSinGuardar}
                                    className={`${cambiosSinGuardar ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400"}`}
                                >
                                    {guardando ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Guardar Cambios
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Información sobre días de operación */}
                        <Alert className="bg-blue-50 border-blue-200 mb-4">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Información importante</AlertTitle>
                            <AlertDescription className="text-blue-700">
                                Las loterías operan de lunes a sábado. Puede configurar qué loterías estarán disponibles en la
                                aplicación en cualquier día. La configuración establecida aquí se aplicará en tiempo real.
                            </AlertDescription>
                        </Alert>

                        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
                            <h3 className="text-lg font-medium text-gray-800 mb-2">Estado actual de las loterías</h3>
                            {/* Modificar la parte donde se muestra el estado actual de las loterías */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {loterias.map((loteria) => {
                                    // Determinar si la lotería debería estar habilitada según el horario
                                    const seccionNombre = Object.entries(sectionToLoteriaId).find(([_, id]) => id === loteria.id)?.[0]
                                    // Verificar que seccionNombre existe y es una clave válida en cutoffTimes
                                    const horarioCierre =
                                        seccionNombre && seccionNombre in cutoffTimes ? cutoffTimes[seccionNombre] : null
                                    const now = new Date()
                                    const horaActual = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
                                    const esDomingo = now.getDay() === 0

                                    // Por defecto, usar el estado actual de la lotería
                                    const estadoActual = loteria.habilitada
                                    let estadoTexto = loteria.habilitada ? "Habilitada" : "Deshabilitada"
                                    let estadoColor = loteria.habilitada ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"

                                    // Si es domingo, todas las loterías deberían estar deshabilitadas
                                    if (esDomingo) {
                                        const deberiaEstar = false
                                        if (estadoActual !== deberiaEstar) {
                                            estadoTexto = `${estadoTexto} (Debería estar deshabilitada - Domingo)`
                                            estadoColor = "bg-amber-100 text-amber-800"
                                        }
                                    }
                                    // Si hay un horario de cierre, verificar si ya pasó
                                    else if (horarioCierre) {
                                        const deberiaEstar = horaActual < horarioCierre
                                        if (estadoActual !== deberiaEstar) {
                                            estadoTexto = deberiaEstar
                                                ? `${estadoTexto} (Debería estar habilitada - Cierra a las ${horarioCierre})`
                                                : `${estadoTexto} (Debería estar deshabilitada - Cerró a las ${horarioCierre})`
                                            estadoColor = "bg-amber-100 text-amber-800"
                                        } else if (deberiaEstar) {
                                            estadoTexto = `${estadoTexto} (Cierra a las ${horarioCierre})`
                                        }
                                    }

                                    return (
                                        <div
                                            key={`estado-${loteria.id}`}
                                            className={`p-3 rounded-md ${estadoColor} flex justify-between items-center`}
                                        >
                                            <div>
                                                <p className="font-medium">{loteria.nombre}</p>
                                                <p className="text-xs">{estadoTexto}</p>
                                            </div>
                                            <Badge variant={loteria.habilitada ? "success" : "destructive"}>
                                                {loteria.habilitada ? "ON" : "OFF"}
                                            </Badge>
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                                Las loterías se actualizan automáticamente según sus horarios de cierre. Los domingos todas las loterías
                                están deshabilitadas.
                            </p>
                        </div>

                        {/* Configuraciones predefinidas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="preset-selector" className="block text-sm font-medium text-gray-700 mb-1">
                                    Aplicar configuración predefinida
                                </label>
                                <div className="flex gap-2">
                                    <Select value={presetSeleccionado} onValueChange={setPresetSeleccionado}>
                                        <SelectTrigger id="preset-selector" className="w-full">
                                            <SelectValue placeholder="Seleccionar configuración..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {presetsConfig.map((preset) => (
                                                <SelectItem key={preset.id} value={preset.id}>
                                                    {preset.nombre}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={() => aplicarPreset(presetSeleccionado)}
                                        disabled={!presetSeleccionado}
                                        className="whitespace-nowrap"
                                    >
                                        Aplicar
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Use estas configuraciones predefinidas para casos de uso comunes
                                </p>
                            </div>

                            {presetSeleccionado && (
                                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700">
                                        {presetsConfig.find((p) => p.id === presetSeleccionado)?.nombre}
                                    </h4>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {presetsConfig.find((p) => p.id === presetSeleccionado)?.descripcion}
                                    </p>
                                </div>
                            )}
                        </div>

                        {cambiosSinGuardar && !guardando && (
                            <Alert className="mt-4 bg-amber-50 border-amber-200">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800">Cambios pendientes</AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    Hay cambios en la configuración que no han sido guardados. Haga clic en "Guardar Cambios" para
                                    aplicarlos.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Filtros y contenido principal */}
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        {cargando ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                <span className="ml-3 text-lg font-medium text-gray-700">Cargando configuración...</span>
                            </div>
                        ) : (
                            <>
                                <Tabs defaultValue="todas" value={tabActiva} onValueChange={setTabActiva} className="w-full">
                                    <div className="flex justify-between items-center mb-6">
                                        <TabsList>
                                            <TabsTrigger value="todas" className="px-4">
                                                Todas
                                            </TabsTrigger>
                                            <TabsTrigger value="habilitadas" className="px-4">
                                                Habilitadas
                                            </TabsTrigger>
                                            <TabsTrigger value="deshabilitadas" className="px-4">
                                                Deshabilitadas
                                            </TabsTrigger>
                                        </TabsList>
                                        <div className="text-sm text-gray-500">
                                            {loterias.filter((l) => l.habilitada).length} de {loterias.length} loterías habilitadas
                                        </div>
                                    </div>

                                    <TabsContent value="todas" className="mt-0">
                                        <LoteriasList
                                            loterias={loteriasVisibles}
                                            getProvinciasDisponibles={getProvinciasDisponibles}
                                            cambiarEstadoLoteria={cambiarEstadoLoteria}
                                            cambiarEstadoProvincia={cambiarEstadoProvincia}
                                            toggleTodasProvincias={toggleTodasProvincias}
                                        />
                                    </TabsContent>
                                    <TabsContent value="habilitadas" className="mt-0">
                                        <LoteriasList
                                            loterias={loteriasVisibles}
                                            getProvinciasDisponibles={getProvinciasDisponibles}
                                            cambiarEstadoLoteria={cambiarEstadoLoteria}
                                            cambiarEstadoProvincia={cambiarEstadoProvincia}
                                            toggleTodasProvincias={toggleTodasProvincias}
                                        />
                                    </TabsContent>
                                    <TabsContent value="deshabilitadas" className="mt-0">
                                        <LoteriasList
                                            loterias={loteriasVisibles}
                                            getProvinciasDisponibles={getProvinciasDisponibles}
                                            cambiarEstadoLoteria={cambiarEstadoLoteria}
                                            cambiarEstadoProvincia={cambiarEstadoProvincia}
                                            toggleTodasProvincias={toggleTodasProvincias}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

interface LoteriasListProps {
    loterias: Loteria[]
    getProvinciasDisponibles: (loteriaId: string) => Provincia[]
    cambiarEstadoLoteria: (id: string, habilitada: boolean) => void
    cambiarEstadoProvincia: (loteriaId: string, provinciaId: string, habilitada: boolean) => void
    toggleTodasProvincias: (loteriaId: string, habilitar: boolean) => void
}

function LoteriasList({
    loterias,
    getProvinciasDisponibles,
    cambiarEstadoLoteria,
    cambiarEstadoProvincia,
    toggleTodasProvincias,
}: LoteriasListProps) {
    if (loterias.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No hay loterías que coincidan con el filtro seleccionado.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {loterias.map((loteria) => (
                <Card
                    key={loteria.id}
                    className={`overflow-hidden transition-all duration-200 ${loteria.habilitada ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}`}
                >
                    <CardHeader className="bg-gray-50 pb-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id={`loteria-switch-${loteria.id}`}
                                    checked={loteria.habilitada}
                                    onCheckedChange={(checked) => cambiarEstadoLoteria(loteria.id, checked)}
                                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600"
                                />
                                <div>
                                    <CardTitle className="text-lg font-medium">{loteria.nombre}</CardTitle>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {getProvinciasDisponibles(loteria.id).filter((p) => loteria.provincias[p.id]).length} provincias
                                        habilitadas
                                    </p>
                                </div>
                            </div>

                            <Badge variant={loteria.habilitada ? "success" : "destructive"} className="ml-2">
                                {loteria.habilitada ? "Habilitada" : "Deshabilitada"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-medium text-gray-700">Provincias disponibles</h4>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTodasProvincias(loteria.id, true)}
                                    disabled={!loteria.habilitada}
                                    className="h-8 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                                >
                                    <Check className="h-3.5 w-3.5 mr-1" /> Seleccionar todas
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleTodasProvincias(loteria.id, false)}
                                    disabled={!loteria.habilitada}
                                    className="h-8 text-xs text-red-700 hover:text-red-800 hover:bg-red-50"
                                >
                                    <X className="h-3.5 w-3.5 mr-1" /> Deseleccionar todas
                                </Button>
                            </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-2">
                            {getProvinciasDisponibles(loteria.id).map((provincia) => (
                                <div
                                    key={`${loteria.id}-${provincia.id}`}
                                    className={`flex items-center space-x-2 p-2 rounded-md transition-colors ${loteria.provincias[provincia.id] ? "bg-green-50" : "bg-gray-50"} ${!loteria.habilitada ? "opacity-60" : ""}`}
                                >
                                    <Checkbox
                                        id={`${loteria.id}-${provincia.id}`}
                                        checked={loteria.provincias[provincia.id] || false}
                                        onCheckedChange={(checked) => cambiarEstadoProvincia(loteria.id, provincia.id, checked === true)}
                                        disabled={!loteria.habilitada}
                                        className={loteria.provincias[provincia.id] ? "border-green-500 text-green-500" : ""}
                                    />
                                    <label
                                        htmlFor={`${loteria.id}-${provincia.id}`}
                                        className={`text-sm leading-none cursor-pointer ${loteria.provincias[provincia.id] ? "font-medium" : ""}`}
                                    >
                                        {provincia.nombre}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 flex justify-between py-3">
                        <div className="text-xs text-gray-500">ID: {loteria.id}</div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={loteria.habilitada ? "outline" : "default"}
                                className={`h-8 px-3 text-xs ${loteria.habilitada ? "border-green-500 text-green-600" : "bg-green-600 hover:bg-green-700"}`}
                                onClick={() => cambiarEstadoLoteria(loteria.id, true)}
                                disabled={loteria.habilitada}
                            >
                                <Check className="h-3.5 w-3.5 mr-1" /> Habilitar
                            </Button>
                            <Button
                                size="sm"
                                variant={!loteria.habilitada ? "outline" : "default"}
                                className={`h-8 px-3 text-xs ${!loteria.habilitada ? "border-red-500 text-red-600" : "bg-red-600 hover:bg-red-700"}`}
                                onClick={() => cambiarEstadoLoteria(loteria.id, false)}
                                disabled={!loteria.habilitada}
                            >
                                <X className="h-3.5 w-3.5 mr-1" /> Deshabilitar
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}

