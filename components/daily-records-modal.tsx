'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { Loader2, Save, X, AlertTriangle, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
} from '@/components/ui/alert-dialog'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, query, where, getDocs, setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

// Interfaz para los documentos de la colección 'saldos_diarios'
interface SaldoDiarioDoc {
    id: string // El ID del documento en Firestore
    pasador_id: string
    pasador_nombre: string
    display_id: string
    fecha: string // Formato "yyyy-MM-dd"
    timestamp: string // Formato "dd/MM/yy HH:mm"
    saldo_anterior: number
    saldo_actual: number // Movimiento neto del día
    saldo_final: number // Saldo acumulado al final del día
    saldo_total: number // Generalmente igual a saldo_final
    ventas_online: number // Corresponde a 'jugado'
    comision_pasador: number
    total_pagos: number // Corresponde a 'pagado'
    total_cobros: number // Corresponde a 'cobrado'
    total_ganado: number // Corresponde a 'premioTotal'
    modulo: number
    posicion_en_modulo: number
}

// Interfaz para los documentos de la colección 'pasadores'
interface PasadorMeta {
    id: string // El ID del documento en Firestore
    displayId: string
    nombre: string
    comision: number // Porcentaje de comisión
    modulo: number
    posicionEnModulo: number
}

interface DailyRecordsModalProps {
    pasadorId: string
    dateDesde: Date
    dateHasta: Date
    onClose: () => void
}

