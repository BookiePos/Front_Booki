"use client"

import * as React from "react"
import {
  ShieldOff,
  UtensilsCrossed,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  Send,
  Receipt,
  CheckCircle2,
  Ban,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listTables,
  createTable,
  listOrders,
  getOrder,
  openOrder,
  addOrderItems,
  sendOrderToKitchen,
  requestOrderBill,
  setOrderTip,
  closeOrder,
  cancelOrder,
  TABLE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type RestaurantTable,
  type RestaurantOrder,
} from "@/lib/erp/api-restaurant"
import { money, errorMessage, numOr } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const tableTone: Record<string, string> = {
  free: "border-border bg-card hover:border-primary",
  occupied: "border-info/40 bg-info/5",
  bill_requested: "border-warning/50 bg-warning/10",
}

export default function RestaurantePage() {
  const { hasPermission, isRetail } = useAuth()
  const canOperate = hasPermission("restaurant.operate")
  const canManageTables = hasPermission("sede.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const [tables, setTables] = React.useState<RestaurantTable[]>([])
  const [orders, setOrders] = React.useState<RestaurantOrder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null)
  const [newTableOpen, setNewTableOpen] = React.useState(false)

  React.useEffect(() => {
    if (!canOperate) return
    listSedes()
      .then((sd) => {
        const active = sd.filter((s) => s.active)
        setSedes(active)
        setSedeId((cur) => cur || active[0]?._id || "")
      })
      .catch((err) => setError(errorMessage(err)))
  }, [canOperate])

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [t, o] = await Promise.all([
        listTables(sedeId),
        listOrders({ sedeId }),
      ])
      setTables(t)
      setOrders(o)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    if (canOperate && sedeId) void load()
  }, [canOperate, sedeId, load])

  // Retail no usa mesas/comandas: la ruta existe pero no es aplicable.
  if (isRetail) {
    return (
      <>
        <PageHeader section="Operación" title="Restaurante" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <UtensilsCrossed className="size-10 text-muted-foreground opacity-50" />
            <p className="font-display text-lg text-foreground">
              No disponible para tu tipo de negocio
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Las mesas y comandas son de negocios tipo restaurante. Tu tienda
              vende desde el <strong>Punto de venta</strong> y el catálogo de{" "}
              <strong>Productos</strong>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  if (!canOperate) {
    return (
      <>
        <PageHeader section="Operación" title="Restaurante" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>restaurant.operate</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const zones = Array.from(new Set(tables.map((t) => t.zone)))
  const openOrderFor = (t: RestaurantTable) =>
    orders.find((o) => o._id === t.currentOrderId) ?? null

  async function handleTableClick(t: RestaurantTable) {
    if (!t.active) return
    if (t.currentOrderId) {
      setActiveOrderId(t.currentOrderId)
      return
    }
    try {
      const order = await openOrder({ tableId: t._id })
      await load()
      setActiveOrderId(order._id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        section="Operación"
        title="Restaurante"
        description="Salón, mesas y comandas. INC 8% y propina 10% (rechazable) sobre el consumo."
        actions={
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManageTables && (
              <Button className="gap-1.5" onClick={() => setNewTableOpen(true)}>
                <Plus className="size-4" /> Mesa
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <UtensilsCrossed className="size-10 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No hay mesas configuradas en esta sede.
              {canManageTables && " Crea la primera con el botón «Mesa»."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {zones.map((zone) => (
            <section key={zone}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{zone}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {tables
                  .filter((t) => t.zone === zone)
                  .map((t) => {
                    const order = openOrderFor(t)
                    return (
                      <button
                        key={t._id}
                        onClick={() => void handleTableClick(t)}
                        disabled={!t.active}
                        className={`flex min-h-24 flex-col justify-between rounded-xl border p-3 text-left transition-all disabled:opacity-40 ${tableTone[t.status]}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm text-foreground">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground">{t.seats}p</span>
                        </div>
                        <div>
                          <Badge
                            variant={t.status === "free" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {TABLE_STATUS_LABELS[t.status]}
                          </Badge>
                          {order && (
                            <p className="tnum mt-1 text-sm font-semibold">{money.format(order.total)}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>
      )}

      <OrderSheet
        orderId={activeOrderId}
        onClose={() => setActiveOrderId(null)}
        onChanged={load}
      />
      {canManageTables && (
        <NewTableSheet
          open={newTableOpen}
          onClose={() => setNewTableOpen(false)}
          sedeId={sedeId}
          onSaved={load}
        />
      )}
    </>
  )
}

function NewTableSheet({
  open,
  onClose,
  sedeId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  sedeId: string
  onSaved: () => Promise<void>
}) {
  const [name, setName] = React.useState("")
  const [zone, setZone] = React.useState("Principal")
  const [seats, setSeats] = React.useState("4")
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setName("")
      setZone("Principal")
      setSeats("4")
      setErr(null)
    }
  }, [open])

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      await createTable({ sedeId, name: name.trim(), zone: zone.trim(), seats: numOr(seats, 4) })
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Nueva mesa</SheetTitle>
          <SheetDescription>Agrega una mesa a un salón.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mesa 1" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Salón / zona</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Principal" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Puestos</Label>
            <Input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Crear mesa
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OrderSheet({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string | null
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { hasPermission } = useAuth()
  const canVoid = hasPermission("pos.void.authorize")

  const [order, setOrder] = React.useState<RestaurantOrder | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [itemName, setItemName] = React.useState("")
  const [itemQty, setItemQty] = React.useState("1")
  const [itemPrice, setItemPrice] = React.useState("0")

  const refresh = React.useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      setOrder(await getOrder(orderId))
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  React.useEffect(() => {
    if (orderId) {
      setErr(null)
      void refresh()
    } else {
      setOrder(null)
    }
  }, [orderId, refresh])

  async function run(fn: () => Promise<RestaurantOrder>, close = false) {
    setBusy(true)
    setErr(null)
    try {
      const updated = await fn()
      setOrder(updated)
      await onChanged()
      if (close) onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function addItem() {
    if (!order || !itemName.trim()) return
    await run(() =>
      addOrderItems(order._id, [
        { name: itemName.trim(), qty: numOr(itemQty, 1), unitPrice: numOr(itemPrice) },
      ]),
    )
    setItemName("")
    setItemQty("1")
    setItemPrice("0")
  }

  const editable = order && order.status !== "closed" && order.status !== "cancelled"

  return (
    <Sheet open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {loading || !order ? (
          <div className="p-6">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {order.tableName} · {order.number}
              </SheetTitle>
              <SheetDescription>
                {ORDER_STATUS_LABELS[order.status]} · {order.guests} comensal(es)
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 py-2">
              <div className="rounded-lg border border-border divide-y divide-border">
                {order.items.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Sin ítems. Agrega el primer pedido.
                  </p>
                ) : (
                  order.items.map((it, i) => (
                    <div key={it._id ?? i} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {it.qty}× {it.name}
                        </p>
                        {!it.sentToKitchen && (
                          <span className="text-[11px] text-warning">Pendiente de cocina</span>
                        )}
                      </div>
                      <span className="tnum text-sm font-medium">
                        {money.format(it.unitPrice * it.qty)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {editable && (
                <div className="rounded-lg border border-border p-2">
                  <Label className="text-xs">Agregar ítem</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Producto"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                    />
                    <Input
                      type="number"
                      className="w-14"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                    />
                    <Input
                      type="number"
                      className="w-24"
                      placeholder="$"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                    />
                    <Button size="icon" onClick={() => void addItem()} disabled={busy || !itemName.trim()}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Totales */}
              <div className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
                <Row label="Subtotal" value={money.format(order.subtotal)} />
                <Row label={`INC ${order.incRate}%`} value={money.format(order.incAmount)} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={order.tipAccepted}
                      disabled={!editable || busy}
                      onChange={(e) =>
                        void run(() => setOrderTip(order._id, { accepted: e.target.checked }))
                      }
                    />
                    Propina {order.tipRate}%
                  </label>
                  <span className="tnum">{money.format(order.tipAmount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tnum">{money.format(order.total)}</span>
                </div>
              </div>

              {err && <p className="text-sm text-destructive">{err}</p>}

              {editable && (
                <div className="flex flex-wrap justify-end gap-2 pb-4">
                  {order.items.some((i) => !i.sentToKitchen) && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => sendOrderToKitchen(order._id))}
                    >
                      <Send className="size-4" /> A cocina
                    </Button>
                  )}
                  {order.status !== "billed" && order.items.length > 0 && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => requestOrderBill(order._id))}
                    >
                      <Receipt className="size-4" /> Pedir cuenta
                    </Button>
                  )}
                  {canVoid && (
                    <Button
                      variant="outline"
                      className="text-destructive"
                      disabled={busy}
                      onClick={() => void run(() => cancelOrder(order._id, "Anulada desde el salón"), true)}
                    >
                      <Ban className="size-4" /> Anular
                    </Button>
                  )}
                  <Button
                    disabled={busy || order.items.length === 0}
                    onClick={() => void run(() => closeOrder(order._id), true)}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Cerrar / pagar
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  )
}
