/**
 * Cliente HTTP del módulo de proveedores.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

// ─── Types ───────────────────────────────────────────────────────────────────

export type SupplierDocType = "NIT" | "CC" | "CE"

export const SUPPLIER_DOC_TYPE_LABELS: Record<SupplierDocType, string> = {
  NIT: "NIT",
  CC: "Cédula",
  CE: "Cédula de extranjería",
}

export interface Supplier {
  _id: string
  name: string
  docType: SupplierDocType
  docNumber: string
  phone?: string
  email?: string
  contactName?: string
  address?: string
  city?: string
  category?: string
  notes?: string
  active: boolean
  createdAt: string
}

export interface SupplierPayload {
  name?: string
  docType?: SupplierDocType
  docNumber?: string
  phone?: string
  email?: string
  contactName?: string
  address?: string
  city?: string
  category?: string
  notes?: string
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function listSuppliers(
  includeInactive = false,
): Promise<Supplier[]> {
  const res = await authFetch(
    `/suppliers${includeInactive ? "?includeInactive=true" : ""}`,
  )
  return parseResponse<Supplier[]>(res)
}

export async function createSupplier(
  payload: SupplierPayload,
): Promise<Supplier> {
  const res = await authFetch("/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Supplier>(res)
}

export async function updateSupplier(
  id: string,
  payload: SupplierPayload,
): Promise<Supplier> {
  const res = await authFetch(`/suppliers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Supplier>(res)
}

/** Activa o desactiva el proveedor (no se elimina). */
export async function setSupplierStatus(
  id: string,
  active: boolean,
): Promise<Supplier> {
  const res = await authFetch(`/suppliers/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  })
  return parseResponse<Supplier>(res)
}
