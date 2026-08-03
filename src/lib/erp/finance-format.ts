/** Formateadores y helpers compartidos por las páginas de Finanzas. */
import { ApiError } from "@/lib/api"

export const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Fecha local en formato YYYY-MM-DD (sin desfases de zona horaria). */
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA")
}

/** Primer día del mes actual en YYYY-MM-DD. */
export function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}

/** Muestra una fecha YYYY-MM-DD como dd/mm/aaaa (sin tocar zona horaria). */
export function fmtDate(iso?: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/** Convierte un string de input a número entero seguro. */
export function numOr(v: string, d = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : d
}
