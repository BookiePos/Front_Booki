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
import { CierreAnualCard } from "@/components/erp/cierre-anual-card"
import { Termino } from "@/components/ui/help-tip"
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
import { useLoadEffect } from "@/hooks/use-load-effect"

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

  useLoadEffect(load, canView)

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
        description={
          <>
            Los informes que te pide el contador o el banco, armados con tus
            ventas, tus <Termino term="gastoFijo">gastos</Termino> y tu{" "}
            <Termino term="costoDeVentas">costo de ventas</Termino>.
          </>
        }
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
          {/* El cierre anual vive junto a los estados que cambia (R4, 1.16). */}
          {(report === "balance-sheet" || report === "income-statement") && (
            <div className="mt-4">
              <CierreAnualCard />
            </div>
          )}
          {report === "trial-balance" && data && <TrialView r={data as TrialBalance} />}
          {report === "sales" && data && (
            <SalesView r={data as SalesReport} sedes={sedes} />
          )}
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
          <span className={`stat-figure text-2xl ${r.utilidadNeta >= 0 ? "text-success-ink" : "text-destructive"}`}>
            {money.format(r.utilidadNeta)}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceView({ r }: { r: BalanceSheet }) {
  // Corte al 31 de diciembre de un año ya cerrado: el asiento de cierre llevó
  // la utilidad a la 3605 y por eso el resultado del ejercicio sale en 0.
  const cortaEnCierre =
    !!r.to?.endsWith("-12-31") &&
    r.resultadoEjercicio === 0 &&
    r.patrimonio.some((l) => l.code === "3605" && l.amount !== 0)
  return (
    <div className="flex flex-col gap-4">
      {cortaEnCierre && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">
            Este año ya está cerrado: su utilidad o pérdida quedó en la línea{" "}
            <span className="font-mono">3605</span> del patrimonio, y por eso el
            «Resultado del ejercicio» sale en 0. Desde el 1 de enero pasa a la 3705.
          </CardContent>
        </Card>
      )}
      <LineTable title="Activo" lines={r.activos} total={r.totalActivo} />
      <div className="grid gap-4 md:grid-cols-2">
        <LineTable title="Pasivo" lines={r.pasivos} total={r.totalPasivo} />
        <LineTable
          title="Patrimonio"
          lines={[
            ...r.patrimonio,
            // Lo de años anteriores sin cerrar va aparte (R4, revisión 1.16).
            ...(r.resultadoAnterioresSinCerrar
              ? [
                  {
                    code: "37",
                    name: "Resultados de años anteriores sin cerrar",
                    amount: r.resultadoAnterioresSinCerrar,
                  },
                ]
              : []),
            { code: "36", name: "Resultado del ejercicio", amount: r.resultadoEjercicio },
          ]}
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

const SALES_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Fiado",
}

/** Cómo se devolvió la plata (`REFUND_METHODS` del backend). */
const REFUND_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  credit_note: "Saldo a favor",
  none: "Cambio por otro producto",
}

/** Por qué volvió (`RETURN_REASONS` del backend). */
const RETURN_REASON_LABELS: Record<string, string> = {
  defectuoso: "Defectuoso",
  equivocado: "Equivocado",
  sobrante: "Sobrante",
  garantia: "Garantía",
  otro: "Otro",
}

