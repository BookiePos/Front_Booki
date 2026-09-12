"use client"

import * as React from "react"
import {
  Search,
  Boxes,
  ShieldOff,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  Plus,
  Minus,
  Loader2,
  CalendarClock,
  PackageX,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  getStock,
  getAlerts,
  listProducts,
  createAdjustment,
  ADJUST_REASON_LABELS,
  type StockRow,
  type InvAlerts,
  type InvProduct,
  type AdjustReason,
} from "@/lib/pos/api-inventory"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  FormDialog,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { Segmented } from "@/components/ui/segmented"
import { Termino } from "@/components/ui/help-tip"

/** Id del `<form>`: el botón de guardar vive en el pie, fuera del formulario. */
const ADJUST_FORM_ID = "ajuste-inventario-form"

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/**
 * Tarjeta de resumen. Cuando recibe `onClick` deja de ser un cartel y se
 * convierte en el filtro de la tabla de abajo: ver "3 productos con stock bajo"
 * y no poder tocarlo para saber cuáles eran exactamente el problema que tenía
 * esta pantalla.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  active = false,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone: "warning" | "danger" | "muted"
  active?: boolean
  onClick?: () => void
}) {
  const tones = {
    warning: "bg-warning/15 text-warning-ink",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }
  const body = (
    <CardContent className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          tones[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 text-left leading-tight">
        <p className="stat-figure text-2xl">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  )

  if (!onClick) return <Card>{body}</Card>

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all outline-none",
        "hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md",
        "focus-visible:ring-3 focus-visible:ring-ring/45",
        active && "border-primary bg-primary/6 shadow-md",
      )}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {body}
    </Card>
  )
}

export default function InventarioPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("inventory.view")
  const canAdjust = hasPermission("inventory.adjust")
  const { sedeId, sede } = useSede()

  const [rows, setRows] = React.useState<StockRow[]>([])
  const [alerts, setAlerts] = React.useState<InvAlerts | null>(null)
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  /** Filtro rápido de la tabla, gobernado por las tarjetas de resumen. */
  const [filtro, setFiltro] = React.useState<"todo" | "bajo" | "vence">("todo")

  // Ajuste de existencias
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [presetProductId, setPresetProductId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!canView || !sedeId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [stock, alrt] = await Promise.all([getStock(sedeId), getAlerts(sedeId)])
      setRows(stock)
      setAlerts(alrt)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canView, sedeId])

  React.useEffect(() => {
    void load()
  }, [load])

  // Catálogo para el selector de ajuste (solo si el rol puede modificar).
  React.useEffect(() => {
    if (!canAdjust) return
    let active = true
    listProducts()
      .then((p) => {
        if (active) setProducts(p)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canAdjust])

  /** Ítems con al menos un lote vencido o a punto de vencer en esta sede. */
  const idsEnRiesgo = React.useMemo(() => {
    const ids = new Set<string>()
    for (const lot of [
      ...(alerts?.expired ?? []),
      ...(alerts?.expiringSoon ?? []),
    ]) {
      if (lot.productId?._id) ids.add(lot.productId._id)
    }
    return ids
  }, [alerts])

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filtro === "bajo" && !(r.minStock > 0 && r.qty <= r.minStock)) {
        return false
      }
      if (filtro === "vence" && !idsEnRiesgo.has(r.product._id)) return false
      if (!q) return true
      return (
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q)
      )
    })
  }, [rows, search, filtro, idsEnRiesgo])

  function openAdjust(productId?: string) {
    setPresetProductId(productId ?? null)
    setAdjustOpen(true)
  }

  if (!canView) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin acceso</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            No tienes permiso para ver el inventario. Contacta al administrador.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Existencias{sede ? ` en ${sede.name}` : ""}.
          </p>
        </div>
        {canAdjust && (
          <Button
            data-tour="pos-inv-ajustar"
            size="lg"
            onClick={() => openAdjust()}
          >
            <SlidersHorizontal className="size-4" />
            Ajustar existencias
          </Button>
        )}
      </div>

      {/* Resumen de alertas. Cada tarjeta filtra la tabla de abajo. */}
      <div data-tour="pos-inv-kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Boxes}
          label="Ítems con stock"
          value={rows.length}
          tone="muted"
          active={filtro === "todo"}
          onClick={() => setFiltro("todo")}
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock bajo"
          value={alerts?.lowStock.length ?? 0}
          tone="warning"
          active={filtro === "bajo"}
          onClick={() => setFiltro("bajo")}
        />
        <StatCard
          icon={Clock}
          label="Por vencer / vencidos"
          value={
            (alerts?.expiringSoon.length ?? 0) + (alerts?.expired.length ?? 0)
          }
          tone="danger"
          active={filtro === "vence"}
          onClick={() => setFiltro("vence")}
        />
      </div>

      {/* Lotes en riesgo, con nombre y apellido.
          La tarjeta de arriba dice "hay 4"; esto dice cuáles, de qué lote y
          para cuándo, que es lo único con lo que se puede hacer algo: sacarlo
          del estante, rebajarlo o darlo de baja con un ajuste. */}
      {(alerts?.expired.length ?? 0) + (alerts?.expiringSoon.length ?? 0) > 0 && (
        <Card tone="warning">
          <CardContent className="flex flex-col gap-2.5 py-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-warning-ink" />
              <p className="text-sm font-bold">
                Lotes vencidos o por vencer
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · próximos {alerts?.days ?? 7} días
                </span>
              </p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {[...(alerts?.expired ?? []), ...(alerts?.expiringSoon ?? [])]
                .slice(0, 6)
                .map((lot) => {
                  const vencido =
                    !!lot.expiresAt && new Date(lot.expiresAt) < new Date()
                  return (
                    <li
                      key={lot._id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card/70 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{lot.productId?.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {lot.lotCode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {nf.format(lot.qty)} {lot.productId?.unit ?? ""}
                      </span>
                      <Badge
                        className={cn(
                          "ml-auto border-transparent",
                          vencido
                            ? "bg-destructive/12 text-destructive"
                            : "bg-warning/20 text-warning-ink",
                        )}
                      >
                        {vencido ? "Vencido" : "Por vencer"}
                        {lot.expiresAt
                          ? " · " +
                            new Date(lot.expiresAt).toLocaleDateString("es-CO", {
                              day: "2-digit",
                              month: "short",
                              timeZone: "UTC",
                            })
                          : ""}
                      </Badge>
                      {canAdjust && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAdjust(lot.productId?._id)}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Dar de baja
                        </Button>
                      )}
                    </li>
                  )
                })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div data-tour="pos-inv-buscar" className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU…"
          className="h-11 pl-9"
        />
      </div>

      <Card data-tour="pos-inv-tabla">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <PackageX className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? "No hay existencias registradas en esta sede."
                  : filtro === "bajo"
                    ? "Nada por debajo del mínimo. Todo en orden."
                    : filtro === "vence"
                      ? "Ningún lote vencido ni próximo a vencer."
                      : "Sin resultados para la búsqueda."}
              </p>
              {filtro !== "todo" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFiltro("todo")}
                >
                  Ver todo el inventario
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>
                    <Termino>SKU</Termino>
                  </TableHead>
                  <TableHead className="text-right">
                    <Termino>Existencia</Termino>
                  </TableHead>
                  <TableHead className="text-right">
                    <Termino term="stockMinimo">Mínimo</Termino>
                  </TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {canAdjust && (
                    <TableHead className="text-right">Acción</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const low = r.minStock > 0 && r.qty <= r.minStock
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.product.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.product.sku}
                      </TableCell>
                      <TableCell className="text-right">
                        {nf.format(r.qty)} {r.product.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.minStock > 0 ? nf.format(r.minStock) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.qty <= 0 ? (
                          <Badge variant="destructive">Agotado</Badge>
                        ) : low ? (
                          <Badge className="bg-warning/15 text-warning-ink">
                            Stock bajo
                          </Badge>
                        ) : (
                          <Badge variant="outline">OK</Badge>
                        )}
                      </TableCell>
                      {canAdjust && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openAdjust(r.product._id)}
                          >
                            <SlidersHorizontal className="size-3.5" />
                            Ajustar
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canAdjust && sedeId && (
        <AdjustDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          sedeId={sedeId}
          products={products}
          presetProductId={presetProductId}
          onSuccess={() => {
            setAdjustOpen(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

// ─── Ajuste de existencias ────────────────────────────────────────────────────

function AdjustDialog({
  open,
  onOpenChange,
  sedeId,
  products,
  presetProductId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  products: InvProduct[]
  presetProductId: string | null
  onSuccess: () => void
}) {
  const [productId, setProductId] = React.useState("")
  const [direction, setDirection] = React.useState<"add" | "remove">("remove")
  const [qty, setQty] = React.useState("")
  const [reason, setReason] = React.useState<AdjustReason>("conteo")
  const [lotCode, setLotCode] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un ajuste de entrada de un producto con lotes crea un lote nuevo.
  const createsLot = direction === "add" && Boolean(product?.trackLots)

  React.useEffect(() => {
    if (!open) return
    setProductId(presetProductId ?? "")
    setDirection("remove")
    setQty("")
    setReason("conteo")
    setLotCode("")
    setExpiresAt("")
    setNote("")
    setError(null)
  }, [open, presetProductId])


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) {
      setError("Selecciona un producto")
      return
    }
    const n = Number(qty)
    if (!(n > 0)) {
      setError("Ingresa una cantidad válida")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createAdjustment({
        productId,
        sedeId,
        direction,
        qty: n,
        reason,
        lotCode: createsLot && lotCode ? lotCode : undefined,
        expiresAt: createsLot && expiresAt ? expiresAt : undefined,
        note: note || undefined,
      })
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !saving && onOpenChange(v)}
      size="2xl"
      icon={SlidersHorizontal}
      title="Ajustar existencias"
      description="Corrige el inventario por conteo, daño, vencimiento o merma. Las salidas descuentan primero los lotes más próximos a vencer."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ADJUST_FORM_ID}
            disabled={saving}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <SlidersHorizontal />}
            {saving ? "Guardando…" : "Guardar ajuste"}
          </Button>
        </>
      }
    >
      <form
        id={ADJUST_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        {error && <FormAlert>{error}</FormAlert>}

        <FormSection title="Qué se ajusta">
          <FieldGrid cols={2}>
            <FieldSpan span={2}>
              <Field id="adj-product" label="Producto" required>
                <NativeSelect
                  id="adj-product"
                  value={productId}
                  onChange={setProductId}
                  options={products.map((p) => ({
                    value: p._id,
                    label: `${p.name} · ${p.sku}`,
                  }))}
                  placeholder="Seleccionar producto"
                />
              </Field>
            </FieldSpan>

            <Field id="adj-dir" label="Tipo">
              <Segmented
                fill
                ariaLabel="Tipo de ajuste"
                value={direction}
                onValueChange={(v) => setDirection(v as "add" | "remove")}
                options={[
                  { value: "remove", label: "Salida (−)", icon: Minus },
                  { value: "add", label: "Entrada (+)", icon: Plus },
                ]}
              />
            </Field>
            <Field
              id="adj-qty"
              label={`Cantidad${product ? ` (${product.unit})` : ""}`}
              required
              help={{ term: "unidad" }}
            >
              <Input
                id="adj-qty"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </Field>

            <FieldSpan span={2}>
              <Field
                id="adj-reason"
                label="Razón"
                help={{ term: "merma" }}
                hint="Queda registrada en el kárdex con tu nombre."
              >
                <NativeSelect
                  id="adj-reason"
                  value={reason}
                  onChange={(v) => setReason(v as AdjustReason)}
                  options={(
                    Object.entries(ADJUST_REASON_LABELS) as [
                      AdjustReason,
                      string,
                    ][]
                  ).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            </FieldSpan>
          </FieldGrid>
        </FormSection>

        {createsLot && (
          <FormSection
            title="Lote que entra"
            description="Las unidades que entran forman un lote, para poder sacar primero lo que se vence antes."
            boxed
          >
            <FieldGrid cols={2}>
              <Field
                id="adj-lot"
                label="Código de lote"
                help={{ term: "lote" }}
                hint="Se genera solo si lo dejas vacío."
              >
                <Input
                  id="adj-lot"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Auto"
                />
              </Field>
              <Field
                id="adj-exp"
                label="Vencimiento"
                required={product?.perishable}
                help={{ term: "fefo" }}
              >
                <Input
                  id="adj-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={product?.perishable}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        )}

        <Field id="adj-note" label="Nota">
          <Input
            id="adj-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detalle del ajuste (opcional)"
          />
        </Field>
      </form>
    </FormDialog>
  )
}
