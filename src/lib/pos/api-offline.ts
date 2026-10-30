/**
 * Cliente HTTP del modo sin conexión (ítem 6.3) y lecturas con respaldo local.
 *
 * - `reservarConsecutivos` y `enviarVentaOffline` hablan con
 *   `/sales/offline/*` (permiso `pos.sell`, alcance por sede en el backend).
 * - `conRespaldo` envuelve una lectura del POS: si responde, guarda una copia
 *   en IndexedDB (por empresa y usuario); si la red falla, devuelve la copia.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import { ApiError } from "@/lib/api"
import { alcanceDeSesion, deviceId } from "@/lib/offline/alcance"
import {
  ConflictoOffline,
  guardarCopia,
  guardarReserva,
  leerCopia,
  type MotivoConflicto,
  type ReservaOffline,
  type SyncDto,
  type VentaOffline,
} from "@/lib/offline/cola"
import { hayIndexedDb } from "@/lib/offline/idb"
import { API_URL } from "@/lib/env"
import { posProducts, type PosProduct, type Sale } from "@/lib/pos/api-sales"
import { getCurrentCaja, type CurrentCaja } from "@/lib/pos/api-caja"
import { listSedes, type Sede } from "@/lib/pos/api-inventory"

/** ¿El error es de red (sin respuesta del servidor)? */
export function esFallaDeRed(err: unknown): boolean {
  if (err instanceof ApiError) return false
  if (err instanceof TypeError) return true
  return typeof navigator !== "undefined" && navigator.onLine === false
}

export async function reservarConsecutivos(
  sedeId: string,
  count?: number,
): Promise<ReservaOffline> {
  const a = alcanceDeSesion()
  if (!a) throw new Error("Sin sesión no hay modo sin conexión")
  const res = await authFetch("/sales/offline/reservations", {
    method: "POST",
    body: JSON.stringify({ sedeId, deviceId: deviceId(), count }),
  })
  const r = await parseResponse<Omit<ReservaOffline, "next">>(res)
  return guardarReserva(a, r)
}

/**
 * Manda una venta cobrada sin red. Un 409 `OFFLINE_CONFLICT` o un 400 se
 * vuelven `ConflictoOffline` (van a la bandeja con su motivo); lo demás
 * (red, 401, 5xx) sube igual para que la venta siga pendiente.
 */
export async function enviarVentaOffline(
  dto: SyncDto,
): Promise<{ status: "creada" | "duplicada"; saleNumber?: string }> {
  const res = await authFetch("/sales/offline/sync", {
    method: "POST",
    body: JSON.stringify(dto),
  })
  if (res.ok) {
    const r = (await res.json()) as {
      status: "creada" | "duplicada"
      sale?: { saleNumber?: string }
    }
    // El número real: si el cobro en línea sí había llegado, es un FV-.
    return { status: r.status, saleNumber: r.sale?.saleNumber }
  }
  let body: { code?: string; reason?: MotivoConflicto; message?: string | string[] } = {}
  try {
    body = (await res.clone().json()) as typeof body
  } catch {
    /* sin cuerpo JSON */
  }
  const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message
  if (res.status === 409 && body.code === "OFFLINE_CONFLICT" && body.reason) {
    throw new ConflictoOffline(body.reason, msg ?? "Conflicto al sincronizar")
  }
  if (res.status === 400) throw new ConflictoOffline("RECHAZADA", msg ?? "Venta rechazada")
  return parseResponse(res)
}

/**
 * ¿Contesta el servidor? Cualquier respuesta HTTP (aun un 401 o un 503) prueba
 * que volvió la red; solo un fallo de `fetch` (TypeError) dice que no. Es el
 * sondeo de cuando el POS quedó «Sin conexión» y el navegador no avisó con el
 * evento `online` (wifi conectado sin salida a internet).
 */
export async function sondearRed(f: typeof fetch = fetch): Promise<boolean> {
  try {
    await f(`${API_URL}/health`, { method: "GET", cache: "no-store" })
    return true
  } catch {
    return false
  }
}

/** Faltante de stock de una venta offline autorizada, sin regularizar. */
export interface FaltanteServidor {
  saleId: string
  saleNumber: string
  soldAt?: string
  cashierEmail?: string
  faltantes: { productId: string; qty: number; unitCost: number; cost: number }[]
}

