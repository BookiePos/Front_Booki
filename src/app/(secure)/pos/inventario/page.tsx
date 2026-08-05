"use client"

import * as React from "react"
import {
  Search,
  Boxes,
  ShieldOff,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
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

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone: "warning" | "danger" | "muted"
}) {
  const tones = {
    warning: "bg-amber-100 text-amber-600",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-2xl">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
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

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q),
    )
  }, [rows, search])

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
          <Button data-tour="pos-inv-ajustar" className="gap-2" onClick={() => openAdjust()}>
            <SlidersHorizontal className="size-4" />
            Ajustar
          </Button>
        )}
      </div>

      {/* Resumen de alertas */}
      <div data-tour="pos-inv-kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Boxes}
          label="Ítems con stock"
          value={rows.length}
          tone="muted"
        />
        <StatCard
          icon={AlertTriangle}
          label="Stock bajo"
          value={alerts?.lowStock.length ?? 0}
          tone="warning"
        />
        <StatCard
          icon={Clock}
          label="Por vencer / vencidos"
          value={
            (alerts?.expiringSoon.length ?? 0) + (alerts?.expired.length ?? 0)
          }
          tone="danger"
        />
      </div>

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
            <p className="py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No hay existencias registradas en esta sede."
                : "Sin resultados para la búsqueda."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Existencia</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
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
                          <Badge className="bg-amber-100 text-amber-700">
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
        <AdjustSheet
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

function AdjustSheet({
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

  const productItems = React.useMemo(
    () =>
      Object.fromEntries(products.map((p) => [p._id, `${p.name} · ${p.sku}`])),
    [products],
  )

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
    <Sheet open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Ajustar existencias
          </SheetTitle>
          <SheetDescription>
            Corrige el inventario por conteo, daño, vencimiento o merma. Las
            salidas descuentan primero los lotes más próximos a vencer.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-product">Producto</Label>
            <Select
              value={productId}
              items={productItems}
              onValueChange={(v) => {
                if (v !== null) setProductId(v as string)
              }}
            >
              <SelectTrigger id="adj-product" className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} · {p.sku}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-dir">Tipo</Label>
              <Select
                value={direction}
                items={{ remove: "Salida (−)", add: "Entrada (+)" }}
                onValueChange={(v) => {
                  if (v === "add" || v === "remove") setDirection(v)
                }}
              >
                <SelectTrigger id="adj-dir" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove">Salida (−)</SelectItem>
                  <SelectItem value="add">Entrada (+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adj-qty">
                Cantidad{product ? ` (${product.unit})` : ""}
              </Label>
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
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">Razón</Label>
            <Select
              value={reason}
              items={ADJUST_REASON_LABELS}
              onValueChange={(v) => {
                if (v !== null) setReason(v as AdjustReason)
              }}
            >
              <SelectTrigger id="adj-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(ADJUST_REASON_LABELS) as [AdjustReason, string][]
                ).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {createsLot && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-lot">Código de lote</Label>
                <Input
                  id="adj-lot"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Auto si se deja vacío"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adj-exp">
                  Vencimiento{product?.perishable ? "" : " (opcional)"}
                </Label>
                <Input
                  id="adj-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={product?.perishable}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-note">Nota (opcional)</Label>
            <Input
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalle del ajuste"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar ajuste"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
