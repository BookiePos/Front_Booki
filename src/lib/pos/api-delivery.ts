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
