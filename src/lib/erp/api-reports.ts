/** Cliente HTTP del motor de reportes (core-reports) y ledger. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export interface StatementLine {
  code: string
  name: string
  amount: number
}

export interface IncomeStatement {
  from?: string
  to?: string
  sedeId?: string | null
  ingresos: StatementLine[]
  totalIngresos: number
  gastos: StatementLine[]
  totalGastos: number
  utilidadNeta: number
}

export interface BalanceSheet {
  to?: string | null
  sedeId?: string | null
  activos: StatementLine[]
  totalActivo: number
  pasivos: StatementLine[]
  totalPasivo: number
  patrimonio: StatementLine[]
  resultadoEjercicio: number
  totalPatrimonio: number
  cuadra: boolean
}

export interface TrialBalanceRow {
  code: string
  name: string
  type: string
  typeLabel: string
  debit: number
  credit: number
  balance: number
}

export interface TrialBalance {
  from?: string
  to?: string
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

export interface SalesReport {
  from?: string
  to?: string
  sedeId?: string | null
  days: {
    date: string
    revenue: number
    tax: number
    tickets: number
    avgTicket: number
  }[]
  byMethod: { method: string; revenue: number; tickets: number }[]
  bySede: { sedeId: string | null; revenue: number; tickets: number }[]
  topProducts: {
    productId: string | null
    name: string
    qty: number
    revenue: number
  }[]
  totalRevenue: number
  totalTax: number
  totalTickets: number
  avgTicket: number
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  return sp.toString() ? `?${sp.toString()}` : ""
}

export async function getIncomeStatement(query: {
  from?: string
  to?: string
  sedeId?: string
}): Promise<IncomeStatement> {
  const res = await authFetch(`/reports/income-statement${qs(query)}`)
  return parseResponse<IncomeStatement>(res)
}

export async function getBalanceSheet(query: {
  to?: string
  sedeId?: string
}): Promise<BalanceSheet> {
  const res = await authFetch(`/reports/balance-sheet${qs(query)}`)
  return parseResponse<BalanceSheet>(res)
}

export async function getTrialBalance(query: {
  from?: string
  to?: string
  sedeId?: string
}): Promise<TrialBalance> {
  const res = await authFetch(`/reports/trial-balance${qs(query)}`)
  return parseResponse<TrialBalance>(res)
}

export async function getSalesReport(query: {
  from?: string
  to?: string
  sedeId?: string
}): Promise<SalesReport> {
  const res = await authFetch(`/reports/sales${qs(query)}`)
  return parseResponse<SalesReport>(res)
}

// ─── Trazabilidad hacia adelante ──────────────────────────────────────────────

/** Lo que la venta guardó del cliente. Puede venir vacío en una de mostrador. */
export interface TraceCustomer {
  name?: string
  idNumber?: string
  phone?: string
  email?: string
}

export interface TraceSale {
  saleId: string
  saleNumber: string
  date: string
  status: string
  /** Unidades de ESTE lote que salieron en esa venta. */
  qty: number
  customer: TraceCustomer | null
}

export interface TraceLotNode {
  lotId: string
  lotCode: string
  productId: string
  productName: string
  expiresAt: string | null
  receivedAt: string
  initialQty: number
  remainingQty: number
  supplier: string | null
  sales: TraceSale[]
  producedInto: TraceProductionNode[]
}

export interface TraceProductionNode {
  orderId: string
  number: string
  date: string
  productName: string
  producedQty: number
  /** Lotes del terminado que salió, ya rastreados a su vez. */
  outputs: TraceLotNode[]
}

export interface TraceResult extends TraceLotNode {
  /** Unidades vendidas sumando toda la cadena, no solo el primer salto. */
  soldQty: number
  customers: TraceCustomer[]
  /** La cadena se cortó por el tope de saltos: la respuesta va incompleta. */
  truncated: boolean
}

/** Un lote encontrado por código, para elegir cuál rastrear. */
export interface TraceLotMatch {
  lotId: string
  lotCode: string
  productId: string
  productName: string
  expiresAt: string | null
  receivedAt: string
  remainingQty: number
  supplier: string | null
}

/** Busca lotes por código. El código no es único: puede devolver varios. */
export async function findTraceLots(code: string): Promise<TraceLotMatch[]> {
  const res = await authFetch(
    `/reports/trazabilidad/lotes?code=${encodeURIComponent(code)}`,
  )
  return parseResponse<TraceLotMatch[]>(res)
}

/** A qué ventas y a qué clientes se fue un lote, pasando por producción. */
export async function traceLot(lotId: string): Promise<TraceResult> {
  const res = await authFetch(`/reports/trazabilidad/lotes/${lotId}`)
  return parseResponse<TraceResult>(res)
}
