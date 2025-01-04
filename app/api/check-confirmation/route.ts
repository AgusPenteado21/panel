import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
export const dynamic = "force-static"; // Para rutas que deben ser estáticas

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email no proporcionado' }, { status: 400 });
        }

        const user = auth.currentUser;

        if (!user || user.email !== email) {
            return NextResponse.json({ error: 'Usuario no encontrado o no coincide' }, { status: 404 });
        }

        await user.reload(); // Recargar el usuario para obtener el estado más reciente

        return NextResponse.json({ isConfirmed: user.emailVerified });
    } catch (error) {
        console.error('Error en check-confirmation:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

