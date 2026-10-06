/** Clientes registrados y lookup de empleados para el fiado del POS. */
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
  /**
   * Lista de precios pactada con él. Vacío = precio de mostrador.
   * El terminal la usa para mostrar el precio correcto mientras se arma el
   * carrito; el que se COBRA lo resuelve el backend.
   */
  priceListId?: string
  active: boolean
}

/** Tipo de documento del directorio → código DIAN de la factura. */
export const DIAN_ID_TYPE: Record<CustomerDocType, string> = {
  CC: "13",
  NIT: "31",
  CE: "22",
  PAS: "41",
}

/** Lo contrario, para guardar en el directorio lo que se tecleó al facturar. */
export function docTypeFromDian(code?: string): CustomerDocType | undefined {
  return (Object.entries(DIAN_ID_TYPE) as [CustomerDocType, string][]).find(
    ([, c]) => c === code,
  )?.[0]
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const suffix = search ? `?search=${encodeURIComponent(search)}` : ""
  const res = await authFetch(`/customers${suffix}`)
  return parseResponse<Customer[]>(res)
}

export async function createCustomer(payload: {
  name: string
  docNumber: string
  docType?: CustomerDocType
  phone?: string
  email?: string
  address?: string
}): Promise<Customer> {
  const res = await authFetch("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Customer>(res)
}

export interface EmployeeLookup {
  _id: string
  firstName: string
  lastName: string
  docNumber: string
}

export async function lookupEmployees(): Promise<EmployeeLookup[]> {
  const res = await authFetch("/employees/lookup")
  return parseResponse<EmployeeLookup[]>(res)
}
