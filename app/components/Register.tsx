"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, CheckCircle } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { createUserWithEmailAndPassword, sendEmailVerification, User, fetchSignInMethodsForEmail } from 'firebase/auth'
import { doc, setDoc, collection, query, getDocs, where } from 'firebase/firestore'

interface RegisterProps {
    onSwitchToLogin: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isRegistered, setIsRegistered] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)

    const validatePassword = (password: string): boolean => {
        return /^\d{6,}$/.test(password);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validatePassword(password)) {
            setError('La contraseña es poco segura. Por favor, usa una contraseña de 6 dígitos o más.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);
        try {
            // Verificar si el nombre de usuario ya existe
            const usernameQuery = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
            if (!usernameQuery.empty) {
                setError('El nombre de usuario ya está en uso');
                setIsLoading(false);
                return;
            }

            // Verificar si el correo electrónico existe en Firebase Authentication
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods.length > 0) {
                setError('El correo electrónico ya está registrado en el sistema de autenticación');
                setIsLoading(false);
                return;
            }

            // Verificar si el correo electrónico existe en Firestore
            const emailQuery = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
            if (!emailQuery.empty) {
                setError('El correo electrónico existe en la base de datos pero no en el sistema de autenticación. Por favor, contacta al soporte.');
                setIsLoading(false);
                return;
            }

            // Crear un nuevo usuario en Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Enviar email de verificación
            await sendEmailVerification(user);

            // Guardar información en Firestore
            await setDoc(doc(db, 'users', user.uid), {
                username,
                email,
                isConfirmed: false,
                createdAt: new Date().toISOString(),
                isAdmin: true, // Marcar al usuario como administrador
                registrationSource: 'web' // Indicar que el registro fue a través de la web
            });

            setIsRegistered(true);
        } catch (err: any) {
            console.error('Error durante el registro:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('El correo electrónico ya está en uso en el sistema de autenticación, pero no en la base de datos. Por favor, contacta al soporte.');
            } else {
                setError(err.message || 'Error al registrar: Por favor, inténtalo de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const checkConfirmationStatus = async () => {
        if (!isRegistered || !auth.currentUser) return;

        try {
            await auth.currentUser.reload()
            setIsConfirmed(auth.currentUser.emailVerified)
        } catch (err) {
            console.error('Error al verificar el estado de confirmación:', err)
            setError('Error al verificar la confirmación del correo. Por favor, intenta más tarde.')
        }
    }

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRegistered && !isConfirmed) {
            interval = setInterval(checkConfirmationStatus, 5000) // Verifica cada 5 segundos
        }
        return () => clearInterval(interval)
    }, [isRegistered, isConfirmed])

    if (isRegistered) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">
                        {isConfirmed ? 'Registro Completado' : 'Registro Exitoso'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isConfirmed
                            ? 'Tu cuenta ha sido confirmada exitosamente.'
                            : `Se ha enviado un correo de confirmación a ${email}. Por favor, verifica tu bandeja de entrada y sigue las instrucciones para confirmar tu cuenta.`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    {isConfirmed
                        ? <CheckCircle className="h-16 w-16 text-green-500 animate-bounce" />
                        : <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    }
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button onClick={onSwitchToLogin}>
                        Ir al inicio de sesión
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">Registro</CardTitle>
                <CardDescription className="text-center">
                    Crea una nueva cuenta para acceder a la plataforma
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Nombre de usuario</Label>
                        <Input
                            id="username"
                            type="text"
                            placeholder="Ingresa tu nombre de usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="Ingresa tu correo electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Ingresa tu contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirma tu contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Registrando...
                            </>
                        ) : (
                            'Registrarse'
                        )}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="flex justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    ¿Ya tienes una cuenta?{' '}
                    <Button variant="link" onClick={onSwitchToLogin} className="p-0">
                        Inicia sesión
                    </Button>
                </p>
            </CardFooter>
        </Card>
    )
}

