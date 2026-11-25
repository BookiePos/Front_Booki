/**
 * La venta que el cajero está armando, guardada en el navegador.
 *
 * Antes vivía solo en memoria: un F5 sin querer, el navegador que se cierra o
 * el equipo que se reinicia a mitad de un pedido de diez productos y el cajero
 * tenía que volver a marcarlo todo con el cliente esperando. Las cuentas de
 * mesa ya se guardan en el servidor; esto cubre la venta directa.
 *
 * Se guarda lo mínimo —qué producto, cuántos y su descuento— y al recuperar se
 * cruza con el catálogo recién cargado: el precio sale siempre del catálogo de
 * hoy, nunca de lo guardado, y lo que ya no existe o se agotó no vuelve.
 *
 * Va en `localStorage` (sobrevive a cerrar el navegador) con una vigencia de
 * doce horas: la venta a medias de ayer no debe aparecerle al turno de hoy.
 */
import type { PosProduct } from "@/lib/pos/api-sales"

export interface LineaGuardada {
  id: string
  qty: number
  discountId?: string
}

export interface VentaGuardada {
  v: 1
  guardada: number
  lineas: LineaGuardada[]
}

interface LineaCarrito {
  product: PosProduct
  qty: number
  discountId?: string
}

export const VIGENCIA_VENTA_MS = 12 * 60 * 60 * 1000

export const claveVentaEnCurso = (sedeId: string) => `pos.ventaEnCurso.${sedeId}`

export function serializarVenta(cart: LineaCarrito[], ahora = Date.now()): VentaGuardada {
  return {
    v: 1,
    guardada: ahora,
    lineas: cart.map((i) => ({
      id: i.product._id,
      qty: i.qty,
      ...(i.discountId ? { discountId: i.discountId } : {}),
    })),
  }
}

/** Lee lo guardado; `null` si no hay, está vencido o no se entiende. */
export function interpretarVenta(crudo: string | null, ahora = Date.now()): VentaGuardada | null {
  if (!crudo) return null
  try {
    const v = JSON.parse(crudo) as Partial<VentaGuardada>
    if (v?.v !== 1 || typeof v.guardada !== "number" || !Array.isArray(v.lineas)) return null
    if (ahora - v.guardada > VIGENCIA_VENTA_MS || v.guardada > ahora + 60_000) return null
    return v as VentaGuardada
  } catch {
    return null
  }
}

/**
 * Arma el carrito con el catálogo actual. Respeta las existencias igual que
 * el botón de agregar: nunca más unidades de las que hay.
 */
export function restaurarCarrito<T extends PosProduct>(
  guardada: VentaGuardada | null,
  productos: T[],
): { product: T; qty: number; discountId?: string }[] {
  if (!guardada) return []
  const porId = new Map(productos.map((p) => [p._id, p]))
  const out: { product: T; qty: number; discountId?: string }[] = []
  for (const l of guardada.lineas) {
    const p = porId.get(l.id)
    if (!p || typeof l.qty !== "number" || !(l.qty > 0) || p.stock <= 0) continue
    const qty = Math.min(l.qty, p.stock)
    out.push({ product: p, qty, ...(l.discountId ? { discountId: l.discountId } : {}) })
  }
  return out
}

// ── Acceso al navegador ──────────────────────────────────────────────────────
// Cualquier fallo (ventana privada, almacenamiento lleno) se ignora: no poder
// guardar la venta nunca debe impedir venderla.

export function guardarVentaEnCurso(sedeId: string, cart: LineaCarrito[]): void {
  try {
    if (cart.length === 0) window.localStorage.removeItem(claveVentaEnCurso(sedeId))
    else window.localStorage.setItem(claveVentaEnCurso(sedeId), JSON.stringify(serializarVenta(cart)))
  } catch {
    /* sin almacenamiento: se sigue vendiendo igual */
  }
}

export function leerVentaEnCurso(sedeId: string): VentaGuardada | null {
  try {
    return interpretarVenta(window.localStorage.getItem(claveVentaEnCurso(sedeId)))
  } catch {
    return null
  }
}
