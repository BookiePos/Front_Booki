"use client"

import * as React from "react"
import {
  ShieldOff,
  Truck,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
  PackageCheck,
  Send,
  Ban,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, listProducts, type Sede, type InvProduct } from "@/lib/erp/api-inventory"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { listTaxes, type TaxView } from "@/lib/erp/api-tax"
import {
  listPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  PO_STATUS_LABELS,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type CreatePOLine,
} from "@/lib/erp/api-purchasing"
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

const statusVariant: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  sent: "outline",
  partial: "default",
  received: "default",
  cancelled: "destructive",
}

interface DraftLine {
  productId?: string
  description: string
  qty: string
  unitCost: string
  taxCode?: string
}

export default function ComprasPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [taxes, setTaxes] = React.useState<TaxView[]>([])
  const [rows, setRows] = React.useState<PurchaseOrder[]>([])
  const [sedeId, setSedeId] = React.useState(ALL)
  const [status, setStatus] = React.useState(ALL)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newOpen, setNewOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<PurchaseOrder | null>(null)

  React.useEffect(() => {
    if (!canView) return
    Promise.all([
      listSedes(),
      listSuppliers(),
      listProducts(),
      listTaxes().catch(() => []),
    ])
      .then(([sd, sup, prod, tax]) => {
        setSedes(sd.filter((s) => s.active))
        setSuppliers(sup.filter((s) => s.active))
        setProducts(prod.filter((p) => p.active))
        setTaxes(tax as TaxView[])
      })
      .catch((err) => setError(errorMessage(err)))
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPurchaseOrders({
        sedeId: sedeId === ALL ? undefined : sedeId,
        status: status === ALL ? undefined : (status as PurchaseOrderStatus),
      })
      setRows(data)
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
        <PageHeader section="Comercial" title="Compras" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>finance.view</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"
  const abiertas = rows.filter((r) => r.status === "sent" || r.status === "partial").length
  const porRecibir = rows
    .filter((r) => r.status !== "received" && r.status !== "cancelled")
    .reduce((s, r) => s + r.total, 0)

  return (
    <>
      <PageHeader
        section="Comercial"
        title="Compras"
        description="Órdenes de compra con recepción parcial o total; la mercancía entra al inventario y puede generar CxP."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManage && (
              <Button className="gap-1.5" onClick={() => setNewOpen(true)}>
                <Plus className="size-4" />
                Nueva orden
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Órdenes en curso" value={String(abiertas)} />
        <Kpi label="Pendiente por recibir" value={money.format(porRecibir)} accent />
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select className={`${inputClass} w-48`} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value={ALL}>Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <select className={`${inputClass} w-44`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value={ALL}>Todos</option>
              {Object.entries(PO_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="hidden sm:table-cell">Sede</TableHead>
                <TableHead className="hidden md:table-cell">Emitida</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                rows.map((po) => (
                  <TableRow key={po._id} className="cursor-pointer" onClick={() => setDetail(po)}>
                    <TableCell className="font-mono text-xs font-medium">{po.number}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {sedeName(po.sedeId)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {fmtDate(po.issueDate)}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">{money.format(po.total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant[po.status]}>{PO_STATUS_LABELS[po.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Truck className="mx-auto mb-2 size-8 opacity-40" />
                    No hay órdenes de compra.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <NewOrderSheet
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onSaved={load}
          sedes={sedes}
          suppliers={suppliers}
          products={products}
          taxes={taxes}
        />
      )}
      <OrderDetailSheet
        po={detail}
        onClose={() => setDetail(null)}
        onSaved={load}
        canManage={canManage}
        products={products}
      />
    </>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`stat-figure mt-1 text-2xl ${accent ? "text-warning" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function NewOrderSheet({
  open,
  onClose,
  onSaved,
  sedes,
  suppliers,
  products,
  taxes,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void>
  sedes: Sede[]
  suppliers: Supplier[]
  products: InvProduct[]
  taxes: TaxView[]
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [supplierId, setSupplierId] = React.useState("")
  const [issueDate, setIssueDate] = React.useState(todayLocal())
  const [expectedDate, setExpectedDate] = React.useState("")
  const [lines, setLines] = React.useState<DraftLine[]>([
    { description: "", qty: "1", unitCost: "0" },
  ])
  const [note, setNote] = React.useState("")
  const [send, setSend] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSedeId(sedes[0]?._id ?? "")
      setSupplierId("")
      setIssueDate(todayLocal())
      setExpectedDate("")
      setLines([{ description: "", qty: "1", unitCost: "0" }])
      setNote("")
      setSend(true)
      setErr(null)
    }
  }, [open, sedes])

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x._id === productId)
    setLine(i, {
      productId: productId || undefined,
      description: p ? p.name : lines[i]?.description ?? "",
      unitCost: p ? String(p.cost ?? 0) : lines[i]?.unitCost ?? "0",
    })
  }

  const subtotal = lines.reduce((s, l) => s + numOr(l.qty) * numOr(l.unitCost), 0)

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const supplier = suppliers.find((s) => s._id === supplierId)
      const payloadLines: CreatePOLine[] = lines
        .filter((l) => l.description.trim() && numOr(l.qty) > 0)
        .map((l) => ({
          productId: l.productId,
          description: l.description.trim(),
          qty: numOr(l.qty),
          unitCost: numOr(l.unitCost),
          taxCode: l.taxCode || undefined,
        }))
      if (payloadLines.length === 0) throw new Error("Agrega al menos un renglón válido")
      await createPurchaseOrder({
        sedeId,
        supplierId: supplierId || undefined,
        supplierName: supplier?.name ?? "Proveedor sin registrar",
        issueDate,
        expectedDate: expectedDate || undefined,
        lines: payloadLines,
        note: note.trim() || undefined,
        send,
      })
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
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva orden de compra</SheetTitle>
          <SheetDescription>Selecciona proveedor y renglones a pedir.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Sede</Label>
              <select className={inputClass} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                {sedes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Proveedor</Label>
              <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Sin registrar</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Emitida</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Entrega esperada</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-1">
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs">Renglones</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLines((ls) => [...ls, { description: "", qty: "1", unitCost: "0" }])}
              >
                <Plus className="size-3.5" /> Agregar
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <div key={i} className="rounded-lg border border-border p-2">
                  <div className="flex gap-2">
                    <select
                      className={`${inputClass} flex-1`}
                      value={l.productId ?? ""}
                      onChange={(e) => pickProduct(i, e.target.value)}
                    >
                      <option value="">— Ítem libre —</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                    {lines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  {!l.productId && (
                    <Input
                      className="mt-2"
                      placeholder="Descripción del ítem"
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
                      <Input type="number" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Costo unit.</Label>
                      <Input
                        type="number"
                        value={l.unitCost}
                        onChange={(e) => setLine(i, { unitCost: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Impuesto</Label>
                      <select
                        className={inputClass}
                        value={l.taxCode ?? ""}
                        onChange={(e) => setLine(i, { taxCode: e.target.value || undefined })}
                      >
                        <option value="">Ninguno</option>
                        {taxes.map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
            Enviar al proveedor al crear (si no, queda en borrador)
          </label>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="tnum text-lg font-semibold">{money.format(subtotal)}</span>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pb-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || !sedeId}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Crear orden
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OrderDetailSheet({
  po,
  onClose,
  onSaved,
  canManage,
  products,
}: {
  po: PurchaseOrder | null
  onClose: () => void
  onSaved: () => Promise<void>
  canManage: boolean
  products: InvProduct[]
}) {
  const [receiveQty, setReceiveQty] = React.useState<Record<number, string>>({})
  const [expiry, setExpiry] = React.useState<Record<number, string>>({})
  const [generatePayable, setGeneratePayable] = React.useState(true)
  const [dueDate, setDueDate] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (po) {
      const q: Record<number, string> = {}
      po.lines.forEach((l, i) => {
        q[i] = String(l.qty - l.qtyReceived)
      })
      setReceiveQty(q)
      setExpiry({})
      setGeneratePayable(true)
      setDueDate("")
      setErr(null)
    }
  }, [po])

  if (!po) return null

  const isPerishable = (productId?: string) =>
    !!productId && !!products.find((p) => p._id === productId)?.perishable
  const canReceive = po.status === "sent" || po.status === "partial" || po.status === "draft"

  async function act(fn: () => Promise<PurchaseOrder>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function doReceive() {
    if (!po) return
    const receiptLines = po.lines
      .map((l, i) => ({
        lineIndex: i,
        qty: numOr(receiveQty[i] ?? "0"),
        expiresAt: expiry[i] || undefined,
      }))
      .filter((r) => r.qty > 0)
    if (receiptLines.length === 0) {
      setErr("Indica al menos una cantidad a recibir")
      return
    }
    await act(() =>
      receivePurchaseOrder(po._id, {
        date: todayLocal(),
        lines: receiptLines,
        generatePayable,
        dueDate: dueDate || undefined,
      }),
    )
  }

  return (
    <Sheet open={!!po} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{po.number}</SheetTitle>
          <SheetDescription>
            {po.supplierName} · {PO_STATUS_LABELS[po.status]}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  {canReceive && canManage && <TableHead className="text-right">Recibir</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((l, i) => {
                  const pending = l.qty - l.qtyReceived
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="text-sm">{l.description}</p>
                        <p className="tnum text-[11px] text-muted-foreground">
                          {money.format(l.unitCost)} c/u
                        </p>
                      </TableCell>
                      <TableCell className="tnum text-right">{l.qty}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{l.qtyReceived}</TableCell>
                      {canReceive && canManage && (
                        <TableCell className="text-right">
                          {pending > 0 ? (
                            <div className="flex flex-col items-end gap-1">
                              <Input
                                type="number"
                                className="h-8 w-20 text-right"
                                value={receiveQty[i] ?? ""}
                                max={pending}
                                onChange={(e) =>
                                  setReceiveQty((q) => ({ ...q, [i]: e.target.value }))
                                }
                              />
                              {isPerishable(l.productId) && (
                                <Input
                                  type="date"
                                  className="h-8 w-32"
                                  title="Vencimiento (perecedero)"
                                  value={expiry[i] ?? ""}
                                  onChange={(e) => setExpiry((x) => ({ ...x, [i]: e.target.value }))}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-success">Completo</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="tnum font-semibold">{money.format(po.total)}</span>
          </div>

          {canReceive && canManage && (
            <div className="rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={generatePayable}
                  onChange={(e) => setGeneratePayable(e.target.checked)}
                />
                Generar cuenta por pagar (CxP)
              </label>
              {generatePayable && (
                <div className="mt-2 flex flex-col gap-1">
                  <Label className="text-xs">Vence (por defecto +30 días)</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}

          {canManage && (
            <div className="flex flex-wrap justify-end gap-2 pb-4">
              {po.status === "draft" && (
                <Button variant="outline" disabled={busy} onClick={() => void act(() => sendPurchaseOrder(po._id))}>
                  <Send className="size-4" /> Enviar
                </Button>
              )}
              {(po.status === "draft" || po.status === "sent") && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => void act(() => cancelPurchaseOrder(po._id))}
                >
                  <Ban className="size-4" /> Anular
                </Button>
              )}
              {canReceive && (
                <Button disabled={busy} onClick={() => void doReceive()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                  Recibir
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