function SalesView({ r, sedes }: { r: SalesReport; sedes: Sede[] }) {
  const sedeName = (id: string | null) =>
    id ? (sedes.find((s) => s._id === id)?.name ?? "—") : "—"
  // Por medio de pago va en bruto (lo cobrado): su % es sobre las brutas.
  // Por sede va neto: su % es sobre las netas.
  const share = (v: number) => (r.totalRevenue > 0 ? (v / r.totalRevenue) * 100 : 0)
  const shareBruto = (v: number) =>
    r.totalGrossRevenue > 0 ? (v / r.totalGrossRevenue) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Netas de devoluciones (R3, revisión 1.16): la devolución resta el
          día en que ocurre, como la 4175 en el libro. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Kpi label="Ventas brutas" value={money.format(r.totalGrossRevenue)} />
        <Kpi
          label={`Devoluciones (${r.totalReturnsCount})`}
          value={money.format(-r.totalReturns)}
        />
        <Kpi label="Ventas netas" value={money.format(r.totalRevenue)} />
        <Kpi label="Tiquetes" value={String(r.totalTickets)} />
        <Kpi label="Ticket promedio neto" value={money.format(r.avgTicket)} />
        <Kpi label="Impuestos netos" value={money.format(r.totalTax)} />
      </div>

      {/* Desglose por medio de pago y por sede */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="px-0 sm:px-2">
            <p className="px-4 pt-3 text-sm font-semibold text-foreground">
              Por medio de pago{" "}
              <span className="font-normal text-muted-foreground">
                (bruto, antes de devoluciones)
              </span>
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Tiquetes</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.byMethod.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Sin ventas.
                    </TableCell>
                  </TableRow>
                )}
                {r.byMethod.map((m) => (
                  <TableRow key={m.method}>
                    <TableCell>{SALES_METHOD_LABELS[m.method] ?? m.method}</TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {m.tickets}
                    </TableCell>
                    <TableCell className="tnum text-right font-medium">
                      {money.format(m.revenue)}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {shareBruto(m.revenue).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-0 sm:px-2">
            <p className="px-4 pt-3 text-sm font-semibold text-foreground">
              Por sede
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Tiquetes</TableHead>
                  <TableHead className="text-right">Devoluciones</TableHead>
                  <TableHead className="text-right">Netas</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.bySede.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Sin ventas.
                    </TableCell>
                  </TableRow>
                )}
                {r.bySede.map((s) => (
                  <TableRow key={s.sedeId ?? "none"}>
                    <TableCell>{sedeName(s.sedeId)}</TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {s.tickets}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {s.returns ? money.format(-s.returns) : "—"}
                    </TableCell>
                    <TableCell className="tnum text-right font-medium">
                      {money.format(s.revenue)}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {share(s.revenue).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Top productos */}
      <Card>
        <CardContent className="px-0 sm:px-2">
          <p className="px-4 pt-3 text-sm font-semibold text-foreground">
            Top productos (por ventas netas)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad neta</TableHead>
                <TableHead className="text-right">Devuelto</TableHead>
                <TableHead className="text-right">Netas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.topProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Sin ventas de productos en este rango.
                  </TableCell>
                </TableRow>
              )}
              {r.topProducts.map((p, i) => (
                <TableRow key={p.productId ?? `p-${i}`}>
                  <TableCell className="font-medium">
                    <span className="mr-1.5 text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    {p.name}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {p.qty}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {p.returnedQty ? `${p.returnedQty} · ${money.format(-p.returned)}` : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right font-medium">
                    {money.format(p.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ventas por día */}
      <Card>
        <CardContent className="px-0 sm:px-2">
          <p className="px-4 pt-3 text-sm font-semibold text-foreground">
            Ventas por día
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead className="text-right">Tiquetes</TableHead>
                <TableHead className="text-right">Brutas</TableHead>
                <TableHead className="text-right">Devoluciones</TableHead>
                <TableHead className="text-right">Netas</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Sin ventas en este rango.
                  </TableCell>
                </TableRow>
              )}
              {r.days.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell className="tnum text-right">{d.tickets}</TableCell>
                  <TableCell className="tnum text-right">{money.format(d.grossRevenue)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {d.returnsCount ? `${money.format(-d.returns)} (${d.returnsCount})` : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right font-medium">{money.format(d.revenue)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {/* Un día con solo devoluciones no tiene tiquetes: sin promedio. */}
                    {d.tickets > 0 ? money.format(d.avgTicket) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {r.days.length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="tnum text-right">{r.totalTickets}</TableCell>
                  <TableCell className="tnum text-right">{money.format(r.totalGrossRevenue)}</TableCell>
                  <TableCell className="tnum text-right">
                    {r.totalReturnsCount
                      ? `${money.format(-r.totalReturns)} (${r.totalReturnsCount})`
                      : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right">{money.format(r.totalRevenue)}</TableCell>
                  <TableCell className="tnum text-right">{money.format(r.avgTicket)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Devoluciones del rango, por motivo y por medio */}
      {r.returns.count > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable
            title="Devoluciones por motivo"
            head="Motivo"
            rows={r.returns.byReason.map((x) => ({
              key: x.reason,
              label: RETURN_REASON_LABELS[x.reason] ?? x.reason,
              count: x.count,
              amount: x.amount,
            }))}
          />
          <BreakdownTable
            title="Devoluciones por medio"
            head="Medio"
            rows={r.returns.byMethod.map((x) => ({
              key: x.method,
              label: REFUND_METHOD_LABELS[x.method] ?? x.method,
              count: x.count,
              amount: x.amount,
            }))}
          />
        </div>
      )}
    </div>
  )
}

function BreakdownTable({
  title,
  head,
  rows,
}: {
  title: string
  head: string
  rows: { key: string; label: string; count: number; amount: number }[]
}) {
  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <p className="px-4 pt-3 text-sm font-semibold text-foreground">{title}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{head}</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((x) => (
              <TableRow key={x.key}>
                <TableCell>{x.label}</TableCell>
                <TableCell className="tnum text-right text-muted-foreground">{x.count}</TableCell>
                <TableCell className="tnum text-right font-medium">{money.format(x.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
