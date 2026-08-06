/**
 * Cliente HTTP del módulo de Finanzas (Fase 1) para el ERP admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 *
 * Contrato de API CONGELADO. Base `/finance`. Montos COP entero.
 * Fechas 'YYYY-MM-DD'.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type CategoryKind = "income" | "cogs" | "payroll" | "expense" | "tax" | "other"

export interface FinanceCategory {
  _id: string
  name: string
  kind: CategoryKind
  accountCode?: string
  system: boolean
  autoSource?: string
  active: boolean
}

export type ExpenseStatus = "paid" | "payable"
export type PaymentMethod = "cash" | "transfer" | "card"

export interface FinanceExpense {
  _id: string
  sedeId: string
  categoryId: string
  categoryName: string
  concept: string
  amount: number
  taxAmount: number
  date: string
  status: ExpenseStatus
  paymentMethod?: PaymentMethod
  supplierId?: string
  supplierName?: string
  recurring: boolean
  note?: string
  createdByEmail: string
  createdAt: string
}

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly"

export interface FinanceRecurringExpense {
  _id: string
  sedeId: string
  categoryId: string
  categoryName: string
  concept: string
  amount: number
  taxAmount: number
  frequency: RecurrenceFrequency
  dayOfMonth: number
  startDate: string
  endDate?: string | null
  defaultStatus: ExpenseStatus
  paymentMethod?: PaymentMethod
  supplierId?: string
  supplierName?: string
  note?: string
  active: boolean
  autoGenerate: boolean
  lastGeneratedDate?: string | null
  createdByEmail: string
  createdAt: string
}

export type PayableStatus = "open" | "partial" | "paid" | "void"

export interface PayablePayment {
  date: string
  amount: number
  method?: PaymentMethod
  note?: string
  userEmail: string
}

export interface FinancePayable {
  _id: string
  sedeId: string
  supplierId?: string
  supplierName: string
  categoryId?: string
  docNumber?: string
  issueDate: string
  dueDate: string
  amount: number
  paidAmount: number
  status: PayableStatus
  payments: PayablePayment[]
  note?: string
  createdByEmail: string
  createdAt: string
}

export type ReceivableStatus = "open" | "partial" | "paid" | "void"

export interface ReceivablePayment {
  date: string
  amount: number
  method?: PaymentMethod
  note?: string
  userEmail: string
}

export interface FinanceReceivable {
  _id: string
  sedeId: string
  customerName: string
  customerDoc?: string
  customerPhone?: string
  saleId?: string | null
  docNumber?: string
  issueDate: string
  dueDate: string
  amount: number
  paidAmount: number
  status: ReceivableStatus
  payments: ReceivablePayment[]
  note?: string
  createdByEmail: string
  createdAt: string
}

export type AccountType = "bank" | "cash" | "wallet"

export interface FinanceAccount {
  _id: string
  sedeId?: string
  name: string
  type: AccountType
  openingBalance: number
  active: boolean
  autoMethods: PaymentMethod[]
  note?: string
  balance?: number
  lastReconciledDate?: string | null
  lastReconciledBalance?: number | null
  lastReconciledAt?: string | null
}

/** Resumen de tesorería: efectivo (caja POS) + cuentas de banco/billetera. */
export interface TreasuryCajaRow {
  sedeId: string
  sedeName: string
  expectedCash: number
  salesTotal: number
  openedAt: string
}

export interface TreasurySummary {
  sedeId?: string | null
  cajaCash: number
  cajaRows: TreasuryCajaRow[]
  accountsBalance: number
  total: number
}

export type MovementSource =
  | "manual"
  | "sale"
  | "expense"
  | "payable_payment"
  | "receivable_payment"
  | "reconcile"

export interface FinanceMovement {
  _id: string
  accountId: string
  sedeId?: string
  date: string
  direction: "in" | "out"
  amount: number
  categoryId?: string
  concept: string
  reconciled: boolean
  sourceType: MovementSource
  sourceId?: string | null
  auto: boolean
  createdByEmail: string
}

