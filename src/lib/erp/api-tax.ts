/** Cliente HTTP del motor de impuestos (core-tax). Base `/taxes`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type TaxKind = "iva" | "inc" | "exento" | "excluido"

export interface TaxRateHistory {
  rate: number
  effectiveFrom: string
  note?: string
  upcoming: boolean
}

export interface TaxView {
  code: string
  name: string
  kind: TaxKind
  kindLabel: string
  active: boolean
  system: boolean
  currentRate: number | null
  currentFrom: string | null
  history: TaxRateHistory[]
}

export interface TaxComputation {
  code: string
  kind: string
  base: number
  rate: number
  taxAmount: number
  total: number
  date: string
}

export async function listTaxes(): Promise<TaxView[]> {
  const res = await authFetch("/taxes")
  return parseResponse<TaxView[]>(res)
}

export async function computeTax(
  code: string,
  base: number,
): Promise<TaxComputation> {
  const res = await authFetch(
    `/taxes/compute?code=${encodeURIComponent(code)}&base=${base}`,
  )
  return parseResponse<TaxComputation>(res)
}

export interface CreateTaxPayload {
  code: string
  name: string
  kind: TaxKind
  rate: number
  effectiveFrom: string
  note?: string
}

export async function createTax(payload: CreateTaxPayload): Promise<TaxView> {
  const res = await authFetch("/taxes", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<TaxView>(res)
}

export async function setTaxVersion(
  code: string,
  payload: { rate: number; effectiveFrom: string; note?: string },
): Promise<TaxView> {
  const res = await authFetch(`/taxes/${encodeURIComponent(code)}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<TaxView>(res)
}

export async function updateTax(
  code: string,
  payload: { name?: string; active?: boolean },
): Promise<TaxView> {
  const res = await authFetch(`/taxes/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<TaxView>(res)
}
