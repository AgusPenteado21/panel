"use client"

import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, Download, Key, Lock, Trash2, Search } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import Navbar from '@/app/components/Navbar'
import { db, auth } from '@/lib/firebase'
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRouter } from 'next/navigation'

interface User {
    id: string
    username: string
    email: string
    tipo: string
    observaciones: string
    isOnline: boolean
    limite: string
    isBlocked: boolean
    isAdmin: boolean
}

const ITEMS_PER_PAGE = 15;

export default function AdminUsersClient() {
    const router = useRouter()
    const [adminUsers, setAdminUsers] = useState<User[]>([])
    const [pasadorUsers, setPasadorUsers] = useState<User[]>([])
    const [filteredAdminUsers, setFilteredAdminUsers] = useState<User[]>([])
    const [filteredPasadorUsers, setFilteredPasadorUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [currentAdminPage, setCurrentAdminPage] = useState(1)
    const [currentPasadorPage, setCurrentPasadorPage] = useState(1)
    const [selectedAdminUsers, setSelectedAdminUsers] = useState<string[]>([])
    const [selectedPasadorUsers, setSelectedPasadorUsers] = useState<string[]>([])
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<string | null>(null)

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        const filteredAdmins = adminUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setFilteredAdminUsers(filteredAdmins)
        setCurrentAdminPage(1)

        const filteredPasadores = pasadorUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.observaciones?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        setFilteredPasadorUsers(filteredPasadores)
        setCurrentPasadorPage(1)
    }, [searchTerm, adminUsers, pasadorUsers])

    const fetchUsers = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const usersCollection = collection(db, 'users')
            const pasadoresCollection = collection(db, 'pasadores')
            const [usersSnapshot, pasadoresSnapshot] = await Promise.all([
                getDocs(usersCollection),
                getDocs(pasadoresCollection)
            ])

            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data()
                return {
                    id: doc.id,
                    ...data,
                    tipo: data.isAdmin ? 'Administrador' : 'Punto de venta',
                    limite: data.limite || '$0.00',
                    isAdmin: !!data.isAdmin,
                    isOnline: !!data.isOnline,
                    observaciones: data.observaciones || '',
                } as User
            })

            const pasadoresData = pasadoresSnapshot.docs.map(doc => {
                const data = doc.data()
                return {
                    id: doc.id,
                    username: data.nombre,
                    email: data.email || '',
                    tipo: 'Pasador',
                    observaciones: data.observaciones || '',
                    isOnline: !!data.isOnline,
                    limite: `$${data.comision.toFixed(2)}`,
                    isBlocked: !!data.bloqueado,
                    isAdmin: false,
                } as User
            })

            const adminUsers = usersData.filter(user => user.isAdmin)
            const pasadorUsers = [...usersData.filter(user => !user.isAdmin), ...pasadoresData]

            setAdminUsers(adminUsers)
            setPasadorUsers(pasadorUsers)
            setFilteredAdminUsers(adminUsers)
            setFilteredPasadorUsers(pasadorUsers)
        } catch (error) {
            console.error('Error:', error)
            setError('Hubo un problema al cargar los usuarios. Por favor, intenta de nuevo más tarde.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleBlockUsers = async (userIds: string[], isAdmin: boolean) => {
        try {
            for (const userId of userIds) {
                const user = pasadorUsers.find(u => u.id === userId)
                if (user) {
                    const userRef = doc(db, user.tipo === 'Pasador' ? 'pasadores' : 'users', userId)
                    await updateDoc(userRef, {
                        [user.tipo === 'Pasador' ? 'bloqueado' : 'isBlocked']: !user.isBlocked
                    })
                }
            }
            await fetchUsers()
            setSelectedPasadorUsers([])
        } catch (error) {
            console.error('Error:', error)
            setError('Hubo un problema al bloquear/desbloquear los usuarios.')
        }
    }

    const handleDeleteUsers = async () => {
        if (!userToDelete) return

        try {
            const userToDeleteData = [...adminUsers, ...pasadorUsers].find(u => u.id === userToDelete)
            if (userToDeleteData) {
                if (userToDeleteData.tipo === 'Pasador') {
                    await deleteDoc(doc(db, 'pasadores', userToDelete))
                } else {
                    await deleteDoc(doc(db, 'users', userToDelete))
                    const user = auth.currentUser
                    if (user && user.uid === userToDelete) {
                        await deleteUser(user)
                        await auth.signOut()
                        router.push('/login')
                    }
                }
            }
            await fetchUsers()
            setSelectedAdminUsers([])
            setSelectedPasadorUsers([])
            setUserToDelete(null)
            setIsDeleteDialogOpen(false)
        } catch (error) {
            console.error('Error:', error)
            setError('Hubo un problema al eliminar el usuario.')
        }
    }

    const handleExport = (users: User[]) => {
        const data = users.map(user => ({
            Tipo: user.tipo,
            Observaciones: user.observaciones,
            Nombre: user.username,
            Email: user.email,
            Estado: user.isOnline ? 'Conectado' : 'Desconectado',
            Límite: user.limite,
            Bloqueado: user.isBlocked ? 'Sí' : 'No'
        }))

        const csvContent = "data:text/csv;charset=utf-8,"
            + Object.keys(data[0]).join(",") + "\n"
            + data.map(row => Object.values(row).join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "usuarios.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const renderUserTable = (users: User[], selectedUsers: string[], setSelectedUsers: React.Dispatch<React.SetStateAction<string[]>>, currentPage: number, setCurrentPage: React.Dispatch<React.SetStateAction<number>>, isAdmin: boolean) => {
        const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE)
        const paginatedUsers = users.slice(
            (currentPage - 1) * ITEMS_PER_PAGE,
            currentPage * ITEMS_PER_PAGE
        )

        return (
            <>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedUsers(paginatedUsers.map(user => user.id))
                                            } else {
                                                setSelectedUsers([])
                                            }
                                        }}
                                        checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                                    />
                                </TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Observaciones</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Límite</TableHead>
                                {!isAdmin && <TableHead>Bloqueado</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.includes(user.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedUsers([...selectedUsers, user.id])
                                                } else {
                                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>{user.tipo}</TableCell>
                                    <TableCell>{user.observaciones}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <div
                                                className={`h-2 w-2 rounded-full mr-2 ${user.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
                                                aria-hidden="true"
                                            ></div>
                                            <span className="sr-only">{user.isOnline ? 'Conectado' : 'Desconectado'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.limite}</TableCell>
                                    {!isAdmin && <TableCell>{user.isBlocked ? 'Sí' : 'No'}</TableCell>}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-500">
                        Página {currentPage} de {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            </>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <div className="flex-grow container mx-auto p-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-center text-red-500">{error}</div>
                ) : (
                    <Tabs defaultValue="admin" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="admin">Usuarios Administradores</TabsTrigger>
                            <TabsTrigger value="pasador">Usuarios Pasadores</TabsTrigger>
                        </TabsList>

                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { }}
                                    disabled={selectedAdminUsers.length === 0 && selectedPasadorUsers.length === 0}
                                >
                                    <Key className="h-4 w-4 mr-2" />
                                    Cambiar Clave
                                </Button>
                                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (selectedAdminUsers.length === 1) {
                                                    setUserToDelete(selectedAdminUsers[0])
                                                } else if (selectedPasadorUsers.length === 1) {
                                                    setUserToDelete(selectedPasadorUsers[0])
                                                }
                                            }}
                                            disabled={selectedAdminUsers.length + selectedPasadorUsers.length !== 1}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Eliminar
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción no se puede deshacer. Esto eliminará permanentemente el usuario
                                                y eliminará sus datos de nuestros servidores.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteUsers}>Eliminar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Download className="h-4 w-4 mr-2" />
                                            Exportar
                                            <ChevronDown className="h-4 w-4 ml-2" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleExport(adminUsers)}>
                                            Exportar Administradores a CSV
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport(pasadorUsers)}>
                                            Exportar Pasadores a CSV
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-gray-500" />
                                <Input
                                    type="search"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-64"
                                />
                            </div>
                        </div>

                        <TabsContent value="admin">
                            <h2 className="text-2xl font-bold mb-4">Usuarios Administradores</h2>
                            {renderUserTable(filteredAdminUsers, selectedAdminUsers, setSelectedAdminUsers, currentAdminPage, setCurrentAdminPage, true)}
                        </TabsContent>

                        <TabsContent value="pasador">
                            <h2 className="text-2xl font-bold mb-4">Usuarios Pasadores</h2>
                            {pasadorUsers.length === 0 ? (
                                <p>No hay usuarios pasadores registrados aún.</p>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleBlockUsers(selectedPasadorUsers, false)}
                                        disabled={selectedPasadorUsers.length === 0}
                                        className="mb-4"
                                    >
                                        <Lock className="h-4 w-4 mr-2" />
                                        Bloquear/Desbloquear
                                    </Button>
                                    {renderUserTable(filteredPasadorUsers, selectedPasadorUsers, setSelectedPasadorUsers, currentPasadorPage, setCurrentPasadorPage, false)}
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    )
}

