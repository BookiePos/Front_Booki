/**
 * Zonas de domicilio con tarifa fija.
 *
 * No hay cálculo por kilómetros a propósito: una API de mapas se paga todos los
 * meses y en Medellín se equivoca —dos direcciones a 800 metros en línea recta
 * pueden tener una montaña en medio—. Son zonas con precio fijo, más una
 * casilla para escribir el valor a mano en el pedido que no cae en ninguna.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type OrderType = "mostrador" | "mesa" | "llevar" | "domicilio"

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  mostrador: "Mostrador",
  mesa: "Mesa",
  llevar: "Para llevar",
  domicilio: "Domicilio",
}

export interface DeliveryZone {
  _id: string
  sedeId: string
  name: string
  /** Lo que se le cobra al cliente por llevarle el pedido a esa zona. */
  fee: number
  active: boolean
  createdAt: string
}

export interface DeliveryZonePayload {
  sedeId?: string
  name?: string
  fee?: number
  active?: boolean
}

export async function listDeliveryZones(
  sedeId: string,
  includeInactive = false,
): Promise<DeliveryZone[]> {
  const qs = includeInactive ? "&includeInactive=true" : ""
  const res = await authFetch(
    `/delivery/zones?sedeId=${encodeURIComponent(sedeId)}${qs}`,
  )
  return parseResponse<DeliveryZone[]>(res)
}

export async function createDeliveryZone(
  payload: DeliveryZonePayload,
): Promise<DeliveryZone> {
  const res = await authFetch("/delivery/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<DeliveryZone>(res)
}

export async function updateDeliveryZone(
  id: string,
  payload: DeliveryZonePayload,
): Promise<DeliveryZone> {
  const res = await authFetch(`/delivery/zones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<DeliveryZone>(res)
}

/** Se desactiva, no se borra: las ventas viejas guardan lo que se cobró. */
export async function deactivateDeliveryZone(
  id: string,
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/delivery/zones/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
}

// ─── Seguimiento de la entrega ────────────────────────────────────────────────

export type DeliveryStatus = "pendiente" | "en_camino" | "entregado" | "fallido"

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pendiente: "Pendiente",
  en_camino: "En camino",
  entregado: "Entregado",
  fallido: "No se pudo entregar",
}

/**
 * A qué estados se puede pasar desde cada uno — copia de la regla del backend.
 *
 * Un domicilio entregado no vuelve a "en camino": si de verdad volvió, eso es
 * una devolución de la venta y no un paso atrás de la logística.
 */
export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pendiente: ["en_camino", "entregado", "fallido"],
  en_camino: ["entregado", "fallido"],
  entregado: [],
  fallido: ["en_camino"],
}

export interface DeliveryRow {
  saleId: string
  saleNumber: string
  createdAt: string
  status: DeliveryStatus
  address: string
  phone?: string
  notes?: string
  courier?: string
  zoneName?: string
  /** Lo que se cobró por llevarlo. */
  fee: number
  /** Total de la venta sin el domicilio. */
  total: number
  /** Lo que el cliente pagó en total. */
  grandTotal: number
  paymentMethod: string
  dispatchedAt?: string
  deliveredAt?: string
  failureReason?: string
}

/** Lo que un repartidor tiene que entregar al volver. */
export interface CourierSettlement {
  courier: string
  entregados: number
  enCamino: number
  fallidos: number
  /** Efectivo que recogió y tiene que devolver a la caja. */
  efectivoRecaudado: number
  /** Lo que se cobró por llevarlos. */
  domiciliosCobrados: number
}

export async function listDeliveries(query: {
  sedeId: string
  date?: string
  status?: DeliveryStatus
}): Promise<DeliveryRow[]> {
  const params = new URLSearchParams({ sedeId: query.sedeId })
  if (query.date) params.set("date", query.date)
  if (query.status) params.set("status", query.status)
  const res = await authFetch(`/delivery/orders?${params.toString()}`)
  return parseResponse<DeliveryRow[]>(res)
}

/** Cuadre del turno: cuánta plata trae cada repartidor. */
export async function getCourierSettlement(query: {
  sedeId: string
  date?: string
}): Promise<CourierSettlement[]> {
  const params = new URLSearchParams({ sedeId: query.sedeId })
  if (query.date) params.set("date", query.date)
  const res = await authFetch(
    `/delivery/orders/settlement?${params.toString()}`,
  )
  return parseResponse<CourierSettlement[]>(res)
}

export async function updateDeliveryStatus(
  saleId: string,
  payload: {
    status: DeliveryStatus
    courier?: string
    /** Obligatorio al marcar fallido. */
    failureReason?: string
  },
): Promise<unknown> {
  const res = await authFetch(`/delivery/orders/${saleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse(res)
}
