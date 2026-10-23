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

/** Tope del QR como imagen: el servidor admite ~150 KB en base64. */
export const QR_MAX_BYTES = 110_000

/** Por qué no se puede subir esa imagen de QR, o `null` si sirve. */
export function validarImagenQr(tipo: string, bytes: number): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(tipo)) {
    return "El QR tiene que ser una imagen PNG, JPG o WEBP."
  }
  if (bytes > QR_MAX_BYTES) {
    return "La imagen pesa mucho: usa una de menos de 100 KB."
  }
  return null
}
