/**
 * Cliente HTTP del módulo de Caja (turnos, movimientos y arqueo).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type CajaMovementType = "in" | "out" | "sangria"

export const CAJA_MOVEMENT_LABELS: Record<CajaMovementType, string> = {
  in: "Ingreso",
  out: "Salida",
  sangria: "Sangría",
}

export interface CajaSession {
  _id: string
  sedeId: string
  status: "open" | "closed"
  openingAmount: number
  openingBills?: number
  openingCoins?: number
  openedByEmail: string
  openedAt: string
  note?: string
  closedAt?: string
  closedByEmail?: string
  countedAmount?: number
  countedBills?: number
  countedCoins?: number
  expectedCash?: number
  difference?: number
  salesCount?: number
  salesTotal?: number
  cashSalesTotal?: number
  movementsIn?: number
  movementsOut?: number
  closeNote?: string
}

export interface CajaTotals {
  salesCount: number
  salesTotal: number
  cashSalesTotal: number
  movementsIn: number
  movementsOut: number
  expectedCash: number
}

export interface CajaMovement {
  _id: string
  sessionId: string
  sedeId: string
  type: CajaMovementType
  amount: number
  reason?: string
  note?: string
  userEmail: string
  createdAt: string
}

export interface CurrentCaja {
  session: CajaSession | null
  totals: CajaTotals | null
  movements: CajaMovement[]
}

export interface CajaSessionsPage {
  total: number
  page: number
  limit: number
  rows: CajaSession[]
}

export async function getCurrentCaja(sedeId: string): Promise<CurrentCaja> {
  const res = await authFetch(
    `/caja/current?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<CurrentCaja>(res)
}

export interface OpenCajaBreakdown {
  /** Efectivo en billetes. */
  bills?: number
  /** Efectivo en monedas. */
  coins?: number
}

export async function openCaja(
  sedeId: string,
  openingAmount: number,
  note?: string,
  breakdown?: OpenCajaBreakdown,
): Promise<CajaSession> {
  const res = await authFetch("/caja/open", {
    method: "POST",
    body: JSON.stringify({
      sedeId,
      openingAmount,
      openingBills: breakdown?.bills,
      openingCoins: breakdown?.coins,
      note,
    }),
  })
  return parseResponse<CajaSession>(res)
}

export interface CloseCajaBreakdown {
  /** Efectivo en billetes. */
  bills?: number
  /** Efectivo en monedas. */
  coins?: number
}

export async function closeCaja(
  sedeId: string,
  countedAmount: number,
  note?: string,
  breakdown?: CloseCajaBreakdown,
): Promise<CajaSession> {
  const res = await authFetch("/caja/close", {
    method: "POST",
    body: JSON.stringify({
      sedeId,
      countedAmount,
      countedBills: breakdown?.bills,
      countedCoins: breakdown?.coins,
      note,
    }),
  })
  return parseResponse<CajaSession>(res)
}

export interface CajaMovementPayload {
  sedeId: string
  type: CajaMovementType
  amount: number
  reason?: string
  note?: string
}

export async function addCajaMovement(
  payload: CajaMovementPayload,
): Promise<CajaMovement> {
  const res = await authFetch("/caja/movements", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<CajaMovement>(res)
}

export async function listCajaSessions(
  sedeId: string,
  page = 1,
  limit = 20,
): Promise<CajaSessionsPage> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&page=${page}&limit=${limit}`
  const res = await authFetch(`/caja/sessions?${qs}`)
  return parseResponse<CajaSessionsPage>(res)
}
