/**
 * Cliente HTTP del módulo de inventario (catálogo, existencias, lotes, kardex).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvCategory {
  _id: string
  name: string
}

export type ItemType = "ingredient" | "product" | "assembly"

// El tipo "ingredient" es el "Producto" estándar de la UI; "product" queda
// solo como valor legado en registros antiguos.
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  product: "Producto",
  assembly: "Montaje",
  ingredient: "Producto",
}

export interface InvProduct {
  _id: string
  sku: string
  itemType: ItemType
  name: string
  brand?: string
  supplier?: string
  supplierId?: string
  description?: string
  categoryId?: InvCategory | null
  unit: string
  weight?: number
  barcode?: string
  perishable: boolean
  trackLots: boolean
  shelfLifeDays?: number
  expiresAt?: string
  minStock: number
  cost: number
  salePrice?: number
  active: boolean
  createdAt: string
}

export interface SedeRef {
  _id: string
  code: string
  name: string
}

export interface Sede extends SedeRef {
  businessName?: string
  address?: string
  nit?: string
  phone?: string
  legalNote?: string
  active: boolean
}

export interface StockRow {
  id: string
  product: InvProduct
  sede: SedeRef
  qty: number
  minStock: number
  lotCount: number
  nextExpiresAt: string | null
  /** Valor a costo real: Σ (qty × unitCost) de sus lotes, o qty × costo si no maneja lotes. */
  value: number
}

export interface InvLot {
  _id: string
  productId: string | InvProduct
  sedeId: SedeRef
  lotCode: string
  supplier?: string
  expiresAt?: string
  qty: number
  initialQty: number
  unitCost: number
  receivedAt: string
}

export type MovementType =
  | "entry"
  | "adjust_in"
  | "adjust_out"
  | "waste"
  | "transfer_out"
  | "transfer_in"
  | "sale"
  | "sale_void"

export interface InvMovement {
  _id: string
  type: MovementType
  productId: { _id: string; sku: string; name: string; unit: string } | null
  sedeId: SedeRef | null
  lotId?: { _id: string; lotCode: string; expiresAt?: string } | null
  delta: number
  balanceAfter: number
  unitCost?: number
  reason?: string
  note?: string
  userEmail?: string
  createdAt: string
}

export interface MovementsPage {
  total: number
  page: number
  limit: number
  rows: InvMovement[]
}

export interface InvAlerts {
  lowStock: StockRow[]
  expired: (InvLot & { productId: InvProduct })[]
  expiringSoon: (InvLot & { productId: InvProduct })[]
  days: number
}

export type AdjustReason = "conteo" | "dano" | "vencimiento" | "merma" | "otro"

export const ADJUST_REASON_LABELS: Record<AdjustReason, string> = {
  conteo: "Conteo físico",
  dano: "Producto dañado",
  vencimiento: "Producto vencido",
  merma: "Merma operativa",
  otro: "Otro",
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: "Entrada",
  adjust_in: "Ajuste +",
  adjust_out: "Ajuste −",
  waste: "Merma",
  transfer_out: "Traslado (salida)",
  transfer_in: "Traslado (entrada)",
  sale: "Venta",
  sale_void: "Anulación de venta",
}

// ─── Sedes ───────────────────────────────────────────────────────────────────

export async function listSedes(): Promise<Sede[]> {
  const res = await authFetch("/sedes")
  return parseResponse<Sede[]>(res)
}

export interface CreateSedePayload {
  code: string
  name: string
  address?: string
}

