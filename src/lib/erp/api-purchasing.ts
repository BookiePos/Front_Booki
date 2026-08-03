/** Cliente HTTP de Compras (purchasing). Base `/purchasing/orders`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "partial"
  | "received"
  | "cancelled"

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  partial: "Recepción parcial",
  received: "Recibida",
  cancelled: "Anulada",
}

export interface PurchaseLine {
  productId?: string
  description: string
  qty: number
  qtyReceived: number
  unitCost: number
  taxCode?: string
  subtotal: number
  taxAmount: number
}

export interface Receipt {
  date: string
  lines: { lineIndex: number; qty: number; lotCode?: string; expiresAt?: string }[]
  note?: string
  userEmail: string
  payableId?: string
  at?: string
}

export interface PurchaseOrder {
  _id: string
  number: string
  sedeId: string
  supplierId?: string
  supplierName: string
  status: PurchaseOrderStatus
  issueDate: string
  expectedDate?: string
  lines: PurchaseLine[]
  subtotal: number
  taxAmount: number
  total: number
  receipts: Receipt[]
  note?: string
  createdByEmail: string
  createdAt: string
}

export interface CreatePOLine {
  productId?: string
  description: string
  qty: number
  unitCost: number
  taxCode?: string
}

export interface CreatePOPayload {
  sedeId: string
  supplierId?: string
  supplierName: string
  issueDate: string
  expectedDate?: string
  lines: CreatePOLine[]
  note?: string
  send?: boolean
}

export interface ReceivePOPayload {
  date: string
  lines: { lineIndex: number; qty: number; lotCode?: string; expiresAt?: string }[]
  note?: string
  generatePayable?: boolean
  dueDate?: string
  docNumber?: string
}

export async function listPurchaseOrders(query: {
  sedeId?: string
  status?: PurchaseOrderStatus
} = {}): Promise<PurchaseOrder[]> {
  const qs = new URLSearchParams()
  if (query.sedeId) qs.set("sedeId", query.sedeId)
  if (query.status) qs.set("status", query.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/purchasing/orders${suffix}`)
  return parseResponse<PurchaseOrder[]>(res)
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await authFetch(`/purchasing/orders/${id}`)
  return parseResponse<PurchaseOrder>(res)
}

export async function createPurchaseOrder(
  payload: CreatePOPayload,
): Promise<PurchaseOrder> {
  const res = await authFetch("/purchasing/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<PurchaseOrder>(res)
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await authFetch(`/purchasing/orders/${id}/send`, {
    method: "POST",
  })
  return parseResponse<PurchaseOrder>(res)
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const res = await authFetch(`/purchasing/orders/${id}/cancel`, {
    method: "POST",
  })
  return parseResponse<PurchaseOrder>(res)
}

export async function receivePurchaseOrder(
  id: string,
  payload: ReceivePOPayload,
): Promise<PurchaseOrder> {
  const res = await authFetch(`/purchasing/orders/${id}/receive`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<PurchaseOrder>(res)
}
