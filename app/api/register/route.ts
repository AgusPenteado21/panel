import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { isUsernameAvailable } from '@/lib/userUtils';
export const dynamic = "force-static"; // Para rutas que deben ser estáticas

export async function POST(request: Request) {
    try {
        const { username, email, password } = await request.json();

        if (!username || !email || !password) {
            return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
        }

        // Verificar si el nombre de usuario está disponible
        const isAvailable = await isUsernameAvailable(username);
        if (!isAvailable) {
            return NextResponse.json({ error: 'El nombre de usuario ya está en uso' }, { status: 400 });
        }

        // Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Guardar información adicional en Firestore
        await setDoc(doc(db, 'users', user.uid), {
            username,
            email,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: 'Usuario registrado exitosamente', userId: user.uid });
    } catch (error: any) {
        console.error('Error en el registro:', error);
        return NextResponse.json({ error: error.message || 'Error en el registro' }, { status: 500 });
    }
}

