"use client"

import * as React from "react"
import {
  ShieldOff,
  FileMinus,
  Plus,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  Repeat,
  Play,
  Pause,
  Sparkles,
  CalendarClock,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listExpenses,
  listCategories,
  createCategory,
  createExpense,
  updateExpense,
  deleteExpense,
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runRecurring,
  listPayables,
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  type FinanceExpense,
  type FinanceCategory,
  type FinanceRecurringExpense,
  type ExpenseStatus,
  type ExpensePayload,
  type RecurringExpensePayload,
  type RecurrenceFrequency,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
import {
  money,
  todayLocal,
  monthStart,
  fmtDate,
  errorMessage,
  numOr,
} from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { PayablesPanel } from "@/components/erp/finance/payables-panel"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const ALL = "all"
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const STATUS_FILTERS: { v: string; l: string }[] = [
  { v: ALL, l: "Todos" },
  { v: "paid", l: "Pagados" },
  { v: "payable", l: "Por pagar" },
]

type Tab = "gastos" | "recurrentes" | "cxp"

const TABS: { v: Tab; l: string }[] = [
  { v: "gastos", l: "Gastos" },
  { v: "recurrentes", l: "Recurrentes" },
  { v: "cxp", l: "Por pagar" },
]

export default function GastosPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")
  const canManageCategories = hasPermission("finance.manage")

  const [tab, setTab] = React.useState<Tab>("gastos")
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])

  const addCategory = React.useCallback((cat: FinanceCategory) => {
    setCategories((prev) =>
      prev.some((c) => c._id === cat._id) ? prev : [...prev, cat],
    )
  }, [])

  // Filtros de la vista Gastos.
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [status, setStatus] = React.useState<string>(ALL)
  const [categoryId, setCategoryId] = React.useState<string>(ALL)
  const [gastoView, setGastoView] = React.useState<"categoria" | "detalle">(
    "categoria",
  )
  const [rows, setRows] = React.useState<FinanceExpense[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Saldo de CxP abierto (para el KPI combinado de obligaciones).
  const [cxpOpen, setCxpOpen] = React.useState(0)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FinanceExpense | null>(null)

  React.useEffect(() => {
    if (!canView) return
    let active = true
    Promise.all([listSedes(), listCategories()])
      .then(([sd, cats]) => {
        if (!active) return
        setSedes(sd.filter((s) => s.active))
        setCategories(cats)
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const loadCxpKpi = React.useCallback(async () => {
    try {
      const pays = await listPayables({})
      const open = pays
        .filter((p) => p.status === "open" || p.status === "partial")
        .reduce((s, p) => s + (p.amount - p.paidAmount), 0)
      setCxpOpen(open)
    } catch {
      /* KPI best-effort */
    }
  }, [])

  React.useEffect(() => {
    if (canView) void loadCxpKpi()
  }, [canView, loadCxpKpi])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listExpenses({
        sedeId: sedeId === ALL ? undefined : sedeId,
        from,
        to,
        status: status === ALL ? undefined : (status as ExpenseStatus),
      })
      setRows(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, from, to, status])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Gastos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los gastos.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const visibleRows =
    categoryId === ALL ? rows : rows.filter((r) => r.categoryId === categoryId)
  const totalPeriodo = visibleRows.reduce((s, r) => s + r.amount + r.taxAmount, 0)
  const gastosPorPagar = visibleRows
    .filter((r) => r.status === "payable")
    .reduce((s, r) => s + r.amount + r.taxAmount, 0)
  const obligaciones = gastosPorPagar + cxpOpen

  // Gastos agrupados por categoría (vista por defecto).
  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      { categoryId: string; name: string; count: number; amount: number; tax: number }
    >()
    for (const r of visibleRows) {
      const g = map.get(r.categoryId) ?? {
        categoryId: r.categoryId,
        name: r.categoryName,
        count: 0,
        amount: 0,
        tax: 0,
      }
      g.count += 1
      g.amount += r.amount
      g.tax += r.taxAmount
      map.set(r.categoryId, g)
    }
    return [...map.values()].sort(
      (a, b) => b.amount + b.tax - (a.amount + a.tax),
    )
  }, [visibleRows])

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }
  function openEdit(e: FinanceExpense) {
    setEditing(e)
    setSheetOpen(true)
  }

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"

  const actions =
    tab === "gastos" ? (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {canManage && (
          <Button data-tour="gastos-nuevo" className="gap-1.5" onClick={openNew}>
            <Plus className="size-4" />
            Nuevo gasto
          </Button>
        )}
      </div>
    ) : null

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Gastos"
        description="Gastos operativos, plantillas recurrentes y cuentas por pagar en un solo lugar."
        actions={actions}
      />

      <div
        data-tour="gastos-kpis"
        className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <Kpi label="Gasto del período" value={money.format(totalPeriodo)} />
        <Kpi label="Gastos por pagar" value={money.format(gastosPorPagar)} accent />
        <Kpi label="CxP (saldo abierto)" value={money.format(cxpOpen)} accent />
        <Kpi label="Total obligaciones" value={money.format(obligaciones)} accent />
      </div>

      {/* Pestañas */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "gastos" && (
        <>
          <Card data-tour="gastos-filtro" className="mb-4">
            <CardContent className="flex flex-wrap items-end gap-3 py-4">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Sede</Label>
                <select
                  className={`${inputClass} w-48`}
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                >
                  <option value={ALL}>Todas las sedes</option>
                  {sedes.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Categoría</Label>
                <select
                  className={`${inputClass} w-44`}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value={ALL}>Todas</option>
                  {categories
                    .filter((c) => c.kind === "expense")
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Desde</Label>
                <Input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Hasta</Label>
                <Input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Estado</Label>
                <select
                  className={`${inputClass} w-40`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.l}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="mb-3 inline-flex rounded-lg border border-border bg-muted/40 p-1">
            {(
              [
                { v: "categoria", l: "Por categoría" },
                { v: "detalle", l: "Detalle" },
              ] as const
            ).map((t) => (
              <button
                key={t.v}
                onClick={() => setGastoView(t.v)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  gastoView === t.v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>

          <Card data-tour="gastos-tabla">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col gap-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : error ? (
                <p className="py-10 text-center text-sm text-destructive">{error}</p>
              ) : visibleRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <FileMinus className="size-9 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No hay gastos en este rango.
                  </p>
                </div>
              ) : gastoView === "categoria" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead>Participación</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped.map((g) => {
                      const total = g.amount + g.tax
                      const share = totalPeriodo > 0 ? (total / totalPeriodo) * 100 : 0
                      return (
                        <TableRow
                          key={g.categoryId}
                          className="cursor-pointer"
                          onClick={() => {
                            setCategoryId(g.categoryId)
                            setGastoView("detalle")
                          }}
                        >
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {g.count}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                <span
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${share}%` }}
                                />
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {share.toFixed(0)}%
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money.format(g.amount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {g.tax ? money.format(g.tax) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {money.format(total)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">
                        Total ({grouped.length} categoría{grouped.length === 1 ? "" : "s"})
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {visibleRows.length}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(visibleRows.reduce((s, r) => s + r.amount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(visibleRows.reduce((s, r) => s + r.taxAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(totalPeriodo)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {canManage && <TableHead className="text-right"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {r.concept}
                            {r.recurring && (
                              <Repeat className="size-3.5 text-muted-foreground" />
                            )}
                          </span>
                          {r.supplierName && (
                            <span className="block text-xs text-muted-foreground">
                              {r.supplierName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{r.categoryName}</TableCell>
                        <TableCell>{sedeName(r.sedeId)}</TableCell>
                        <TableCell>
                          <ExpenseStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money.format(r.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.taxAmount ? money.format(r.taxAmount) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money.format(r.amount + r.taxAmount)}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEdit(r)}
                                title="Editar"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <DeleteButton
                                label="¿Eliminar este gasto?"
                                onConfirm={() => deleteExpense(r._id)}
                                onDeleted={() => void load()}
                              />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-semibold">
                        Total ({visibleRows.length})
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(visibleRows.reduce((s, r) => s + r.amount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(visibleRows.reduce((s, r) => s + r.taxAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money.format(totalPeriodo)}
                      </TableCell>
                      {canManage && <TableCell />}
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === "recurrentes" && (
        <RecurringPanel
          sedes={sedes}
          categories={categories}
          canManage={canManage}
          canManageCategories={canManageCategories}
          onCategoryCreated={addCategory}
          onChanged={() => void load()}
        />
      )}

      {tab === "cxp" && <PayablesPanel showKpis={false} />}

      {canManage && (
        <ExpenseSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editing={editing}
          sedes={sedes}
          categories={categories}
          canManageCategories={canManageCategories}
          onCategoryCreated={addCategory}
          onSaved={() => {
            setSheetOpen(false)
            void load()
          }}
        />
      )}
    </>
  )
}

function DeleteButton({
  label,
  onConfirm,
  onDeleted,
}: {
  label: string
  onConfirm: () => Promise<void>
  onDeleted: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const confirm = useConfirm()
  async function remove() {
    if (!(await confirm({ title: label, destructive: true }))) return
    setBusy(true)
    try {
      await onConfirm()
      onDeleted()
    } catch {
      /* no-op */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      onClick={() => void remove()}
      title="Eliminar"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  )
}

// ─── Gastos recurrentes ──────────────────────────────────────────────────────

function RecurringPanel({
  sedes,
  categories,
  canManage,
  canManageCategories,
  onCategoryCreated,
  onChanged,
}: {
  sedes: Sede[]
  categories: FinanceCategory[]
  canManage: boolean
  canManageCategories: boolean
  onCategoryCreated: (cat: FinanceCategory) => void
  onChanged: () => void
}) {
  const [rows, setRows] = React.useState<FinanceRecurringExpense[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FinanceRecurringExpense | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listRecurring())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"

  async function generateNow() {
    setRunning(true)
    setMsg(null)
    try {
      const res = await runRecurring()
      setMsg(
        res.generated > 0
          ? `Se generaron ${res.generated} gasto(s) de ${res.templates} plantilla(s).`
          : "No había gastos recurrentes pendientes.",
      )
      await load()
      onChanged()
    } catch (err) {
      setMsg(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  async function toggleActive(t: FinanceRecurringExpense) {
    await updateRecurring(t._id, { active: !t.active })
    await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-muted-foreground">
          Plantillas que generan un gasto cada período (arriendo, servicios,
          suscripciones…). Las activas se generan solas a diario; también puedes
          generarlas al instante.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={running}
                onClick={() => void generateNow()}
              >
                {running ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generar ahora
              </Button>
              <Button
                className="gap-1.5"
                onClick={() => {
                  setEditing(null)
                  setSheetOpen(true)
                }}
              >
                <Plus className="size-4" />
                Nueva plantilla
              </Button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <CalendarClock className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay plantillas de gasto recurrente.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Última generación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  {canManage && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="font-medium">
                      {t.concept}
                      {t.supplierName && (
                        <span className="block text-xs text-muted-foreground">
                          {t.supplierName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{t.categoryName}</TableCell>
                    <TableCell>{sedeName(t.sedeId)}</TableCell>
                    <TableCell>
                      {RECURRENCE_FREQUENCY_LABELS[t.frequency]}
                      {t.frequency !== "weekly" && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · día {t.dayOfMonth}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {t.lastGeneratedDate ? fmtDate(t.lastGeneratedDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {t.active ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Pausada
                          </Badge>
                        )}
                        {t.active && t.autoGenerate && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            Auto
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(t.amount + t.taxAmount)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void toggleActive(t)}
                            title={t.active ? "Pausar" : "Activar"}
                          >
                            {t.active ? (
                              <Pause className="size-4" />
                            ) : (
                              <Play className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditing(t)
                              setSheetOpen(true)
                            }}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <DeleteButton
                            label="¿Eliminar esta plantilla? Los gastos ya generados no se borran."
                            onConfirm={() => deleteRecurring(t._id)}
                            onDeleted={() => void load()}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <RecurringSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editing={editing}
          sedes={sedes}
          categories={categories}
          canManageCategories={canManageCategories}
          onCategoryCreated={onCategoryCreated}
          onSaved={() => {
            setSheetOpen(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function RecurringSheet({
  open,
  onOpenChange,
  editing,
  sedes,
  categories,
  canManageCategories,
  onCategoryCreated,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: FinanceRecurringExpense | null
  sedes: Sede[]
  categories: FinanceCategory[]
  canManageCategories: boolean
  onCategoryCreated: (cat: FinanceCategory) => void
  onSaved: () => void
}) {
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.active)

  const [sedeId, setSedeId] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [taxAmount, setTaxAmount] = React.useState("")
  const [frequency, setFrequency] = React.useState<RecurrenceFrequency>("monthly")
  const [dayOfMonth, setDayOfMonth] = React.useState("1")
  const [startDate, setStartDate] = React.useState(todayLocal())
  const [endDate, setEndDate] = React.useState("")
  const [defaultStatus, setDefaultStatus] = React.useState<ExpenseStatus>("payable")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("transfer")
  const [supplierName, setSupplierName] = React.useState("")
  const [note, setNote] = React.useState("")
  const [autoGenerate, setAutoGenerate] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setSedeId(editing.sedeId)
      setCategoryId(editing.categoryId)
      setConcept(editing.concept)
      setAmount(String(editing.amount))
      setTaxAmount(editing.taxAmount ? String(editing.taxAmount) : "")
      setFrequency(editing.frequency)
      setDayOfMonth(String(editing.dayOfMonth))
      setStartDate(editing.startDate.slice(0, 10))
      setEndDate(editing.endDate ? editing.endDate.slice(0, 10) : "")
      setDefaultStatus(editing.defaultStatus)
      setPaymentMethod(editing.paymentMethod ?? "transfer")
      setSupplierName(editing.supplierName ?? "")
      setNote(editing.note ?? "")
      setAutoGenerate(editing.autoGenerate)
    } else {
      setSedeId(sedes[0]?._id ?? "")
      setCategoryId(expenseCats[0]?._id ?? "")
      setConcept("")
      setAmount("")
      setTaxAmount("")
      setFrequency("monthly")
      setDayOfMonth("1")
      setStartDate(todayLocal())
      setEndDate("")
      setDefaultStatus("payable")
      setPaymentMethod("transfer")
      setSupplierName("")
      setNote("")
      setAutoGenerate(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: RecurringExpensePayload = {
      sedeId,
      categoryId,
      concept,
      amount: numOr(amount),
      taxAmount: numOr(taxAmount),
      frequency,
      dayOfMonth: Math.min(28, Math.max(1, Math.round(numOr(dayOfMonth) || 1))),
      startDate,
      endDate: endDate || null,
      defaultStatus,
      paymentMethod: defaultStatus === "paid" ? paymentMethod : undefined,
      supplierName: supplierName || undefined,
      note: note || undefined,
      autoGenerate,
    }
    try {
      if (editing) await updateRecurring(editing._id, payload)
      else await createRecurring(payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = sedeId && categoryId && concept.trim() && numOr(amount) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">
              {editing ? "Editar plantilla" : "Nueva plantilla recurrente"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "Actualiza la plantilla de gasto recurrente."
                : "Se generará un gasto cada período según la frecuencia."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className={inputClass}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <ExpenseCategorySelect
            value={categoryId}
            onChange={setCategoryId}
            categories={expenseCats}
            canCreate={canManageCategories}
            onCreated={(cat) => {
              onCategoryCreated(cat)
              setCategoryId(cat._id)
            }}
          />

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Arriendo local"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Monto (sin IVA)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">IVA</Label>
              <Input
                type="number"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Frecuencia</Label>
              <select
                className={inputClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
              >
                {(
                  Object.keys(RECURRENCE_FREQUENCY_LABELS) as RecurrenceFrequency[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {RECURRENCE_FREQUENCY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            {frequency !== "weekly" && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Día del mes (1–28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fin (opcional)</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado del gasto generado</Label>
            <select
              className={inputClass}
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value as ExpenseStatus)}
            >
              {(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((k) => (
                <option key={k} value={k}>
                  {EXPENSE_STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {defaultStatus === "paid" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Método de pago</Label>
              <select
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Proveedor (opcional)</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
            />
            Generar automáticamente cada período
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar" : "Crear plantilla"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Gasto puntual ───────────────────────────────────────────────────────────

function ExpenseSheet({
  open,
  onOpenChange,
  editing,
  sedes,
  categories,
  canManageCategories,
  onCategoryCreated,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: FinanceExpense | null
  sedes: Sede[]
  categories: FinanceCategory[]
  canManageCategories: boolean
  onCategoryCreated: (cat: FinanceCategory) => void
  onSaved: () => void
}) {
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.active)

  const [sedeId, setSedeId] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [taxAmount, setTaxAmount] = React.useState("")
  const [date, setDate] = React.useState(todayLocal())
  const [status, setStatus] = React.useState<ExpenseStatus>("paid")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")
  const [supplierName, setSupplierName] = React.useState("")
  const [recurring, setRecurring] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setSedeId(editing.sedeId)
      setCategoryId(editing.categoryId)
      setConcept(editing.concept)
      setAmount(String(editing.amount))
      setTaxAmount(editing.taxAmount ? String(editing.taxAmount) : "")
      setDate(editing.date.slice(0, 10))
      setStatus(editing.status)
      setPaymentMethod(editing.paymentMethod ?? "cash")
      setSupplierName(editing.supplierName ?? "")
      setRecurring(editing.recurring)
      setNote(editing.note ?? "")
    } else {
      setSedeId(sedes[0]?._id ?? "")
      setCategoryId(expenseCats[0]?._id ?? "")
      setConcept("")
      setAmount("")
      setTaxAmount("")
      setDate(todayLocal())
      setStatus("paid")
      setPaymentMethod("cash")
      setSupplierName("")
      setRecurring(false)
      setNote("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: ExpensePayload = {
      sedeId,
      categoryId,
      concept,
      amount: numOr(amount),
      taxAmount: numOr(taxAmount),
      date,
      status,
      paymentMethod: status === "paid" ? paymentMethod : undefined,
      supplierName: supplierName || undefined,
      recurring,
      note: note || undefined,
    }
    try {
      if (editing) await updateExpense(editing._id, payload)
      else await createExpense(payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = sedeId && categoryId && concept.trim() && numOr(amount) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">
              {editing ? "Editar gasto" : "Nuevo gasto"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "Actualiza los datos del gasto."
                : "Registra un gasto operativo."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className={inputClass}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <ExpenseCategorySelect
            value={categoryId}
            onChange={setCategoryId}
            categories={expenseCats}
            canCreate={canManageCategories}
            onCreated={(cat) => {
              onCategoryCreated(cat)
              setCategoryId(cat._id)
            }}
          />

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Arriendo local"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Monto (sin IVA)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">IVA</Label>
              <Input
                type="number"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Estado</Label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
              >
                {(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPENSE_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === "paid" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Método de pago</Label>
              <select
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Proveedor (opcional)</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Marcar como recurrente
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar" : "Registrar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Selector de categoría de gasto con opción inline de crear una nueva. */
function ExpenseCategorySelect({
  value,
  onChange,
  categories,
  canCreate,
  onCreated,
}: {
  value: string
  onChange: (v: string) => void
  categories: FinanceCategory[]
  canCreate: boolean
  onCreated: (cat: FinanceCategory) => void
}) {
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function create() {
    const clean = name.trim()
    if (!clean) return
    setBusy(true)
    setError(null)
    try {
      const cat = await createCategory({ name: clean, kind: "expense" })
      onCreated(cat)
      setName("")
      setCreating(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Categoría</Label>
        {canCreate && !creating && (
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:underline"
            onClick={() => setCreating(true)}
          >
            + Nueva categoría
          </button>
        )}
      </div>
      {creating ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
          <Input
            value={name}
            autoFocus
            placeholder="Nombre de la categoría"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void create()
              }
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(false)
                setName("")
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Crear
            </Button>
          </div>
        </div>
      ) : (
        <select
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecciona…</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  if (status === "paid") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        Pagado
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-amber-600">
      Por pagar
    </Badge>
  )
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`font-display text-2xl leading-tight ${
            accent ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}
