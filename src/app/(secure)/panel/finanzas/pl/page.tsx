"use client"

import * as React from "react"
import {
  ShieldOff,
  TrendingUp,
  RefreshCw,
  BarChart3,
  FileText,
  Loader2,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  getPL,
  listBudgets,
  getBudgetVsActual,
  MONTHS_SHORT,
  type PLReport,
  type FinanceBudget,
  type BudgetVsActual,
} from "@/lib/erp/api-finance"
import { money, todayLocal, monthStart, errorMessage } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const ALL = "all"
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type View = "pl" | "vs"

export default function PlPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [view, setView] = React.useState<View>("pl")

  React.useEffect(() => {
    if (!canView) return
    let active = true
    listSedes()
      .then((sd) => active && setSedes(sd.filter((s) => s.active)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canView])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Estado de resultados" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los reportes financieros.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const sedeSelector = (
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
  )

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Estado de resultados"
        description="P&L del período e IVA, y comparativo Presupuesto vs Real."
        actions={sedeSelector}
      />

      <div data-tour="pl-vistas" className="mb-4 flex flex-wrap gap-1">
        <Button
          data-tour="pl-estado"
          variant={view === "pl" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("pl")}
        >
          <FileText className="size-4" />
          Estado de resultados
        </Button>
        <Button
          data-tour="pl-vs"
          variant={view === "vs" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("vs")}
        >
          <BarChart3 className="size-4" />
          Presupuesto vs Real
        </Button>
      </div>

      {view === "pl" ? (
        <PLView
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          sedeId={sedeId === ALL ? undefined : sedeId}
        />
      ) : (
        <VsActualView sedeId={sedeId === ALL ? undefined : sedeId} />
      )}
    </>
  )
}

// ── Estado de resultados ─────────────────────────────────────────────────────
function PLView({
  from,
  to,
  setFrom,
  setTo,
  sedeId,
}: {
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
  sedeId?: string
}) {
  const [data, setData] = React.useState<PLReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getPL({ from, to, sedeId }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [from, to, sedeId])

  React.useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
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
          <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="py-4">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Estado de resultados
              </p>
              <PLLine label="Ingresos" value={data.ingresos} strong />
              <PLLine label="(−) Costo de ventas" value={-data.cogs} muted />
              <PLLine label="Margen bruto" value={data.margenBruto} divider strong />
              <PLLine label="(−) Nómina" value={-data.nomina} muted />
              <div className="mt-2 mb-1 text-xs font-medium text-muted-foreground">
                Gastos operativos
              </div>
              {data.gastos.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">Sin gastos.</p>
              ) : (
                data.gastos.map((g, i) => (
                  <PLLine
                    key={g.categoryId ?? `g-${i}`}
                    label={g.label}
                    value={-g.amount}
                    muted
                    indent
                  />
                ))
              )}
              <PLLine label="(−) Total gastos" value={-data.gastosTotal} muted divider />
              <PLLine
                label="Utilidad operativa"
                value={data.utilidadOperativa}
                divider
                strong
                accent
              />
            </CardContent>
          </Card>

          <Card className="self-start">
            <CardContent className="py-4">
              <p className="mb-3 text-sm font-semibold text-foreground">IVA</p>
              <PLLine label="IVA generado (ventas)" value={data.ivaGenerado} />
              <PLLine label="IVA descontable (compras)" value={data.ivaDescontable} muted />
              <PLLine label="IVA por pagar" value={data.ivaPorPagar} divider strong accent />
              <p className="mt-3 text-[11px] text-muted-foreground">
                Diferencia entre el IVA cobrado en ventas y el IVA pagado en compras
                y gastos del período.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function PLLine({
  label,
  value,
  strong,
  muted,
  divider,
  accent,
  indent,
}: {
  label: string
  value: number
  strong?: boolean
  muted?: boolean
  divider?: boolean
  accent?: boolean
  indent?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 text-sm ${
        divider ? "mt-1 border-t border-border pt-2" : ""
      }`}
    >
      <span
        className={`${indent ? "pl-3" : ""} ${
          strong ? "font-semibold" : muted ? "text-muted-foreground" : ""
        }`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? "font-semibold" : ""
        } ${accent ? "text-primary" : value < 0 ? "text-muted-foreground" : ""}`}
      >
        {money.format(value)}
      </span>
    </div>
  )
}

