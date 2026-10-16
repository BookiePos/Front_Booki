import { ApiError } from "@/lib/api"
import { type InvProduct } from "@/lib/erp/api-inventory"
import {
  precioDePresentacion,
  presentacionDeCompra,
} from "@/lib/erp/purchase-unit"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Enlaza el botón Guardar del pie del diálogo con el <form> del cuerpo. */
export const VARIANTS_FORM_ID = "ficha-producto-variantes"
export const PRODUCT_FORM_ID = "ficha-producto-inventario"
export const ENTRY_FORM_ID = "ficha-entrada-mercancia"
export const ADJUST_FORM_ID = "ficha-ajuste-inventario"
export const TRANSFER_FORM_ID = "ficha-traslado-sedes"

export const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
// Totales en plata: la caja colombiana no maneja centavos.
export const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})
// Para costos unitarios pequeños (tras conversión de unidades) que se
// distorsionarían al redondear a 0 decimales (ej. $8,33 por gramo).
export const moneyUnit = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Muestra un costo unitario en la presentación en que se COMPRA el insumo:
 * $3,80 el gramo guardado se lee como "$95.000 / bulto", que es el número que
 * el dueño reconoce. Sin presentación definida se muestra por su unidad.
 */
export function formatUnitCost(
  cost: number,
  p: Pick<InvProduct, "unit" | "purchaseUnit" | "purchaseFactor">,
): string {
  const pres = presentacionDeCompra(p)
  return `${moneyUnit.format(precioDePresentacion(cost, pres.factor))} / ${pres.unidad}`
}
export const df = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" })
// Los vencimientos se guardan como fecha pura (medianoche UTC); se formatean
// en UTC para que no se corran un día por la zona horaria local.
export const dfUTC = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "UTC",
})
export const dtf = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
})

/** Normaliza para comparar nombres: minúsculas, sin tildes ni espacios extra. */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}
