"use client"

import * as React from "react"
import Link from "next/link"
import {
  ShoppingCart,
  Truck,
  ScanLine,
  BarChart3,
  Banknote,
  TrendingUp,
  TrendingDown,
  Receipt,
  HandCoins,
  UtensilsCrossed,
  Package,
  PackageX,
  Users,
  Compass,
  CalendarDays,
  CreditCard,
  Store,
  Trophy,
  Ticket,
  Percent,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import type { BusinessType } from "@/lib/api"
import { money, fmtDate } from "@/lib/erp/finance-format"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LayoutItem, WidgetDef, WidgetProps } from "./types"

// ─── Piezas reutilizables ─────────────────────────────────────────────────────

/** Tarjeta de cifra (KPI). Muestra “—” si no hay dato y esqueleto si carga. */
function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
  href,
  loading,
  featured,
}: {
  label: string
  value: string | null
  icon: LucideIcon
  tone?: string
  href?: string
  loading?: boolean
  featured?: boolean
}) {
  const inner = (
    <Card
      className={
        featured
          ? "h-full border-primary/30 gradient-brand text-primary-foreground shadow-[0_18px_40px_-24px_var(--primary)]"
          : "h-full transition-colors hover:border-primary/40"
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span
            className={
              featured
                ? "text-sm font-medium text-primary-foreground/85"
                : "text-sm font-medium text-muted-foreground"
            }
          >
            {label}
          </span>
          <span
            className={
              featured
                ? "flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15 text-primary-foreground [&_svg]:size-4"
                : `flex size-9 items-center justify-center rounded-lg bg-accent [&_svg]:size-4 ${tone}`
            }
          >
            <Icon />
          </span>
        </div>
        {loading && value === null ? (
          <Skeleton className="mt-3 h-8 w-28" />
        ) : (
          <p
            className={
              featured
                ? "stat-figure mt-3 text-[2rem] leading-none text-primary-foreground"
                : "stat-figure mt-3 text-[2rem] leading-none text-foreground"
            }
          >
            {value ?? "—"}
          </p>
        )}
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}

/** Helper: valor monetario del overview o null si aún no cargó / sin permiso. */
function ovMoney(
  { data }: WidgetProps,
  pick: (o: NonNullable<WidgetProps["data"]["overview"]>) => number,
): string | null {
  return data.overview ? money.format(pick(data.overview)) : null
}

// ─── Accesos rápidos por giro (reutilizado por el widget) ─────────────────────

type QuickAction = { title: string; href: string; icon: LucideIcon }
function quickActionsFor(tipoNegocio?: BusinessType): QuickAction[] {
  const common: QuickAction[] = [
    { title: "Nueva compra", href: "/panel/compras", icon: Truck },
    { title: "Ver reportes", href: "/panel/finanzas/reportes", icon: BarChart3 },
  ]
  if (tipoNegocio === "retail") {
    return [
      { title: "Nueva venta", href: "/pos", icon: ShoppingCart },
      { title: "Productos", href: "/panel/productos", icon: Package },
      { title: "Bajo stock", href: "/panel/inventario", icon: PackageX },
      ...common,
    ]
  }
  if (tipoNegocio === "restaurante") {
    return [
      { title: "Abrir mesa", href: "/panel/restaurante", icon: UtensilsCrossed },
      { title: "Abrir POS", href: "/pos", icon: ShoppingCart },
      ...common,
    ]
  }
  return [{ title: "Abrir POS", href: "/pos", icon: ShoppingCart }, ...common]
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

function GreetingWidget() {
  const { user, tipoNegocio } = useAuth()
  const first = user?.name?.split(" ")[0] ?? ""
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const negocio =
    tipoNegocio === "restaurante"
      ? "tu restaurante"
      : tipoNegocio === "retail"
        ? "tu tienda"
        : "tu negocio"
  return (
    <Card className="h-full border-primary/25 bg-gradient-to-br from-accent/60 to-card">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span className="capitalize">{today}</span>
          </p>
          <p className="mt-2 font-display text-xl text-foreground">
            Hola{first ? `, ${first}` : ""} 👋
          </p>
          <p className="text-sm text-muted-foreground">
            Este es el resumen de {negocio} de hoy.
          </p>
        </div>
        <Button size="sm" className="w-fit" render={<Link href="/pos" />}>
          <ShoppingCart />
          Nueva venta
        </Button>
      </CardContent>
    </Card>
  )
}

function GuideWidget() {
  const { openGuide } = useOnboarding()
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
        <div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
            <Compass />
          </span>
          <p className="mt-3 font-display text-base text-foreground">
            Recorrido guiado
          </p>
          <p className="text-sm text-muted-foreground">
            ¿Nuevo por aquí? Te muestro BookiPos paso a paso, área por área.
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={openGuide}>
          Ver el recorrido
        </Button>
      </CardContent>
    </Card>
  )
}

function SalesMonthWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Ventas del mes"
      value={ovMoney(p, (o) => o.salesMonth)}
      icon={TrendingUp}
      tone="text-success-ink"
      loading={p.loading}
      featured
    />
  )
}
function CashTodayWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Efectivo hoy"
      value={ovMoney(p, (o) => o.cashToday)}
      icon={Banknote}
      tone="text-info"
      loading={p.loading}
    />
  )
}
function ExpensesMonthWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Gastos del mes"
      value={ovMoney(p, (o) => o.expensesMonth)}
      icon={TrendingDown}
      tone="text-warning-ink"
      loading={p.loading}
    />
  )
}
function ProfitMonthWidget(p: WidgetProps) {
  const positive = (p.data.overview?.utilidadMonth ?? 0) >= 0
  return (
    <KpiCard
      label="Utilidad del mes"
      value={ovMoney(p, (o) => o.utilidadMonth)}
      icon={BarChart3}
      tone={positive ? "text-success-ink" : "text-destructive"}
      loading={p.loading}
    />
  )
}
function ReceivablesWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Por cobrar (CxC)"
      value={ovMoney(p, (o) => o.receivablesOpen)}
      icon={HandCoins}
      href="/panel/clientes"
      loading={p.loading}
    />
  )
}
function PayablesWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Por pagar (CxP)"
      value={ovMoney(p, (o) => o.payablesOpen)}
      icon={Receipt}
      href="/panel/finanzas/cxp"
      loading={p.loading}
    />
  )
}
function PayrollWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Nómina del mes"
      value={ovMoney(p, (o) => o.nomina)}
      icon={Users}
      href="/panel/nomina"
      loading={p.loading}
    />
  )
}
function PurchaseOrdersWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Órdenes en curso"
      value={p.data.poCount === null ? null : String(p.data.poCount)}
      icon={Truck}
      href="/panel/compras"
      loading={p.loading}
    />
  )
}
/**
 * Facturas fotografiadas que esperan revisión.
 *
 * Es el widget que cierra el circuito: la foto se toma en la bodega y quien
 * administra ve desde el tablero que hay algo pendiente de aprobar, en vez de
 * tener que acordarse de entrar al módulo.
 */
function PendingScansWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Facturas por revisar"
      value={p.data.pendingScans === null ? null : String(p.data.pendingScans)}
      icon={ScanLine}
      href="/panel/compras/facturas"
      loading={p.loading}
    />
  )
}
function LowStockWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Productos bajo stock"
      value={p.data.lowStock === null ? null : String(p.data.lowStock)}
      icon={PackageX}
      tone="text-warning-ink"
      href="/panel/inventario"
      loading={p.loading}
    />
  )
}
function OpenTablesWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Comandas abiertas"
      value={p.data.openTables === null ? null : String(p.data.openTables)}
      icon={UtensilsCrossed}
      href="/panel/restaurante"
      loading={p.loading}
    />
  )
}

/** Mini gráfico de barras (CSS) de ingresos por día, últimos 7 días. */
function SalesChartWidget({ data, loading }: WidgetProps) {
  const days = data.sales?.days ?? []
  const max = Math.max(1, ...days.map((d) => d.revenue))
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display text-lg">
              Ventas últimos 7 días
            </CardTitle>
            <CardDescription>Ingresos por día (todas las sedes).</CardDescription>
          </div>
          {data.sales && (
            <span className="tnum text-sm font-semibold text-foreground">
              {money.format(data.sales.totalRevenue)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data.sales ? (
          <Skeleton className="h-40 w-full" />
        ) : days.length > 0 ? (
          <div className="flex h-40 items-end gap-2">
            {days.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${fmtDate(d.date)}: ${money.format(d.revenue)} · ${d.tickets} tiquetes`}
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary"
                    style={{
                      height: `${Math.max(4, Math.round((d.revenue / max) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(`${d.date}T00:00:00`).toLocaleDateString("es-CO", {
                    weekday: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Aún no hay ventas en el período.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Tabla de ventas por día (últimos 7 días). */
function SalesTableWidget({ data, loading }: WidgetProps) {
  const days = data.sales?.days ?? []
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-lg">Detalle de ventas (7 días)</CardTitle>
        <CardDescription>Tiquetes, ticket promedio e ingresos por día.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-2">
        {loading && !data.sales ? (
          <div className="px-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : days.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead className="text-right">Tiquetes</TableHead>
                <TableHead className="text-right">Ticket prom.</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {d.tickets}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {money.format(d.avgTicket)}
                  </TableCell>
                  <TableCell className="tnum text-right font-semibold">
                    {money.format(d.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Aún no hay ventas registradas en el período.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Fiado",
}
/** Desglose de ingresos por método de pago (últimos 7 días). */
function PaymentMethodsWidget({ data, loading }: WidgetProps) {
  const rows = data.sales?.byMethod ?? []
  const total = rows.reduce((s, r) => s + r.revenue, 0) || 1
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-lg">Métodos de pago</CardTitle>
        <CardDescription>Ingresos por medio (7 días).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data.sales ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length > 0 ? (
          rows.map((r) => (
            <div key={r.method}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="size-3.5" />
                  {METHOD_LABEL[r.method] ?? r.method}
                </span>
                <span className="tnum font-semibold">{money.format(r.revenue)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((r.revenue / total) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin ventas en el período.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const CAJA_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Abierta", cls: "bg-success/15 text-success-ink" },
  closed: { label: "Cerrada", cls: "bg-muted text-muted-foreground" },
  none: { label: "Sin abrir", cls: "bg-warning/15 text-warning-ink" },
}
/** Estado de la caja de hoy por sede. */
function CajaSedesWidget({ data, loading }: WidgetProps) {
  const rows = data.caja?.rows ?? []
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display text-lg">Caja por sede (hoy)</CardTitle>
            <CardDescription>Estado y efectivo esperado de cada sede.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/panel/caja" />}>
            Ver caja
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-2">
        {loading && !data.caja ? (
          <div className="px-4">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Efectivo esp.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const st = CAJA_STATUS[r.status] ?? CAJA_STATUS.none
                return (
                  <TableRow key={r.sedeId}>
                    <TableCell className="flex items-center gap-1.5">
                      <Store className="size-3.5 text-muted-foreground" />
                      {r.sedeName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">
                      {money.format(r.salesTotal)}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">
                      {r.expectedCash === undefined ? "—" : money.format(r.expectedCash)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay cajas para mostrar.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Accesos rápidos según el giro. */
function QuickActionsWidget() {
  const { tipoNegocio } = useAuth()
  const actions = React.useMemo(() => quickActionsFor(tipoNegocio), [tipoNegocio])
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-lg">Accesos rápidos</CardTitle>
        <CardDescription>Acciones frecuentes del día a día.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-[96px] flex-col items-start justify-between rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/40 hover:shadow-[0_12px_28px_-18px_var(--primary)]"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:size-4">
              <action.icon />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {action.title}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

/** Top de productos más vendidos por ingresos (últimos 7 días). */
function TopProductsWidget({ data, loading }: WidgetProps) {
  const items = (data.sales?.topProducts ?? []).slice(0, 5)
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Trophy className="size-4 text-primary" />
          Top productos (7 días)
        </CardTitle>
        <CardDescription>Los más vendidos por ingresos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && !data.sales ? (
          <Skeleton className="h-32 w-full" />
        ) : items.length > 0 ? (
          items.map((p, i) => (
            <div
              key={p.productId ?? p.name}
              className="flex items-center gap-3 rounded-lg border border-border p-2.5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.name}
                </p>
                <p className="text-xs text-muted-foreground">{p.qty} vendidos</p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold">
                {money.format(p.revenue)}
              </span>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin ventas en el período.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AvgTicketWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Ticket promedio (7 días)"
      value={p.data.sales ? money.format(p.data.sales.avgTicket) : null}
      icon={Receipt}
      tone="text-info"
      loading={p.loading}
    />
  )
}

function TicketsWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Tiquetes (7 días)"
      value={p.data.sales ? String(p.data.sales.totalTickets) : null}
      icon={Ticket}
      href="/panel/finanzas/reportes"
      loading={p.loading}
    />
  )
}

function CashExpectedTotalWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Efectivo esperado (cajas)"
      value={p.data.caja ? money.format(p.data.caja.totals.expectedCashTotal) : null}
      icon={Banknote}
      tone="text-info"
      href="/panel/caja"
      loading={p.loading}
    />
  )
}

function OpenCajasWidget(p: WidgetProps) {
  const t = p.data.caja?.totals
  return (
    <KpiCard
      label="Cajas abiertas"
      value={t ? `${t.openCount}/${t.sedes}` : null}
      icon={Store}
      tone="text-success-ink"
      href="/panel/caja"
      loading={p.loading}
    />
  )
}

function MarginMonthWidget(p: WidgetProps) {
  const o = p.data.overview
  const margin =
    o && o.salesMonth > 0 ? Math.round((o.utilidadMonth / o.salesMonth) * 100) : null
  return (
    <KpiCard
      label="Margen del mes"
      value={o ? (margin === null ? "—" : `${margin}%`) : null}
      icon={Percent}
      tone={(margin ?? 0) >= 0 ? "text-success-ink" : "text-destructive"}
      loading={p.loading}
    />
  )
}

function ExpiringWidget(p: WidgetProps) {
  return (
    <KpiCard
      label="Próximos a vencer"
      value={p.data.expiring === null ? null : String(p.data.expiring)}
      icon={CalendarClock}
      tone="text-warning-ink"
      href="/panel/inventario"
      loading={p.loading}
    />
  )
}

/** Chip de variación % entre el valor actual y el del mes anterior. */
function DeltaChip({
  current,
  previous,
  goodWhenUp,
}: {
  current: number
  previous: number
  goodWhenUp: boolean
}) {
  const up = current >= previous
  const good = up === goodWhenUp
  const cls = good
    ? "bg-success/10 text-success-ink"
    : "bg-destructive/10 text-destructive"
  const pct =
    previous !== 0 ? Math.round(((current - previous) / Math.abs(previous)) * 100) : null
  const Arrow = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      <Arrow className="size-3.5" />
      {pct === null
        ? previous === 0 && current > 0
          ? "nuevo"
          : "—"
        : `${pct > 0 ? "+" : ""}${pct}%`}
    </span>
  )
}

/** Comparativo del mes en curso contra el mes anterior (ventas, gastos, utilidad). */
function ComparativeWidget({ data, loading }: WidgetProps) {
  const report = data.plMonthly
  const now = new Date()
  const curIdx = now.getMonth() // 0..11 (igual que el backend)
  const cur = report?.months.find((m) => m.month === curIdx) ?? null
  const prev = report?.months.find((m) => m.month === curIdx - 1) ?? null

  const curName = now.toLocaleDateString("es-CO", { month: "long" })
  const prevName = new Date(now.getFullYear(), curIdx - 1, 1).toLocaleDateString(
    "es-CO",
    { month: "long" },
  )

  const rows = cur
    ? [
        {
          label: "Ventas",
          current: cur.ingresos,
          previous: prev?.ingresos ?? 0,
          goodWhenUp: true,
        },
        {
          label: "Gastos y nómina",
          current: cur.gastos + cur.nomina,
          previous: (prev?.gastos ?? 0) + (prev?.nomina ?? 0),
          goodWhenUp: false,
        },
        {
          label: "Utilidad",
          current: cur.utilidad,
          previous: prev?.utilidad ?? 0,
          goodWhenUp: true,
        },
      ]
    : []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-lg">Comparativo mensual</CardTitle>
        <CardDescription className="capitalize">
          {curName} vs {prevName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !report ? (
          <Skeleton className="h-28 w-full" />
        ) : rows.length > 0 ? (
          rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{r.label}</p>
                <p className="tnum text-lg font-semibold text-foreground">
                  {money.format(r.current)}
                </p>
                <p className="text-xs text-muted-foreground">
                  vs {money.format(r.previous)}
                </p>
              </div>
              <DeltaChip
                current={r.current}
                previous={r.previous}
                goodWhenUp={r.goodWhenUp}
              />
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aún no hay datos del mes para comparar.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export const WIDGETS: WidgetDef[] = [
  {
    id: "greeting",
    title: "Bienvenida",
    description: "Saludo, fecha y acceso a una nueva venta.",
    defaultSize: "wide",
    sizes: ["compact", "wide"],
    Component: GreetingWidget,
  },
  {
    id: "guide",
    title: "Recorrido guiado",
    description: "Reabre el tour de bienvenida de BookiPos.",
    defaultSize: "compact",
    sizes: ["compact", "wide"],
    Component: GuideWidget,
  },
  {
    id: "sales-month",
    title: "Ventas del mes",
    description: "Total facturado en el mes en curso.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: SalesMonthWidget,
  },
  {
    id: "cash-today",
    title: "Efectivo hoy",
    description: "Efectivo esperado en caja hoy.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: CashTodayWidget,
  },
  {
    id: "expenses-month",
    title: "Gastos del mes",
    description: "Gasto operativo del mes en curso.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: ExpensesMonthWidget,
  },
  {
    id: "profit-month",
    title: "Utilidad del mes",
    description: "Utilidad estimada del mes (ingresos − costos).",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: ProfitMonthWidget,
  },
  {
    id: "sales-chart",
    title: "Gráfico de ventas (7 días)",
    description: "Barras de ingresos por día de la última semana.",
    defaultSize: "wide",
    sizes: ["wide", "full"],
    permission: "reports.view",
    Component: SalesChartWidget,
  },
  {
    id: "sales-table",
    title: "Detalle de ventas (7 días)",
    description: "Tabla con tiquetes, ticket promedio e ingresos.",
    defaultSize: "full",
    sizes: ["wide", "full"],
    permission: "reports.view",
    Component: SalesTableWidget,
  },
  {
    id: "payment-methods",
    title: "Métodos de pago",
    description: "Ingresos por medio de pago (7 días).",
    defaultSize: "compact",
    sizes: ["compact", "wide"],
    permission: "reports.view",
    Component: PaymentMethodsWidget,
  },
  {
    id: "caja-sedes",
    title: "Caja por sede",
    description: "Estado y efectivo esperado de cada sede hoy.",
    defaultSize: "wide",
    sizes: ["wide", "full"],
    permission: "pos.sell",
    Component: CajaSedesWidget,
  },
  {
    id: "receivables",
    title: "Cuentas por cobrar",
    description: "Total del fiado pendiente por cobrar.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: ReceivablesWidget,
  },
  {
    id: "payables",
    title: "Cuentas por pagar",
    description: "Total pendiente de pago a proveedores.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: PayablesWidget,
  },
  {
    id: "payroll",
    title: "Nómina del mes",
    description: "Costo de nómina del mes en curso.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: PayrollWidget,
  },
  {
    id: "purchase-orders",
    title: "Órdenes en curso",
    description: "Órdenes de compra enviadas o parciales.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: PurchaseOrdersWidget,
  },
  {
    id: "pending-scans",
    title: "Facturas por revisar",
    description: "Facturas fotografiadas esperando tu aprobación.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "purchasing.manage",
    Component: PendingScansWidget,
  },
  {
    id: "low-stock",
    title: "Bajo stock",
    description: "Productos por debajo de su mínimo.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "inventory.view",
    Component: LowStockWidget,
  },
  {
    id: "open-tables",
    title: "Comandas abiertas",
    description: "Mesas con cuenta abierta ahora mismo.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "pos.sell",
    businessTypes: ["restaurante"],
    Component: OpenTablesWidget,
  },
  {
    id: "quick-actions",
    title: "Accesos rápidos",
    description: "Atajos a las acciones más frecuentes.",
    defaultSize: "wide",
    sizes: ["wide", "full"],
    Component: QuickActionsWidget,
  },
  {
    id: "top-products",
    title: "Top productos",
    description: "Los más vendidos por ingresos (7 días).",
    defaultSize: "wide",
    sizes: ["wide", "full"],
    permission: "reports.view",
    Component: TopProductsWidget,
  },
  {
    id: "avg-ticket",
    title: "Ticket promedio",
    description: "Valor promedio por tiquete (7 días).",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "reports.view",
    Component: AvgTicketWidget,
  },
  {
    id: "tickets",
    title: "Tiquetes (7 días)",
    description: "Cantidad de ventas de la última semana.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "reports.view",
    Component: TicketsWidget,
  },
  {
    id: "cash-expected-total",
    title: "Efectivo esperado (cajas)",
    description: "Efectivo esperado sumando todas las cajas de hoy.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "pos.sell",
    Component: CashExpectedTotalWidget,
  },
  {
    id: "open-cajas",
    title: "Cajas abiertas",
    description: "Cuántas sedes tienen la caja abierta ahora.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "pos.sell",
    Component: OpenCajasWidget,
  },
  {
    id: "margin-month",
    title: "Margen del mes",
    description: "Utilidad como porcentaje de las ventas del mes.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "finance.view",
    Component: MarginMonthWidget,
  },
  {
    id: "expiring",
    title: "Próximos a vencer",
    description: "Lotes de inventario cerca de su vencimiento.",
    defaultSize: "compact",
    sizes: ["compact"],
    permission: "inventory.view",
    Component: ExpiringWidget,
  },
  {
    id: "comparative",
    title: "Comparativo mensual",
    description: "Ventas, gastos y utilidad de este mes vs el anterior.",
    defaultSize: "wide",
    sizes: ["compact", "wide", "full"],
    permission: "finance.view",
    Component: ComparativeWidget,
  },
]

/** Índice por id para acceso O(1). */
export const WIDGET_BY_ID: Record<string, WidgetDef> = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w]),
)

/**
 * Widgets ofrecidos al usuario según sus permisos y el giro del negocio.
 */
export function availableWidgets(
  hasPermission: (perm: string) => boolean,
  tipoNegocio?: BusinessType,
): WidgetDef[] {
  return WIDGETS.filter(
    (w) =>
      (!w.permission || hasPermission(w.permission)) &&
      (!w.businessTypes ||
        (tipoNegocio ? w.businessTypes.includes(tipoNegocio) : false)),
  )
}

/**
 * Tablero por defecto para quien recién se registra: solo 5 widgets, los más
 * importantes para arrancar (bienvenida, guía, la venta del mes, la tendencia
 * de ventas y los accesos rápidos). El resto queda disponible en "Agregar
 * widgets". Se filtra por disponibilidad según permisos/giro.
 */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "greeting", size: "wide" },
  { id: "guide", size: "compact" },
  { id: "sales-month", size: "compact" },
  { id: "sales-chart", size: "wide" },
  { id: "pending-scans", size: "compact" },
  { id: "quick-actions", size: "wide" },
]
