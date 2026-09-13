/**
 * Cliente HTTP del catálogo de productos vendibles del POS.
 * Un producto se abastece del inventario de dos formas: un ítem directo
 * o una receta (ingredientes + cantidades). Reutiliza authFetch de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { InvCategory } from "@/lib/erp/api-inventory"

export type CatalogSourceType = "inventory" | "recipe"

export const SOURCE_TYPE_LABELS: Record<CatalogSourceType, string> = {
  inventory: "Del inventario",
  recipe: "Con receta",
}

/** IVA del producto (el precio ya lo incluye). */
export type IvaRate = 0 | 5 | 19
export type IvaType = "gravado" | "exento" | "excluido"

/** Opciones de IVA para el selector, con su tarifa y tratamiento. */
export const IVA_OPTIONS: {
  key: string
  label: string
  rate: IvaRate
  type: IvaType
}[] = [
  { key: "19", label: "IVA 19%", rate: 19, type: "gravado" },
  { key: "5", label: "IVA 5%", rate: 5, type: "gravado" },
  { key: "exento", label: "Exento (0%)", rate: 0, type: "exento" },
  { key: "excluido", label: "Excluido", rate: 0, type: "excluido" },
]

/** Deriva la key del selector a partir de la tarifa y el tratamiento. */
export function ivaKey(rate: IvaRate | number, type: IvaType): string {
  if (type === "exento") return "exento"
  if (type === "excluido") return "excluido"
  return String(rate)
}

/** Referencia liviana a un ítem de inventario (populada por el backend). */
export interface InvProductRef {
  _id: string
  name: string
  sku: string
  unit: string
}

export interface RecipeLine {
  productId: InvProductRef | string
  qty: number
}

export interface CatalogProduct {
  _id: string
  sku: string
  name: string
  description?: string
  categoryId?: InvCategory | null
  salePrice: number
  ivaRate: IvaRate
  ivaType: IvaType
  sourceType: CatalogSourceType
  inventoryProductId?: InvProductRef | null
  qtyPerUnit?: number
  recipe: RecipeLine[]
  /**
   * Empaque que se gasta al vender una unidad: la bolsa, el vaso, la cuchara.
   * Aplica a los dos orígenes —la galleta comprada hecha también sale en
   * bolsa— y por eso va aparte de la receta. Puede faltar en productos viejos.
   */
  packaging?: RecipeLine[]
  /** Foto del producto (Vercel Blob). Ausente si nunca se subió una. */
  imageUrl?: string | null
  active: boolean
  createdAt: string
}

export interface RecipeLinePayload {
  productId: string
  qty: number
}

export interface CatalogProductPayload {
  sku?: string
  name?: string
  description?: string
  categoryId?: string
  salePrice?: number
  ivaRate?: IvaRate
  ivaType?: IvaType
  sourceType?: CatalogSourceType
  inventoryProductId?: string
  qtyPerUnit?: number
  recipe?: RecipeLinePayload[]
  /** Una lista vacía quita el empaque; no mandarla lo deja como estaba. */
  packaging?: RecipeLinePayload[]
  active?: boolean
}

export async function listCatalogProducts(
  includeInactive = false,
): Promise<CatalogProduct[]> {
  const res = await authFetch(
    `/catalog/products${includeInactive ? "?includeInactive=true" : ""}`,
  )
  return parseResponse<CatalogProduct[]>(res)
}

