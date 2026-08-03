"use client"

import * as React from "react"
import Link from "next/link"
import {
  ShoppingCart,
  Truck,
  Wallet,
  BarChart3,
  Banknote,
  TrendingUp,
  TrendingDown,
  Receipt,
  HandCoins,
  UtensilsCrossed,
  RefreshCw,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { getOverview, type FinanceOverview } from "@/lib/erp/api-finance"
import { getSalesReport, type SalesReport } from "@/lib/erp/api-reports"
import { listPurchaseOrders } from "@/lib/erp/api-purchasing"
import { listOrders } from "@/lib/erp/api-restaurant"
import { money, fmtDate, todayLocal } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
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

const quickActions = [
  { title: "Abrir POS", href: "/pos", icon: ShoppingCart },
  { title: "Nueva compra", href: "/panel/compras", icon: Truck },
  { title: "Restaurante", href: "/panel/restaurante", icon: UtensilsCrossed },
  { title: "Ver reportes", href: "/panel/finanzas/reportes", icon: BarChart3 },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const canFinance = hasPermission("finance.view")
  const canReports = hasPermission("reports.view")

  const [overview, setOverview] = React.useState<FinanceOverview | null>(null)
  const [sales, setSales] = React.useState<SalesReport | null>(null)
  const [poCount, setPoCount] = React.useState<number | null>(null)
  const [openTables, setOpenTables] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    // Cada fuente es independiente: si una falla o no hay permiso, el resto sigue.
    await Promise.all([
      canFinance
        ? getOverview().then(setOverview).catch(() => setOverview(null))
        : Promise.resolve(),
      canReports
        ? getSalesReport({ from: daysAgo(6), to: todayLocal() })
            .then(setSales)
            .catch(() => setSales(null))
        : Promise.resolve(),
      canFinance
        ? listPurchaseOrders()
            .then((pos) =>
              setPoCount(
                pos.filter((p) => p.status === "sent" || p.status === "partial").length,
              ),
            )
            .catch(() => setPoCount(null))
        : Promise.resolve(),
      hasPermission("pos.sell")
        ? listOrders()
            .then((o) => setOpenTables(o.filter((x) => x.status !== "closed" && x.status !== "cancelled").length))
            .catch(() => setOpenTables(null))
        : Promise.resolve(),
    ])
    setLoading(false)
  }, [canFinance, canReports, hasPermission])

  React.useEffect(() => {
    void load()
  }, [load])

  const kpis = overview
    ? [
        { label: "Ventas del mes", value: money.format(overview.salesMonth), icon: TrendingUp, tone: "text-success" },
        { label: "Efectivo hoy", value: money.format(overview.cashToday), icon: Banknote, tone: "text-info" },
        { label: "Gastos del mes", value: money.format(overview.expensesMonth), icon: TrendingDown, tone: "text-warning" },
        {
          label: "Utilidad del mes",
          value: money.format(overview.utilidadMonth),
          icon: BarChart3,
          tone: overview.utilidadMonth >= 0 ? "text-success" : "text-destructive",
        },
      ]
    : []

  const secondary = overview
    ? [
        { label: "Por cobrar (CxC)", value: money.format(overview.receivablesOpen), icon: HandCoins, href: "/panel/clientes" },
        { label: "Por pagar (CxP)", value: money.format(overview.payablesOpen), icon: Receipt, href: "/panel/finanzas/cxp" },
        { label: "Órdenes en curso", value: poCount === null ? "—" : String(poCount), icon: Truck, href: "/panel/compras" },
        { label: "Comandas abiertas", value: openTables === null ? "—" : String(openTables), icon: UtensilsCrossed, href: "/panel/restaurante" },
      ]
    : []

  return (
    <>
      <PageHeader
        title="Panel ejecutivo"
        section="Panel"
        description={`Bienvenido${user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Resumen operativo del negocio.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button render={<Link href="/panel/pos" />}>
              <ShoppingCart />
              Nueva venta
            </Button>
          </div>
        }
      />

      {/* KPIs financieros */}
      {loading && !overview ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </section>
      ) : overview ? (
        <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* El primer KPI (ventas del mes) va en violeta sólido: en una fila de
              cuatro cifras del mismo peso, ninguna destaca y el ojo tiene que
              leerlas todas. Una sola llena de color fija el ancla de lectura. */}
          {kpis.map((kpi, i) => {
            const featured = i === 0
            return (
              <Card
                key={kpi.label}
                className={
                  featured
                    ? "border-primary/30 bg-gradient-to-br from-primary to-[#5b21b6] text-primary-foreground shadow-[0_18px_40px_-24px_var(--primary)]"
                    : "transition-colors hover:border-primary/40"
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
                      {kpi.label}
                    </span>
                    <span
                      className={
                        featured
                          ? "flex size-9 items-center justify-center rounded-lg bg-white/15 text-primary-foreground [&_svg]:size-4"
                          : `flex size-9 items-center justify-center rounded-lg bg-accent [&_svg]:size-4 ${kpi.tone}`
                      }
                    >
                      <kpi.icon />
                    </span>
                  </div>
                  <p
                    className={
                      featured
                        ? "stat-figure mt-3 text-[2rem] leading-none text-primary-foreground"
                        : "stat-figure mt-3 text-[2rem] leading-none text-foreground"
                    }
                  >
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tienes acceso a los indicadores financieros. Habla con el administrador si necesitas el permiso{" "}
            <code>finance.view</code>.
          </CardContent>
        </Card>
      )}

      {/* Indicadores secundarios */}
      {secondary.length > 0 && (
        <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {secondary.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_28px_-18px_var(--primary)]">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:size-4">
                    <s.icon />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                    <p className="tnum text-lg font-semibold text-foreground">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Ventas últimos 7 días */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display text-lg">Ventas últimos 7 días</CardTitle>
                <CardDescription>Ingresos y tiquetes por día (todas las sedes).</CardDescription>
              </div>
              {sales && (
                <span className="tnum text-sm font-semibold text-foreground">
                  {money.format(sales.totalRevenue)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            {loading && !sales ? (
              <div className="px-4">
                <Skeleton className="h-40 w-full" />
              </div>
            ) : sales && sales.days.length > 0 ? (
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
                  {sales.days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{fmtDate(d.date)}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{d.tickets}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{money.format(d.avgTicket)}</TableCell>
                      <TableCell className="tnum text-right font-semibold">{money.format(d.revenue)}</TableCell>
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

        {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Accesos rápidos</CardTitle>
            <CardDescription>Acciones frecuentes del día a día.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-h-[104px] flex-col items-start justify-between rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/40 hover:shadow-[0_12px_28px_-18px_var(--primary)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:size-4">
                  <action.icon />
                </span>
                <span className="text-sm font-semibold text-foreground">{action.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
