/** Cliente HTTP del motor de impuestos (core-tax). Base `/taxes`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type TaxKind = "iva" | "inc" | "exento" | "excluido"

/**
 * Cómo se lee la tarifa: porcentaje sobre la base (IVA 19) o pesos fijos por
 * unidad (INC de bolsas: $73 por bolsa en 2026). Sin dato, porcentaje.
 */
export type TaxBasis = "porcentaje" | "por_unidad"

/**
 * Tarifa lista para mostrar: "19 %" o "$ 73 por bolsa". Antes se pegaba
 * siempre un "%", y el INC de bolsas salía como "73 %".
 */
export function formatTaxRate(rate: number, basis?: TaxBasis): string {
  if (basis === "por_unidad") {
    const pesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(rate)
    return `$ ${pesos} por bolsa`
  }
  return `${rate} %`
}

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
  basis?: TaxBasis
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