export type BudgetScenario = "base" | "optimista" | "pesimista"
export type BudgetStatus = "draft" | "active"

export interface BudgetLine {
  categoryId: string
  categoryName: string
  kind: CategoryKind
  /** 12 valores, ene..dic */
  monthly: number[]
}

export interface FinanceBudget {
  _id: string
  name: string
  fiscalYear: number
  sedeId?: string
  scenario: BudgetScenario
  status: BudgetStatus
  lines: BudgetLine[]
  createdByEmail: string
  createdAt: string
}

export interface BudgetVsActualLine {
  categoryId: string
  categoryName: string
  kind: CategoryKind
  monthlyBudget: number[]
  monthlyActual: number[]
  totalBudget: number
  totalActual: number
}

export interface BudgetVsActual {
  budgetId: string
  fiscalYear: number
  sedeId?: string
  lines: BudgetVsActualLine[]
  totals: { budget: number; actual: number }
}

export interface PLRow {
  categoryId?: string
  label: string
  amount: number
}

export interface PLReport {
  from: string
  to: string
  sedeId?: string
  ingresos: number
  cogs: number
  margenBruto: number
  nomina: number
  gastos: PLRow[]
  gastosTotal: number
  utilidadOperativa: number
  ivaGenerado: number
  ivaDescontable: number
  ivaPorPagar: number
}

export interface PLMonthRow {
  month: number
  ingresos: number
  cogs: number
  margenBruto: number
  nomina: number
  gastos: number
  utilidad: number
}

export interface PLMonthlyReport {
  year: number
  sedeId?: string | null
  months: PLMonthRow[]
  totals: PLMonthRow
}

export interface FinanceOverview {
  sedeId?: string
  cashToday: number
  salesMonth: number
  expensesMonth: number
  nomina: number
  margenBruto: number
  payablesOpen: number
  payablesOverdue: number
  receivablesOpen: number
  receivablesOverdue: number
  utilidadMonth: number
}

export interface CashflowBucket {
  index: number
  from: string
  to: string
  inflows: { receivables: number; projectedSales: number; total: number }
  outflows: {
    payables: number
    recurringExpenses: number
    payroll: number
    total: number
  }
  net: number
  balance: number
}

export interface CashflowProjection {
  sedeId?: string | null
  from: string
  to: string
  horizonDays: number
  includeProjections: boolean
  openingBalance: number
  buckets: CashflowBucket[]
  overdue: { receivables: number; payables: number }
  assumptions: {
    monthlyRecurringExpenses: number
    monthlyPayroll: number
    avgDailySales: number
  }
  runway: { negative: boolean; date?: string; weeks?: number }
  totals: {
    inflows: number
    outflows: number
    net: number
    endingBalance: number
  }
}

// ─── Categorías ────────────────────────────────────────────────────────────────

export async function listCategories(): Promise<FinanceCategory[]> {
  const res = await authFetch("/finance/categories")
  return parseResponse<FinanceCategory[]>(res)
}

export interface CategoryPayload {
  name?: string
  kind?: CategoryKind
  accountCode?: string
  active?: boolean
}

