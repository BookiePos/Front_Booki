/**
 * Cliente HTTP de Caja para el ERP admin: resumen del día por sede.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type CajaOverviewStatus = "none" | "open" | "closed"

export interface CajaOverviewRow {
  sedeId: string
  sedeName: string
  status: CajaOverviewStatus
  sessionId?: string
  openingAmount?: number
  openedAt?: string
  openedByEmail?: string
  closedAt?: string
  closedByEmail?: string
  countedAmount?: number
  expectedCash?: number
  difference?: number
  salesCount: number
  salesTotal: number
  cashSalesTotal: number
  movementsIn: number
  movementsOut: number
}

export interface CajaOverviewTotals {
  sedes: number
  openCount: number
  closedCount: number
  noneCount: number
  openingTotal: number
  salesCount: number
  salesTotal: number
  cashSalesTotal: number
  expectedCashTotal: number
}

export interface CajaOverview {
  date: string
  rows: CajaOverviewRow[]
  totals: CajaOverviewTotals
}

/** Resumen del día de todas las cajas visibles. `date` en YYYY-MM-DD (opc.). */
export async function getCajaOverview(date?: string): Promise<CajaOverview> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ""
  const res = await authFetch(`/caja/overview${qs}`)
  return parseResponse<CajaOverview>(res)
}

export interface CajaClosingRow {
  sessionId: string
  sedeId: string
  sedeName: string
  openedAt: string
  closedAt?: string
  closedByEmail?: string
  openingAmount: number
  salesCount: number
  salesTotal: number
  cashSalesTotal: number
  movementsIn: number
  movementsOut: number
  expectedCash: number
  countedAmount: number
  difference: number
}

export interface CajaClosingsReport {
  from: string
  to: string
  rows: CajaClosingRow[]
  totals: {
    count: number
    openingTotal: number
    salesTotal: number
    expectedCash: number
    countedAmount: number
    difference: number
  }
}

/** Cierres de caja (arqueos) de las sedes visibles en un rango (o un día). */
export async function getCajaClosings(
  from?: string,
  to?: string,
): Promise<CajaClosingsReport> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString()
  const res = await authFetch(`/caja/closings${qs ? `?${qs}` : ""}`)
  return parseResponse<CajaClosingsReport>(res)
}
