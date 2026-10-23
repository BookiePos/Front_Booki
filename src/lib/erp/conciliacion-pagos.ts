/**
 * Reglas de la conciliación de pagos digitales (ítem 6.4) que la pantalla
 * necesita antes de hablar con el servidor. El servidor recalcula todo: esto
 * solo sirve para mostrar la diferencia mientras se escribe y para no subir una
 * imagen que el servidor va a rechazar.
 */
import type { ReconSettlement } from "@/lib/erp/api-finance"

export interface ExtractoCifras {
  statementAmount: number
  commission?: number
  commissionIva?: number
  retefuente?: number
  reteIca?: number
  reteIva?: number
}

/** Cobrado − (consignado + comisión + IVA + retenciones). 0 = cuadra. */
export function diferenciaConciliacion(
  esperado: number,
  c: ExtractoCifras,
): number {
  const explicado =
    Math.round(c.statementAmount) +
    Math.round(c.commission ?? 0) +
    Math.round(c.commissionIva ?? 0) +
    Math.round(c.retefuente ?? 0) +
    Math.round(c.reteIca ?? 0) +
    Math.round(c.reteIva ?? 0)
  return Math.round(esperado) - explicado
}

export type EstadoConciliacion = "pendiente" | "conciliado" | "diferencia"

export function estadoConciliacion(
  s: Pick<ReconSettlement, "status"> | null,
): EstadoConciliacion {
  if (!s) return "pendiente"
  return s.status === "reconciled" ? "conciliado" : "diferencia"
}

/**
 * Topes del servidor (el cuerpo JSON de Express admite 100 KB): el QR hasta
 * 70 KB de imagen (~94 KB en base64) y el CSV del extracto hasta 90 KB.
 */
export const QR_MAX_BYTES = 70_000
export const CSV_MAX_BYTES = 90_000

/** Por qué no se puede subir esa imagen de QR, o `null` si sirve. */
export function validarImagenQr(tipo: string, bytes: number): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(tipo)) {
    return "El QR tiene que ser una imagen PNG, JPG o WEBP."
  }
  if (bytes > QR_MAX_BYTES) {
    return "La imagen pesa mucho: usa una de menos de 70 KB."
  }
  return null
}

/** Por qué no se puede subir ese extracto, o `null` si cabe. */
export function validarCsv(bytes: number): string | null {
  if (bytes > CSV_MAX_BYTES) {
    return "El extracto pesa más de 90 KB: divídelo por semanas o por canal."
  }
  return null
}