/** Faltantes pendientes de la sede (`pos.void.authorize`). */
export async function listarFaltantes(sedeId: string): Promise<FaltanteServidor[]> {
  const res = await authFetch(
    `/sales/offline/faltantes?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<FaltanteServidor[]>(res)
}

/** Saca del stock lo que faltaba (ya entró) y cierra la cuenta puente. */
export async function regularizarFaltantes(
  saleId: string,
): Promise<{ estimado: number; real: number }> {
  const res = await authFetch(
    `/sales/offline/faltantes/${encodeURIComponent(saleId)}/regularizar`,
    { method: "POST" },
  )
  return parseResponse<{ estimado: number; real: number }>(res)
}

/** Conflicto offline guardado en el servidor (bandeja por sede). */
export interface ConflictoServidor {
  _id: string
  saleNumber: string
  reason: MotivoConflicto
  message: string
  userEmail?: string
  soldAt?: string
  expectedGrandTotal?: number
  payload: SyncDto
  updatedAt?: string
}

/** Bandeja del servidor: la ve quien autoriza anulaciones (`pos.void.authorize`). */
export async function listarConflictosServidor(sedeId: string): Promise<ConflictoServidor[]> {
  const res = await authFetch(
    `/sales/offline/conflicts?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<ConflictoServidor[]>(res)
}

export interface ConOrigen<T> {
  data: T
  /** `red` = recién traído; `copia` = de IndexedDB porque no hubo red. */
  origen: "red" | "copia"
  /** Cuándo se trajo del servidor (ISO). */
  at: string
}

/** Notifica a la UI que se actualizó una copia (fecha de última sincronización). */
export const COPIA_EVENT = "bookipos:offline-copia"

export async function conRespaldo<T>(
  tipo: string,
  clave: string,
  traer: () => Promise<T>,
): Promise<ConOrigen<T>> {
  const a = hayIndexedDb() ? alcanceDeSesion() : null
  try {
    const data = await traer()
    if (a) {
      await guardarCopia(a, tipo, clave, data).catch(() => undefined)
      window.dispatchEvent(new CustomEvent(COPIA_EVENT))
    }
    return { data, origen: "red", at: new Date().toISOString() }
  } catch (err) {
    if (!a || !esFallaDeRed(err)) throw err
    const copia = await leerCopia<T>(a, tipo, clave).catch(() => undefined)
    if (!copia) throw err
    return { data: copia.data, origen: "copia", at: copia.at }
  }
}

/** Catálogo vendible de la sede, con respaldo local. */
export async function posProductsConRespaldo(sedeId: string): Promise<PosProduct[]> {
  return (await conRespaldo("catalogo", sedeId, () => posProducts(sedeId))).data
}

/** Turno de caja abierto de la sede, con respaldo local. */
export async function cajaActualConRespaldo(sedeId: string): Promise<CurrentCaja> {
  return (await conRespaldo("caja", sedeId, () => getCurrentCaja(sedeId))).data
}

/** Sedes visibles para el usuario, con respaldo local. */
export async function sedesConRespaldo(): Promise<Sede[]> {
  return (await conRespaldo("sedes", "todas", () => listSedes())).data
}

/** Fecha de la última vez que el catálogo de la sede se trajo del servidor. */
export async function ultimaSincronizacion(sedeId: string): Promise<string | null> {
  const a = hayIndexedDb() ? alcanceDeSesion() : null
  if (!a) return null
  const c = await leerCopia<unknown>(a, "catalogo", sedeId).catch(() => undefined)
  return c?.at ?? null
}

/**
 * La venta encolada con la forma de `Sale`, para el comprobante de siempre. El
 * número es el definitivo (`FVC-`). La copia local del catálogo no trae la
 * tarifa de cada producto ni el régimen de la sede (IVA, INC o ninguno), así
 * que no se discrimina aquí: el comprobante dice «Impuestos incluidos» con la
 * leyenda de contingencia y el servidor liquida el impuesto al sincronizar.
 */
export function ventaOfflineComoSale(
  v: VentaOffline,
  sede: { _id: string; code?: string; name?: string } | undefined,
): Sale {
  const lines = v.lineas.map((l) => ({
    productId: l.productId,
    sku: l.sku,
    name: l.name,
    unit: l.unit,
    qty: l.qty,
    unitPrice: l.unitPrice,
    lineTotal: l.qty * l.unitPrice,
  }))
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const bagTaxTotal = v.lineas.reduce(
    (s, l) => s + Math.round((l.bagTaxUnit ?? 0) * l.qty),
    0,
  )
  const tip = v.sale.tip ?? 0
  const received = v.sale.payment.received
  return {
    _id: v.offlineId,
    saleNumber: v.saleNumber,
    sedeId: { _id: v.sedeId, code: sede?.code ?? "", name: sede?.name ?? "" },
    cashierEmail: v.cashierEmail,
    seller: v.sale.seller,
    status: "completed",
    lines,
    subtotal,
    discountTotal: 0,
    taxTotal: 0,
    bagTaxTotal: bagTaxTotal || undefined,
    total: subtotal + bagTaxTotal,
    tip: tip || undefined,
    orderType: "mostrador",
    payment: {
      method: "cash",
      received,
      change: received !== undefined ? Math.max(0, received - v.expectedGrandTotal) : undefined,
    },
    customer: v.sale.customer,
    createdAt: v.soldAt,
    contingencia: true,
  } as Sale
}
