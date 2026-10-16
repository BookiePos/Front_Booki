"use client"

import * as React from "react"
import {
  PackagePlus,
  PackageMinus,
  CalendarClock,
  ChevronRight,
  Search,
  CircleAlert,
} from "lucide-react"
import {
  listLots,
  type Sede,
  type InvLotRow,
  type LotStatus,
} from "@/lib/erp/api-inventory"
import { unidadCorta } from "@/lib/erp/unidades"
import { Button, ButtonLabel } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Segmented } from "@/components/ui/segmented"
import {
  nf,
  moneyUnit,
  formatUnitCost,
  df,
  dfUTC,
  errorMessage,
} from "@/components/inventario/helpers"
import {
  ExpiryBadge,
  TableSkeleton,
  sedeItems,
} from "@/components/inventario/ui-comunes"
import { VacioConSalida } from "@/components/inventario/pestanas"

// ─── Panel de lotes (trazabilidad y vencimientos) ────────────────────────────

export const LOT_STATUS_OPTIONS: { value: LotStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expired", label: "Vencidos" },
  { value: "expiring", label: "Por vencer" },
  { value: "ok", label: "Al día" },
]

/**
 * Pestaña "Lotes": todos los lotes abiertos del inventario, en orden FEFO.
 *
 * Hasta ahora los lotes solo se veían desplegando una fila de existencias, un
 * producto cada vez. Eso sirve para responder "¿de qué lote es esta caja?",
 * pero no para la pregunta con la que se abre la tienda: "¿qué se me vence
 * esta semana?". Con doscientas referencias, contestarla a mano era imposible,
 * así que en la práctica nadie lo hacía y la merma se descubría en el estante.
 *
 * El orden es FEFO —lo que primero vence, primero se ve— porque es también el
 * orden en el que el sistema los consume al vender: la lista de arriba es
 * literalmente lo que va a salir primero.
 */
export function LotsPanel({
  sedes,
  canAdjust,
  onAdjust,
  onEntry,
  refreshKey,
}: {
  sedes: Sede[]
  canAdjust: boolean
  /** Abre el ajuste con el producto y la sede del lote ya puestos. */
  onAdjust: (preset: { productId: string; sedeId: string }) => void
  /** Abre la entrada de mercancía desde el estado vacío. */
  onEntry: () => void
  /** Cambia tras cada operación de stock para forzar la recarga. */
  refreshKey: number
}) {
  const [sedeId, setSedeId] = React.useState("all")
  const [status, setStatus] = React.useState<LotStatus>("all")
  const [search, setSearch] = React.useState("")
  const [rows, setRows] = React.useState<InvLotRow[]>([])
  const [days, setDays] = React.useState(30)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listLots({
          sedeId: sedeId === "all" ? undefined : sedeId,
          status,
        })
        if (cancelled) return
        setRows(data.rows)
        setDays(data.days)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sedeId, status, refreshKey])

  const filtered = rows.filter((lot) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const product = typeof lot.productId === "object" ? lot.productId : null
    return (
      lot.lotCode.toLowerCase().includes(q) ||
      (product?.name ?? "").toLowerCase().includes(q) ||
      (product?.sku ?? "").toLowerCase().includes(q) ||
      (lot.supplier ?? "").toLowerCase().includes(q)
    )
  })

  /** Cuántos lotes hay vencidos, para el aviso de arriba. */
  const vencidos = rows.filter(
    (l) => l.expiresAt && new Date(l.expiresAt) < new Date(),
  ).length

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Lotes en existencia</CardTitle>
          <CardDescription>
            Orden FEFO: lo que primero vence es lo primero que el sistema
            descuenta al vender. Ventana de aviso: {days} días.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lote, producto, proveedor…"
              className="w-60 pl-9"
              aria-label="Buscar lotes"
            />
          </div>
          <Segmented
            value={status}
            onValueChange={setStatus}
            options={LOT_STATUS_OPTIONS}
            size="sm"
            ariaLabel="Filtrar lotes por vencimiento"
          />
          {sedes.length > 1 && (
            <Select
              value={sedeId}
              items={{ all: "Todas las sedes", ...sedeItems(sedes) }}
              onValueChange={(v) => {
                if (v !== null) setSedeId(v)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {sedes.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      {vencidos > 0 && status !== "expired" && (
        <CardContent className="pb-0">
          <button
            type="button"
            onClick={() => setStatus("expired")}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/35 bg-destructive/8 px-4 py-3 text-left text-sm text-destructive-ink transition-colors hover:bg-destructive/12 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
          >
            <CircleAlert className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">{vencidos} lote(s) vencidos</span>{" "}
              siguen con existencias. Sácalos con un ajuste por vencimiento.
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0" />
          </button>
        </CardContent>
      )}

      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={7} />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          rows.length === 0 ? (
            <VacioConSalida
              icon={CalendarClock}
              titulo="Todavía no hay lotes"
              frase="Un lote es cada tanda que entró junta, con su fecha de vencimiento. Solo los llevan las cosas que marcaste como perecederas: márcalo en la ficha y se creará solo en la próxima entrada."
              accion={
                canAdjust
                  ? {
                      texto: "Registrar una entrada",
                      icon: PackagePlus,
                      onClick: onEntry,
                    }
                  : undefined
              }
            />
          ) : (
            <VacioConSalida
              icon={Search}
              titulo="Ningún lote coincide"
              frase="Prueba con otro filtro, o busca por el código del lote, el producto o el proveedor."
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lot) => {
                const product =
                  typeof lot.productId === "object" ? lot.productId : null
                const consumido = lot.initialQty - lot.qty
                return (
                  <TableRow key={lot._id}>
                    <TableCell className="font-mono text-xs">
                      {lot.lotCode}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {product?.name ?? "—"}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {product?.sku ?? ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.sedeId?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tnum font-medium">
                        {nf.format(lot.qty)}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {product ? unidadCorta(product.unit) : ""}
                      </span>
                      {consumido > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          de {nf.format(lot.initialQty)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.expiresAt ? (
                        <span className="flex items-center gap-2">
                          {dfUTC.format(new Date(lot.expiresAt))}
                          <ExpiryBadge date={lot.expiresAt} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No caduca</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span>{df.format(new Date(lot.receivedAt))}</span>
                      {lot.supplier && (
                        <span className="block text-xs text-muted-foreground">
                          {lot.supplier}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {product
                        ? formatUnitCost(lot.unitCost, product)
                        : moneyUnit.format(lot.unitCost)}
                    </TableCell>
                    <TableCell>
                      {canAdjust && product && lot.sedeId?._id && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Dar de baja este lote con un ajuste"
                            onClick={() =>
                              onAdjust({
                                productId: product._id,
                                sedeId: lot.sedeId._id,
                              })
                            }
                          >
                            <PackageMinus />
                            <ButtonLabel from="lg">Ajustar</ButtonLabel>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
