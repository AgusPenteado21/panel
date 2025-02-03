"use client"

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
        <div className="flex flex-col min-h-screen">
            <Navbar />
            <div className="container mx-auto p-4 flex-1">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Listado de Pasadores</h1>
                    <div className="flex gap-2">
                        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Nuevo Pasador
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Nuevo Pasador</DialogTitle>
                                    <DialogDescription>Complete los datos del nuevo pasador</DialogDescription>
                                </DialogHeader>
                                <form className="grid gap-4 py-4" onSubmit={handleNewPasador}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nombre">Nombre</Label>
                                        <Input id="nombre" name="nombre" required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="nombreFantasia">Nombre Fantasía</Label>
                                        <Input id="nombreFantasia" name="nombreFantasia" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="comision">Comisión (%)</Label>
                                        <Input id="comision" name="comision" type="number" step="0.01" defaultValue="20.00" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="observaciones">Observaciones</Label>
                                        <Input id="observaciones" name="observaciones" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="username">Nombre de Usuario</Label>
                                        <Input id="username" name="username" required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Contraseña</Label>
                                        <Input id="password" name="password" type="password" required />
                                    </div>
                                    <Button type="submit" disabled={isLoading}>
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
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Modificar
                        </Button>
                        <Button variant="outline" disabled={selectedPasadores.length === 0} onClick={handleDeletePasadores}>
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
                        >
                            <Lock className="h-4 w-4 mr-2" />
                            Bloquear/Desbloquear
                        </Button>
                        <Button variant="outline" onClick={handleExportToExcel}>
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                    </div>
                </div>

                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="w-[100px]">Nº</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Nombre Fantasía</TableHead>
                                <TableHead className="text-right pr-8">Comisión</TableHead>
                                <TableHead className="text-center px-8">Deje</TableHead>
                                <TableHead className="text-right px-8">DejeComisión</TableHead>
                                <TableHead>Nombre de Usuario</TableHead>
                                <TableHead className="pl-8">Observaciones</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedPasadores.map((pasador) => (
                                <TableRow key={pasador.id} className={selectedPasadores.includes(pasador.id) ? "bg-muted" : ""}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedPasadores.includes(pasador.id)}
                                            onCheckedChange={() => togglePasadorSelection(pasador.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{pasador.displayId.toString().padStart(4, "0")}</TableCell>
                                    <TableCell>{pasador.nombre}</TableCell>
                                    <TableCell>{pasador.nombreFantasia}</TableCell>
                                    <TableCell className="text-right pr-8">{pasador.comision.toFixed(2)}%</TableCell>
                                    <TableCell className="text-center px-8">{pasador.deje ? "Sí" : "No"}</TableCell>
                                    <TableCell className="text-right px-8">${pasador.dejeComision.toFixed(2)}</TableCell>
                                    <TableCell>{pasador.username}</TableCell>
                                    <TableCell className="pl-8">{pasador.observaciones}</TableCell>
                                    <TableCell className="text-center">
                                        {pasador.bloqueado ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Bloqueado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Activo
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Modificar Pasador</DialogTitle>
                            <DialogDescription>Modifique la comisión del pasador</DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleUpdatePasador}>
                            <div className="grid gap-2">
                                <Label htmlFor="editComision">Comisión (%)</Label>
                                <Input
                                    id="editComision"
                                    name="comision"
                                    type="number"
                                    step="0.01"
                                    value={editingComision}
                                    onChange={(e) => setEditingComision(Number.parseFloat(e.target.value))}
                                />
                            </div>
                            <Button type="submit" disabled={isLoading}>
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
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cambiar Contraseña</DialogTitle>
                            <DialogDescription>Ingrese la nueva contraseña para el pasador</DialogDescription>
                        </DialogHeader>
                        <form className="grid gap-4 py-4" onSubmit={handleChangePassword}>
                            <div className="grid gap-2">
                                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                                <Input id="newPassword" name="newPassword" type="password" required />
                            </div>
                            <Button type="submit" disabled={isLoading}>
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