export async function createSede(payload: CreateSedePayload): Promise<Sede> {
  const res = await authFetch("/sedes", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sede>(res)
}

export interface UpdateSedePayload {
  code?: string
  name?: string
  address?: string
  active?: boolean
}

export async function updateSede(
  id: string,
  payload: UpdateSedePayload,
): Promise<Sede> {
  const res = await authFetch(`/sedes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sede>(res)
}

// ─── Productos y categorías ──────────────────────────────────────────────────

export async function listProducts(includeInactive = false): Promise<InvProduct[]> {
  const res = await authFetch(
    `/inventory/products${includeInactive ? "?includeInactive=true" : ""}`,
  )
  return parseResponse<InvProduct[]>(res)
}

export interface ProductPayload {
  sku?: string
  itemType?: ItemType
  name?: string
  brand?: string
  supplier?: string
  supplierId?: string
  description?: string
  categoryId?: string
  unit?: string
  weight?: number
  barcode?: string
  perishable?: boolean
  trackLots?: boolean
  shelfLifeDays?: number
  expiresAt?: string
  minStock?: number
  cost?: number
  salePrice?: number
  active?: boolean
}

export async function createProduct(payload: ProductPayload): Promise<InvProduct> {
  const res = await authFetch("/inventory/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<InvProduct>(res)
}

export async function updateProduct(
  id: string,
  payload: ProductPayload,
): Promise<InvProduct> {
  const res = await authFetch(`/inventory/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<InvProduct>(res)
}

/** Elimina el producto definitivamente, con sus existencias, lotes y kardex. */
export async function deleteProduct(id: string): Promise<{ ok: boolean }> {
  const res = await authFetch(`/inventory/products/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
}

export async function listCategories(): Promise<InvCategory[]> {
  const res = await authFetch("/inventory/categories")
  return parseResponse<InvCategory[]>(res)
}

export async function createCategory(name: string): Promise<InvCategory> {
  const res = await authFetch("/inventory/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
  return parseResponse<InvCategory>(res)
}

export async function updateCategory(
  id: string,
  name: string,
): Promise<InvCategory> {
  const res = await authFetch(`/inventory/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
  return parseResponse<InvCategory>(res)
}

/** Elimina la categoría (falla si algún ítem la tiene asignada). */
export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  const res = await authFetch(`/inventory/categories/${id}`, {
    method: "DELETE",
  })
  return parseResponse<{ ok: boolean }>(res)
}

// ─── Existencias, lotes y alertas ────────────────────────────────────────────

export async function getStock(sedeId?: string): Promise<StockRow[]> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/inventory/stock${qs}`)
  return parseResponse<StockRow[]>(res)
}

export async function getLots(
  productId: string,
  sedeId?: string,
): Promise<InvLot[]> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/inventory/products/${productId}/lots${qs}`)
  return parseResponse<InvLot[]>(res)
}

export async function getAlerts(sedeId?: string, days?: number): Promise<InvAlerts> {
  const params = new URLSearchParams()
  if (sedeId) params.set("sedeId", sedeId)
  if (days) params.set("days", String(days))
  const qs = params.toString()
  const res = await authFetch(`/inventory/alerts${qs ? `?${qs}` : ""}`)
  return parseResponse<InvAlerts>(res)
}

// ─── Kardex ──────────────────────────────────────────────────────────────────

export async function getMovements(query: {
  sedeId?: string
  productId?: string
  type?: string
  page?: number
  limit?: number
}): Promise<MovementsPage> {
  const params = new URLSearchParams()
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.productId) params.set("productId", query.productId)
  if (query.type) params.set("type", query.type)
  if (query.page) params.set("page", String(query.page))
  if (query.limit) params.set("limit", String(query.limit))
  const qs = params.toString()
  const res = await authFetch(`/inventory/movements${qs ? `?${qs}` : ""}`)
  return parseResponse<MovementsPage>(res)
}

// ─── Operaciones ─────────────────────────────────────────────────────────────

export interface EntryPayload {
  productId: string
  sedeId: string
  qty: number
  unitCost?: number
  lotCode?: string
  supplier?: string
  supplierId?: string
  expiresAt?: string
  note?: string
}

export async function createEntry(payload: EntryPayload): Promise<unknown> {
  const res = await authFetch("/inventory/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse(res)
}

export interface AdjustPayload {
  productId: string
  sedeId: string
  direction: "add" | "remove"
  qty: number
  reason: AdjustReason
  lotId?: string
  lotCode?: string
  expiresAt?: string
  note?: string
}

export async function createAdjustment(payload: AdjustPayload): Promise<unknown> {
  const res = await authFetch("/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse(res)
}

export interface TransferPayload {
  productId: string
  fromSedeId: string
  toSedeId: string
  qty: number
  note?: string
}

export async function createTransfer(payload: TransferPayload): Promise<unknown> {
  const res = await authFetch("/inventory/transfers", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse(res)
}
