"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Factory,
  Loader2,
  Package,
  Play,
  Plus,
  RefreshCw,
  ShieldOff,
  ShoppingBag,
  Trash2,
  Ban,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listSedes,
  listProducts,
  type Sede,
  type InvProduct,
} from "@/lib/erp/api-inventory"
import {
  cancelProductionOrder,
  completeProductionOrder,
  createBom,
  createProductionOrder,
  deleteBom,
  listBoms,
  listOutputs,
  listProductionOrders,
  publishOutput,
  refId,
  startProductionOrder,
  PRODUCTION_STATUS_LABELS,
  type Bom,
  type ProductionOrder,
  type ProductionOrderStatus,
  type ProductionOutput,
} from "@/lib/erp/api-production"
import { money, todayLocal, fmtDate, errorMessage, numOr } from "@/lib/erp/finance-format"

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const ALL = "all"
const inputClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const statusVariant: Record<
  ProductionOrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  in_progress: "outline",
  done: "default",
  cancelled: "destructive",
}

type Tab = "terminados" | "ordenes" | "recetas"

/** Cantidades con hasta 4 decimales, sin ceros de relleno (1.5 y no 1.5000). */
function qty(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(n)
}

export default function ProduccionPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("production.view")
  const canManage = hasPermission("production.manage")

  const [tab, setTab] = React.useState<Tab>("terminados")
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [sedeId, setSedeId] = React.useState(ALL)

  const [outputs, setOutputs] = React.useState<ProductionOutput[]>([])
  const [orders, setOrders] = React.useState<ProductionOrder[]>([])
  const [boms, setBoms] = React.useState<Bom[]>([])
  const [status, setStatus] = React.useState(ALL)

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [bomOpen, setBomOpen] = React.useState(false)
  const [orderOpen, setOrderOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<ProductionOrder | null>(null)
  const [publishing, setPublishing] = React.useState<ProductionOutput | null>(
    null,
  )

  React.useEffect(() => {
    if (!canView) return
    Promise.all([listSedes(), listProducts()])
      .then(([sd, prod]) => {
        setSedes(sd.filter((s) => s.active))
        setProducts(prod.filter((p) => p.active))
      })
      .catch((err) => setError(errorMessage(err)))
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sede = sedeId === ALL ? undefined : sedeId
      const [out, ord, bom] = await Promise.all([
        listOutputs(sede),
        listProductionOrders({
          sedeId: sede,
          status: status === ALL ? undefined : (status as ProductionOrderStatus),
        }),
        listBoms(),
      ])
      setOutputs(out)
      setOrders(ord)
      setBoms(bom)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, status])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Operación" title="Producción" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>production.view</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const enCurso = orders.filter(
    (o) => o.status === "draft" || o.status === "in_progress",
  ).length
  const sinVender = outputs.filter((o) => !o.sellable).length

  return (
    <>
      <PageHeader
        section="Operación"
        title="Producción"
        description="Recetas de lote y órdenes de fabricación: los insumos salen del inventario, el terminado entra con su lote y su costo, y desde aquí se publica en Productos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              title="Actualizar"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setBomOpen(true)}>
                  <Plus className="size-4" />
                  Nueva receta
                </Button>
                <Button onClick={() => setOrderOpen(true)}>
                  <Factory className="size-4" />
                  Nueva orden
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* La cadena, dicha en una línea: es el modelo mental del módulo y sin él
          nadie entiende por qué hay recetas en dos sitios distintos. */}
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3 text-sm">
          <Link
            href="/panel/inventario"
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Boxes className="size-4" />
            Inventario
          </Link>
          <span className="text-muted-foreground">(insumos)</span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <span className="inline-flex items-center gap-1.5 font-medium text-primary">
            <Factory className="size-4" />
            Producción
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <Link
            href="/panel/productos"
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <ShoppingBag className="size-4" />
            Productos
          </Link>
          <span className="text-muted-foreground">
            (lo que se vende en caja). Solo pasa por aquí lo que se fabrica; lo
            que se compra ya hecho va directo de Inventario a Productos.
          </span>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Órdenes en curso" value={String(enCurso)} />
        <Kpi label="Terminados con receta" value={String(outputs.length)} />
        <Kpi
          label="Sin publicar en Productos"
          value={String(sinVender)}
          accent={sinVender > 0}
        />
      </div>

      <Card className="mb-4">
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
          {tab === "ordenes" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Estado</Label>
              <select
                className={`${inputClass} w-44`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value={ALL}>Todos</option>
                {Object.entries(PRODUCTION_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1">
        {(
          [
            ["terminados", "Terminados", Package],
            ["ordenes", "Órdenes", Factory],
            ["recetas", "Recetas", Boxes],
          ] as [Tab, string, typeof Package][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {tab === "terminados" && (
        <OutputsTable
          rows={outputs}
          loading={loading}
          canManage={canManage}
          onPublish={setPublishing}
        />
      )}

      {tab === "ordenes" && (
        <OrdersTable
          rows={orders}
          sedes={sedes}
          loading={loading}
          onOpen={setDetail}
        />
      )}

      {tab === "recetas" && (
        <BomsTable
          rows={boms}
          loading={loading}
          canManage={canManage}
          onDeleted={load}
        />
      )}

      {canManage && (
        <>
          <NewBomSheet
            open={bomOpen}
            onClose={() => setBomOpen(false)}
            onSaved={load}
            products={products}
          />
          <NewOrderSheet
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            onSaved={load}
            sedes={sedes}
            products={products}
            boms={boms}
          />
          <PublishSheet
            output={publishing}
            onClose={() => setPublishing(null)}
            onSaved={load}
          />
        </>
      )}
      <OrderDetailSheet
        order={detail}
        onClose={() => setDetail(null)}
        onSaved={load}
        canManage={canManage}
        products={products}
      />
    </>
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
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={`stat-figure mt-1 text-2xl ${accent ? "text-warning-ink" : "text-foreground"}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Terminados: el puente con Inventario y Productos ────────────────────────

/**
 * La tabla que justifica el módulo. Cada fila enlaza los tres eslabones: el
 * terminado en bodega (Inventario), lo que cuesta fabricarlo (Producción) y a
 * qué precio se vende (Productos). El margen es contra el precio con IVA de la
 * tirilla, que es el número que el dueño tiene en la cabeza.
 */
function OutputsTable({
  rows,
  loading,
  canManage,
  onPublish,
}: {
  rows: ProductionOutput[]
  loading: boolean
  canManage: boolean
  onPublish: (output: ProductionOutput) => void
}) {
  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminado</TableHead>
              <TableHead className="text-right">En bodega</TableHead>
              <TableHead className="text-right">Costo unitario</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Precio de venta
              </TableHead>
              <TableHead className="hidden text-right lg:table-cell">
                Margen
              </TableHead>
              <TableHead className="text-right">Productos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              rows.map((row) => (
                <TableRow key={row.bomId}>
                  <TableCell>
                    <Link
                      href="/panel/inventario"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.product.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.product.sku} · rinde {qty(row.outputQty)}{" "}
                      {row.product.unit} por lote
                    </p>
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {qty(row.stock)}{" "}
                    <span className="text-muted-foreground">
                      {row.product.unit}
                    </span>
                  </TableCell>
                  <TableCell className="tnum text-right">
                    <span className="font-semibold">
                      {money.format(row.unitCost)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {row.lastOrder
                        ? `real · ${row.lastOrder.number}`
                        : "estimado"}
                    </p>
                  </TableCell>
                  <TableCell className="tnum hidden text-right md:table-cell">
                    {row.sellable ? (
                      money.format(row.sellable.salePrice)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tnum hidden text-right lg:table-cell">
                    {row.margin !== undefined ? (
                      <span
                        className={
                          row.margin >= 0
                            ? "font-medium text-foreground"
                            : "font-medium text-destructive"
                        }
                      >
                        {money.format(row.margin)}
                        {row.marginPct !== undefined && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({row.marginPct}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.sellable ? (
                      <Button variant="ghost" size="sm" render={<Link href="/panel/productos" />}>
                        <ShoppingBag className="size-4" />
                        Se vende
                      </Button>
                    ) : canManage ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPublish(row)}
                      >
                        Publicar
                      </Button>
                    ) : (
                      <Badge variant="secondary">Sin publicar</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  <Package className="mx-auto mb-2 size-8 opacity-40" />
                  Aún no hay recetas. Crea la primera para empezar a fabricar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Órdenes ─────────────────────────────────────────────────────────────────

function OrdersTable({
  rows,
  sedes,
  loading,
  onOpen,
}: {
  rows: ProductionOrder[]
  sedes: Sede[]
  loading: boolean
  onOpen: (order: ProductionOrder) => void
}) {
  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"
  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Terminado</TableHead>
              <TableHead className="hidden sm:table-cell">Sede</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              rows.map((o) => (
                <TableRow
                  key={o._id}
                  className="cursor-pointer"
                  onClick={() => onOpen(o)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {o.number}
                  </TableCell>
                  <TableCell>{o.productName}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {sedeName(refId(o.sedeId as string))}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {fmtDate(o.date)}
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {o.status === "done"
                      ? `${qty(o.producedQty)} ${o.unit}`
                      : `${qty(o.plannedQty)} ${o.unit}`}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusVariant[o.status]}>
                      {PRODUCTION_STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  <Factory className="mx-auto mb-2 size-8 opacity-40" />
                  No hay órdenes de producción.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Recetas ─────────────────────────────────────────────────────────────────

function BomsTable({
  rows,
  loading,
  canManage,
  onDeleted,
}: {
  rows: Bom[]
  loading: boolean
  canManage: boolean
  onDeleted: () => void
}) {
  const [busy, setBusy] = React.useState<string | null>(null)

  async function handleDelete(bom: Bom) {
    if (!confirm(`¿Eliminar la receta "${bom.name}"?`)) return
    setBusy(bom._id)
    try {
      await deleteBom(bom._id)
      onDeleted()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receta</TableHead>
              <TableHead>Insumos</TableHead>
              <TableHead className="text-right">Rinde</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                Conversión
              </TableHead>
              {canManage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              rows.map((bom) => {
                const product =
                  typeof bom.productId === "object" ? bom.productId : null
                return (
                  <TableRow key={bom._id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{bom.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {product?.sku ?? ""} · {product?.name ?? ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bom.lines
                        .map((l) => {
                          const input =
                            typeof l.productId === "object" ? l.productId : null
                          return `${qty(l.qty)} ${input?.unit ?? ""} ${input?.name ?? "—"}`
                        })
                        .join(" · ")}
                    </TableCell>
                    <TableCell className="tnum text-right">
                      {qty(bom.outputQty)}{" "}
                      <span className="text-muted-foreground">
                        {product?.unit ?? ""}
                      </span>
                    </TableCell>
                    <TableCell className="tnum hidden text-right md:table-cell">
                      {money.format(bom.extraCost)}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar la receta ${bom.name}`}
                          disabled={busy === bom._id}
                          onClick={() => void handleDelete(bom)}
                        >
                          {busy === bom._id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 5 : 4}
                  className="py-10 text-center text-muted-foreground"
                >
                  <Boxes className="mx-auto mb-2 size-8 opacity-40" />
                  Todavía no hay recetas de lote.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ─── Nueva receta ────────────────────────────────────────────────────────────

interface DraftLine {
  productId: string
  qty: string
}

function NewBomSheet({
  open,
  onClose,
  onSaved,
  products,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  products: InvProduct[]
}) {
  const [productId, setProductId] = React.useState("")
  const [name, setName] = React.useState("")
  const [outputQty, setOutputQty] = React.useState("1")
  const [extraCost, setExtraCost] = React.useState("0")
  const [lines, setLines] = React.useState<DraftLine[]>([
    { productId: "", qty: "" },
  ])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setProductId("")
    setName("")
    setOutputQty("1")
    setExtraCost("0")
    setLines([{ productId: "", qty: "" }])
    setError(null)
  }, [open])

  const output = products.find((p) => p._id === productId)

  // Costo teórico mientras se escribe: sin él, nadie sabe si la receta que está
  // armando deja margen hasta después de fabricar el primer lote.
  const materials = lines.reduce((sum, l) => {
    const input = products.find((p) => p._id === l.productId)
    return sum + (input ? input.cost * Number(l.qty || 0) : 0)
  }, 0)
  const rendimiento = Number(outputQty || 0)
  const unitCost =
    rendimiento > 0
      ? Math.round((materials + numOr(extraCost)) / rendimiento)
      : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createBom({
        productId,
        name: name.trim() || output?.name || "Receta",
        outputQty: Number(outputQty),
        extraCost: numOr(extraCost),
        lines: lines
          .filter((l) => l.productId && Number(l.qty) > 0)
          .map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const valid =
    productId &&
    Number(outputQty) > 0 &&
    lines.some((l) => l.productId && Number(l.qty) > 0)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva receta de lote</SheetTitle>
          <SheetDescription>
            Define qué insumos consume un lote y cuántas unidades rinde. Las
            cantidades son por lote completo, no por unidad.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bom-product">Terminado</Label>
            <select
              id="bom-product"
              className={inputClass}
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((x) => x._id === e.target.value)
                if (p && !name) setName(p.name)
              }}
              required
            >
              <option value="">Seleccionar…</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} · {p.sku}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              El ítem de inventario que sale del proceso. Si no existe, créalo
              primero en Inventario como “Montaje”.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bom-name">Nombre de la receta</Label>
            <Input
              id="bom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Pan francés — horneada de 120"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bom-output">
                Rinde ({output?.unit ?? "und"})
              </Label>
              <Input
                id="bom-output"
                type="number"
                min="0"
                step="any"
                value={outputQty}
                onChange={(e) => setOutputQty(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bom-extra">Mano de obra e indirectos</Label>
              <Input
                id="bom-extra"
                type="number"
                min="0"
                value={extraCost}
                onChange={(e) => setExtraCost(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Insumos por lote</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className={inputClass}
                  aria-label={`Insumo ${i + 1}`}
                  value={line.productId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, productId: e.target.value } : l,
                      ),
                    )
                  }
                >
                  <option value="">Insumo…</option>
                  {products
                    .filter((p) => p._id !== productId)
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                </select>
                <Input
                  className="w-28"
                  type="number"
                  min="0"
                  step="any"
                  aria-label={`Cantidad del insumo ${i + 1}`}
                  placeholder="Cant."
                  value={line.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, qty: e.target.value } : l,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar el insumo ${i + 1}`}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((prev) => [...prev, { productId: "", qty: "" }])
              }
            >
              <Plus className="size-4" />
              Agregar insumo
            </Button>
          </div>

          <Card className="bg-muted/40">
            <CardContent className="flex items-center justify-between py-3 text-sm">
              <span className="text-muted-foreground">
                Costo estimado por {output?.unit ?? "unidad"}
              </span>
              <span className="tnum font-semibold">
                {money.format(unitCost)}
              </span>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pb-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Crear receta
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Nueva orden ─────────────────────────────────────────────────────────────

function NewOrderSheet({
  open,
  onClose,
  onSaved,
  sedes,
  products,
  boms,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  sedes: Sede[]
  products: InvProduct[]
  boms: Bom[]
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [productId, setProductId] = React.useState("")
  const [date, setDate] = React.useState(todayLocal())
  const [plannedQty, setPlannedQty] = React.useState("")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSedeId(sedes.length === 1 ? (sedes[0]?._id ?? "") : "")
    setProductId("")
    setDate(todayLocal())
    setPlannedQty("")
    setNote("")
    setError(null)
  }, [open, sedes])

  // Solo se ofrece fabricar lo que tiene receta: sin ella el backend no sabe
  // qué consumir y la orden se rechazaría al guardarla.
  const producibles = boms.map((b) => {
    const id = refId(b.productId)
    return { bom: b, product: products.find((p) => p._id === id) }
  })

  const selected = producibles.find((p) => p.product?._id === productId)
  const lotes =
    selected && Number(plannedQty) > 0
      ? Number(plannedQty) / selected.bom.outputQty
      : 0

  async function save(start: boolean) {
    setSaving(true)
    setError(null)
    try {
      await createProductionOrder({
        sedeId,
        productId,
        date,
        plannedQty: Number(plannedQty),
        note: note.trim() || undefined,
        start,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void save(true)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva orden de producción</SheetTitle>
          <SheetDescription>
            Los insumos se descuentan al terminar la orden, no al crearla.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-sede">Sede</Label>
            <select
              id="op-sede"
              className={inputClass}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-product">Qué se fabrica</Label>
            <select
              id="op-product"
              className={inputClass}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {producibles.map(({ bom, product }) =>
                product ? (
                  <option key={bom._id} value={product._id}>
                    {product.name} · {product.sku}
                  </option>
                ) : null,
              )}
            </select>
            {producibles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay recetas registradas. Crea una primero.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-qty">
                Cantidad ({selected?.product?.unit ?? "und"})
              </Label>
              <Input
                id="op-qty"
                type="number"
                min="0"
                step="any"
                value={plannedQty}
                onChange={(e) => setPlannedQty(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="op-date">Fecha</Label>
              <Input
                id="op-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {selected && lotes > 0 && (
            <Card className="bg-muted/40">
              <CardContent className="py-3 text-sm text-muted-foreground">
                Equivale a{" "}
                <span className="font-medium text-foreground">
                  {qty(Math.round(lotes * 100) / 100)}
                </span>{" "}
                lote(s) de “{selected.bom.name}”. Los insumos se calculan a
                prorrata al guardar.
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-note">Nota (opcional)</Label>
            <Input
              id="op-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 pb-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {/* Borrador para lo que se programa hoy y se hornea mañana; iniciar
                para lo que ya está en la mesa de trabajo. En ninguno de los dos
                se toca el inventario todavía. */}
            <Button
              type="button"
              variant="outline"
              disabled={saving || !sedeId || !productId || !plannedQty}
              onClick={() => void save(false)}
            >
              Guardar borrador
            </Button>
            <Button
              type="submit"
              disabled={saving || !sedeId || !productId || !plannedQty}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Crear e iniciar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Detalle de la orden ─────────────────────────────────────────────────────

function OrderDetailSheet({
  order,
  onClose,
  onSaved,
  canManage,
  products,
}: {
  order: ProductionOrder | null
  onClose: () => void
  onSaved: () => void
  canManage: boolean
  products: InvProduct[]
}) {
  const [producedQty, setProducedQty] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!order) return
    setProducedQty(String(order.plannedQty))
    setExpiresAt(order.expiresAt ?? "")
    setError(null)
  }, [order])

  if (!order) return null

  const output = products.find((p) => p._id === order.productId)
  const open = order.status === "draft" || order.status === "in_progress"

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={Boolean(order)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono">{order.number}</span>
            <Badge variant={statusVariant[order.status]}>
              {PRODUCTION_STATUS_LABELS[order.status]}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {order.productName} · {qty(order.plannedQty)} {order.unit} planeadas
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-2">
          <div>
            <p className="mb-2 text-sm font-medium">Insumos</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  {order.status === "done" && (
                    <TableHead className="text-right">Costo</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{l.description}</TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {qty(l.qty)} {l.unit}
                    </TableCell>
                    {order.status === "done" && (
                      <TableCell className="tnum text-right text-sm">
                        {money.format(l.subtotal)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {order.status === "done" && (
            <Card className="bg-muted/40">
              <CardContent className="flex flex-col gap-1.5 py-3 text-sm">
                <Row label="Producido">
                  {qty(order.producedQty)} {order.unit}
                </Row>
                <Row label="Lote">{order.lotCode ?? "—"}</Row>
                <Row label="Materiales">{money.format(order.materialsCost)}</Row>
                <Row label="Mano de obra e indirectos">
                  {money.format(order.extraCost)}
                </Row>
                <Row label="Costo del lote">{money.format(order.totalCost)}</Row>
                <Row label={`Costo por ${order.unit}`}>
                  <span className="font-semibold">
                    {money.format(order.unitCost)}
                  </span>
                </Row>
              </CardContent>
            </Card>
          )}

          {open && canManage && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="op-produced">
                    Salida real ({order.unit})
                  </Label>
                  <Input
                    id="op-produced"
                    type="number"
                    min="0"
                    step="any"
                    value={producedQty}
                    onChange={(e) => setProducedQty(e.target.value)}
                  />
                </div>
                {output?.perishable && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="op-expires">Vence</Label>
                    <Input
                      id="op-expires"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Al terminar, los insumos salen del inventario y el terminado
                entra con su lote y su costo. No se puede deshacer: una orden
                terminada se corrige con un ajuste.
              </p>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {open && canManage && (
            <div className="flex flex-wrap justify-end gap-2 pb-4">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => cancelProductionOrder(order._id))}
              >
                <Ban className="size-4" />
                Anular
              </Button>
              {order.status === "draft" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => startProductionOrder(order._id))}
                >
                  <Play className="size-4" />
                  Iniciar
                </Button>
              )}
              <Button
                disabled={busy || !producedQty}
                onClick={() =>
                  void run(() =>
                    completeProductionOrder(order._id, {
                      producedQty: Number(producedQty),
                      expiresAt: expiresAt || undefined,
                    }),
                  )
                }
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Terminar
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tnum">{children}</span>
    </div>
  )
}

// ─── Publicar en Productos ───────────────────────────────────────────────────

/**
 * El último tramo del puente. Crea el vendible del POS abastecido del ítem de
 * inventario (una unidad por venta), no de una receta: los insumos ya se
 * consumieron al fabricar, y volver a descontarlos al vender contaría la harina
 * dos veces.
 */
function PublishSheet({
  output,
  onClose,
  onSaved,
}: {
  output: ProductionOutput | null
  onClose: () => void
  onSaved: () => void
}) {
  const [salePrice, setSalePrice] = React.useState("")
  const [ivaRate, setIvaRate] = React.useState<"0" | "5" | "19">("19")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!output) return
    // Sugerencia de arranque: costo con un margen del 40%, redondeado a peso.
    setSalePrice(String(Math.round(output.unitCost * 1.4)))
    setIvaRate("19")
    setError(null)
  }, [output])

  if (!output) return null

  const price = numOr(salePrice)
  const margin = price - output.unitCost
  const marginPct = price > 0 ? Math.round((margin / price) * 100) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!output) return
    setSaving(true)
    setError(null)
    try {
      await publishOutput(output.bomId, {
        salePrice: price,
        ivaRate: Number(ivaRate) as 0 | 5 | 19,
        ivaType: ivaRate === "0" ? "excluido" : "gravado",
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={Boolean(output)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Publicar en Productos</SheetTitle>
          <SheetDescription>
            {output.product.name} pasa a venderse en el POS. Cada venta descuenta
            una unidad del terminado en bodega.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <Card className="bg-muted/40">
            <CardContent className="flex flex-col gap-1.5 py-3 text-sm">
              <Row label={`Costo por ${output.product.unit}`}>
                {money.format(output.unitCost)}
              </Row>
              <Row label="En bodega">
                {qty(output.stock)} {output.product.unit}
              </Row>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pub-price">Precio (IVA incluido)</Label>
              <Input
                id="pub-price"
                type="number"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pub-iva">IVA</Label>
              <select
                id="pub-iva"
                className={inputClass}
                value={ivaRate}
                onChange={(e) =>
                  setIvaRate(e.target.value as "0" | "5" | "19")
                }
              >
                <option value="19">19% — gravado</option>
                <option value="5">5% — gravado</option>
                <option value="0">0% — excluido</option>
              </select>
            </div>
          </div>

          <p
            className={`text-sm ${margin >= 0 ? "text-muted-foreground" : "text-destructive"}`}
          >
            Margen: <span className="tnum font-medium">{money.format(margin)}</span>{" "}
            ({marginPct}%)
            {margin < 0 && " — estarías vendiendo por debajo del costo."}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pb-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !salePrice}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Publicar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
