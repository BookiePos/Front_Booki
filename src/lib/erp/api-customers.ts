/** Cliente HTTP del directorio de Clientes. Base `/customers`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type CustomerDocType = "CC" | "NIT" | "CE" | "PAS"

export interface Customer {
  _id: string
  name: string
  docType: CustomerDocType
  docNumber: string
  phone?: string
  email?: string
  address?: string
  city?: string
  creditLimit: number
  /**
   * Lista de precios con la que se le cobra. Vacío = precio de mostrador.
   * Existe para que el descuento del mayorista no dependa de que el cajero se
   * acuerde de aplicarlo en cada venta.
   */
  priceListId?: string
  notes?: string
  active: boolean
  createdAt: string
}

export interface CustomerPayload {
  name: string
  docType?: CustomerDocType
  docNumber: string
  phone?: string
  email?: string
  address?: string
  city?: string
  creditLimit?: number
  /** Cadena vacía = quitarle la lista y volver a cobrarle de mostrador. */
  priceListId?: string
  notes?: string
}

export async function listCustomers(query: {
  search?: string
  includeInactive?: boolean
} = {}): Promise<Customer[]> {
  const qs = new URLSearchParams()
  if (query.search) qs.set("search", query.search)
  if (query.includeInactive) qs.set("includeInactive", "true")
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/customers${suffix}`)
  return parseResponse<Customer[]>(res)
}

export async function createCustomer(
  payload: CustomerPayload,
): Promise<Customer> {
  const res = await authFetch("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Customer>(res)
}

export async function updateCustomer(
  id: string,
  payload: Partial<CustomerPayload> & { active?: boolean },
): Promise<Customer> {
  const res = await authFetch(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Customer>(res)
}
