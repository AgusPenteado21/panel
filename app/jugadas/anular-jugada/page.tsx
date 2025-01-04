'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import Navbar from '../../components/Navbar'

export default function AnularJugadaPage() {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // Handle form submission
    }

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <Navbar />
            <main className="flex-grow p-4">
                <Card className="max-w-2xl mx-auto border border-black">
                    <CardHeader className="bg-black text-white">
                        <CardTitle className="text-xl">Anular Jugada</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <div className="bg-black text-white p-2">
                                    Ingrese el Número de Secuencia
                                </div>
                                <Input
                                    type="text"
                                    className="w-full border-black"
                                    required
                                />
                            </div>
                            <div className="flex justify-center gap-4">
                                <Button type="submit" className="bg-black text-white hover:bg-gray-800">
                                    Aceptar
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-black text-black hover:bg-gray-100"
                                    onClick={() => window.history.back()}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

