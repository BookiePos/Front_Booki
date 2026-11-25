import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un valor numérico como pesos colombianos (COP), sin decimales.
 * Usar junto a la clase `.tnum` para números tabulares alineados.
 */
export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Formatea un número entero con separador de miles (es-CO): 150000 → "150.000".
 * Sin símbolo de moneda — para cuando el "$" ya está en el marcado.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value)
}

/** Acota un valor al rango [min, max]. Lo usan las animaciones de scroll. */
export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * "1 producto", "3 productos". En caja nadie lee "3 ítem(s)": el paréntesis es
 * de formulario, no de mostrador, y obliga a leer dos veces.
 */
export function contar(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`
}

/**
 * Quién hizo algo, como lo lee un cajero: el nombre guardado y, en registros
 * viejos que solo traen el correo, lo que va antes de la arroba.
 */
export function quien(nombre?: string | null, correo?: string | null): string {
  return nombre?.trim() || correo?.split("@")[0] || "—"
}
