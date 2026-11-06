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
  /** Resultado del año del corte (ingresos − gastos desde el 1 de enero). */
  resultadoEjercicio: number
  /**
   * Utilidad o pérdida de años anteriores que no se ha cerrado (sigue en las
   * cuentas 4, 5, 6 y 7). Con los años cerrados es 0: ya está en la 3705.
   */
  resultadoAnterioresSinCerrar: number
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
  /**
   * Ventas NETAS de devoluciones (R3, revisión 1.16). La devolución resta el
   * día en que ocurre, no el de la venta, como la 4175 en el libro. Un día con
   * solo devoluciones aparece con `grossRevenue` 0 y `revenue` negativo.
   */
  days: {
    date: string
    grossRevenue: number
    returns: number
    returnsCount: number
    /** Neto: `grossRevenue − returns`. */
    revenue: number
    tax: number
    tickets: number
    avgTicket: number
  }[]
  /**
   * Un tiquete mixto (ítem 6.9) cuenta en cada medio: `revenue` se reparte en
   * proporción a lo que cubrió cada uno y `collected` es lo que entró por ese
   * medio, con propina y domicilio.
   */
  byMethod: {
    method: string
    revenue: number
    collected?: number
    tickets: number
  }[]
  bySede: {
    sedeId: string | null
    grossRevenue: number
    returns: number
    returnsCount: number
    revenue: number
    tickets: number
  }[]
  /** Netos de devoluciones; `returnedQty`/`returned` es lo que se devolvió. */
  topProducts: {
    productId: string | null
    name: string
    qty: number
    revenue: number
    returnedQty: number
    returned: number
  }[]
  returns: SalesReturnsBlock
  totalGrossRevenue: number
  totalReturns: number
  totalReturnsCount: number
  /** Neto de devoluciones. */
  totalRevenue: number
  totalTax: number
  totalTickets: number
  avgTicket: number
}

/** Las devoluciones del rango: cuántas, cuánto y por qué medio y motivo. */
export interface SalesReturnsBlock {
  count: number
  amount: number
  tax: number
  byMethod: { method: string; amount: number; count: number }[]
  byReason: { reason: string; amount: number; count: number }[]
  topProducts: { productId: string | null; name: string; qty: number; refund: number }[]
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

// ─── Cierre anual (R4, revisión 1.16) ─────────────────────────────────────────

/** Un año del libro y su estado de cierre. */
export interface EstadoAnio {
  anio: number
  cerrado: boolean
  /** Ya terminó y los anteriores están cerrados. */
  puedeCerrar: boolean
  /** Utilidad (+) o pérdida (−) del año, sin el asiento de cierre. */
  resultado: number
  cierre: {
    number: string
    date: string
    createdByEmail?: string
    trasladoNumber: string | null
  } | null
  /** Entró un asiento con fecha del año después de cerrarlo: reabrir y cerrar. */
  saldoPosteriorAlCierre: number
}

export async function getCierres(): Promise<EstadoAnio[]> {
  const res = await authFetch("/ledger/cierres")
  return parseResponse<EstadoAnio[]>(res)
}

export async function cerrarAnio(anio: number): Promise<unknown> {
  const res = await authFetch(`/ledger/cierres/${anio}`, { method: "POST" })
  return parseResponse<unknown>(res)
}

export async function reabrirAnio(anio: number): Promise<unknown> {
  const res = await authFetch(`/ledger/cierres/${anio}/reabrir`, { method: "POST" })
  return parseResponse<unknown>(res)
}
