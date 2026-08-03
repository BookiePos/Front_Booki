/** Clientes registrados y lookup de empleados para el fiado del POS. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type CustomerDocType = "CC" | "NIT" | "CE" | "PAS"

export interface Customer {
  _id: string
  name: string
  docType: CustomerDocType
  docNumber: string
  phone?: string
  active: boolean
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
