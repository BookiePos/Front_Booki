"use client"

import * as React from "react"
import {
  ShieldOff,
  UtensilsCrossed,
  Plus,
  RefreshCw,
  Loader2,
  Send,
  Receipt,
  CheckCircle2,
  Ban,
  Banknote,
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
  sendOrderToCaja,
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
import { MoneyInput } from "@/components/ui/money-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import { Field, FieldGrid, FieldSpan } from "@/components/ui/field"
import { Termino } from "@/components/ui/help-tip"
import { Checkbox } from "@/components/ui/checkbox"

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
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              title="Actualizar"
              data-tour="restaurante-refrescar"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManageTables && (
              <Button className="gap-1.5" onClick={() => setNewTableOpen(true)} data-tour="restaurante-mesa">
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
        <div className="flex flex-col gap-6" data-tour="restaurante-salon">
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

      <OrderDialog
        orderId={activeOrderId}
        onClose={() => setActiveOrderId(null)}
        onChanged={load}
      />
      {canManageTables && (
        <NewTableDialog
          open={newTableOpen}
          onClose={() => setNewTableOpen(false)}
          sedeId={sedeId}
          onSaved={load}
        />
      )}
    </>
  )
}

function NewTableDialog({
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
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      icon={UtensilsCrossed}
      title="Nueva mesa"
      description="Un puesto del salón al que se le puede abrir una cuenta."
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void save()}
          busy={saving}
          disabled={!name.trim()}
          submitLabel="Crear mesa"
        />
      }
    >
      {err && <FormAlert>{err}</FormAlert>}

      <FormSection title="Datos de la mesa">
        <FieldGrid cols={2}>
          <FieldSpan span={2}>
            <Field id="mesa-name" label="Nombre" required>
              <Input
                id="mesa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mesa 1"
              />
            </Field>
          </FieldSpan>
          <Field
            id="mesa-zone"
            label="Salón / zona"
            hint="Para agrupar el mapa del salón."
          >
            <Input
              id="mesa-zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Principal"
            />
          </Field>
          <Field id="mesa-seats" label="Puestos">
            <Input
              id="mesa-seats"
              type="number"
              inputMode="numeric"
              min="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormDialog>
  )
}

function OrderDialog({
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

  const sentToCaja = !!order?.posOrderId
  const editable =
    order &&
    order.status !== "closed" &&
    order.status !== "cancelled" &&
    !sentToCaja

  return (
    <FormDialog
      open={!!orderId}
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      icon={UtensilsCrossed}
      title={order ? `${order.tableName} · ${order.number}` : "Comanda"}
      description={
        order
          ? `${ORDER_STATUS_LABELS[order.status]} · ${order.guests} comensal(es)`
          : undefined
      }
      footer={
        order && editable ? (
          <>
            {order.items.some((i) => !i.sentToKitchen) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => sendOrderToKitchen(order._id))}
              >
                <Send /> A cocina
              </Button>
            )}
            {order.status !== "billed" && order.items.length > 0 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => requestOrderBill(order._id))}
              >
                <Receipt /> Pedir cuenta
              </Button>
            )}
            {canVoid && (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => cancelOrder(order._id, "Anulada desde el salón"),
                    true,
                  )
                }
              >
                <Ban /> Anular
              </Button>
            )}
            {canVoid && (
              <Button
                variant="outline"
                disabled={busy || order.items.length === 0}
                onClick={() => void run(() => closeOrder(order._id), true)}
                title="Cierra la comanda sin registrar venta (cortesía / ajuste)"
              >
                <CheckCircle2 /> Cerrar sin cobrar
              </Button>
            )}
            <Button
              disabled={busy || order.items.length === 0}
              onClick={() => void run(() => sendOrderToCaja(order._id), true)}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Banknote />}
              Enviar a caja
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      {loading || !order ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (
        <>
          {err && <FormAlert>{err}</FormAlert>}

          <FormSection
            title="Lo pedido"
            description={
              order.items.length > 0
                ? `${order.items.length} línea${order.items.length === 1 ? "" : "s"} en la mesa.`
                : undefined
            }
          >
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {order.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Sin ítems. Agrega el primer pedido.
                </p>
              ) : (
                order.items.map((it, i) => (
                  <div
                    key={it._id ?? i}
                    className="flex items-center justify-between gap-3 bg-card px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {it.qty}× {it.name}
                      </p>
                      {!it.sentToKitchen && (
                        <span className="text-[0.6875rem] font-semibold text-warning-ink">
                          Pendiente de cocina
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {money.format(it.unitPrice * it.qty)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {sentToCaja && order.status !== "closed" && (
              <FormAlert tone="success" icon={Banknote}>
                Enviada a caja. El cobro (venta + inventario + caja) se hace
                desde el <span className="font-semibold">POS</span>. Al cobrarla,
                la mesa se libera sola.
              </FormAlert>
            )}
          </FormSection>

          {editable && (
            <FormSection title="Agregar ítem" boxed>
              <div className="flex items-end gap-2">
                <Field id="cmd-item" label="Producto" className="flex-1">
                  <Input
                    id="cmd-item"
                    placeholder="Bandeja paisa"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addItem()}
                  />
                </Field>
                <Field id="cmd-qty" label="Cant." className="w-20">
                  <Input
                    id="cmd-qty"
                    type="number"
                    inputMode="numeric"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                  />
                </Field>
                <Field id="cmd-price" label="Precio" className="w-32">
                  {/* El estado de esta ficha es texto, así que se traduce aquí
                      mismo: lo que se guarda no cambia y el mesero ve el punto
                      de los miles igual que en el resto del sistema. */}
                  <MoneyInput
                    id="cmd-price"
                    placeholder="0"
                    value={itemPrice === "" ? null : Number(itemPrice)}
                    onValueChange={(v) => setItemPrice(v === null ? "" : String(v))}
                  />
                </Field>
                <Button
                  size="icon"
                  aria-label="Agregar ítem"
                  className="shrink-0"
                  onClick={() => void addItem()}
                  disabled={busy || !itemName.trim()}
                >
                  <Plus />
                </Button>
              </div>
            </FormSection>
          )}

          <FormSection title="Cuenta">
            <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-muted/35 p-3.5 text-sm">
              <Row label="Subtotal" value={money.format(order.subtotal)} />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Termino term="inc">INC</Termino> {order.incRate}%
                </span>
                <span className="tnum">{money.format(order.incAmount)}</span>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={order.tipAccepted}
                    disabled={!editable || busy}
                    onCheckedChange={(v) =>
                      void run(() =>
                        setOrderTip(order._id, { accepted: Boolean(v) }),
                      )
                    }
                  />
                  <span className="flex items-center gap-1">
                    <Termino>Propina</Termino> {order.tipRate}%
                  </span>
                </span>
                <span className="tnum">{money.format(order.tipAmount)}</span>
              </label>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5">
                <span className="font-semibold">Total</span>
                <span className="stat-figure text-lg">
                  {money.format(order.total)}
                </span>
              </div>
            </div>
          </FormSection>
        </>
      )}
    </FormDialog>
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
