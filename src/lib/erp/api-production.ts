/**
 * Cliente HTTP de Producción. Base `/production`.
 *
 * Producción es el intermediario de ALGUNOS productos entre Inventario y
 * Productos: lo que se compra ya hecho va derecho de uno a otro y no pasa por
 * aquí. Lo que se fabrica sale de insumos del inventario, se convierte en un
 * terminado con lote y costo propios, y desde ahí se publica como vendible.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { ItemType, SedeRef } from "@/lib/erp/api-inventory"

// ─── Recetas de lote (BOM) ───────────────────────────────────────────────────

/** Ítem de inventario tal como llega poblado en una receta. */
export interface BomProductRef {
  _id: string
  sku: string
  name: string
  unit: string
  itemType?: ItemType
  perishable?: boolean
  cost?: number
  active?: boolean
}

export interface BomLine {
  productId: BomProductRef | string
  /** Cantidad por LOTE completo, en la unidad del insumo. */
  qty: number
  note?: string
}

export interface Bom {
  _id: string
  productId: BomProductRef | string
  name: string
  /** Unidades del terminado que rinde un lote de la receta. */
  outputQty: number
  lines: BomLine[]
  /** Mano de obra e indirectos por lote (COP entero). */
  extraCost: number
  /**
   * Empaque del lote escrito en dinero (COP entero). Va aparte de la mano de
   * obra porque es el costo que más se mueve y el que se negocia por su lado.
   * Puede faltar en recetas creadas antes de esta versión.
   */
  packagingCost?: number
  note?: string
  active: boolean
  createdAt: string
}

export interface BomLinePayload {
  productId: string
  qty: number
  note?: string
}

export interface CreateBomPayload {
  productId: string
  name: string
  outputQty: number
  lines: BomLinePayload[]
  extraCost?: number
  packagingCost?: number
  note?: string
}

export interface UpdateBomPayload {
  name?: string
  outputQty?: number
  lines?: BomLinePayload[]
  extraCost?: number
  packagingCost?: number
  note?: string
  active?: boolean
}

export async function listBoms(includeInactive = false): Promise<Bom[]> {
  const res = await authFetch(
    `/production/boms${includeInactive ? "?includeInactive=true" : ""}`,
  )
  return parseResponse<Bom[]>(res)
}

