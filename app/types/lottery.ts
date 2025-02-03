export const PROVINCIAS = {
    'Ciudad': 'NACION',
    'Provincia': 'PROVINCIA',
    'Córdoba': 'CORDOBA',
    'Mendoza': 'MENDOZA',
    'Montevideo': 'URUGUAY',
    'Corrientes': 'CORRIENTES',
    'Santa Fe': 'SANTA FE',
    'Entre Ríos': 'ENTRE RIOS',
    'Chaco': 'CHACO'
} as const

export const TURNOS = {
    'PREVIA': 'PREVIA',
    'PRIMERA': 'PRIMERA',
    'MATUTINA': 'MATUTINA',
    'VESPERTINA': 'VESPERTINA',
    'NOCTURNA': 'NOCTURNA'
} as const

export const HORARIOS = {
    'PREVIA': '10:15',
    'PRIMERA': '11:30',
    'MATUTINA': '15:00',
    'VESPERTINA': '17:30',
    'NOCTURNA': '21:00'
} as const

export const ORDEN_TURNOS = ['PREVIA', 'PRIMERA', 'MATUTINA', 'VESPERTINA', 'NOCTURNA'] as const

export type Provincia = keyof typeof PROVINCIAS
export type ProvinciaValue = typeof PROVINCIAS[Provincia]
export type Turno = keyof typeof TURNOS
export type TurnoValue = typeof TURNOS[Turno]

export interface Extracto {
    id: string
    fecha: string
    dia: string
    sorteo: string
    loteria: string
    necesita: string
    confirmado: string
    numeros: string[]
}

