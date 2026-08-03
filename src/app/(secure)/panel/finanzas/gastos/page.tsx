"use client"

import * as React from "react"
import {
  ShieldOff,
  FileMinus,
  Plus,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  Repeat,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listExpenses,
  listCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceExpense,
  type FinanceCategory,
  type ExpenseStatus,
  type ExpensePayload,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
import {
  money,
  todayLocal,
  monthStart,
  fmtDate,
  errorMessage,
  numOr,
} from "@/lib/erp/finance-format"

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
  { v: ALL, l: "Todos" },
  { v: "paid", l: "Pagados" },
  { v: "payable", l: "Por pagar" },
]

export default function GastosPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [status, setStatus] = React.useState<string>(ALL)
  const [rows, setRows] = React.useState<FinanceExpense[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FinanceExpense | null>(null)

  React.useEffect(() => {
    if (!canView) return
    let active = true
    Promise.all([listSedes(), listCategories()])
      .then(([sd, cats]) => {
        if (!active) return
        setSedes(sd.filter((s) => s.active))
        setCategories(cats)
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listExpenses({
        sedeId: sedeId === ALL ? undefined : sedeId,
        from,
        to,
        status: status === ALL ? undefined : (status as ExpenseStatus),
      })
      setRows(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, from, to, status])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Gastos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los gastos.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const totalMes = rows.reduce((s, r) => s + r.amount + r.taxAmount, 0)
  const porPagar = rows
    .filter((r) => r.status === "payable")
    .reduce((s, r) => s + r.amount + r.taxAmount, 0)

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }
  function openEdit(e: FinanceExpense) {
    setEditing(e)
    setSheetOpen(true)
  }

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      {canManage && (
        <Button className="gap-1.5" onClick={openNew}>
          <Plus className="size-4" />
          Nuevo gasto
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Gastos"
        description="Registro de gastos operativos por sede, con IVA y estado de pago."
        actions={actions}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Gasto del período" value={money.format(totalMes)} />
        <Kpi label="Por pagar" value={money.format(porPagar)} accent />
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
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Estado</Label>
            <select
              className={`${inputClass} w-40`}
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
              <FileMinus className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay gastos en este rango.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {canManage && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {r.concept}
                        {r.recurring && (
                          <Repeat
                            className="size-3.5 text-muted-foreground"
                          />
                        )}
                      </span>
                      {r.supplierName && (
                        <span className="block text-xs text-muted-foreground">
                          {r.supplierName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.categoryName}</TableCell>
                    <TableCell>{sedeName(r.sedeId)}</TableCell>
                    <TableCell>
                      <ExpenseStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(r.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.taxAmount ? money.format(r.taxAmount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(r.amount + r.taxAmount)}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(r)}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <DeleteButton id={r._id} onDeleted={() => void load()} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
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
                    {money.format(rows.reduce((s, r) => s + r.taxAmount, 0))}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {money.format(totalMes)}
                  </TableCell>
                  {canManage && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <ExpenseSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editing={editing}
          sedes={sedes}
          categories={categories}
          onSaved={() => {
            setSheetOpen(false)
            void load()
          }}
        />
      )}
    </>
  )
}

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [busy, setBusy] = React.useState(false)
  async function remove() {
    if (!window.confirm("¿Eliminar este gasto?")) return
    setBusy(true)
    try {
      await deleteExpense(id)
      onDeleted()
    } catch {
      /* no-op */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      onClick={() => void remove()}
      title="Eliminar"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  )
}

function ExpenseSheet({
  open,
  onOpenChange,
  editing,
  sedes,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: FinanceExpense | null
  sedes: Sede[]
  categories: FinanceCategory[]
  onSaved: () => void
}) {
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.active)

  const [sedeId, setSedeId] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [taxAmount, setTaxAmount] = React.useState("")
  const [date, setDate] = React.useState(todayLocal())
  const [status, setStatus] = React.useState<ExpenseStatus>("paid")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")
  const [supplierName, setSupplierName] = React.useState("")
  const [recurring, setRecurring] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setSedeId(editing.sedeId)
      setCategoryId(editing.categoryId)
      setConcept(editing.concept)
      setAmount(String(editing.amount))
      setTaxAmount(editing.taxAmount ? String(editing.taxAmount) : "")
      setDate(editing.date.slice(0, 10))
      setStatus(editing.status)
      setPaymentMethod(editing.paymentMethod ?? "cash")
      setSupplierName(editing.supplierName ?? "")
      setRecurring(editing.recurring)
      setNote(editing.note ?? "")
    } else {
      setSedeId(sedes[0]?._id ?? "")
      setCategoryId(expenseCats[0]?._id ?? "")
      setConcept("")
      setAmount("")
      setTaxAmount("")
      setDate(todayLocal())
      setStatus("paid")
      setPaymentMethod("cash")
      setSupplierName("")
      setRecurring(false)
      setNote("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: ExpensePayload = {
      sedeId,
      categoryId,
      concept,
      amount: numOr(amount),
      taxAmount: numOr(taxAmount),
      date,
      status,
      paymentMethod: status === "paid" ? paymentMethod : undefined,
      supplierName: supplierName || undefined,
      recurring,
      note: note || undefined,
    }
    try {
      if (editing) await updateExpense(editing._id, payload)
      else await createExpense(payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = sedeId && categoryId && concept.trim() && numOr(amount) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">
              {editing ? "Editar gasto" : "Nuevo gasto"}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? "Actualiza los datos del gasto."
                : "Registra un gasto operativo."}
            </SheetDescription>
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
            <Label className="text-xs">Categoría</Label>
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {expenseCats.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Arriendo local"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Monto (sin IVA)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">IVA</Label>
              <Input
                type="number"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
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
              <Label className="text-xs">Estado</Label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
              >
                {(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPENSE_STATUS_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === "paid" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Método de pago</Label>
              <select
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Proveedor (opcional)</Label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Gasto recurrente
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar" : "Registrar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  if (status === "paid") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
        Pagado
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-amber-600">
      Por pagar
    </Badge>
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
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`font-display text-2xl leading-tight ${
            accent ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}