export async function createCatalogProduct(
  payload: CatalogProductPayload,
): Promise<CatalogProduct> {
  const res = await authFetch("/catalog/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<CatalogProduct>(res)
}

export async function updateCatalogProduct(
  id: string,
  payload: CatalogProductPayload,
): Promise<CatalogProduct> {
  const res = await authFetch(`/catalog/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<CatalogProduct>(res)
}

/**
 * Sube (o reemplaza) la foto del producto.
 *
 * Va como multipart porque el backend la recibe con multer y la reenvía a
 * Vercel Blob: el token del store es de servidor y no puede bajar al navegador,
 * así que el archivo pasa por el API en vez de subirse directo.
 *
 * No se fija `Content-Type`: con FormData lo pone el navegador con su boundary
 * (ver `applyContentType` en api-admin).
 */
export async function uploadCatalogProductImage(
  id: string,
  file: File | Blob,
): Promise<CatalogProduct> {
  const body = new FormData()
  body.append("file", file)
  const res = await authFetch(`/catalog/products/${id}/image`, {
    method: "POST",
    body,
  })
  return parseResponse<CatalogProduct>(res)
}

/** Quita la foto del producto (y borra el archivo del store). */
export async function deleteCatalogProductImage(
  id: string,
): Promise<CatalogProduct> {
  const res = await authFetch(`/catalog/products/${id}/image`, {
    method: "DELETE",
  })
  return parseResponse<CatalogProduct>(res)
}

export async function deleteCatalogProduct(
  id: string,
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/catalog/products/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
}

// ─── Listas de precios ────────────────────────────────────────────────────────

/**
 * Un precio pactado dentro de una lista. Con `minQty` se arma el precio por
 * cantidad: la gaseosa a $2.500 desde 12 y a $2.200 desde 50 son dos filas del
 * mismo producto.
 */
export interface PriceListItem {
  catalogProductId: string
  /** Precio unitario, con IVA incluido igual que el de mostrador. */
  price: number
  /** Desde cuántas unidades aplica. Sin valor, aplica siempre. */
  minQty?: number
}

/**
 * Lista de precios: vender lo mismo a distinto precio según a quién.
 *
 * El precio del catálogo sigue siendo el de mostrador; la lista son las reglas
 * que se le aplican encima. El porcentaje general existe para arrancar con una
 * sola cifra, y los precios por producto mandan sobre él.
 */
export interface PriceList {
  _id: string
  name: string
  description?: string
  /** Descuento general sobre el precio de mostrador (0–100). */
  discountPercent: number
  items: PriceListItem[]
  active: boolean
  createdAt: string
}

export interface PriceListPayload {
  name?: string
  description?: string
  discountPercent?: number
  items?: PriceListItem[]
  active?: boolean
}

/** Cómo quedaría un producto del catálogo con una lista aplicada. */
export interface PriceListPreviewRow {
  catalogProductId: string
  name: string
  /** Precio de mostrador. */
  base: number
  /** Lo que se cobraría con esta lista y esta cantidad. */
  price: number
}

export async function listPriceLists(
  includeInactive = false,
): Promise<PriceList[]> {
  const qs = includeInactive ? "?includeInactive=true" : ""
  const res = await authFetch(`/catalog/price-lists${qs}`)
  return parseResponse<PriceList[]>(res)
}

export async function createPriceList(
  payload: PriceListPayload,
): Promise<PriceList> {
  const res = await authFetch("/catalog/price-lists", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<PriceList>(res)
}

export async function updatePriceList(
  id: string,
  payload: PriceListPayload,
): Promise<PriceList> {
  const res = await authFetch(`/catalog/price-lists/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<PriceList>(res)
}

/**
 * Se desactiva, no se borra: las ventas viejas guardan el precio que cobraron,
 * pero los clientes siguen apuntando a la lista y borrarla dejaría esa
 * referencia colgando.
 */
export async function deactivatePriceList(
  id: string,
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/catalog/price-lists/${id}`, {
    method: "DELETE",
  })
  return parseResponse<{ ok: boolean }>(res)
}

/** Vista previa del catálogo con la lista aplicada, para una cantidad dada. */
export async function previewPriceList(
  id: string,
  qty = 1,
): Promise<PriceListPreviewRow[]> {
  const res = await authFetch(
    `/catalog/price-lists/${id}/preview?qty=${encodeURIComponent(qty)}`,
  )
  return parseResponse<PriceListPreviewRow[]>(res)
}
