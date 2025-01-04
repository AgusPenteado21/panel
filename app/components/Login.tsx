"use client"

import { useState } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'

interface LoginProps {
    onLogin: (username: string) => void;
    onSwitchToRegister: () => void;
}

export default function Login({ onLogin, onSwitchToRegister }: LoginProps) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (identifier && password) {
            setIsLoading(true);
            setError('');
            try {
                let email = identifier;
                if (!identifier.includes('@')) {
                    // Si no es un email, buscamos el usuario por nombre de usuario
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where("username", "==", identifier));
                    const querySnapshot = await getDocs(q);
                    if (querySnapshot.empty) {
                        throw new Error('Usuario no encontrado');
                    }
                    email = querySnapshot.docs[0].data().email;
                }

                // Verificar si el usuario está bloqueado
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where("email", "==", email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    if (userData.isBlocked) {
                        throw new Error('Este usuario ha sido bloqueado por el administrador');
                    }
                }

                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Obtener el nombre de usuario
                const usernameQuery = query(usersRef, where("email", "==", user.email));
                const usernameSnapshot = await getDocs(usernameQuery);
                if (usernameSnapshot.empty) {
                    throw new Error('Usuario no encontrado en la base de datos');
                }
                const username = usernameSnapshot.docs[0].data().username;

                onLogin(username);
            } catch (err: any) {
                console.error('Error al iniciar sesión:', err);
                setError(err.message || 'Error al iniciar sesión');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">Iniciar sesión</CardTitle>
                <CardDescription className="text-center">
                    Ingresa con tu email o nombre de usuario
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="identifier">Email o nombre de usuario</Label>
                        <Input
                            id="identifier"
                            type="text"
                            placeholder="Ingresa tu email o nombre de usuario"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
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
                        />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Iniciando sesión...
                            </>
                        ) : (
                            'Iniciar sesión'
                        )}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="flex justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    ¿No tienes una cuenta?{' '}
                    <Button variant="link" onClick={onSwitchToRegister} className="p-0">
                        Regístrate
                    </Button>
                </p>
            </CardFooter>
        </Card>
    );
}

