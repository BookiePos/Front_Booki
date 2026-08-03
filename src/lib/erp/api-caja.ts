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
