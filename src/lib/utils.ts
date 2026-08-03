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
