"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, CheckCircle } from 'lucide-react'

export default function EmailConfirmation() {
    const [isConfirming, setIsConfirming] = useState(true)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    useEffect(() => {
        const confirmEmail = async () => {
            if (!token) {
                setError('Token de confirmación no proporcionado')
                setIsConfirming(false)
                return
            }

            try {
                const response = await fetch(`/api/confirm-email?token=${token}`, {
                    method: 'GET',
                })

                const data = await response.json()

                if (response.ok) {
                    setIsConfirmed(true)
                } else {
                    setError(data.error || 'Error al confirmar el correo electrónico')
                }
            } catch (err) {
                setError('Error al confirmar el correo: Por favor, inténtalo de nuevo.')
            } finally {
                setIsConfirming(false)
            }
        }

        confirmEmail()
    }, [token])

    useEffect(() => {
        if (isConfirmed) {
            const timer = setTimeout(() => {
                router.push('/login')
            }, 3000)

            return () => clearTimeout(timer)
        }
    }, [isConfirmed, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">
                        {isConfirming ? 'Confirmando correo electrónico' : (isConfirmed ? 'Correo confirmado' : 'Error de confirmación')}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isConfirming ? 'Por favor, espera mientras confirmamos tu correo electrónico...' :
                            (isConfirmed ? 'Tu correo electrónico ha sido confirmado exitosamente.' : 'Hubo un problema al confirmar tu correo electrónico.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    {isConfirming ? (
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    ) : (
                        isConfirmed ? (
                            <CheckCircle className="h-16 w-16 text-green-500 animate-bounce" />
                        ) : (
                            <p className="text-red-500">{error}</p>
                        )
                    )}
                </CardContent>
                {isConfirmed && (
                    <CardContent className="flex justify-center">
                        <p className="text-sm text-gray-500">Redirigiendo al inicio de sesión en 3 segundos...</p>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}

