"use client"

import { usePathname } from "next/navigation"
import type { CSSProperties } from "react"

/**
 * Fondo del panel y del POS: tres manchas violeta apagadas y, encima, un
 * puntillismo fino que se concentra donde están las manchas (decisión de
 * Paulo, 20-nov-2026).
 *
 * Cada sección tiene su propia composición. Al cambiar de sección las manchas
 * se deslizan a su nuevo sitio en 1,6 s: casi no se nota, pero la pantalla no
 * se siente la misma en Ventas que en Nómina. Todo es CSS (gradientes y un
 * ruido SVG como máscara): nada de imágenes ni de JS por cuadro.
 */

type Mancha = [x: number, y: number, tam: number]
interface Composicion {
  manchas: [Mancha, Mancha, Mancha]
  /** Cuánto tira la segunda mancha hacia el índigo (0) o hacia el ciruela (1). */
  tono: number
}

// Posiciones en % del viewport y tamaño en vmax. Curadas a mano, no al azar:
// siempre una mancha grande fuera de la esquina superior, nunca detrás del
// centro de la tabla, y el puntillismo cae en los bordes de la pantalla.
const COMPOSICIONES: Composicion[] = [
  { manchas: [[88, -6, 48], [6, 104, 40], [52, 46, 22]], tono: 0.3 },
  { manchas: [[-4, 12, 44], [96, 92, 46], [70, 30, 20]], tono: 0.7 },
  { manchas: [[104, 40, 42], [18, -10, 36], [30, 96, 28]], tono: 0.5 },
  { manchas: [[60, -14, 50], [-8, 70, 38], [100, 100, 26]], tono: 0.15 },
  { manchas: [[92, 70, 44], [10, 6, 34], [46, 108, 30]], tono: 0.85 },
  { manchas: [[24, 104, 46], [102, 4, 40], [80, 56, 18]], tono: 0.4 },
  { manchas: [[-10, 40, 40], [74, -8, 42], [96, 96, 30]], tono: 0.6 },
  { manchas: [[50, 110, 52], [100, 20, 34], [4, 2, 26]], tono: 0.25 },
]

// Secciones conocidas en orden de menú: dos vecinas nunca comparten composición.
const SECCIONES = [
  "",
  "hoy",
  "pos",
  "caja",
  "restaurante",
  "productos",
  "inventario",
  "produccion",
  "compras",
  "proveedores",
  "clientes",
  "facturacion",
  "finanzas",
  "impuestos",
  "nomina",
  "empleados",
  "turnos",
  "sedes",
  "resoluciones",
  "auditoria",
  "config",
  "ventas",
  "historial",
  "pedidos",
  "cocina",
]

function composicionDe(pathname: string): Composicion {
  const seccion = pathname.split("/")[2] ?? ""
  let i = SECCIONES.indexOf(seccion)
  if (i < 0) {
    // Sección nueva: un índice estable por su nombre.
    i = [...seccion].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  }
  // El POS arranca desplazado para que "Venta" no repita la de "Inicio".
  const zona = pathname.startsWith("/pos") ? 3 : 0
  return COMPOSICIONES[(i + zona) % COMPOSICIONES.length]
}

export function FondoLibro() {
  const pathname = usePathname() ?? ""
  const c = composicionDe(pathname)
  const vars = {} as Record<string, string>
  c.manchas.forEach(([x, y, t], n) => {
    vars[`--m${n + 1}x`] = `${x}%`
    vars[`--m${n + 1}y`] = `${y}%`
    vars[`--m${n + 1}t`] = `${t}vmax`
  })
  vars["--m-tono"] = `${Math.round(c.tono * 100)}%`
  return (
    <div aria-hidden className="fondo-libro" style={vars as CSSProperties}>
      <div className="fondo-libro-manchas" />
      <div className="fondo-libro-puntos" />
    </div>
  )
}
