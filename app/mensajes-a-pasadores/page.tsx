"use client"

import { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Edit, Trash2, Send } from 'lucide-react'
import toast from "react-hot-toast"
import Navbar from "@/app/components/Navbar"

interface Mensaje {
    id: string
    contenido: string
    createdAt: Timestamp
    updatedAt?: Timestamp
}

export default function MensajesPasadoresPage() {
    const [mensajes, setMensajes] = useState<Mensaje[]>([])
    const [nuevoMensajeContenido, setNuevoMensajeContenido] = useState("")
    const [editandoMensaje, setEditandoMensaje] = useState<Mensaje | null>(null)
    const [estaCargando, setEstaCargando] = useState(true)
    const [estaGuardando, setEstaGuardando] = useState(false)

    // Listener para mensajes en tiempo real
    useEffect(() => {
        setEstaCargando(true)
        const mensajesRef = collection(db, "mensajes")
        const q = query(mensajesRef, orderBy("createdAt", "desc"))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const mensajesData: Mensaje[] = snapshot.docs.map(doc => ({
                id: doc.id,
                contenido: doc.data().contenido,
                createdAt: doc.data().createdAt,
                updatedAt: doc.data().updatedAt || undefined,
            }))
            setMensajes(mensajesData)
            setEstaCargando(false)
        }, (error) => {
            console.error("Error al obtener mensajes en tiempo real:", error)
            toast.error("Error al cargar los mensajes.")
            setEstaCargando(false)
        })

        return () => unsubscribe()
    }, [])

    // Función para agregar un nuevo mensaje
    const agregarMensaje = useCallback(async () => {
        if (!nuevoMensajeContenido.trim()) {
            toast.error("El mensaje no puede estar vacío.")
            return
        }
        setEstaGuardando(true)
        try {
            await addDoc(collection(db, "mensajes"), {
                contenido: nuevoMensajeContenido,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            })
            setNuevoMensajeContenido("")
            toast.success("Mensaje enviado exitosamente.")
        } catch (error) {
            console.error("Error al agregar mensaje:", error)
            toast.error("Error al enviar el mensaje.")
        } finally {
            setEstaGuardando(false)
        }
    }, [nuevoMensajeContenido])

    // Función para actualizar un mensaje existente
    const actualizarMensaje = useCallback(async () => {
        if (!editandoMensaje || !editandoMensaje.contenido.trim()) {
            toast.error("El mensaje a editar no puede estar vacío.")
            return
        }
        setEstaGuardando(true)
        try {
            const mensajeRef = doc(db, "mensajes", editandoMensaje.id)
            await updateDoc(mensajeRef, {
                contenido: editandoMensaje.contenido,
                updatedAt: Timestamp.now(),
            })
            setEditandoMensaje(null) // Cerrar el diálogo de edición
            toast.success("Mensaje actualizado exitosamente.")
        } catch (error) {
            console.error("Error al actualizar mensaje:", error)
            toast.error("Error al actualizar el mensaje.")
        } finally {
            setEstaGuardando(false)
        }
    }, [editandoMensaje])

    // Función para eliminar un mensaje
    const eliminarMensaje = useCallback(async (id: string) => {
        setEstaGuardando(true)
        try {
            await deleteDoc(doc(db, "mensajes", id))
            toast.success("Mensaje eliminado exitosamente.")
        } catch (error) {
            console.error("Error al eliminar mensaje:", error)
            toast.error("Error al eliminar el mensaje.")
        } finally {
            setEstaGuardando(false)
        }
    }, [])

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Navbar />
            <main className="container mx-auto p-4">
                <h1 className="text-2xl font-bold text-blue-800 mb-4 border-b-2 border-blue-500 pb-2">
                    📢 Mensajes a Pasadores
                </h1>

                <Card className="mb-6 shadow-md border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-blue-700">Enviar Nuevo Mensaje</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid w-full gap-2">
                            <Textarea
                                placeholder="Escribe tu mensaje aquí..."
                                value={nuevoMensajeContenido}
                                onChange={(e) => setNuevoMensajeContenido(e.target.value)}
                                className="min-h-[80px] border-blue-300 focus-visible:ring-blue-500"
                                disabled={estaGuardando}
                            />
                            <Button
                                onClick={agregarMensaje}
                                className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 h-10 px-6 text-base rounded-md shadow-md transition-all duration-200 transform hover:scale-105 self-end"
                                disabled={estaGuardando || !nuevoMensajeContenido.trim()}
                            >
                                {estaGuardando ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Enviar Mensaje
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-gray-700">Mensajes Existentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {estaCargando ? (
                            <div className="flex justify-center p-8">
                                <div className="text-center">
                                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                                    <p className="text-blue-600 font-medium">Cargando mensajes...</p>
                                </div>
                            </div>
                        ) : mensajes.length === 0 ? (
                            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded my-4 shadow-md" role="alert">
                                <p className="font-bold">Sin mensajes</p>
                                <p>No hay mensajes registrados aún.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead className="w-[60%] text-gray-700">Mensaje</TableHead>
                                        <TableHead className="w-[20%] text-gray-700">Fecha Creación</TableHead>
                                        <TableHead className="w-[20%] text-right text-gray-700">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mensajes.map((mensaje) => (
                                        <TableRow key={mensaje.id}>
                                            <TableCell className="font-medium text-gray-800">
                                                {mensaje.contenido}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {format(mensaje.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es })}
                                                {mensaje.updatedAt && (
                                                    <div className="text-xs text-gray-400">
                                                        (Editado: {format(mensaje.updatedAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es })})
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Dialog
                                                        open={editandoMensaje?.id === mensaje.id}
                                                        onOpenChange={(isOpen) => {
                                                            if (!isOpen) setEditandoMensaje(null)
                                                        }}
                                                    >
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                                                onClick={() => setEditandoMensaje(mensaje)}
                                                                disabled={estaGuardando}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                                <span className="sr-only">Editar</span>
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="sm:max-w-[425px]">
                                                            <DialogHeader>
                                                                <DialogTitle>Editar Mensaje</DialogTitle>
                                                                <DialogDescription>
                                                                    Realiza cambios en el mensaje aquí. Haz clic en guardar cuando hayas terminado.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="grid gap-4 py-4">
                                                                <Textarea
                                                                    id="contenido"
                                                                    value={editandoMensaje?.contenido || ""}
                                                                    onChange={(e: { target: { value: any } }) =>
                                                                        setEditandoMensaje(prev => prev ? { ...prev, contenido: e.target.value } : null)
                                                                    }
                                                                    className="col-span-3 min-h-[100px]"
                                                                    disabled={estaGuardando}
                                                                />
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    onClick={actualizarMensaje}
                                                                    disabled={estaGuardando || !editandoMensaje?.contenido.trim()}
                                                                >
                                                                    {estaGuardando ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : null}
                                                                    Guardar cambios
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-red-600 border-red-300 hover:bg-red-50"
                                                                disabled={estaGuardando}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">Eliminar</span>
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>¿Estás absolutamente seguro?</DialogTitle>
                                                                <DialogDescription>
                                                                    Esta acción no se puede deshacer. Esto eliminará permanentemente el mensaje.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => { /* Close dialog */ }}
                                                                    disabled={estaGuardando}
                                                                >
                                                                    Cancelar
                                                                </Button>
                                                                <Button
                                                                    variant="destructive"
                                                                    onClick={() => eliminarMensaje(mensaje.id)}
                                                                    disabled={estaGuardando}
                                                                >
                                                                    {estaGuardando ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : null}
                                                                    Eliminar
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
