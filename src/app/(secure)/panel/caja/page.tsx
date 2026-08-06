"use client"

import * as React from "react"
import {
  Wallet,
  ShieldOff,
  RefreshCw,
  MapPin,
  Banknote,
  Receipt,
  CircleDollarSign,
  DoorOpen,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  getCajaOverview,
  getCajaClosings,
  type CajaOverviewRow,
  type CajaOverview,
  type CajaClosingsReport,
} from "@/lib/erp/api-caja"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA")
}

function fmtTime(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export default function CajaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("pos.sell")

  const [date, setDate] = React.useState(todayLocal())
  const [data, setData] = React.useState<CajaOverview | null>(null)
  const [closings, setClosings] = React.useState<CajaClosingsReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, cl] = await Promise.all([
        getCajaOverview(date),
        getCajaClosings(date, date).catch(() => null),
      ])
      setData(ov)
      setClosings(cl)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [date])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Operación" title="Caja" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver el resumen de cajas.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const totals = data?.totals
  const isToday = date === todayLocal()

  const actions = (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1" data-tour="caja-dia">
        <Label htmlFor="fecha" className="text-xs">
          Día
        </Label>
        <Input
          id="fecha"
          type="date"
          value={date}
          max={todayLocal()}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
      </div>
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  )

  return (
    <>
      <PageHeader
        section="Operación"
        title="Caja"
        description="Resumen del día de las cajas por sede: apertura, cierre y ventas."
        actions={actions}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4" data-tour="caja-kpis">
        <Kpi
          icon={DoorOpen}
          label="Cajas abiertas"
          value={totals ? `${totals.openCount} / ${totals.sedes}` : "—"}
          hint={
            totals
              ? `${totals.closedCount} cerradas · ${totals.noneCount} sin abrir`
              : undefined
          }
        />
        <Kpi
          icon={Receipt}
          label="Ventas del día"
          value={totals ? money.format(totals.salesTotal) : "—"}
          hint={totals ? `${totals.salesCount} ventas` : undefined}
        />
        <Kpi
          icon={CircleDollarSign}
          label="Efectivo esperado"
          value={totals ? money.format(totals.expectedCashTotal) : "—"}
          hint={
            totals ? `Efectivo ventas: ${money.format(totals.cashSalesTotal)}` : undefined
          }
        />
        <Kpi
          icon={Banknote}
          label="Base de apertura"
          value={totals ? money.format(totals.openingTotal) : "—"}
        />
      </div>

      <Card data-tour="caja-tabla">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : !data || data.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Wallet className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No hay sedes para mostrar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Apertura</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Efectivo esperado</TableHead>
                  <TableHead className="text-right">Cierre (contado)</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <CajaRow key={r.sedeId} r={r} isToday={isToday} />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold" colSpan={2}>
                    Total ({data.totals.sedes} sedes)
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(data.totals.openingTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(data.totals.salesTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(data.totals.expectedCashTotal)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Cierres del día (arqueos): dinero en cada caja al cerrar ── */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <Banknote className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">
          Cierres del día — dinero en caja al cerrar
        </h2>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : !closings || closings.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <Banknote className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay cierres de caja este día.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Cada vez que un turno se cierra en el POS, queda aquí con el
                efectivo contado y su diferencia — aunque se abra un turno nuevo.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Cerrada</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Efectivo esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closings.rows.map((c) => (
                  <TableRow key={c.sessionId}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {c.sedeName}
                      </span>
                      {c.closedByEmail && (
                        <span className="block text-[11px] text-muted-foreground">
                          {c.closedByEmail}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtTime(c.closedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money.format(c.openingAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span>{money.format(c.salesTotal)}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {c.salesCount} venta{c.salesCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(c.expectedCash)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(c.countedAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <DifferenceCell value={c.difference} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold" colSpan={2}>
                    Total ({closings.totals.count} cierre
                    {closings.totals.count === 1 ? "" : "s"})
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(closings.totals.openingTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(closings.totals.salesTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(closings.totals.expectedCash)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(closings.totals.countedAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <DifferenceCell value={closings.totals.difference} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function CajaRow({ r, isToday }: { r: CajaOverviewRow; isToday: boolean }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-muted-foreground" />
          {r.sedeName}
        </span>
      </TableCell>
      <TableCell>
        <StatusBadge status={r.status} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {r.status === "none" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col items-end">
            <span>{money.format(r.openingAmount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">{fmtTime(r.openedAt)}</span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {r.status === "none" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col items-end">
            <span>{money.format(r.salesTotal)}</span>
            <span className="text-xs text-muted-foreground">
              {r.salesCount} venta{r.salesCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {r.status === "none" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          money.format(r.expectedCash ?? 0)
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {r.status === "closed" ? (
          <div className="flex flex-col items-end">
            <span>{money.format(r.countedAmount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">{fmtTime(r.closedAt)}</span>
          </div>
        ) : r.status === "open" ? (
          <span className="text-xs text-muted-foreground">
            {isToday ? "En curso" : "No cerró"}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {r.status === "closed" && r.difference !== undefined ? (
          <DifferenceCell value={r.difference} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function DifferenceCell({ value }: { value: number }) {
  const cls =
    value === 0
      ? "text-muted-foreground"
      : value > 0
        ? "text-emerald-600"
        : "text-destructive"
  const sign = value > 0 ? "+" : ""
  return (
    <span className={`font-medium ${cls}`}>
      {sign}
      {money.format(value)}
    </span>
  )
}

function StatusBadge({ status }: { status: CajaOverviewRow["status"] }) {
  if (status === "open") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Abierta
      </Badge>
    )
  }
  if (status === "closed") {
    return (
      <Badge variant="secondary" className="gap-1">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Cerrada
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Sin abrir
    </Badge>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p className="font-display text-2xl leading-tight text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
