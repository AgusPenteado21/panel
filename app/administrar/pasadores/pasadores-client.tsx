"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    PlusCircle,
    Download,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Key,
    Lock,
    Users,
} from "lucide-react"
import Navbar from "@/app/components/Navbar"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore"
import { hash } from "bcryptjs"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import * as XLSX from "xlsx"

interface Pasador {
    id: string
    displayId: string
    nombre: string
    nombreFantasia: string
    comision: number
    deje: boolean
    dejeComision: number
    observaciones: string
    username: string
    password: string
    bloqueado: boolean
    modulo: number
    posicionEnModulo: number
}

const ITEMS_PER_PAGE = 15
const PASADORES_POR_MODULO = 40

export default function PasadoresClient() {
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedPasadores, setSelectedPasadores] = useState<string[]>([])
    const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false)
    const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false)
    const [editingPasador, setEditingPasador] = useState<Pasador | null>(null)
    const [editingComision, setEditingComision] = useState<number>(0)
    const [bulkComision, setBulkComision] = useState<number>(0)
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [modulosDisponibles, setModulosDisponibles] = useState<number[]>([])
    const [moduloSeleccionado, setModuloSeleccionado] = useState<number>(70)
    const [isCreateModuleDialogOpen, setIsCreateModuleDialogOpen] = useState(false)

    const { toast } = useToast()

    useEffect(() => {
        fetchPasadores()
    }, [])

    const calcularModulosDisponibles = (pasadores: Pasador[]) => {
        // Contar pasadores por módulo
        const contadorPorModulo: { [key: number]: number } = {}
        pasadores.forEach((pasador) => {
            if (pasador.modulo >= 70) {
                contadorPorModulo[pasador.modulo] = (contadorPorModulo[pasador.modulo] || 0) + 1
            }
        })

        // Encontrar módulos disponibles (que no estén llenos)
        const modulosDisponibles: number[] = []
        // Verificar módulos existentes
        Object.keys(contadorPorModulo).forEach((modulo) => {
            const numeroModulo = Number.parseInt(modulo)
            if (contadorPorModulo[numeroModulo] < PASADORES_POR_MODULO) {
                modulosDisponibles.push(numeroModulo)
            }
        })

        // Si no hay módulos disponibles o queremos agregar uno nuevo
        const ultimoModulo = Math.max(...Object.keys(contadorPorModulo).map(Number), 69)
        const siguienteModulo = ultimoModulo + 1

        // Agregar el siguiente módulo si el último está lleno o si no hay módulos
        if (
            modulosDisponibles.length === 0 ||
            !contadorPorModulo[ultimoModulo] ||
            contadorPorModulo[ultimoModulo] >= PASADORES_POR_MODULO
        ) {
            modulosDisponibles.push(siguienteModulo)
        }

        // Asegurar que siempre tengamos al menos el módulo 70
        if (modulosDisponibles.length === 0) {
            modulosDisponibles.push(70)
        }

        return modulosDisponibles.sort((a, b) => a - b)
    }

    const handleCreateModule = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)
        const formData = new FormData(event.currentTarget)
        const numeroModulo = Number.parseInt(formData.get("numeroModulo") as string)

        // Validar que el número de módulo sea válido
        if (numeroModulo < 70) {
            toast({
                title: "Error",
                description: "El número de módulo debe ser 70 o mayor.",
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        // Verificar si el módulo ya existe
        const moduloExiste = pasadores.some((p) => p.modulo === numeroModulo)
        if (moduloExiste) {
            toast({
                title: "Error",
                description: `El módulo ${numeroModulo} ya existe.`,
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        // Verificar si el módulo ya está en la lista de módulos disponibles
        if (modulosDisponibles.includes(numeroModulo)) {
            toast({
                title: "Error",
                description: `El módulo ${numeroModulo} ya está disponible.`,
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        try {
            // Agregar el módulo a la lista de módulos disponibles
            const nuevosModulos = [...modulosDisponibles, numeroModulo].sort((a, b) => a - b)
            setModulosDisponibles(nuevosModulos)
            // Seleccionar el nuevo módulo
            setModuloSeleccionado(numeroModulo)
            toast({
                title: "Éxito",
                description: `Módulo ${numeroModulo} creado correctamente.`,
            })
            setIsCreateModuleDialogOpen(false)
        } catch (error) {
            console.error("Error al crear módulo:", error)
            toast({
                title: "Error",
                description: "No se pudo crear el módulo.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const obtenerSiguientePosicion = (pasadores: Pasador[], modulo: number) => {
        const pasadoresEnModulo = pasadores.filter((p) => p.modulo === modulo)
        return pasadoresEnModulo.length + 1
    }

    const fetchPasadores = async () => {
        const pasadoresCollection = collection(db, "pasadores")
        const pasadoresSnapshot = await getDocs(pasadoresCollection)
        const pasadoresList = pasadoresSnapshot.docs.map((doc) => {
            const data = doc.data()
            return {
                id: doc.id,
                displayId: data.displayId || `${data.modulo || 70}-${(data.posicionEnModulo || 1).toString().padStart(4, "0")}`,
                nombre: data.nombre || "",
                nombreFantasia: data.nombreFantasia || "",
                comision: data.comision || 0,
                deje: data.deje || false,
                dejeComision: data.dejeComision || 0,
                observaciones: data.observaciones || "",
                username: data.username || "",
                password: data.password || "",
                bloqueado: data.bloqueado || false,
                modulo: data.modulo || 70,
                posicionEnModulo: data.posicionEnModulo || 1,
            } as Pasador
        })

        // Ordenar por módulo y posición
        pasadoresList.sort((a, b) => {
            if (a.modulo !== b.modulo) {
                return a.modulo - b.modulo
            }
            return a.posicionEnModulo - b.posicionEnModulo
        })

        setPasadores(pasadoresList)
        // Calcular módulos disponibles
        const modulos = calcularModulosDisponibles(pasadoresList)
        setModulosDisponibles(modulos)
        // Si el módulo seleccionado no está disponible, seleccionar el primero disponible
        if (!modulos.includes(moduloSeleccionado)) {
            setModuloSeleccionado(modulos[0])
        }
    }

    const totalPages = Math.ceil(pasadores.length / ITEMS_PER_PAGE)
    const paginatedPasadores = pasadores.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    const handleNewPasador = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)
        const formData = new FormData(event.currentTarget)
        const nombre = formData.get("nombre") as string
        const username = formData.get("username") as string
        const password = formData.get("password") as string
        const moduloSeleccionadoForm = Number.parseInt(formData.get("modulo") as string)

        const nombreQuery = query(collection(db, "pasadores"), where("nombre", "==", nombre))
        const usernameQuery = query(collection(db, "pasadores"), where("username", "==", username))
        const [nombreSnapshot, usernameSnapshot] = await Promise.all([getDocs(nombreQuery), getDocs(usernameQuery)])

        if (!nombreSnapshot.empty) {
            toast({
                title: "Error",
                description: "El nombre ya está en uso.",
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        if (!usernameSnapshot.empty) {
            toast({
                title: "Error",
                description: "El usuario que intenta crear ya existe. Por favor, elija otro nombre de usuario.",
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        // Verificar que el módulo no esté lleno
        const pasadoresEnModulo = pasadores.filter((p) => p.modulo === moduloSeleccionadoForm)
        if (pasadoresEnModulo.length >= PASADORES_POR_MODULO) {
            toast({
                title: "Error",
                description: `El módulo ${moduloSeleccionadoForm} está lleno (máximo ${PASADORES_POR_MODULO} pasadores).`,
                variant: "destructive",
            })
            setIsLoading(false)
            return
        }

        const hashedPassword = await hash(password, 10)
        const posicionEnModulo = obtenerSiguientePosicion(pasadores, moduloSeleccionadoForm)
        const displayId = `${moduloSeleccionadoForm}-${posicionEnModulo.toString().padStart(4, "0")}`

        const newPasador = {
            nombre,
            nombreFantasia: formData.get("nombreFantasia") as string,
            comision: Number.parseFloat(formData.get("comision") as string),
            deje: false,
            dejeComision: 0,
            observaciones: formData.get("observaciones") as string,
            username,
            password: hashedPassword,
            bloqueado: false,
            modulo: moduloSeleccionadoForm,
            posicionEnModulo: posicionEnModulo,
            displayId: displayId,
        }

        try {
            await addDoc(collection(db, "pasadores"), newPasador)
            await fetchPasadores()
            toast({
                title: "Éxito",
                description: `Pasador creado correctamente en el módulo ${moduloSeleccionadoForm}.`,
            })
            setIsNewDialogOpen(false)
        } catch (error) {
            console.error("Error al crear nuevo pasador:", error)
            toast({
                title: "Error",
                description: "No se pudo crear el pasador.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenEditDialog = (pasador: Pasador) => {
        setEditingPasador(pasador)
        setEditingComision(pasador.comision)
        setIsEditDialogOpen(true)
    }

    const handleUpdatePasador = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (editingPasador) {
            setIsLoading(true)
            const updatedPasador = {
                ...editingPasador,
                comision: editingComision,
            }

            try {
                await updateDoc(doc(db, "pasadores", editingPasador.id), updatedPasador)
                setIsEditDialogOpen(false)
                setEditingPasador(null)
                setEditingComision(0)
                await fetchPasadores()
                toast({
                    title: "Éxito",
                    description: "Pasador actualizado correctamente.",
                })
            } catch (error) {
                console.error("Error al actualizar pasador:", error)
                toast({
                    title: "Error",
                    description: "No se pudo actualizar el pasador.",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }
    }

    const handleBulkUpdateComision = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsLoading(true)

        try {
            const updatePromises = selectedPasadores.map((pasadorId) =>
                updateDoc(doc(db, "pasadores", pasadorId), { comision: bulkComision }),
            )

            await Promise.all(updatePromises)

            setIsBulkEditDialogOpen(false)
            setBulkComision(0)
            setSelectedPasadores([])
            await fetchPasadores()

            toast({
                title: "Éxito",
                description: `Comisión actualizada para ${selectedPasadores.length} pasador(es).`,
            })
        } catch (error) {
            console.error("Error al actualizar comisiones:", error)
            toast({
                title: "Error",
                description: "No se pudieron actualizar las comisiones.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeletePasadores = async () => {
        setIsLoading(true)
        try {
            for (const pasadorId of selectedPasadores) {
                await deleteDoc(doc(db, "pasadores", pasadorId))
            }
            setSelectedPasadores([])
            await fetchPasadores()
            toast({
                title: "Éxito",
                description: "Pasadores eliminados correctamente.",
            })
        } catch (error) {
            console.error("Error al eliminar pasadores:", error)
            toast({
                title: "Error",
                description: "No se pudieron eliminar los pasadores.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (editingPasador) {
            setIsLoading(true)
            const formData = new FormData(event.currentTarget)
            const newPassword = formData.get("newPassword") as string
            const hashedPassword = await hash(newPassword, 10)

            try {
                await updateDoc(doc(db, "pasadores", editingPasador.id), { password: hashedPassword })
                setIsChangePasswordDialogOpen(false)
                toast({
                    title: "Éxito",
                    description: "Contraseña actualizada correctamente.",
                })
            } catch (error) {
                console.error("Error al cambiar la contraseña:", error)
                toast({
                    title: "Error",
                    description: "No se pudo cambiar la contraseña.",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }
    }

    const handleToggleBlock = async (pasadorId: string, currentBlockedStatus: boolean) => {
        setIsLoading(true)
        try {
            await updateDoc(doc(db, "pasadores", pasadorId), { bloqueado: !currentBlockedStatus })
            await fetchPasadores()
            toast({
                title: "Éxito",
                description: `Pasador ${currentBlockedStatus ? "desbloqueado" : "bloqueado"} correctamente.`,
            })
        } catch (error) {
            console.error("Error al cambiar el estado de bloqueo:", error)
            toast({
                title: "Error",
                description: "No se pudo cambiar el estado de bloqueo del pasador.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const togglePasadorSelection = (pasadorId: string) => {
        setSelectedPasadores((prev) =>
            prev.includes(pasadorId) ? prev.filter((id) => id !== pasadorId) : [...prev, pasadorId],
        )
    }

    const toggleSelectAll = () => {
        if (selectedPasadores.length === paginatedPasadores.length) {
            setSelectedPasadores([])
        } else {
            setSelectedPasadores(paginatedPasadores.map((p) => p.id))
        }
    }

    const isAllSelected = selectedPasadores.length === paginatedPasadores.length && paginatedPasadores.length > 0
    const isPartiallySelected = selectedPasadores.length > 0 && selectedPasadores.length < paginatedPasadores.length

    const handleExportToExcel = () => {
        const workbook = XLSX.utils.book_new()
        const worksheetData = pasadores.map((p) => ({
            ID: p.displayId,
            Módulo: p.modulo,
            Posición: p.posicionEnModulo,
            Nombre: p.nombre,
            "Nombre Fantasía": p.nombreFantasia,
            Comisión: `${p.comision.toFixed(2)}%`,
            Deje: p.deje ? "Sí" : "No",
            DejeComisión: `$${p.dejeComision.toFixed(2)}`,
            "Nombre de Usuario": p.username,
            Observaciones: p.observaciones,
            Estado: p.bloqueado ? "Bloqueado" : "Activo",
        }))

        const worksheet = XLSX.utils.json_to_sheet(worksheetData)
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pasadores")
        XLSX.writeFile(workbook, "pasadores.xlsx")

        toast({
            title: "Éxito",
            description: "Archivo Excel generado y descargado correctamente.",
        })
    }

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
            <Navbar />
            <div className="container mx-auto p-4 flex-1">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-blue-800 border-b-2 border-blue-500 pb-2">Listado de Pasadores</h1>
                    <div className="flex gap-2 flex-wrap">
                        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-md transition-all duration-200 transform hover:scale-105">
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Nuevo Pasador
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-white border border-blue-200 shadow-xl max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-blue-800">Nuevo Pasador</DialogTitle>
                                    <DialogDescription>Complete los datos del nuevo pasador</DialogDescription>
                                </DialogHeader>
                                <form className="grid gap-4 py-4" onSubmit={handleNewPasador}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="modulo" className="text-blue-700">
                                            Módulo
                                        </Label>
                                        <Select name="modulo" defaultValue={moduloSeleccionado.toString()}>
                                            <SelectTrigger className="border-blue-200 focus:border-blue-500">
                                                <SelectValue placeholder="Seleccionar módulo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {modulosDisponibles.map((modulo) => {
                                                    const pasadoresEnModulo = pasadores.filter((p) => p.modulo === modulo).length
                                                    const espaciosDisponibles = PASADORES_POR_MODULO - pasadoresEnModulo
                                                    return (
                                                        <SelectItem key={modulo} value={modulo.toString()}>
                                                            Módulo {modulo} ({espaciosDisponibles} espacios disponibles)
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nombre" className="text-blue-700">
                                            Nombre
                                        </Label>
                                        <Input id="nombre" name="nombre" required className="border-blue-200 focus:border-blue-500" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nombreFantasia" className="text-blue-700">
                                            Nombre Fantasía
                                        </Label>
                                        <Input
                                            id="nombreFantasia"
                                            name="nombreFantasia"
                                            className="border-blue-200 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="comision" className="text-blue-700">
                                            Comisión (%)
                                        </Label>
                                        <Input
                                            id="comision"
                                            name="comision"
                                            type="number"
                                            step="0.01"
                                            defaultValue="20.00"
                                            className="border-blue-200 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="observaciones" className="text-blue-700">
                                            Observaciones
                                        </Label>
                                        <Input id="observaciones" name="observaciones" className="border-blue-200 focus:border-blue-500" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="username" className="text-blue-700">
                                            Nombre de Usuario
                                        </Label>
                                        <Input id="username" name="username" required className="border-blue-200 focus:border-blue-500" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password" className="text-blue-700">
                                            Contraseña
                                        </Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            required
                                            className="border-blue-200 focus:border-blue-500"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar"
                                        )}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Button
                            onClick={() => setIsCreateModuleDialogOpen(true)}
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
                        >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Crear Módulo
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() =>
                                selectedPasadores.length === 1 &&
                                handleOpenEditDialog(pasadores.find((p) => p.id === selectedPasadores[0])!)
                            }
                            disabled={selectedPasadores.length !== 1}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Modificar
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setBulkComision(0)
                                setIsBulkEditDialogOpen(true)
                            }}
                            disabled={selectedPasadores.length === 0}
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-500"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Modificar Comisión ({selectedPasadores.length})
                        </Button>

                        <Button
                            variant="outline"
                            disabled={selectedPasadores.length === 0}
                            onClick={handleDeletePasadores}
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500 bg-transparent"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                if (selectedPasadores.length === 1) {
                                    setEditingPasador(pasadores.find((p) => p.id === selectedPasadores[0])!)
                                    setIsChangePasswordDialogOpen(true)
                                }
                            }}
                            disabled={selectedPasadores.length !== 1}
                            className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-500"
                        >
                            <Key className="h-4 w-4 mr-2" />
                            Cambiar Contraseña
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => {
                                if (selectedPasadores.length === 1) {
                                    const pasador = pasadores.find((p) => p.id === selectedPasadores[0])!
                                    handleToggleBlock(pasador.id, pasador.bloqueado)
                                }
                            }}
                            disabled={selectedPasadores.length !== 1}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-500"
                        >
                            <Lock className="h-4 w-4 mr-2" />
                            Bloquear/Desbloquear
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleExportToExcel}
                            className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500 bg-transparent"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                    </div>
                </div>

                <div className="border rounded-md shadow-lg bg-white overflow-hidden">
                    <Table>
                        <TableHeader className="bg-gradient-to-r from-blue-600 to-indigo-700">
                            <TableRow>
                                <TableHead className="w-[50px] text-white">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isPartiallySelected
                                        }}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-white text-white bg-transparent focus:ring-white focus:ring-2"
                                    />
                                </TableHead>
                                <TableHead className="w-[120px] text-white font-bold">ID</TableHead>
                                <TableHead className="w-[80px] text-white font-bold">Módulo</TableHead>
                                <TableHead className="text-white font-bold">Nombre</TableHead>
                                <TableHead className="text-white font-bold">Nombre Fantasía</TableHead>
                                <TableHead className="text-right pr-8 text-white font-bold">Comisión</TableHead>
                                <TableHead className="text-center px-8 text-white font-bold">Deje</TableHead>
                                <TableHead className="text-right px-8 text-white font-bold">DejeComisión</TableHead>
                                <TableHead className="text-white font-bold">Nombre de Usuario</TableHead>
                                <TableHead className="pl-8 text-white font-bold">Observaciones</TableHead>
                                <TableHead className="text-center text-white font-bold">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedPasadores.map((pasador, index) => (
                                <TableRow
                                    key={pasador.id}
                                    className={`${selectedPasadores.includes(pasador.id) ? "bg-blue-100" : ""} 
                    ${index % 2 === 0 ? "bg-blue-50" : "bg-white"} 
                    hover:bg-blue-100 transition-colors`}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedPasadores.includes(pasador.id)}
                                            onCheckedChange={() => togglePasadorSelection(pasador.id)}
                                            className="border-blue-400 text-blue-600"
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium text-blue-800">{pasador.displayId}</TableCell>
                                    <TableCell className="font-medium text-indigo-600">{pasador.modulo}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">
                                                {pasador.nombre.charAt(0).toUpperCase()}
                                            </div>
                                            {pasador.nombre}
                                        </div>
                                    </TableCell>
                                    <TableCell>{pasador.nombreFantasia}</TableCell>
                                    <TableCell className="text-right pr-8 text-indigo-600 font-semibold">
                                        {pasador.comision.toFixed(2)}%
                                    </TableCell>
                                    <TableCell className="text-center px-8">
                                        {pasador.deje ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                Sí
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                No
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right px-8 text-green-600 font-semibold">
                                        ${pasador.dejeComision.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-gray-700">{pasador.username}</TableCell>
                                    <TableCell className="pl-8 text-gray-600 italic">{pasador.observaciones}</TableCell>
                                    <TableCell className="text-center">
                                        {pasador.bloqueado ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 shadow-sm">
                                                Bloqueado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 shadow-sm">
                                                Activo
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between mt-6 bg-white p-3 rounded-lg shadow-md border border-blue-200">
                    <div className="text-sm text-blue-700 font-medium">
                        Página {currentPage} de {totalPages} - Total: {pasadores.length} pasadores
                        {selectedPasadores.length > 0 && (
                            <span className="ml-4 text-indigo-600">
                                ({selectedPasadores.length} seleccionado{selectedPasadores.length !== 1 ? "s" : ""})
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>

                {/* Diálogo para modificar pasador individual */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800">Modificar Pasador</DialogTitle>
                            <DialogDescription>Modifique la comisión del pasador</DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleUpdatePasador}>
                            <div className="grid gap-2">
                                <Label htmlFor="editComision" className="text-blue-700">
                                    Comisión (%)
                                </Label>
                                <Input
                                    id="editComision"
                                    name="comision"
                                    type="number"
                                    step="0.01"
                                    value={editingComision}
                                    onChange={(e) => setEditingComision(Number.parseFloat(e.target.value))}
                                    className="border-blue-200 focus:border-blue-500"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    "Guardar"
                                )}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Diálogo para modificar comisión masiva */}
                <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
                    <DialogContent className="bg-white border border-indigo-200 shadow-xl">
                        <DialogHeader>
                            <DialogTitle className="text-indigo-800">Modificar Comisión Masiva</DialogTitle>
                            <DialogDescription>
                                Modificar la comisión de {selectedPasadores.length} pasador{selectedPasadores.length !== 1 ? "es" : ""}{" "}
                                seleccionado{selectedPasadores.length !== 1 ? "s" : ""}
                            </DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleBulkUpdateComision}>
                            <div className="grid gap-2">
                                <Label htmlFor="bulkComision" className="text-indigo-700">
                                    Nueva Comisión (%)
                                </Label>
                                <Input
                                    id="bulkComision"
                                    name="bulkComision"
                                    type="number"
                                    step="0.01"
                                    value={bulkComision}
                                    onChange={(e) => setBulkComision(Number.parseFloat(e.target.value))}
                                    className="border-indigo-200 focus:border-indigo-500"
                                    placeholder="Ej: 25.00"
                                />
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-md">
                                <p className="text-sm text-indigo-700">
                                    <strong>Pasadores seleccionados:</strong>
                                </p>
                                <div className="mt-2 max-h-32 overflow-y-auto">
                                    {selectedPasadores.map((id) => {
                                        const pasador = pasadores.find((p) => p.id === id)
                                        return (
                                            <div key={id} className="text-xs text-indigo-600 py-1">
                                                • {pasador?.displayId} - {pasador?.nombre}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading || !bulkComision}
                                className="bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Actualizando...
                                    </>
                                ) : (
                                    `Actualizar ${selectedPasadores.length} Pasador${selectedPasadores.length !== 1 ? "es" : ""}`
                                )}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800">Cambiar Contraseña</DialogTitle>
                            <DialogDescription>Ingrese la nueva contraseña para el pasador</DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleChangePassword}>
                            <div className="grid gap-2">
                                <Label htmlFor="newPassword" className="text-blue-700">
                                    Nueva Contraseña
                                </Label>
                                <Input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    required
                                    className="border-blue-200 focus:border-blue-500"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Cambiando...
                                    </>
                                ) : (
                                    "Cambiar Contraseña"
                                )}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCreateModuleDialogOpen} onOpenChange={setIsCreateModuleDialogOpen}>
                    <DialogContent className="bg-white border border-blue-200 shadow-xl max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-blue-800">Crear Nuevo Módulo</DialogTitle>
                            <DialogDescription>Ingrese el número del módulo que desea crear</DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleCreateModule}>
                            <div className="grid gap-2">
                                <Label htmlFor="numeroModulo" className="text-blue-700">
                                    Número de Módulo
                                </Label>
                                <Input
                                    id="numeroModulo"
                                    name="numeroModulo"
                                    type="number"
                                    min="70"
                                    required
                                    placeholder="Ej: 75"
                                    className="border-blue-200 focus:border-blue-500"
                                />
                                <p className="text-xs text-gray-500">
                                    El número debe ser 70 o mayor. Cada módulo puede contener hasta 40 pasadores.
                                </p>
                            </div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    "Crear Módulo"
                                )}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                <Toaster />
            </div>
        </div>
    )
}
