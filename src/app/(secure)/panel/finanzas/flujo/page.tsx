"use client"

import * as React from "react"
import {
  ShieldOff,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart as LineChartIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  getCashflow,
  type CashflowProjection,
  type CashflowBucket,
} from "@/lib/erp/api-finance"
import { money, fmtDate, errorMessage } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "all"
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/** Rango corto de un bucket, ej. "28 jul – 3 ago". */
function bucketLabel(b: CashflowBucket): string {
  return `${fmtDate(b.from)} – ${fmtDate(b.to)}`
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/** Fila de la proyección (semana o mes agregado). */
interface FlowRow {
  key: string
  label: string
  sub: string
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

/** Convierte los buckets semanales del backend en filas por semana o por mes. */
function buildRows(buckets: CashflowBucket[], groupBy: "week" | "month"): FlowRow[] {
  if (groupBy === "week") {
    return buckets.map((b) => ({
      key: String(b.index),
      label: `Sem ${b.index + 1}`,
      sub: bucketLabel(b),
      inflows: { ...b.inflows },
      outflows: { ...b.outflows },
      net: b.net,
      balance: b.balance,
    }))
  }
  // Agrupa por mes calendario del inicio del bucket; el saldo del mes = saldo
  // del último bucket que cae en ese mes.
  const groups = new Map<string, FlowRow>()
  for (const b of buckets) {
    const ym = b.from.slice(0, 7)
    const [y, m] = ym.split("-")
    const label = `${MONTH_NAMES[Number(m) - 1]} ${y}`
    const prev = groups.get(ym)
    if (!prev) {
      groups.set(ym, {
        key: ym,
        label,
        sub: "",
        inflows: { ...b.inflows },
        outflows: { ...b.outflows },
        net: b.net,
        balance: b.balance,
      })
    } else {
      prev.inflows.receivables += b.inflows.receivables
      prev.inflows.projectedSales += b.inflows.projectedSales
      prev.inflows.total += b.inflows.total
      prev.outflows.payables += b.outflows.payables
      prev.outflows.recurringExpenses += b.outflows.recurringExpenses
      prev.outflows.payroll += b.outflows.payroll
      prev.outflows.total += b.outflows.total
      prev.net += b.net
      prev.balance = b.balance // último del mes
    }
  }
  return [...groups.values()]
}

export default function FlujoCajaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [days, setDays] = React.useState<number>(90)
  const [groupBy, setGroupBy] = React.useState<"week" | "month">("week")
  const [includeProjections, setIncludeProjections] = React.useState(true)
  const [data, setData] = React.useState<CashflowProjection | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

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

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCashflow({
        days,
        sedeId: sedeId === ALL ? undefined : sedeId,
        includeProjections,
      })
      setData(res)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [days, sedeId, includeProjections])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Flujo de caja proyectado" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver el flujo de caja.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const actions = (
    <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
      <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  )

  const rows = data ? buildRows(data.buckets, groupBy) : []
  const maxAbs = data
    ? Math.max(
        Math.abs(data.openingBalance),
        1,
        ...rows.map((b) => Math.abs(b.balance)),
      )
    : 1

  const runwayValue = data
    ? data.runway.negative
      ? `Semana ${data.runway.weeks}`
      : "Saldo positivo"
    : "—"
  const runwaySub = data
    ? data.runway.negative
      ? `Déficit ~ ${fmtDate(data.runway.date ?? "")}`
      : `sin déficit en ${data.horizonDays} días`
    : ""

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Flujo de caja proyectado"
        description="Proyección semanal de entradas y salidas para estimar cuánto durará el efectivo (runway)."
        actions={actions}
      />

      <Card data-tour="flujo-filtro" className="mb-4">
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
            <Label className="text-xs">Horizonte</Label>
            <select
              className={`${inputClass} w-32`}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
              <option value={180}>180 días</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Agrupar por</Label>
            <select
              className={`${inputClass} w-28`}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "week" | "month")}
            >
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              checked={includeProjections}
              onChange={(e) => setIncludeProjections(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Incluir estimados (ventas, nómina, recurrentes)
          </label>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div
            data-tour="flujo-runway"
            className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5"
          >
            <Kpi
              label="Tesorería actual"
              value={money.format(data.openingBalance)}
              sub="bancos + efectivo en caja"
              icon={Wallet}
            />
            <Kpi
              label="Entradas (horizonte)"
              value={money.format(data.totals.inflows)}
              icon={TrendingUp}
              good
            />
            <Kpi
              label="Salidas (horizonte)"
              value={money.format(data.totals.outflows)}
              icon={TrendingDown}
              danger
            />
            <Kpi
              label="Saldo final proyectado"
              value={money.format(data.totals.endingBalance)}
              icon={LineChartIcon}
              danger={data.totals.endingBalance < 0}
            />
            <Kpi
              label="Runway"
              value={runwayValue}
              sub={runwaySub}
              danger={data.runway.negative}
              good={!data.runway.negative}
            />
          </div>

          {(data.overdue.receivables > 0 || data.overdue.payables > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Vencidos (ubicados en la primera semana):{" "}
                {data.overdue.receivables > 0 && (
                  <b>{money.format(data.overdue.receivables)} por cobrar</b>
                )}
                {data.overdue.receivables > 0 && data.overdue.payables > 0 && " · "}
                {data.overdue.payables > 0 && (
                  <b>{money.format(data.overdue.payables)} por pagar</b>
                )}
              </span>
            </div>
          )}

          <Card data-tour="flujo-proyeccion">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{groupBy === "week" ? "Semana" : "Mes"}</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Salidas</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">Saldo proyectado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((b) => (
                    <TableRow key={b.key}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{b.label}</span>
                        {b.sub && (
                          <span className="block text-xs text-muted-foreground">
                            {b.sub}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(b.inflows.total)}
                        <span className="block text-[11px] text-muted-foreground">
                          CxC {money.format(b.inflows.receivables)}
                          {data.includeProjections &&
                            ` · ventas ${money.format(b.inflows.projectedSales)}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(b.outflows.total)}
                        <span className="block text-[11px] text-muted-foreground">
                          CxP {money.format(b.outflows.payables)}
                          {data.includeProjections &&
                            ` · rec ${money.format(b.outflows.recurringExpenses)} · nóm ${money.format(b.outflows.payroll)}`}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          b.net < 0 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {b.net >= 0 ? "+" : ""}
                        {money.format(b.net)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`tabular-nums font-medium ${
                            b.balance < 0 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {money.format(b.balance)}
                        </span>
                        <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <span
                            className={`h-full rounded-full ${
                              b.balance < 0 ? "bg-destructive" : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (Math.abs(b.balance) / maxAbs) * 100,
                              )}%`,
                            }}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">
                      Total ({rows.length} {groupBy === "week" ? "sem" : "meses"})
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money.format(data.totals.inflows)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money.format(data.totals.outflows)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        data.totals.net < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {money.format(data.totals.net)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        data.totals.endingBalance < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {money.format(data.totals.endingBalance)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {data.includeProjections && (
            <p className="mt-3 text-xs text-muted-foreground">
              Estimados prorrateados por día: ventas ≈{" "}
              {money.format(data.assumptions.avgDailySales)}/día (promedio 30
              días) · nómina ≈ {money.format(data.assumptions.monthlyPayroll)}/mes
              (última corrida, sin provisiones) · gastos recurrentes ≈{" "}
              {money.format(data.assumptions.monthlyRecurringExpenses)}/mes. Los
              compromisos ciertos (CxC / CxP) usan su fecha de vencimiento.
            </p>
          )}
        </>
      ) : null}
    </>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  danger,
  good,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  danger?: boolean
  good?: boolean
}) {
  const tone = danger
    ? "text-destructive"
    : good
      ? "text-emerald-600"
      : "text-foreground"
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {Icon && <Icon className="size-3.5" />}
          {label}
        </span>
        <span className={`font-display text-xl leading-tight ${tone}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}
