"use client"

import * as React from "react"
import {
  Receipt as ReceiptIcon,
  Banknote,
  TrendingUp,
  ShieldOff,
  MapPin,
  Printer,
  PackageX,
  ChevronRight,
  Ban,
  Search,
  FileText,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  listSales,
  voidSale,
  PAYMENT_METHOD_LABELS,
  type Sale,
} from "@/lib/pos/api-sales"
import { money, timeOnly, isToday } from "@/lib/pos/format"
import { Receipt } from "@/components/pos/receipt"
import { Factura } from "@/components/pos/factura"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

type StatusFilter = "all" | "completed" | "void"
type DetailView = "receipt" | "factura"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

export default function VentasPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("pos.sell")
  const canVoid = hasPermission("pos.void.authorize")
  const { sedeId, sede } = useSede()
  const confirm = useConfirm()

  const [rows, setRows] = React.useState<Sale[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Sale | null>(null)
  const [detailView, setDetailView] = React.useState<DetailView>("factura")
  const [voiding, setVoiding] = React.useState(false)
  const [voidError, setVoidError] = React.useState<string | null>(null)

  // Filtros
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")

  const load = React.useCallback(
    async (nextPage: number) => {
      if (!sedeId) return
      if (nextPage === 1) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      try {
        const res = await listSales(sedeId, nextPage, PAGE_SIZE)
        setTotal(res.total)
        setPage(res.page)
        setRows((prev) => (nextPage === 1 ? res.rows : [...prev, ...res.rows]))
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sedeId],
  )

  React.useEffect(() => {
    if (!canView || !sedeId) return
    setRows([])
    void load(1)
  }, [canView, sedeId, load])

  // Resumen del turno (ventas de hoy, sin contar las anuladas).
  const today = React.useMemo(() => {
    const list = rows.filter((s) => isToday(s.createdAt) && s.status !== "void")
    const sum = list.reduce((acc, s) => acc + s.total, 0)
    return {
      count: list.length,
      total: sum,
      avg: list.length ? sum / list.length : 0,
    }
  }, [rows])

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false
      if (!q) return true
      return (
        s.saleNumber.toLowerCase().includes(q) ||
        (s.customer?.name?.toLowerCase().includes(q) ?? false) ||
        (s.customer?.idNumber?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [rows, query, statusFilter])

  async function handleVoid() {
    if (!selected) return
    const ok = await confirm({
      title: `¿Anular la venta ${selected.saleNumber}?`,
      description:
        "Se devolverá su consumo al inventario. Esta acción no se puede deshacer.",
      destructive: true,
    })
    if (!ok) return
    setVoiding(true)
    setVoidError(null)
    try {
      const updated = await voidSale(selected._id)
      setSelected(updated)
      setRows((prev) => prev.map((s) => (s._id === updated._id ? updated : s)))
    } catch (err) {
      setVoidError(errorMessage(err))
    } finally {
      setVoiding(false)
    }
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin acceso</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            No tienes permiso para ver las ventas. Contacta al administrador.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!sedeId) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin sede</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Selecciona una sede para ver sus ventas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Historial{sede ? ` de ${sede.name}` : ""}.
        </p>
      </div>

      {/* Resumen del día */}
      <div data-tour="pos-ventas-kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={ReceiptIcon}
          label="Ventas hoy"
          value={String(today.count)}
          tone="muted"
        />
        <StatCard
          icon={Banknote}
          label="Total hoy"
          value={money(today.total)}
          tone="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Ticket promedio"
          value={money(today.avg)}
          tone="muted"
        />
      </div>

      {/* Filtros */}
      <div data-tour="pos-ventas-buscar" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número o cliente…"
            className="h-10 pl-9"
            aria-label="Buscar ventas"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {(
            [
              ["all", "Todas"],
              ["completed", "Completadas"],
              ["void", "Anuladas"],
            ] as const
          ).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <Card data-tour="pos-ventas-lista">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <PackageX className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay ventas registradas en esta sede.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Search className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ninguna venta coincide con el filtro.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredRows.map((s) => {
                const items = s.lines.reduce((acc, l) => acc + l.qty, 0)
                return (
                  <li key={s._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setVoidError(null)
                        setDetailView("factura")
                        setSelected(s)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ReceiptIcon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.saleNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeOnly(s.createdAt)} · {items} ítem(s)
                          {s.customer?.name ? ` · ${s.customer.name}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="stat-figure text-base">
                          {money(s.total)}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {PAYMENT_METHOD_LABELS[s.payment.method]}
                        </Badge>
                      </div>
                      {s.status === "void" && (
                        <Badge variant="destructive">Anulada</Badge>
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!loading && !error && rows.length < total && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void load(page + 1)}
          >
            {loadingMore ? "Cargando…" : "Ver más"}
          </Button>
        </div>
      )}

      {/* Detalle / comprobante */}
      <Sheet
        open={selected !== null}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        <SheetContent side="right" className="overflow-y-auto sm:max-w-xl">
          {selected && (
            <div className="flex flex-col gap-4 px-4 py-2">
              <SheetHeader className="px-0">
                <SheetTitle className="flex items-center gap-2 font-display text-lg">
                  {selected.saleNumber}
                  {selected.status === "void" && (
                    <Badge variant="destructive">Anulada</Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  Detalle de la venta y comprobante.
                </SheetDescription>
              </SheetHeader>

              {/* Alternar entre factura (carta) y recibo (tirilla) */}
              <div className="no-print grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
                {(
                  [
                    ["factura", "Factura", FileText],
                    ["receipt", "Recibo", ReceiptIcon],
                  ] as const
                ).map(([key, lbl, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDetailView(key)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                      detailView === key
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {lbl}
                  </button>
                ))}
              </div>

              {detailView === "factura" ? (
                <Factura
                  sale={selected}
                  business={{
                    name:
                      sede?.name ??
                      (typeof selected.sedeId === "object"
                        ? selected.sedeId.name
                        : "Punto de venta"),
                    address: sede?.address,
                    nit: sede?.nit,
                    phone: sede?.phone,
                  }}
                />
              ) : (
                <Receipt sale={selected} sede={sede} />
              )}

              {voidError && (
                <p className="no-print rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {voidError}
                </p>
              )}

              <div className="no-print flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  {detailView === "factura" ? "Imprimir / PDF" : "Imprimir"}
                </Button>
                <Button className="flex-1" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
              </div>

              {canVoid && selected.status === "completed" && (
                <Button
                  variant="destructive"
                  className="no-print gap-2"
                  disabled={voiding}
                  onClick={() => void handleVoid()}
                >
                  <Ban className="size-4" />
                  {voiding ? "Anulando…" : "Anular venta"}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  tone: "success" | "muted"
}) {
  const tones = {
    success: "bg-success/10 text-success-ink",
    muted: "bg-muted text-muted-foreground",
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="stat-figure truncate text-xl">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
