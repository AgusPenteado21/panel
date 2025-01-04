import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { getUserByUsername } from '@/lib/userUtils';
export const dynamic = "force-static"; // Para rutas que deben ser estáticas

export async function POST(request: Request) {
    try {
        const { identifier, password } = await request.json();

        if (!identifier || !password) {
            return NextResponse.json({ error: 'Identificador y contraseña son requeridos' }, { status: 400 });
        }

        let email = identifier;
        if (!identifier.includes('@')) {
            // Si no es un email, buscamos el usuario por nombre de usuario
            const user = await getUserByUsername(identifier);
            if (!user) {
                return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
            }
            email = user.email;
        }

        console.log('Intento de inicio de sesión para:', email);

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user) {
            console.log('Inicio de sesión exitoso para:', email);
            return NextResponse.json({ message: 'Inicio de sesión exitoso', user: { uid: user.uid, email: user.email } });
        } else {
            return NextResponse.json({ error: 'Error desconocido durante el inicio de sesión' }, { status: 500 });
        }
    } catch (error) {
        const authError = error as AuthError;
        console.log('Inicio de sesión fallido:', authError.code, authError.message);
        return NextResponse.json({ error: 'Credenciales inválidas o usuario no confirmado' }, { status: 401 });
    }
}