export default function DailyRecordsModal({ pasadorId, dateDesde, dateHasta, onClose }: DailyRecordsModalProps) {
    const [dailyRecords, setDailyRecords] = useState<SaldoDiarioDoc[]>([])
    const [isLoadingRecords, setIsLoadingRecords] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
    const [editedValues, setEditedValues] = useState<Partial<SaldoDiarioDoc>>({})
    const [pasadorCommission, setPasadorCommission] = useState<number>(0)

    const formatearMoneda = useCallback((monto: number): string => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
        }).format(monto)
    }, [])

    const fetchPasadorCommission = useCallback(async () => {
        try {
            const pasadorDocRef = doc(db, 'pasadores', pasadorId)
            const pasadorDocSnap = await getDoc(pasadorDocRef)
            if (pasadorDocSnap.exists()) {
                setPasadorCommission(pasadorDocSnap.data().comision || 0)
            } else {
                console.warn(`No se encontró el pasador con ID: ${pasadorId}`)
                setPasadorCommission(0)
            }
        } catch (err) {
            console.error('Error fetching pasador commission:', err)
            setError('Error al obtener la comisión del pasador.')
            setPasadorCommission(0)
        }
    }, [pasadorId])

    const fetchDailyRecords = useCallback(async () => {
        setIsLoadingRecords(true)
        setError(null)
        try {
            const saldosDiariosRef = collection(db, 'saldos_diarios')
            const q = query(
                saldosDiariosRef,
                where('pasador_id', '==', pasadorId),
                where('fecha', '>=', format(dateDesde, 'yyyy-MM-dd')),
                where('fecha', '<=', format(dateHasta, 'yyyy-MM-dd'))
            )
            const querySnapshot = await getDocs(q)
            const records: SaldoDiarioDoc[] = []
            querySnapshot.forEach((docSnap) => {
                records.push({ id: docSnap.id, ...docSnap.data() } as SaldoDiarioDoc)
            })
            records.sort((a, b) => parseISO(a.fecha).getTime() - parseISO(b.fecha).getTime())
            setDailyRecords(records)
        } catch (err) {
            console.error('Error fetching daily records:', err)
            setError('Error al cargar los registros diarios.')
        } finally {
            setIsLoadingRecords(false)
        }
    }, [pasadorId, dateDesde, dateHasta])

    useEffect(() => {
        fetchPasadorCommission()
        fetchDailyRecords()
    }, [fetchPasadorCommission, fetchDailyRecords])

    const handleEdit = (record: SaldoDiarioDoc) => {
        setEditingRecordId(record.id)
        setEditedValues({ ...record }) // Copy all fields for editing
    }

    const handleChange = (field: keyof SaldoDiarioDoc, value: string) => {
        setEditedValues((prev) => {
            const newValues = { ...prev, [field]: Number(value) || 0 } as SaldoDiarioDoc;

            // Recalculate comision_pasador, saldo_actual, saldo_final based on new values
            const ventasOnline = newValues.ventas_online ?? (prev.ventas_online || 0);
            const totalGanado = newValues.total_ganado ?? (prev.total_ganado || 0);
            const totalPagos = newValues.total_pagos ?? (prev.total_pagos || 0);
            const totalCobros = newValues.total_cobros ?? (prev.total_cobros || 0);
            const saldoAnterior = newValues.saldo_anterior ?? (prev.saldo_anterior || 0); // Use original saldo_anterior if not explicitly edited

            const calculatedComision = (pasadorCommission / 100) * ventasOnline;
            const calculatedSaldoActual = ventasOnline - calculatedComision - totalGanado;
            const calculatedSaldoFinal = saldoAnterior + calculatedSaldoActual + totalPagos - totalCobros;

            return {
                ...newValues,
                comision_pasador: calculatedComision,
                saldo_actual: calculatedSaldoActual,
                saldo_final: calculatedSaldoFinal,
                saldo_total: calculatedSaldoFinal, // Keep saldo_total consistent with saldo_final
            };
        });
    };

    const handleSave = async () => {
        if (!editingRecordId) return

        setIsSaving(true)
        setError(null)
        try {
            const docRef = doc(db, 'saldos_diarios', editingRecordId)
            await setDoc(
                docRef,
                {
                    ...editedValues,
                    timestamp: format(new Date(), 'dd/MM/yy HH:mm'), // Update timestamp on save
                },
                { merge: true }
            )
            toast.success('Registro actualizado exitosamente!')
            setEditingRecordId(null)
            setEditedValues({})
            fetchDailyRecords() // Re-fetch to update the table with latest data
        } catch (err) {
            console.error('Error saving record:', err)
            setError('Error al guardar el registro.')
            toast.error('Error al guardar el registro.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setEditingRecordId(null)
        setEditedValues({})
    }

    const renderCell = (record: SaldoDiarioDoc, field: keyof SaldoDiarioDoc) => {
        const isEditing = editingRecordId === record.id
        const value = isEditing ? editedValues[field] : record[field]

        const isEditableField = ['ventas_online', 'total_pagos', 'total_cobros', 'total_ganado'].includes(field as string)
        const isCalculatedField = ['comision_pasador', 'saldo_actual', 'saldo_final', 'saldo_total'].includes(field as string)

        if (isEditing && isEditableField) {
            return (
                <Input
                    type="number"
                    value={Number(value).toFixed(2)}
                    onChange={(e) => handleChange(field, e.target.value)}
                    className="w-24 h-7 text-xs p-1"
                />
            )
        } else if (isEditing && isCalculatedField) {
            return (
                <Input
                    type="number"
                    value={Number(value).toFixed(2)}
                    readOnly
                    className="w-24 h-7 text-xs p-1 bg-gray-100 text-gray-600"
                />
            )
        } else if (typeof value === 'number') {
            return formatearMoneda(value)
        }
        return String(value)
    }

    return (
        <div className="p-4">
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded my-4 shadow-md" role="alert">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                </div>
            )}

            {isLoadingRecords ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="ml-2 text-blue-600">Cargando registros...</p>
                </div>
            ) : dailyRecords.length === 0 ? (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded my-4 shadow-md" role="alert">
                    <p className="font-bold">Sin registros</p>
                    <p>No se encontraron registros diarios para este pasador en el rango de fechas seleccionado.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="min-w-[1000px] text-xs">
                        <TableHeader>
                            <TableRow className="bg-blue-100">
                                <TableHead>Fecha</TableHead>
                                <TableHead>S. Anterior</TableHead>
                                <TableHead>Jugado</TableHead>
                                <TableHead>Comisión</TableHead>
                                <TableHead>Premios</TableHead>
                                <TableHead>S. Actual</TableHead>
                                <TableHead>Pagado</TableHead>
                                <TableHead>Cobrado</TableHead>
                                <TableHead>S. Final</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dailyRecords.map((record) => (
                                <TableRow key={record.id} className={editingRecordId === record.id ? 'bg-blue-50' : ''}>
                                    <TableCell>{record.fecha}</TableCell>
                                    <TableCell>{formatearMoneda(record.saldo_anterior)}</TableCell>
                                    <TableCell>{renderCell(record, 'ventas_online')}</TableCell>
                                    <TableCell>{renderCell(record, 'comision_pasador')}</TableCell>
                                    <TableCell>{renderCell(record, 'total_ganado')}</TableCell>
                                    <TableCell>{renderCell(record, 'saldo_actual')}</TableCell>
                                    <TableCell>{renderCell(record, 'total_pagos')}</TableCell>
                                    <TableCell>{renderCell(record, 'total_cobros')}</TableCell>
                                    <TableCell>{renderCell(record, 'saldo_final')}</TableCell>
                                    <TableCell>
                                        {editingRecordId === record.id ? (
                                            <div className="flex gap-1">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50">
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar Guardar Cambios</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                ¿Estás seguro de que quieres guardar los cambios para este registro?
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel asChild>
                                                                <Button variant="outline">Cancelar</Button>
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction asChild>
                                                                <Button onClick={handleSave} disabled={isSaving}>
                                                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                                                                </Button>
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-red-600 hover:bg-red-50">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            <div className="mt-4 flex justify-end">
                <Button onClick={onClose} variant="outline">
                    Cerrar
                </Button>
            </div>
        </div>
    )
}
