import { db, auth } from './firebase';
import { collection, query, where, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, UserCredential } from 'firebase/auth';

interface User {
    username: string;
    email: string;
    uid: string;
    createdAt: string;
    lastLoginAt: string;
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const userDoc = await getDoc(doc(db, 'users', username));
    if (userDoc.exists()) {
        return userDoc.data() as User;
    }
    return null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }

    return querySnapshot.docs[0].data() as User;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
    const user = await getUserByUsername(username);
    return user === null;
}

export async function getUsernameByUid(uid: string): Promise<string | null> {
    try {
        const q = query(collection(db, 'users'), where('uid', '==', uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data() as User;
            return userData.username;
        }
        return null;
    } catch (error) {
        console.error('Error fetching username:', error);
        return null;
    }
}

export async function registerUser(email: string, password: string, username: string): Promise<User> {
    const isAvailable = await isUsernameAvailable(username);
    if (!isAvailable) {
        throw new Error('El nombre de usuario ya está en uso');
    }

    let userCredential: UserCredential;
    try {
        // Crear usuario en Firebase Authentication
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        console.error('Error al crear usuario en Firebase Auth:', error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('El correo electrónico ya está en uso');
        }
        throw new Error('Error al crear la cuenta. Por favor, inténtalo de nuevo.');
    }

    if (!userCredential.user) {
        throw new Error('No se pudo crear el usuario en Firebase Auth');
    }

    const uid = userCredential.user.uid;

    try {
        // Crear el documento del usuario en Firestore usando el username como ID
        const userData: User = {
            username,
            email,
            uid,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'users', username), userData);

        return userData;
    } catch (error: any) {
        console.error('Error al guardar usuario en Firestore:', error);
        // Si falla la creación en Firestore, intentamos eliminar el usuario de Firebase Auth
        try {
            await userCredential.user.delete();
        } catch (deleteError) {
            console.error('Error al eliminar usuario de Firebase Auth después de fallo en Firestore:', deleteError);
        }
        throw new Error('Error al guardar la información del usuario. Por favor, inténtalo de nuevo.');
    }
}

export async function loginUser(identifier: string, password: string): Promise<User> {
    try {
        let email: string;
        let userData: User | null;

        // Verificar si el identificador es un email o un nombre de usuario
        if (identifier.includes('@')) {
            email = identifier;
            userData = await getUserByEmail(email);
        } else {
            userData = await getUserByUsername(identifier);
            if (userData) {
                email = userData.email;
            } else {
                throw new Error('Usuario no encontrado');
            }
        }

        if (!userData) {
            throw new Error('Usuario no encontrado');
        }

        // Autenticar con Firebase
        await signInWithEmailAndPassword(auth, email, password);

        // Actualizar la fecha de último acceso
        userData.lastLoginAt = new Date().toISOString();
        await setDoc(doc(db, 'users', userData.username), userData, { merge: true });

        return userData;
    } catch (error: any) {
        console.error('Error en loginUser:', error);
        throw error;
    }
}

