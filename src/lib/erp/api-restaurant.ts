/** Cliente HTTP de Restaurante (mesas + comandas). Base `/restaurant`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type TableStatus = "free" | "occupied" | "bill_requested"

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  free: "Libre",
  occupied: "Ocupada",
  bill_requested: "Pide cuenta",
}

export interface RestaurantTable {
  _id: string
  sedeId: string
  name: string
  zone: string
  seats: number
  status: TableStatus
  currentOrderId?: string | null
  active: boolean
}

export type OrderStatus = "open" | "sent" | "billed" | "closed" | "cancelled"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: "Abierta",
  sent: "En cocina",
  billed: "Cuenta pedida",
  closed: "Cerrada",
  cancelled: "Anulada",
}

export interface OrderItem {
  _id?: string
  productId?: string
  name: string
  qty: number
  unitPrice: number
  note?: string
  station?: string
  sentToKitchen: boolean
}

export interface RestaurantOrder {
  _id: string
  number: string
  sedeId: string
  tableId: string
  tableName: string
  zone?: string
  guests: number
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  incRate: number
  incAmount: number
  tipRate: number
  tipAccepted: boolean
  tipAmount: number
  total: number
  waiterEmail: string
  createdAt: string
}

// ── Mesas ────────────────────────────────────────────────────────────────────
export async function listTables(sedeId?: string): Promise<RestaurantTable[]> {
  const suffix = sedeId ? `?sedeId=${sedeId}` : ""
  const res = await authFetch(`/restaurant/tables${suffix}`)
  return parseResponse<RestaurantTable[]>(res)
}

export async function createTable(payload: {
  sedeId: string
  name: string
  zone?: string
  seats?: number
}): Promise<RestaurantTable> {
  const res = await authFetch("/restaurant/tables", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<RestaurantTable>(res)
}

export async function updateTable(
  id: string,
  payload: { name?: string; zone?: string; seats?: number; active?: boolean },
): Promise<RestaurantTable> {
  const res = await authFetch(`/restaurant/tables/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<RestaurantTable>(res)
}

export async function deleteTable(id: string): Promise<void> {
  const res = await authFetch(`/restaurant/tables/${id}`, { method: "DELETE" })
  return parseResponse<void>(res)
}

// ── Comandas ─────────────────────────────────────────────────────────────────
export async function listOrders(query: {
  sedeId?: string
  status?: OrderStatus
} = {}): Promise<RestaurantOrder[]> {
  const qs = new URLSearchParams()
  if (query.sedeId) qs.set("sedeId", query.sedeId)
  if (query.status) qs.set("status", query.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/restaurant/orders${suffix}`)
  return parseResponse<RestaurantOrder[]>(res)
}

export async function getOrder(id: string): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}`)
  return parseResponse<RestaurantOrder>(res)
}

export async function openOrder(payload: {
  tableId: string
  guests?: number
}): Promise<RestaurantOrder> {
  const res = await authFetch("/restaurant/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function addOrderItems(
  id: string,
  items: {
    productId?: string
    name: string
    qty: number
    unitPrice: number
    note?: string
    station?: string
  }[],
): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/items`, {
    method: "POST",
    body: JSON.stringify({ items }),
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function sendOrderToKitchen(id: string): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/send`, {
    method: "POST",
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function requestOrderBill(id: string): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/bill`, {
    method: "POST",
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function setOrderTip(
  id: string,
  payload: { accepted?: boolean; rate?: number },
): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/tip`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function closeOrder(id: string): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/close`, {
    method: "POST",
  })
  return parseResponse<RestaurantOrder>(res)
}

export async function cancelOrder(
  id: string,
  reason: string,
): Promise<RestaurantOrder> {
  const res = await authFetch(`/restaurant/orders/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  return parseResponse<RestaurantOrder>(res)
}
