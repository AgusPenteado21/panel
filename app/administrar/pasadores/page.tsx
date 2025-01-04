import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import PasadoresClient from './pasadores-client'

export default function PasadoresPage() {
    return (
        <div className="min-h-screen bg-background">
            <Suspense fallback={
                <div className="flex h-screen items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            }>
                <PasadoresClient />
            </Suspense>
        </div>
    )
}

