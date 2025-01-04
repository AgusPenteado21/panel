"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, User, LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext'

type MenuItem = {
    titulo: string;
    href?: string;
    submenu?: (MenuItem | string)[];
}

const elementosMenu: MenuItem[] = [
    {
        titulo: "acreditaciones",
        submenu: [
            {
                titulo: "pasadores",
                submenu: [
                    "ingresar pagos y cobros",
                    "pago a pasador",
                    "cobro a pasador",
                    "reclamos a pasador",
                    "ajustes pasador",
                    "listado de pagos y cobros a pasadores"
                ]
            },
            "pagos y cobros de borras",
            {
                titulo: "deje pasadores",
                submenu: [
                    "listado de arrastre de pasadores",
                    "procesar deje",
                    "procesar deje apuestas"
                ]
            },
            {
                titulo: "distribuidores",
                submenu: [
                    "pago a distribuidores",
                    "cobro a distribuidores",
                    "listado de pagos realizados por distribuidores a pasadores",
                    "listado de cobros realizados por distribuidores a pasadores"
                ]
            },
            {
                titulo: "crédito acordado",
                submenu: [
                    "listado de créditos acordados activos",
                    "listado de créditos acordados según cliente",
                    "alta de crédito acordado",
                    "alta de crédito acordado en cuotas"
                ]
            }
        ]
    },
    {
        titulo: "administrar",
        submenu: [
            "pasadores",
            "terminales",
            "listas de precio",
            "pasadores por correo",
            "usuarios"
        ]
    },
    {
        titulo: "jugadas",
        submenu: [
            "cargar redoblonas de un pasador",
            "cargar exactas de un pasador",
            {
                titulo: "cargar borras",
                submenu: [
                    "cargar triplonas de un pasador",
                    "cargar quintinas de un pasador",
                    "cargar borratinas de un pasador"
                ]
            },
            "panel de control",
            {
                titulo: "listado de jugadas",
                submenu: [
                    "listado de jugadas agrupadas por ticket",
                    "buscar jugadas por pasador",
                    "listado jugadas quiniela y exacta",
                    "listado jugadas quiniela agrupadas",
                    "listado jugadas quiniela a las 3 cifras agrupadas",
                    "listado jugadas quiniela a las 4 cifras agrupadas",
                    "listado jugadas quiniela a las 4 cifras",
                    "listado jugadas redoblona",
                    "listado jugadas borratinas",
                    "listado de aciertos",
                    "listado de jugadas cargadas fuera de horario",
                    "jugadas duplicadas",
                    "listado de tickets anulados"
                ]
            },
            {
                titulo: "listado de anuladas",
                submenu: [
                    {
                        titulo: "listado jugadas anuladas agrupadas",
                        href: "/jugadas/listado-de-anuladas/listado-jugadas-anuladas-agrupadas"
                    },
                    "listado anuladas por pasador por día",
                    "ver detalle de anulaciones por pasador"
                ]
            },
            "anular jugada",
            "buscar jugada quiniela"
        ]
    },
    { titulo: "sorteos", href: "/sorteos" },
    { titulo: "extractos", href: "/extractos" },
    { titulo: "mensajes a pasadores", href: "/mensajes-a-pasadores" },
    {
        titulo: "consultas",
        submenu: [
            "resumen diario por pasador",
            "rendicion de caja por pasador",
            "resumen diario todos los pasadores",
            "listado totales de pasadores por día",
            "consulta de saldo"
        ]
    }
]

