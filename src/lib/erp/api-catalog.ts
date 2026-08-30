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