// ── Presupuesto vs Real ──────────────────────────────────────────────────────
function VsActualView({ sedeId }: { sedeId?: string }) {
  const nowYear = new Date().getFullYear()
  const [year, setYear] = React.useState(nowYear)
  const [budgets, setBudgets] = React.useState<FinanceBudget[]>([])
  const [budgetId, setBudgetId] = React.useState("")
  const [data, setData] = React.useState<BudgetVsActual | null>(null)
  const [loadingList, setLoadingList] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setLoadingList(true)
    listBudgets(year)
      .then((bs) => {
        if (!active) return
        setBudgets(bs)
        setBudgetId((prev) =>
          bs.some((b) => b._id === prev) ? prev : (bs[0]?._id ?? ""),
        )
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoadingList(false))
    return () => {
      active = false
    }
  }, [year])

  const load = React.useCallback(async () => {
    if (!budgetId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getBudgetVsActual(budgetId, sedeId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [budgetId, sedeId])

  React.useEffect(() => {
    void load()
  }, [load])

  const years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Año fiscal</Label>
            <select
              className={`${inputClass} w-28`}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Presupuesto</Label>
            <select
              className={`${inputClass} w-64`}
              value={budgetId}
              onChange={(e) => setBudgetId(e.target.value)}
              disabled={loadingList || budgets.length === 0}
            >
              {budgets.length === 0 && <option value="">Sin presupuestos</option>}
              {budgets.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} · {b.scenario}
                </option>
              ))}
            </select>
          </div>
          {loading && <Loader2 className="mb-1.5 size-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      {loadingList ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <BarChart3 className="size-9 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              No hay presupuestos para {year}. Crea uno en la página de Presupuestos.
            </p>
          </CardContent>
        </Card>
      ) : data ? (
        <VsActualMatrix data={data} />
      ) : null}
    </div>
  )
}

function VsActualMatrix({ data }: { data: BudgetVsActual }) {
  const compact = new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                Categoría
              </th>
              {MONTHS_SHORT.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <React.Fragment key={line.categoryId}>
                <tr className="border-b border-border/60">
                  <td
                    rowSpan={3}
                    className="sticky left-0 z-10 bg-card px-3 py-1.5 align-top font-medium"
                  >
                    {line.categoryName}
                  </td>
                  <RowCells
                    label="Ppto"
                    values={line.monthlyBudget}
                    total={line.totalBudget}
                    fmt={compact}
                    muted
                  />
                </tr>
                <tr className="border-b border-border/60">
                  <RowCells
                    label="Real"
                    values={line.monthlyActual}
                    total={line.totalActual}
                    fmt={compact}
                  />
                </tr>
                <tr className="border-b border-border">
                  <VarRowCells
                    budget={line.monthlyBudget}
                    actual={line.monthlyActual}
                    totalBudget={line.totalBudget}
                    totalActual={line.totalActual}
                    kind={line.kind}
                    fmt={compact}
                  />
                </tr>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="sticky left-0 z-10 bg-card px-3 py-2">Totales</td>
              <td colSpan={12} className="px-2 py-2 text-right text-muted-foreground">
                Ppto {money.format(data.totals.budget)} · Real{" "}
                {money.format(data.totals.actual)}
              </td>
              <td className="px-3 py-2 text-right">
                {money.format(data.totals.actual)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  )
}

function RowCells({
  label,
  values,
  total,
  fmt,
  muted,
}: {
  label: string
  values: number[]
  total: number
  fmt: Intl.NumberFormat
  muted?: boolean
}) {
  return (
    <>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-2 py-1 text-right tabular-nums ${
            muted ? "text-muted-foreground" : ""
          }`}
        >
          <span className="mr-1 text-[10px] text-muted-foreground">{i === 0 ? label : ""}</span>
          {v ? fmt.format(v) : "—"}
        </td>
      ))}
      <td className={`px-3 py-1 text-right font-medium tabular-nums ${muted ? "text-muted-foreground" : ""}`}>
        {fmt.format(total)}
      </td>
    </>
  )
}

/** Fila de varianza (Real − Ppto). Para ingresos, positivo es bueno (verde);
 *  para costos/gastos, gastar menos que el presupuesto es bueno (verde). */
function VarRowCells({
  budget,
  actual,
  totalBudget,
  totalActual,
  kind,
  fmt,
}: {
  budget: number[]
  actual: number[]
  totalBudget: number
  totalActual: number
  kind: string
  fmt: Intl.NumberFormat
}) {
  const isIncome = kind === "income"
  const cls = (variance: number) => {
    if (variance === 0) return "text-muted-foreground"
    const good = isIncome ? variance > 0 : variance < 0
    return good ? "text-emerald-600" : "text-destructive"
  }
  return (
    <>
      {budget.map((b, i) => {
        const variance = (actual[i] ?? 0) - b
        return (
          <td key={i} className={`px-2 py-1 text-right tabular-nums ${cls(variance)}`}>
            <span className="mr-1 text-[10px] text-muted-foreground">
              {i === 0 ? "Var" : ""}
            </span>
            {variance === 0 ? "—" : fmt.format(variance)}
          </td>
        )
      })}
      <td className={`px-3 py-1 text-right font-medium tabular-nums ${cls(totalActual - totalBudget)}`}>
        {fmt.format(totalActual - totalBudget)}
      </td>
    </>
  )
}