export async function createBom(payload: CreateBomPayload): Promise<Bom> {
  const res = await authFetch("/production/boms", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Bom>(res)
}

export async function updateBom(
  id: string,
  payload: UpdateBomPayload,
): Promise<Bom> {
  const res = await authFetch(`/production/boms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Bom>(res)
}

export async function deleteBom(id: string): Promise<{ ok: boolean }> {
  const res = await authFetch(`/production/boms/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
}

// ─── Puente Inventario → Producción → Productos ──────────────────────────────

export interface OutputLine {
  productId: string
  sku: string
  name: string
  unit: string
  qty: number
  unitCost: number
  subtotal: number
}

export interface LastProductionOrder {
  _id: string
  number: string
  date: string
  completedAt?: string
  producedQty: number
  unitCost: number
  totalCost: number
}

/** Una fila del tablero de terminados: los tres eslabones de la cadena. */
export interface ProductionOutput {
  bomId: string
  name: string
  outputQty: number
  extraCost: number
  /** Empaque por lote escrito en dinero en la receta. */
  packagingCost?: number
  lines: OutputLine[]
  product: {
    _id: string
    sku: string
    name: string
    unit: string
    itemType: string
    perishable: boolean
    active: boolean
  }
  /** Existencia del terminado en la sede filtrada (o en todas las visibles). */
  stock: number
  /** Costo por unidad según los costos actuales del inventario. */
  estimatedUnitCost: number
  /** Costo de referencia: el de la última orden, o el estimado si nunca se produjo. */
  unitCost: number
  lastOrder?: LastProductionOrder
  /** Producto del catálogo del POS que vende este terminado, si ya existe. */
  sellable?: {
    _id: string
    sku: string
    name: string
    salePrice: number
    ivaRate: number
    ivaType: string
    active: boolean
  }
  margin?: number
  marginPct?: number
}

export async function listOutputs(sedeId?: string): Promise<ProductionOutput[]> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/production/outputs${qs}`)
  return parseResponse<ProductionOutput[]>(res)
}

export interface PublishOutputPayload {
  /** Precio al público (IVA incluido), en COP entero. */
  salePrice: number
  ivaRate?: 0 | 5 | 19
  ivaType?: "gravado" | "exento" | "excluido"
  categoryId?: string
}

/** Saca el terminado a la venta: lo crea en el catálogo del POS. */
export async function publishOutput(
  bomId: string,
  payload: PublishOutputPayload,
): Promise<{ _id: string; sku: string; name: string; salePrice: number }> {
  const res = await authFetch(`/production/boms/${bomId}/publish`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<{
    _id: string
    sku: string
    name: string
    salePrice: number
  }>(res)
}

// ─── Órdenes de producción ───────────────────────────────────────────────────

export type ProductionOrderStatus =
  | "draft"
  | "in_progress"
  | "done"
  | "cancelled"

export const PRODUCTION_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  draft: "Borrador",
  in_progress: "En proceso",
  done: "Terminada",
  cancelled: "Anulada",
}

export interface ProductionOrderLine {
  productId: string
  /** Nombre y SKU congelados al crear la orden. */
  description: string
  unit: string
  qty: number
  qtyConsumed: number
  unitCost: number
  subtotal: number
}

export interface ProductionOrder {
  _id: string
  number: string
  sedeId: string | SedeRef
  status: ProductionOrderStatus
  date: string
  bomId?: string
  productId: string
  productName: string
  unit: string
  plannedQty: number
  producedQty: number
  lines: ProductionOrderLine[]
  extraCost: number
  /** Empaque del lote, prorrateado de la receta y congelado en la orden. */
  packagingCost?: number
  materialsCost: number
  totalCost: number
  unitCost: number
  lotCode?: string
  expiresAt?: string
  note?: string
  createdByEmail: string
  completedAt?: string
  completedByEmail?: string
  createdAt: string
}

export interface CreateProductionOrderPayload {
  sedeId: string
  productId: string
  date: string
  plannedQty: number
  /** Si se omite, el backend explota la receta del terminado. */
  lines?: { productId: string; qty: number }[]
  extraCost?: number
  packagingCost?: number
  note?: string
  start?: boolean
}

export interface CompleteProductionOrderPayload {
  /** Salida real. Si se omite se toma lo planeado. */
  producedQty?: number
  lotCode?: string
  expiresAt?: string
  extraCost?: number
  packagingCost?: number
  note?: string
}

export async function listProductionOrders(
  query: { sedeId?: string; status?: ProductionOrderStatus } = {},
): Promise<ProductionOrder[]> {
  const qs = new URLSearchParams()
  if (query.sedeId) qs.set("sedeId", query.sedeId)
  if (query.status) qs.set("status", query.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/production/orders${suffix}`)
  return parseResponse<ProductionOrder[]>(res)
}

export async function createProductionOrder(
  payload: CreateProductionOrderPayload,
): Promise<ProductionOrder> {
  const res = await authFetch("/production/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ProductionOrder>(res)
}

export async function startProductionOrder(
  id: string,
): Promise<ProductionOrder> {
  const res = await authFetch(`/production/orders/${id}/start`, {
    method: "POST",
  })
  return parseResponse<ProductionOrder>(res)
}

export async function completeProductionOrder(
  id: string,
  payload: CompleteProductionOrderPayload,
): Promise<ProductionOrder> {
  const res = await authFetch(`/production/orders/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ProductionOrder>(res)
}

export async function cancelProductionOrder(
  id: string,
): Promise<ProductionOrder> {
  const res = await authFetch(`/production/orders/${id}/cancel`, {
    method: "POST",
  })
  return parseResponse<ProductionOrder>(res)
}

/** Id de una referencia que el backend pudo devolver poblada. */
export function refId(ref: { _id: string } | string | undefined): string {
  if (!ref) return ""
  return typeof ref === "string" ? ref : ref._id
}