const ElementoMenu: React.FC<{ item: MenuItem }> = React.memo(({ item }) => {
    const [estaAbierto, setEstaAbierto] = React.useState(false)
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = React.useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setEstaAbierto(true)
    }, [])

    const handleMouseLeave = React.useCallback(() => {
        timeoutRef.current = setTimeout(() => setEstaAbierto(false), 300)
    }, [])

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    if (item.href) {
        return (
            <Link
                href={item.href}
                className="px-2 py-1 rounded-md text-xs font-medium flex items-center whitespace-nowrap transition-all duration-300 ease-in-out hover:bg-gray-700 hover:text-white"
            >
                <span className="relative overflow-hidden">
                    {item.titulo}
                    <span className="absolute left-0 bottom-0 w-full h-0.5 bg-white transform scale-x-0 transition-transform duration-300 origin-left group-hover:scale-x-100"></span>
                </span>
            </Link>
        )
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className="px-2 py-1 rounded-md text-xs font-medium flex items-center whitespace-nowrap transition-all duration-300 ease-in-out hover:bg-gray-700 hover:text-white"
                aria-expanded={estaAbierto}
                aria-haspopup="true"
            >
                <span className="relative overflow-hidden">
                    {item.titulo}
                    <span className="absolute left-0 bottom-0 w-full h-0.5 bg-white transform scale-x-0 transition-transform duration-300 origin-left group-hover:scale-x-100"></span>
                </span>
                {item.submenu && <ChevronDown className="ml-1 h-3 w-3 transition-transform duration-300 ease-in-out" style={{ transform: estaAbierto ? 'rotate(180deg)' : 'rotate(0deg)' }} aria-hidden="true" />}
            </button>
            {item.submenu && estaAbierto && (
                <div className="absolute left-0 mt-1 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 transition-opacity duration-300 ease-in-out opacity-100">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        {item.submenu.map((subItem, subIndex) => (
                            <ElementoSubmenu key={subIndex} item={subItem} tituloParent={item.titulo} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
})

ElementoMenu.displayName = 'ElementoMenu'

const ElementoSubmenu: React.FC<{ item: MenuItem | string; tituloParent: string }> = React.memo(({ item, tituloParent }) => {
    const [estaAbierto, setEstaAbierto] = React.useState(false)
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = React.useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setEstaAbierto(true)
    }, [])

    const handleMouseLeave = React.useCallback(() => {
        timeoutRef.current = setTimeout(() => setEstaAbierto(false), 300)
    }, [])

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    const getHref = (item: MenuItem | string, tituloParent: string): string => {
        if (typeof item === 'string') {
            return `/${tituloParent.toLowerCase()}/${item.toLowerCase().replace(/ /g, '-')}`
        }
        return item.href || `/${tituloParent.toLowerCase()}/${item.titulo.toLowerCase().replace(/ /g, '-')}`
    }

    const href = getHref(item, tituloParent)

    if (typeof item === 'string' || 'href' in item) {
        return (
            <Link
                href={href}
                className="block px-4 py-2 text-xs text-white hover:bg-gray-700 transition-colors duration-300 ease-in-out"
                role="menuitem"
            >
                <span className="relative overflow-hidden">
                    {typeof item === 'string' ? item : item.titulo}
                    <span className="absolute left-0 bottom-0 w-full h-0.5 bg-white transform scale-x-0 transition-transform duration-300 origin-left group-hover:scale-x-100"></span>
                </span>
            </Link>
        )
    }

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className="w-full text-left px-4 py-2 text-xs text-white hover:bg-gray-700 flex items-center justify-between transition-colors duration-300 ease-in-out"
                aria-expanded={estaAbierto}
                aria-haspopup="true"
            >
                <span className="relative overflow-hidden">
                    {item.titulo}
                    <span className="absolute left-0 bottom-0 w-full h-0.5 bg-white transform scale-x-0 transition-transform duration-300 origin-left group-hover:scale-x-100"></span>
                </span>
                {item.submenu && <ChevronRight className="h-3 w-3 transition-transform duration-300 ease-in-out" style={{ transform: estaAbierto ? 'rotate(90deg)' : 'rotate(0deg)' }} aria-hidden="true" />}
            </button>
            {item.submenu && estaAbierto && (
                <div className="absolute left-full top-0 mt-0 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 transition-opacity duration-300 ease-in-out opacity-100">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        {item.submenu.map((subItem, subIndex) => (
                            <ElementoSubmenu key={subIndex} item={subItem} tituloParent={`${tituloParent}/${item.titulo}`} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
})

ElementoSubmenu.displayName = 'ElementoSubmenu'

export default function Navbar() {
    const { isLoggedIn, username, logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <nav className="bg-black text-white" aria-label="Navegación principal">
            <div className="container mx-auto px-2">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center space-x-1">
                        {elementosMenu.map((item, index) => (
                            <ElementoMenu key={index} item={item} />
                        ))}
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center bg-gray-800 rounded-full px-2 py-1 transition-colors duration-300 ease-in-out hover:bg-gray-700">
                            <User className="h-3 w-3 mr-1 text-gray-300" aria-hidden="true" />
                            <span className="text-xs font-medium text-gray-300">usuario: {username}</span>
                        </div>
                        {isLoggedIn && (
                            <button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                className="flex items-center bg-red-600 hover:bg-red-700 text-white rounded-full px-2 py-1 text-xs font-medium transition-colors duration-300 ease-in-out disabled:opacity-50"
                            >
                                {isLoggingOut ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                                ) : (
                                    <LogOut className="h-3 w-3 mr-1" aria-hidden="true" />
                                )}
                                {isLoggingOut ? 'Saliendo...' : 'Salir'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}

