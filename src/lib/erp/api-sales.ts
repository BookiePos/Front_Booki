/**
 * Cliente HTTP del POS (ventas por sede).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { SedeRef } from "@/lib/erp/api-inventory"

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "card" | "transfer" | "credit"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Fiado",
}

/** Producto vendible con el stock disponible en la sede consultada. */
export interface PosProduct {
  _id: string
  sku: string
  name: string
  unit: string
  salePrice: number
  stock: number
  /** Foto del producto (Vercel Blob). null si no tiene. */
  imageUrl?: string | null
}

export interface SaleLine {
  productId: string
  sku: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface Sale {
  _id: string
  saleNumber: string
  sedeId: SedeRef
  cashierEmail: string
  status: "completed" | "void"
  lines: SaleLine[]
  subtotal: number
  taxTotal: number
  total: number
  payment: { method: PaymentMethod; received?: number; change?: number }
  createdAt: string
}

export interface SalesPage {
  total: number
  page: number
  limit: number
  rows: Sale[]
}

export interface CreateSalePayload {
  sedeId: string
  lines: { productId: string; qty: number }[]
  payment: { method: PaymentMethod; received?: number }
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function posProducts(sedeId: string): Promise<PosProduct[]> {
  const res = await authFetch(
    `/sales/pos-products?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<PosProduct[]>(res)
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const res = await authFetch("/sales", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sale>(res)
}

export async function listSales(
  sedeId: string,
  page = 1,
  limit = 20,
): Promise<SalesPage> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&page=${page}&limit=${limit}`
  const res = await authFetch(`/sales?${qs}`)
  return parseResponse<SalesPage>(res)
}

/** Resumen de ventas de hoy de una sede: cantidad y total en dinero. */
export interface SalesStats {
  count: number
  total: number
}

export async function getSalesStats(sedeId: string): Promise<SalesStats> {
  const res = await authFetch(`/sales/stats?sedeId=${encodeURIComponent(sedeId)}`)
  return parseResponse<SalesStats>(res)
}
