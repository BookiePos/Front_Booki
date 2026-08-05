"use client"

import * as React from "react"
import {
  Receipt,
  Plus,
  Loader2,
  RefreshCw,
  HandCoins,
  AlertTriangle,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listPayables,
  createPayable,
  addPayablePayment,
  PAYABLE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinancePayable,
  type PayableStatus,
  type PayablePayload,
  type PayablePaymentPayload,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
import {
  money,
  todayLocal,
  fmtDate,
  errorMessage,
  numOr,
} from "@/lib/erp/finance-format"

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
  TableFooter,
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
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const STATUS_FILTERS: { v: string; l: string }[] = [
  { v: ALL, l: "Todas" },
  { v: "open", l: "Abiertas" },
  { v: "partial", l: "Con abono" },
  { v: "paid", l: "Pagadas" },
  { v: "void", l: "Anuladas" },
]

function isOverdue(p: FinancePayable): boolean {
  if (p.status === "paid" || p.status === "void") return false
  return p.dueDate.slice(0, 10) < todayLocal()
}

/**
 * Panel de Cuentas por pagar reutilizable. Vive tanto en /finanzas/cxp como
 * embebido en la pestaña "Por pagar" de /finanzas/gastos. Gestiona su propio
 * estado (sedes, filtros, sheets). `showKpis` oculta sus KPIs cuando el contenedor
 * ya muestra un resumen combinado.
 */
export function PayablesPanel({ showKpis = true }: { showKpis?: boolean }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("purchasing.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [status, setStatus] = React.useState<string>(ALL)
  const [rows, setRows] = React.useState<FinancePayable[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newOpen, setNewOpen] = React.useState(false)
  const [payFor, setPayFor] = React.useState<FinancePayable | null>(null)

  React.useEffect(() => {
    let active = true
    listSedes()
      .then((sd) => active && setSedes(sd.filter((s) => s.active)))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPayables({
        sedeId: sedeId === ALL ? undefined : sedeId,
        status: status === ALL ? undefined : (status as PayableStatus),
      })
      setRows(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, status])

  React.useEffect(() => {
    void load()
  }, [load])

  const openRows = rows.filter((r) => r.status === "open" || r.status === "partial")
  const totalAbierto = openRows.reduce((s, r) => s + (r.amount - r.paidAmount), 0)
  const totalVencido = rows
    .filter(isOverdue)
    .reduce((s, r) => s + (r.amount - r.paidAmount), 0)

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        {canManage && (
          <Button className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Nueva CxP
          </Button>
        )}
      </div>

      {showKpis && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Total abierto" value={money.format(totalAbierto)} />
          <Kpi label="Vencido" value={money.format(totalVencido)} danger />
        </div>
      )}

      <Card>
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
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <select
              className={`${inputClass} w-44`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Receipt className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay cuentas por pagar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Abonado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  {canManage && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const overdue = isOverdue(r)
                  const saldo = r.amount - r.paidAmount
                  return (
                    <TableRow key={r._id}>
                      <TableCell className="font-medium">{r.supplierName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.docNumber ?? "—"}
                      </TableCell>
                      <TableCell>{sedeName(r.sedeId)}</TableCell>
                      <TableCell
                        className={`tabular-nums ${
                          overdue ? "font-medium text-destructive" : ""
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {overdue && <AlertTriangle className="size-3.5" />}
                          {fmtDate(r.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <PayableStatusBadge status={r.status} overdue={overdue} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(r.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {money.format(r.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money.format(saldo)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {(r.status === "open" || r.status === "partial") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => setPayFor(r)}
                            >
                              <HandCoins className="size-3.5" />
                              Abono
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">
                    Total ({rows.length})
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(rows.reduce((s, r) => s + r.amount, 0))}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(rows.reduce((s, r) => s + r.paidAmount, 0))}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(
                      rows.reduce((s, r) => s + (r.amount - r.paidAmount), 0),
                    )}
                  </TableCell>
                  {canManage && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          <NewPayableSheet
            open={newOpen}
            onOpenChange={setNewOpen}
            sedes={sedes}
            onSaved={() => {
              setNewOpen(false)
              void load()
            }}
          />
          <PaymentSheet
            payable={payFor}
            onOpenChange={(v) => !v && setPayFor(null)}
            onSaved={() => {
              setPayFor(null)
              void load()
            }}
          />
        </>
      )}
    </div>
  )
}

function NewPayableSheet({
  open,
  onOpenChange,
  sedes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedes: Sede[]
  onSaved: () => void
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [supplierName, setSupplierName] = React.useState("")
  const [docNumber, setDocNumber] = React.useState("")
  const [issueDate, setIssueDate] = React.useState(todayLocal())
  const [dueDate, setDueDate] = React.useState(todayLocal())
  const [amount, setAmount] = React.useState("")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setSedeId(sedes[0]?._id ?? "")
    setSupplierName("")
    setDocNumber("")
    setIssueDate(todayLocal())
    setDueDate(todayLocal())
    setAmount("")
    setNote("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: PayablePayload = {
      sedeId,
      supplierName,
      docNumber: docNumber || undefined,
      issueDate,
      dueDate,
      amount: numOr(amount),
      note: note || undefined,
    }
    try {
      await createPayable(payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = sedeId && supplierName.trim() && numOr(amount) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">Nueva cuenta por pagar</SheetTitle>
            <SheetDescription>Factura de un proveedor pendiente de pago.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className={inputClass}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Proveedor</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">N.º de documento (opcional)</Label>
            <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Emisión</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Vencimiento</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Monto</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PaymentSheet({
  payable,
  onOpenChange,
  onSaved,
}: {
  payable: FinancePayable | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const saldo = payable ? payable.amount - payable.paidAmount : 0
  const [date, setDate] = React.useState(todayLocal())
  const [amount, setAmount] = React.useState("")
  const [method, setMethod] = React.useState<PaymentMethod>("transfer")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!payable) return
    setError(null)
    setDate(todayLocal())
    setAmount(String(payable.amount - payable.paidAmount))
    setMethod("transfer")
    setNote("")
  }, [payable])

  async function save() {
    if (!payable) return
    setBusy(true)
    setError(null)
    const payload: PayablePaymentPayload = {
      date,
      amount: numOr(amount),
      method,
      note: note || undefined,
    }
    try {
      await addPayablePayment(payable._id, payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const val = numOr(amount)
  const valid = val > 0 && val <= saldo

  return (
    <Sheet open={payable !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {payable && (
          <div className="flex flex-col gap-4 px-4 py-2">
            <SheetHeader className="px-0">
              <SheetTitle className="font-display text-lg">Registrar abono</SheetTitle>
              <SheetDescription>{payable.supplierName}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="tabular-nums">{money.format(payable.amount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Abonado</span>
                <span className="tabular-nums">{money.format(payable.paidAmount)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Saldo</span>
                <span className="font-medium tabular-nums text-primary">
                  {money.format(saldo)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Método</Label>
                <select
                  className={inputClass}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                    <option key={k} value={k}>
                      {PAYMENT_METHOD_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Monto del abono</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {val > saldo && (
                <span className="text-xs text-destructive">
                  El abono no puede superar el saldo.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Nota (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {payable.payments.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Abonos anteriores
                </span>
                {payable.payments.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {fmtDate(p.date)}
                      {p.method ? ` · ${PAYMENT_METHOD_LABELS[p.method]}` : ""}
                    </span>
                    <span className="tabular-nums">{money.format(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                className="gap-2"
                disabled={busy || !valid}
                onClick={() => void save()}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Registrar abono
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PayableStatusBadge({
  status,
  overdue,
}: {
  status: PayableStatus
  overdue: boolean
}) {
  if (overdue) {
    return (
      <Badge variant="destructive" className="gap-1">
        Vencida
      </Badge>
    )
  }
  if (status === "paid") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        Pagada
      </Badge>
    )
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="text-amber-600">
        Abono parcial
      </Badge>
    )
  }
  if (status === "void") {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Anulada
      </Badge>
    )
  }
  return <Badge variant="secondary">{PAYABLE_STATUS_LABELS[status]}</Badge>
}

function Kpi({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`font-display text-2xl leading-tight ${
            danger ? "text-destructive" : "text-foreground"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}
