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
  /** Si es una variante, apunta al producto padre (plantilla). */
  variantOf?: string
  /** Valores de los ejes de esta variante, p. ej. { Talla: "M", Color: "Rojo" }. */
  variantAttrs?: Record<string, string>
  /** Ejes de variación (solo en el padre): Talla, Color… */
  variantAxes?: { name: string; values: string[] }[]
}

export interface SedeRef {
  _id: string
  code: string
  name: string
}

export type TipoPersona = "natural" | "juridica"
export type ResponsabilidadFiscal =
  | "responsable_iva"
  | "no_responsable_iva"
  | "regimen_simple"
  | "gran_contribuyente"

/** Resolución de numeración DIAN (factura electrónica). Fechas en ISO. */
export interface ResolucionFe {
  numero?: string
  fechaResolucion?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
  claveTecnica?: string
}

export interface Sede extends SedeRef {
  businessName?: string
  address?: string
  nit?: string
  phone?: string
  legalNote?: string
  // Perfil fiscal (factura electrónica)
  nitDv?: string
  tipoPersona?: TipoPersona
  responsabilidadFiscal?: ResponsabilidadFiscal
  ciiu?: string
  departamento?: string
  ciudad?: string
  emailFacturacion?: string
  resolucionFe?: ResolucionFe
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

/** Campos fiscales de la sede (factura electrónica), compartidos por payloads. */
export interface SedeFiscalFields {
  nitDv?: string
  tipoPersona?: TipoPersona
  responsabilidadFiscal?: ResponsabilidadFiscal
  ciiu?: string
  departamento?: string
  ciudad?: string
  emailFacturacion?: string
  resolucionFe?: ResolucionFe
}

export interface CreateSedePayload extends SedeFiscalFields {
  code: string
  name: string
  businessName?: string
  address?: string
  nit?: string
  phone?: string
  legalNote?: string
}

export async function createSede(payload: CreateSedePayload): Promise<Sede> {
  const res = await authFetch("/sedes", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sede>(res)
}

export interface UpdateSedePayload extends SedeFiscalFields {
  code?: string
  name?: string
  businessName?: string
  address?: string
  nit?: string
  phone?: string
  legalNote?: string
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

// ─── Descuentos (por sede) ───────────────────────────────────────────────────

export type DiscountType = "percent" | "amount"

export interface Discount {
  _id: string
  sedeId: string
  name: string
  type: DiscountType
  value: number
  active: boolean
}

export interface DiscountPayload {
  sedeId?: string
  name?: string
  type?: DiscountType
  value?: number
  active?: boolean
}

export async function listDiscounts(sedeId: string): Promise<Discount[]> {
  const res = await authFetch(`/discounts?sedeId=${encodeURIComponent(sedeId)}`)
  return parseResponse<Discount[]>(res)
}

export async function createDiscount(payload: DiscountPayload): Promise<Discount> {
  const res = await authFetch("/discounts", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Discount>(res)
}

export async function updateDiscount(
  id: string,
  payload: DiscountPayload,
): Promise<Discount> {
  const res = await authFetch(`/discounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Discount>(res)
}

export async function deleteDiscount(id: string): Promise<{ ok: boolean }> {
  const res = await authFetch(`/discounts/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
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

/** Un eje de variación (Talla, Color…) con sus valores. */
export interface VariantAxis {
  name: string
  values: string[]
}

export interface CreateVariantsPayload {
  skuPrefix: string
  name: string
  categoryId?: string
  brand?: string
  supplier?: string
  supplierId?: string
  description?: string
  salePrice?: number
  cost?: number
  minStock?: number
  axes: VariantAxis[]
}

/** Crea un producto con variantes: devuelve el padre y sus filas hijas. */
export async function createProductVariants(
  payload: CreateVariantsPayload,
): Promise<{ parent: InvProduct; variants: InvProduct[] }> {
  const res = await authFetch("/inventory/products/with-variants", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<{ parent: InvProduct; variants: InvProduct[] }>(res)
}

/** Una fila de importación de productos (la categoría va por NOMBRE). */
export interface ImportProductRow {
  sku?: string
  name?: string
  itemType?: ItemType
  brand?: string
  supplier?: string
  description?: string
  category?: string
  unit?: string
  barcode?: string
  weight?: number
  perishable?: boolean
  trackLots?: boolean
  shelfLifeDays?: number
  minStock?: number
  cost?: number
  salePrice?: number
  active?: boolean
}

/** Resumen del resultado de una importación masiva. */
export interface ImportResult {
  total: number
  created: number
  updated: number
  errors: { row: number; sku: string; message: string }[]
}

/** Importa (upsert por SKU) un lote de productos desde filas de CSV. */
export async function importProducts(
  rows: ImportProductRow[],
): Promise<ImportResult> {
  const res = await authFetch("/inventory/products/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  })
  return parseResponse<ImportResult>(res)
}

/** Una fila de carga de existencias (entrada). La sede va por nombre o código. */
export interface ImportStockRow {
  sku?: string
  sede?: string
  qty?: number
  unitCost?: number
  lotCode?: string
  expiresAt?: string
  supplier?: string
  note?: string
}

/** Resumen del resultado de una carga de existencias. */
export interface ImportStockResult {
  total: number
  imported: number
  errors: { row: number; sku: string; sede: string; message: string }[]
}

/** Carga masiva de existencias (una entrada por fila) desde un CSV. */
export async function importStock(
  rows: ImportStockRow[],
): Promise<ImportStockResult> {
  const res = await authFetch("/inventory/stock/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  })
  return parseResponse<ImportStockResult>(res)
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