export async function createCategory(
  payload: CategoryPayload,
): Promise<FinanceCategory> {
  const res = await authFetch("/finance/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceCategory>(res)
}

export async function updateCategory(
  id: string,
  payload: CategoryPayload,
): Promise<FinanceCategory> {
  const res = await authFetch(`/finance/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceCategory>(res)
}

// ─── Gastos ────────────────────────────────────────────────────────────────────

export async function listExpenses(query: {
  sedeId?: string
  from?: string
  to?: string
  status?: ExpenseStatus
}): Promise<FinanceExpense[]> {
  const params = new URLSearchParams()
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  if (query.status) params.set("status", query.status)
  const qs = params.toString()
  const res = await authFetch(`/finance/expenses${qs ? `?${qs}` : ""}`)
  return parseResponse<FinanceExpense[]>(res)
}

export interface ExpensePayload {
  sedeId?: string
  categoryId?: string
  concept?: string
  amount?: number
  taxAmount?: number
  date?: string
  status?: ExpenseStatus
  paymentMethod?: PaymentMethod
  supplierId?: string
  supplierName?: string
  recurring?: boolean
  note?: string
}

export async function createExpense(
  payload: ExpensePayload,
): Promise<FinanceExpense> {
  const res = await authFetch("/finance/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceExpense>(res)
}

export async function updateExpense(
  id: string,
  payload: ExpensePayload,
): Promise<FinanceExpense> {
  const res = await authFetch(`/finance/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceExpense>(res)
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await authFetch(`/finance/expenses/${id}`, { method: "DELETE" })
  await parseResponse<{ ok: boolean }>(res)
}

// ─── Gastos recurrentes (plantillas) ─────────────────────────────────────────

export async function listRecurring(query: {
  sedeId?: string
  active?: boolean
} = {}): Promise<FinanceRecurringExpense[]> {
  const params = new URLSearchParams()
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.active !== undefined) params.set("active", String(query.active))
  const qs = params.toString()
  const res = await authFetch(`/finance/recurring${qs ? `?${qs}` : ""}`)
  return parseResponse<FinanceRecurringExpense[]>(res)
}

export interface RecurringExpensePayload {
  sedeId?: string
  categoryId?: string
  concept?: string
  amount?: number
  taxAmount?: number
  frequency?: RecurrenceFrequency
  dayOfMonth?: number
  startDate?: string
  endDate?: string | null
  defaultStatus?: ExpenseStatus
  paymentMethod?: PaymentMethod
  supplierId?: string
  supplierName?: string
  note?: string
  active?: boolean
  autoGenerate?: boolean
}

export async function createRecurring(
  payload: RecurringExpensePayload,
): Promise<FinanceRecurringExpense> {
  const res = await authFetch("/finance/recurring", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceRecurringExpense>(res)
}

export async function updateRecurring(
  id: string,
  payload: RecurringExpensePayload,
): Promise<FinanceRecurringExpense> {
  const res = await authFetch(`/finance/recurring/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceRecurringExpense>(res)
}

export async function deleteRecurring(id: string): Promise<void> {
  const res = await authFetch(`/finance/recurring/${id}`, { method: "DELETE" })
  await parseResponse<{ deleted: boolean }>(res)
}

/** Genera ahora los gastos recurrentes vencidos del tenant (manual). */
export async function runRecurring(): Promise<{
  generated: number
  templates: number
}> {
  const res = await authFetch("/finance/recurring/run", { method: "POST" })
  return parseResponse<{ generated: number; templates: number }>(res)
}

// ─── Cuentas por pagar ───────────────────────────────────────────────────────

export async function listPayables(query: {
  sedeId?: string
  status?: PayableStatus
}): Promise<FinancePayable[]> {
  const params = new URLSearchParams()
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.status) params.set("status", query.status)
  const qs = params.toString()
  const res = await authFetch(`/finance/payables${qs ? `?${qs}` : ""}`)
  return parseResponse<FinancePayable[]>(res)
}

export interface PayablePayload {
  sedeId?: string
  supplierId?: string
  supplierName?: string
  categoryId?: string
  docNumber?: string
  issueDate?: string
  dueDate?: string
  amount?: number
  note?: string
}

export async function createPayable(
  payload: PayablePayload,
): Promise<FinancePayable> {
  const res = await authFetch("/finance/payables", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinancePayable>(res)
}

export interface PayablePaymentPayload {
  date?: string
  amount?: number
  method?: PaymentMethod
  note?: string
}

export async function addPayablePayment(
  id: string,
  payload: PayablePaymentPayload,
): Promise<FinancePayable> {
  const res = await authFetch(`/finance/payables/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinancePayable>(res)
}

// ─── Cuentas por cobrar (fiado) ──────────────────────────────────────────────

export async function listReceivables(query: {
  sedeId?: string
  status?: ReceivableStatus
}): Promise<FinanceReceivable[]> {
  const params = new URLSearchParams()
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.status) params.set("status", query.status)
  const qs = params.toString()
  const res = await authFetch(`/finance/receivables${qs ? `?${qs}` : ""}`)
  return parseResponse<FinanceReceivable[]>(res)
}

export interface ReceivablePayload {
  sedeId?: string
  /** Cliente registrado (obligatorio): la CxC ya no acepta texto libre. */
  customerId?: string
  docNumber?: string
  issueDate?: string
  dueDate?: string
  amount?: number
  note?: string
}

export async function createReceivable(
  payload: ReceivablePayload,
): Promise<FinanceReceivable> {
  const res = await authFetch("/finance/receivables", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceReceivable>(res)
}

export interface ReceivablePaymentPayload {
  date?: string
  amount?: number
  method?: PaymentMethod
  note?: string
}

export async function addReceivablePayment(
  id: string,
  payload: ReceivablePaymentPayload,
): Promise<FinanceReceivable> {
  const res = await authFetch(`/finance/receivables/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceReceivable>(res)
}

// ─── Cuentas (caja y bancos) ─────────────────────────────────────────────────

export async function listAccounts(): Promise<FinanceAccount[]> {
  const res = await authFetch("/finance/accounts")
  return parseResponse<FinanceAccount[]>(res)
}

export interface AccountPayload {
  sedeId?: string
  name?: string
  type?: AccountType
  openingBalance?: number
  autoMethods?: PaymentMethod[]
  active?: boolean
  note?: string
}

export async function createAccount(
  payload: AccountPayload,
): Promise<FinanceAccount> {
  const res = await authFetch("/finance/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceAccount>(res)
}

export async function updateAccount(
  id: string,
  payload: AccountPayload,
): Promise<FinanceAccount> {
  const res = await authFetch(`/finance/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceAccount>(res)
}

export async function getTreasury(sedeId?: string): Promise<TreasurySummary> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/finance/treasury${qs}`)
  return parseResponse<TreasurySummary>(res)
}

export async function listAccountMovements(
  id: string,
  query: { from?: string; to?: string } = {},
): Promise<FinanceMovement[]> {
  const params = new URLSearchParams()
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  const qs = params.toString()
  const res = await authFetch(
    `/finance/accounts/${id}/movements${qs ? `?${qs}` : ""}`,
  )
  return parseResponse<FinanceMovement[]>(res)
}

export interface MovementPayload {
  date?: string
  direction?: "in" | "out"
  amount?: number
  categoryId?: string
  concept?: string
  reconciled?: boolean
}

export async function createAccountMovement(
  id: string,
  payload: MovementPayload,
): Promise<FinanceMovement> {
  const res = await authFetch(`/finance/accounts/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceMovement>(res)
}

export interface ReconciliationResult {
  accountId: string
  openingBalance: number
  reconciledBalance: number
  currentBalance: number
  statementBalance: number
  difference: number
  outstandingCount: number
  outstandingNet: number
  lastReconciledDate?: string | null
  lastReconciledAt?: string | null
}

export interface ReconcilePayload {
  statementDate: string
  statementBalance: number
  reconciledMovementIds?: string[]
  newMovements?: MovementPayload[]
}

export async function reconcileAccount(
  id: string,
  payload: ReconcilePayload,
): Promise<ReconciliationResult> {
  const res = await authFetch(`/finance/accounts/${id}/reconcile`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ReconciliationResult>(res)
}

// ─── Presupuestos ────────────────────────────────────────────────────────────

export async function listBudgets(fiscalYear?: number): Promise<FinanceBudget[]> {
  const qs = fiscalYear ? `?fiscalYear=${fiscalYear}` : ""
  const res = await authFetch(`/finance/budgets${qs}`)
  return parseResponse<FinanceBudget[]>(res)
}

export async function getBudget(id: string): Promise<FinanceBudget> {
  const res = await authFetch(`/finance/budgets/${id}`)
  return parseResponse<FinanceBudget>(res)
}

export interface BudgetPayload {
  name?: string
  fiscalYear?: number
  sedeId?: string
  scenario?: BudgetScenario
  status?: BudgetStatus
  lines?: BudgetLine[]
}

export async function createBudget(
  payload: BudgetPayload,
): Promise<FinanceBudget> {
  const res = await authFetch("/finance/budgets", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceBudget>(res)
}

export async function updateBudget(
  id: string,
  payload: BudgetPayload,
): Promise<FinanceBudget> {
  const res = await authFetch(`/finance/budgets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<FinanceBudget>(res)
}

export async function deleteBudget(id: string): Promise<void> {
  const res = await authFetch(`/finance/budgets/${id}`, { method: "DELETE" })
  await parseResponse<{ ok: boolean }>(res)
}

export async function getBudgetVsActual(
  id: string,
  sedeId?: string,
): Promise<BudgetVsActual> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/finance/budgets/${id}/vs-actual${qs}`)
  return parseResponse<BudgetVsActual>(res)
}

// ─── Reportes ────────────────────────────────────────────────────────────────

export async function getPL(query: {
  from: string
  to: string
  sedeId?: string
}): Promise<PLReport> {
  const params = new URLSearchParams()
  params.set("from", query.from)
  params.set("to", query.to)
  if (query.sedeId) params.set("sedeId", query.sedeId)
  const res = await authFetch(`/finance/pl?${params.toString()}`)
  return parseResponse<PLReport>(res)
}

export async function getPLMonthly(query: {
  year: number
  sedeId?: string
}): Promise<PLMonthlyReport> {
  const params = new URLSearchParams()
  params.set("year", String(query.year))
  if (query.sedeId) params.set("sedeId", query.sedeId)
  const res = await authFetch(`/finance/pl-monthly?${params.toString()}`)
  return parseResponse<PLMonthlyReport>(res)
}

export async function getOverview(sedeId?: string): Promise<FinanceOverview> {
  const qs = sedeId ? `?sedeId=${encodeURIComponent(sedeId)}` : ""
  const res = await authFetch(`/finance/overview${qs}`)
  return parseResponse<FinanceOverview>(res)
}

export async function getCashflow(query: {
  days?: number
  sedeId?: string
  includeProjections?: boolean
}): Promise<CashflowProjection> {
  const params = new URLSearchParams()
  if (query.days) params.set("days", String(query.days))
  if (query.sedeId) params.set("sedeId", query.sedeId)
  if (query.includeProjections === false) params.set("includeProjections", "false")
  const qs = params.toString()
  const res = await authFetch(`/finance/cashflow${qs ? `?${qs}` : ""}`)
  return parseResponse<CashflowProjection>(res)
}

// ─── Etiquetas / helpers compartidos ─────────────────────────────────────────

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Ingreso",
  cogs: "Costo de ventas",
  payroll: "Nómina",
  expense: "Gasto",
  tax: "Impuesto",
  other: "Otro",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Banco",
  cash: "Efectivo",
  wallet: "Billetera",
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  paid: "Pagado",
  payable: "Por pagar",
}

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
}

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  open: "Abierta",
  partial: "Abono parcial",
  paid: "Pagada",
  void: "Anulada",
}

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  open: "Abierta",
  partial: "Abono parcial",
  paid: "Cobrada",
  void: "Anulada",
}

export const BUDGET_SCENARIO_LABELS: Record<BudgetScenario, string> = {
  base: "Base",
  optimista: "Optimista",
  pesimista: "Pesimista",
}

export const MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]
