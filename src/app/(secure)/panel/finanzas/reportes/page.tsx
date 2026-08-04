"use client"

import * as React from "react"
import { ShieldOff, TrendingUp, RefreshCw, Scale, BookOpen, BarChart3 } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  getIncomeStatement,
  getBalanceSheet,
  getTrialBalance,
  getSalesReport,
  type IncomeStatement,
  type BalanceSheet,
  type TrialBalance,
  type SalesReport,
} from "@/lib/erp/api-reports"
import { money, monthStart, todayLocal, fmtDate, errorMessage } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "all"
type ReportKey = "income-statement" | "balance-sheet" | "trial-balance" | "sales"

const REPORTS: { key: ReportKey; label: string; icon: typeof TrendingUp }[] = [
  { key: "income-statement", label: "Estado de resultados", icon: TrendingUp },
  { key: "balance-sheet", label: "Balance general", icon: Scale },
  { key: "trial-balance", label: "Balance de comprobación", icon: BookOpen },
  { key: "sales", label: "Ventas por día", icon: BarChart3 },
]

export default function ReportesPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("reports.view")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState(ALL)
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [report, setReport] = React.useState<ReportKey>("income-statement")

  const [data, setData] = React.useState<
    IncomeStatement | BalanceSheet | TrialBalance | SalesReport | null
  >(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!canView) return
    listSedes()
      .then((sd) => setSedes(sd.filter((s) => s.active)))
      .catch(() => {})
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const sede = sedeId === ALL ? undefined : sedeId
    try {
      if (report === "income-statement") setData(await getIncomeStatement({ from, to, sedeId: sede }))
      else if (report === "balance-sheet") setData(await getBalanceSheet({ to, sedeId: sede }))
      else if (report === "trial-balance") setData(await getTrialBalance({ from, to, sedeId: sede }))
      else setData(await getSalesReport({ from, to, sedeId: sede }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [report, from, to, sedeId])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Reportes" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>reports.view</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Reportes"
        description="Estados financieros leídos del ledger de partida doble y ventas de la operación."
        actions={
          <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div data-tour="reportes-tipos" className="mb-4 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <Button
            key={r.key}
            variant={report === r.key ? "default" : "outline"}
            size="sm"
            onClick={() => setReport(r.key)}
          >
            <r.icon className="size-4" />
            {r.label}
          </Button>
        ))}
      </div>

      <Card data-tour="reportes-filtro" className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className="h-9 w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value={ALL}>Consolidado</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {report !== "balance-sheet" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" className="w-40" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{report === "balance-sheet" ? "Corte" : "Hasta"}</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {report === "income-statement" && data && <IncomeView r={data as IncomeStatement} />}
          {report === "balance-sheet" && data && <BalanceView r={data as BalanceSheet} />}
          {report === "trial-balance" && data && <TrialView r={data as TrialBalance} />}
          {report === "sales" && data && <SalesView r={data as SalesReport} />}
        </>
      )}
    </>
  )
}

function LineTable({ title, lines, total }: { title: string; lines: { code: string; name: string; amount: number }[]; total: number }) {
  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <p className="px-4 pt-3 text-sm font-semibold text-foreground">{title}</p>
        <Table>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                  Sin movimientos en el ledger para este rango.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow key={l.code}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{l.code}</span> {l.name}
                </TableCell>
                <TableCell className="tnum text-right font-medium">{money.format(l.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm font-semibold">
          <span>Total {title.toLowerCase()}</span>
          <span className="tnum">{money.format(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function IncomeView({ r }: { r: IncomeStatement }) {
  return (
    <div className="flex flex-col gap-4">
      <LineTable title="Ingresos" lines={r.ingresos} total={r.totalIngresos} />
      <LineTable title="Gastos" lines={r.gastos} total={r.totalGastos} />
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="font-display text-lg">Utilidad neta</span>
          <span className={`stat-figure text-2xl ${r.utilidadNeta >= 0 ? "text-success" : "text-destructive"}`}>
            {money.format(r.utilidadNeta)}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceView({ r }: { r: BalanceSheet }) {
  return (
    <div className="flex flex-col gap-4">
      <LineTable title="Activo" lines={r.activos} total={r.totalActivo} />
      <div className="grid gap-4 md:grid-cols-2">
        <LineTable title="Pasivo" lines={r.pasivos} total={r.totalPasivo} />
        <LineTable
          title="Patrimonio"
          lines={[...r.patrimonio, { code: "36", name: "Resultado del ejercicio", amount: r.resultadoEjercicio }]}
          total={r.totalPatrimonio}
        />
      </div>
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Activo = Pasivo + Patrimonio</span>
          <Badge variant={r.cuadra ? "default" : "destructive"}>{r.cuadra ? "Cuadra" : "Descuadrado"}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}

function TrialView({ r }: { r: TrialBalance }) {
  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Débito</TableHead>
              <TableHead className="text-right">Crédito</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  El ledger no tiene asientos en este rango.
                </TableCell>
              </TableRow>
            )}
            {r.rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{row.code}</span> {row.name}
                </TableCell>
                <TableCell className="tnum text-right">{money.format(row.debit)}</TableCell>
                <TableCell className="tnum text-right">{money.format(row.credit)}</TableCell>
                <TableCell className="tnum text-right font-medium">{money.format(row.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm font-semibold">
          <span>Totales</span>
          <span className="tnum">
            {money.format(r.totalDebit)} / {money.format(r.totalCredit)}
            <Badge variant={r.balanced ? "default" : "destructive"} className="ml-2">
              {r.balanced ? "Cuadrado" : "Descuadrado"}
            </Badge>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function SalesView({ r }: { r: SalesReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi label="Ingresos" value={money.format(r.totalRevenue)} />
        <Kpi label="Tiquetes" value={String(r.totalTickets)} />
        <Kpi label="Ticket promedio" value={money.format(r.avgTicket)} />
      </div>
      <Card>
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead className="text-right">Tiquetes</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin ventas en este rango.
                  </TableCell>
                </TableRow>
              )}
              {r.days.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell className="tnum text-right">{d.tickets}</TableCell>
                  <TableCell className="tnum text-right font-medium">{money.format(d.revenue)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{money.format(d.avgTicket)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="stat-figure mt-1 text-2xl text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
