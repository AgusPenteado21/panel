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
import { PlusCircle, Download, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, Key, Lock } from "lucide-react"
import Navbar from "@/app/components/Navbar"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore"
import { hash } from "bcryptjs"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import * as XLSX from "xlsx"

interface Pasador {
    id: string
    displayId: number
    nombre: string
    nombreFantasia: string
    comision: number
    deje: boolean
    dejeComision: number
    observaciones: string
    username: string
    password: string
    bloqueado: boolean
}

const ITEMS_PER_PAGE = 15

export default function PasadoresClient() {
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedPasadores, setSelectedPasadores] = useState<string[]>([])
    const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false)
    const [editingPasador, setEditingPasador] = useState<Pasador | null>(null)
    const [editingComision, setEditingComision] = useState<number>(0)
    const [pasadores, setPasadores] = useState<Pasador[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        fetchPasadores()
    }, [])

    const fetchPasadores = async () => {
        const pasadoresCollection = collection(db, "pasadores")
        const pasadoresSnapshot = await getDocs(pasadoresCollection)
        const pasadoresList = pasadoresSnapshot.docs.map(
            (doc, index) =>
                ({
                    id: doc.id,
                    displayId: index + 1,
                    ...doc.data(),
                }) as Pasador,
        )
        setPasadores(pasadoresList)
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

        const hashedPassword = await hash(password, 10)

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
        }

        try {
            await addDoc(collection(db, "pasadores"), newPasador)
            await fetchPasadores()
            toast({
                title: "Éxito",
                description: "Pasador creado correctamente.",
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

    const handleExportToExcel = () => {
        const workbook = XLSX.utils.book_new()
        const worksheetData = pasadores.map((p) => ({
            Nº: p.displayId,
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
                            <DialogContent className="bg-white border border-blue-200 shadow-xl">
                                <DialogHeader>
                                    <DialogTitle className="text-blue-800">Nuevo Pasador</DialogTitle>
                                    <DialogDescription>Complete los datos del nuevo pasador</DialogDescription>
                                </DialogHeader>
                                <form className="grid gap-4 py-4" onSubmit={handleNewPasador}>
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
                            disabled={selectedPasadores.length === 0}
                            onClick={handleDeletePasadores}
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-500"
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
                            className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-500"
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
                                <TableHead className="w-[50px] text-white"></TableHead>
                                <TableHead className="w-[100px] text-white font-bold">Nº</TableHead>
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
                                    <TableCell className="font-medium text-blue-800">
                                        {pasador.displayId.toString().padStart(4, "0")}
                                    </TableCell>
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
                        Página {currentPage} de {totalPages}
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
                <Toaster />
            </div>
        </div>
    )
}

