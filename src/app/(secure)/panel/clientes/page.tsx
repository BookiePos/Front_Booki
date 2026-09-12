"use client"

import * as React from "react"
import {
  ShieldOff,
  Users,
  Plus,
  Loader2,
  RefreshCw,
  HandCoins,
  AlertTriangle,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listReceivables,
  createReceivable,
  addReceivablePayment,
  RECEIVABLE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceReceivable,
  type ReceivableStatus,
  type ReceivablePayload,
  type ReceivablePaymentPayload,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
import {
  listCustomers,
  createCustomer,
  type Customer,
} from "@/lib/erp/api-customers"
import {
  money,
  todayLocal,
  fmtDate,
  errorMessage,
  numOr,
} from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
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
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { Termino } from "@/components/ui/help-tip"
import { cn } from "@/lib/utils"

const ALL = "all"

const STATUS_FILTERS: { v: string; l: string }[] = [
  { v: ALL, l: "Todas" },
  { v: "open", l: "Abiertas" },
  { v: "partial", l: "Con abono" },
  { v: "paid", l: "Cobradas" },
  { v: "void", l: "Anuladas" },
]

/** Saldo pendiente de una cuenta (total − abonado). */
function saldoOf(r: FinanceReceivable): number {
  return r.amount - r.paidAmount
}

/** Solo las cuentas vivas (abiertas o con abono) cuentan para saldos/aging. */
function isLive(r: FinanceReceivable): boolean {
  return r.status === "open" || r.status === "partial"
}

/** Días vencidos respecto a hoy (≤0 = aún no vence). */
function daysOverdue(dueDate: string): number {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`).getTime()
  const today = new Date(`${todayLocal()}T00:00:00`).getTime()
  return Math.floor((today - due) / 86_400_000)
}

function isOverdue(r: FinanceReceivable): boolean {
  return isLive(r) && daysOverdue(r.dueDate) > 0
}

/** Bucket de antigüedad (aging) del saldo. */
type Bucket = "corriente" | "d1_30" | "d31_60" | "d61_90" | "d90"
const BUCKET_LABELS: Record<Bucket, string> = {
  corriente: "Por vencer",
  d1_30: "1–30 días",
  d31_60: "31–60 días",
  d61_90: "61–90 días",
  d90: "+90 días",
}
function bucketOf(r: FinanceReceivable): Bucket {
  const d = daysOverdue(r.dueDate)
  if (d <= 0) return "corriente"
  if (d <= 30) return "d1_30"
  if (d <= 60) return "d31_60"
  if (d <= 90) return "d61_90"
  return "d90"
}

export default function ClientesPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [status, setStatus] = React.useState<string>(ALL)
  const [rows, setRows] = React.useState<FinanceReceivable[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newOpen, setNewOpen] = React.useState(false)
  const [payFor, setPayFor] = React.useState<FinanceReceivable | null>(null)

  React.useEffect(() => {
    if (!canView) return
    let active = true
    listSedes()
      .then((sd) => active && setSedes(sd.filter((s) => s.active)))
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReceivables({
        sedeId: sedeId === ALL ? undefined : sedeId,
        status: status === ALL ? undefined : (status as ReceivableStatus),
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
        <PageHeader section="Comercial" title="Cuentas por cobrar" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver las cuentas por cobrar.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const liveRows = rows.filter(isLive)
  const totalPorCobrar = liveRows.reduce((s, r) => s + saldoOf(r), 0)
  const totalVencido = rows
    .filter(isOverdue)
    .reduce((s, r) => s + saldoOf(r), 0)
  const clientesConSaldo = new Set(
    liveRows.map((r) => (r.customerDoc?.trim() || r.customerName).toLowerCase()),
  ).size

  // Antigüedad de saldos (aging) por bucket, sobre el saldo pendiente.
  const aging: Record<Bucket, number> = {
    corriente: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90: 0,
  }
  for (const r of liveRows) aging[bucketOf(r)] += saldoOf(r)

  const sedeName = (id: string) => sedes.find((s) => s._id === id)?.name ?? "—"

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      {canManage && (
        <Button className="gap-1.5" onClick={() => setNewOpen(true)} data-tour="cxc-nuevo">
          <Plus className="size-4" />
          Nuevo fiado
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        section="Comercial"
        title="Cuentas por cobrar"
        titleHelp={{ term: "cxc" }}
        description={
          <>
            Lo que te deben los clientes a los que les fiaste, con sus{" "}
            <Termino>abonos</Termino>, sus vencimientos y qué tan vieja está
            cada deuda.
          </>
        }
        actions={actions}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3" data-tour="cxc-kpis">
        <Kpi label="Total por cobrar" value={money.format(totalPorCobrar)} />
        <Kpi label="Vencido" value={money.format(totalVencido)} danger />
        <Kpi label="Clientes con saldo" value={String(clientesConSaldo)} />
      </div>

      {/* Antigüedad de saldos (aging) */}
      <Card className="mb-4" data-tour="cxc-aging">
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Antigüedad de saldos
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => {
              const overdue = b !== "corriente"
              return (
                <div
                  key={b}
                  className="flex flex-col gap-0.5 rounded-lg border border-border p-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {BUCKET_LABELS[b]}
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      overdue && aging[b] > 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {money.format(aging[b])}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Field id="cxc-sede" label="Sede" className="w-48">
            <NativeSelect
              id="cxc-sede"
              value={sedeId}
              onChange={setSedeId}
              options={[
                { value: ALL, label: "Todas las sedes" },
                ...sedes.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
          </Field>
          <Field id="cxc-estado" label="Estado" className="w-44">
            <NativeSelect
              id="cxc-estado"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS.map((s) => ({
                value: s.v,
                label: s.l,
              }))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card data-tour="cxc-tabla">
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
              <Users className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay cuentas por cobrar. El fiado del POS aparece aquí
                automáticamente.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>
                    <Termino>Sede</Termino>
                  </TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">
                    <Termino>Abonado</Termino>
                  </TableHead>
                  <TableHead className="text-right">
                    <Termino>Saldo</Termino>
                  </TableHead>
                  {canManage && <TableHead className="text-right"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const overdue = isOverdue(r)
                  const saldo = saldoOf(r)
                  return (
                    <TableRow key={r._id}>
                      <TableCell className="font-medium">
                        {r.customerName}
                        {r.customerPhone ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {r.customerPhone}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.customerDoc ?? r.docNumber ?? "—"}
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
                        <ReceivableStatusBadge status={r.status} overdue={overdue} />
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
                          {isLive(r) && (
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
                    {money.format(rows.reduce((s, r) => s + saldoOf(r), 0))}
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
          <NewReceivableDialog
            open={newOpen}
            onOpenChange={setNewOpen}
            sedes={sedes}
            onSaved={() => {
              setNewOpen(false)
              void load()
            }}
          />
          <PaymentDialog
            receivable={payFor}
            onOpenChange={(v) => !v && setPayFor(null)}
            onSaved={() => {
              setPayFor(null)
              void load()
            }}
          />
        </>
      )}
    </>
  )
}

function NewReceivableDialog({
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
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [customerId, setCustomerId] = React.useState("")
  const [docNumber, setDocNumber] = React.useState("")
  const [issueDate, setIssueDate] = React.useState(todayLocal())
  const [dueDate, setDueDate] = React.useState(todayLocal())
  const [amount, setAmount] = React.useState("")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Alta rápida de cliente inline.
  const [showNewCustomer, setShowNewCustomer] = React.useState(false)
  const [ncName, setNcName] = React.useState("")
  const [ncDoc, setNcDoc] = React.useState("")
  const [ncPhone, setNcPhone] = React.useState("")
  const [ncBusy, setNcBusy] = React.useState(false)

  const loadCustomers = React.useCallback(async () => {
    try {
      setCustomers(await listCustomers())
    } catch {
      setCustomers([])
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setSedeId(sedes[0]?._id ?? "")
    setCustomerId("")
    setDocNumber("")
    setIssueDate(todayLocal())
    setDueDate(todayLocal())
    setAmount("")
    setNote("")
    setShowNewCustomer(false)
    void loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function quickAddCustomer() {
    if (!ncName.trim() || !ncDoc.trim()) return
    setNcBusy(true)
    setError(null)
    try {
      const created = await createCustomer({
        name: ncName.trim(),
        docNumber: ncDoc.trim(),
        phone: ncPhone.trim() || undefined,
      })
      await loadCustomers()
      setCustomerId(created._id)
      setShowNewCustomer(false)
      setNcName("")
      setNcDoc("")
      setNcPhone("")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setNcBusy(false)
    }
  }

  async function save() {
    setBusy(true)
    setError(null)
    const payload: ReceivablePayload = {
      sedeId,
      customerId,
      docNumber: docNumber || undefined,
      issueDate,
      dueDate,
      amount: numOr(amount),
      note: note || undefined,
    }
    try {
      await createReceivable(payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = sedeId && customerId && numOr(amount) > 0

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={Plus}
      title="Nuevo fiado"
      description="Lo que le queda debiendo un cliente. Tiene que ir a nombre de alguien registrado, para poder cobrárselo después."
      footer={
        <FormActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void save()}
          busy={busy}
          disabled={!valid}
          submitLabel="Registrar"
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <FormSection title="A quién y dónde">
        <FieldGrid cols={2}>
          <Field id="fi-sede" label="Sede" required help={{ term: "sede" }}>
            <NativeSelect
              id="fi-sede"
              value={sedeId}
              onChange={setSedeId}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
              placeholder="Selecciona…"
            />
          </Field>

          <Field
            id="fi-customer"
            label="Cliente registrado"
            required
            help={{ term: "cxc" }}
          >
            <NativeSelect
              id="fi-customer"
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((c) => ({
                value: c._id,
                label: `${c.name} · ${c.docType} ${c.docNumber}`,
              }))}
              placeholder="Selecciona un cliente…"
              disabled={showNewCustomer}
            />
          </Field>
        </FieldGrid>

        {/* Alta rápida: fiarle a alguien que todavía no está en el directorio
            es el caso normal en el mostrador; obligar a salir de la ficha para
            registrarlo hacía perder lo ya escrito. */}
        {!showNewCustomer ? (
          <button
            type="button"
            className="self-start text-xs font-semibold text-primary hover:underline"
            onClick={() => setShowNewCustomer(true)}
          >
            + El cliente no está en la lista
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.04] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.8125rem] font-bold text-foreground">
                Registrar un cliente nuevo
              </p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowNewCustomer(false)}
              >
                Cancelar
              </Button>
            </div>
            <FieldGrid cols={3}>
              <FieldSpan span={3}>
                <Field id="nc-name" label="Nombre" required>
                  <Input
                    id="nc-name"
                    placeholder="Nombre del cliente"
                    value={ncName}
                    onChange={(e) => setNcName(e.target.value)}
                  />
                </Field>
              </FieldSpan>
              <FieldSpan span={2}>
                <Field id="nc-doc" label="Cédula o NIT" required>
                  <Input
                    id="nc-doc"
                    inputMode="numeric"
                    placeholder="1020304050"
                    value={ncDoc}
                    onChange={(e) => setNcDoc(e.target.value)}
                  />
                </Field>
              </FieldSpan>
              <Field id="nc-phone" label="Teléfono">
                <Input
                  id="nc-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="Opcional"
                  value={ncPhone}
                  onChange={(e) => setNcPhone(e.target.value)}
                />
              </Field>
            </FieldGrid>
            <Button
              type="button"
              size="sm"
              className="self-start"
              disabled={ncBusy || !ncName.trim() || !ncDoc.trim()}
              onClick={() => void quickAddCustomer()}
            >
              {ncBusy && <Loader2 className="animate-spin" />}
              Registrar y seleccionar
            </Button>
          </div>
        )}
      </FormSection>

      <FormSection title="La deuda">
        <FieldGrid cols={3}>
          <Field id="fi-amount" label="Monto" required>
            <MoneyInput
              id="fi-amount"
              value={numOr(amount) || null}
              onValueChange={(v) => setAmount(v == null ? "" : String(v))}
              placeholder="0"
            />
          </Field>
          <Field id="fi-issue" label="Fecha">
            <Input
              id="fi-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
          <Field
            id="fi-due"
            label="Vencimiento"
            help={{ term: "cartera" }}
            hint="Desde esta fecha la deuda cuenta como vencida."
          >
            <Input
              id="fi-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>

          <FieldSpan span={2}>
            <Field id="fi-doc" label="Referencia / documento">
              <Input
                id="fi-doc"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </FieldSpan>
          <FieldSpan span={3}>
            <Field id="fi-note" label="Nota">
              <Input
                id="fi-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>
    </FormDialog>
  )
}

function PaymentDialog({
  receivable,
  onOpenChange,
  onSaved,
}: {
  receivable: FinanceReceivable | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const saldo = receivable ? receivable.amount - receivable.paidAmount : 0
  const [date, setDate] = React.useState(todayLocal())
  const [amount, setAmount] = React.useState("")
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!receivable) return
    setError(null)
    setDate(todayLocal())
    setAmount(String(receivable.amount - receivable.paidAmount))
    setMethod("cash")
    setNote("")
  }, [receivable])

  async function save() {
    if (!receivable) return
    setBusy(true)
    setError(null)
    const payload: ReceivablePaymentPayload = {
      date,
      amount: numOr(amount),
      method,
      note: note || undefined,
    }
    try {
      await addReceivablePayment(receivable._id, payload)
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
    <FormDialog
      open={receivable !== null}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={HandCoins}
      title="Registrar abono"
      description={
        receivable
          ? `${receivable.customerName} · saldo de ${money.format(saldo)}`
          : undefined
      }
      footer={
        <FormActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void save()}
          busy={busy}
          disabled={!valid}
          icon={HandCoins}
          submitLabel="Registrar abono"
        />
      }
    >
      {receivable && (
        <>
          {error && <FormAlert>{error}</FormAlert>}

          {/* Las tres cifras que importan antes de escribir nada: cuánto era,
              cuánto lleva pagado y cuánto falta. */}
          <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-muted/35">
            {[
              { label: "Total", value: receivable.amount, tone: "" },
              { label: "Abonado", value: receivable.paidAmount, tone: "" },
              { label: "Saldo", value: saldo, tone: "text-primary" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-0.5 px-3.5 py-3">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <span className={cn("stat-figure text-base", c.tone)}>
                  {money.format(c.value)}
                </span>
              </div>
            ))}
          </div>

          <FormSection title="El abono">
            <FieldGrid cols={3}>
              <Field id="ab-date" label="Fecha">
                <Input
                  id="ab-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field
                id="ab-method"
                label="Medio de pago"
                help={{ term: "nequi" }}
              >
                <NativeSelect
                  id="ab-method"
                  value={method}
                  onChange={(v) => setMethod(v as PaymentMethod)}
                  options={(
                    Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]
                  ).map((k) => ({ value: k, label: PAYMENT_METHOD_LABELS[k] }))}
                />
              </Field>
              <Field
                id="ab-amount"
                label="Monto del abono"
                help={{ term: "abono" }}
                error={val > saldo ? "El abono no puede superar el saldo." : null}
              >
                <MoneyInput
                  id="ab-amount"
                  value={val || null}
                  onValueChange={(v) => setAmount(v == null ? "" : String(v))}
                  placeholder="0"
                />
              </Field>

              <FieldSpan span={3}>
                <Field id="ab-note" label="Nota">
                  <Input
                    id="ab-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </FieldSpan>
            </FieldGrid>
          </FormSection>

          {receivable.payments.length > 0 && (
            <FormSection
              title="Abonos anteriores"
              description={`${receivable.payments.length} pago${receivable.payments.length === 1 ? "" : "s"} registrado${receivable.payments.length === 1 ? "" : "s"}.`}
              boxed
            >
              <ul className="flex flex-col gap-1.5">
                {receivable.payments.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                  >
                    <span>
                      {fmtDate(p.date)}
                      {p.method ? ` · ${PAYMENT_METHOD_LABELS[p.method]}` : ""}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {money.format(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </FormSection>
          )}
        </>
      )}
    </FormDialog>
  )
}

function ReceivableStatusBadge({
  status,
  overdue,
}: {
  status: ReceivableStatus
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
      <Badge className="gap-1 border-success/30 bg-success/10 text-success-ink">
        Cobrada
      </Badge>
    )
  }
  if (status === "partial") {
    return (
      <Badge variant="outline" className="text-warning-ink">
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
  return <Badge variant="secondary">{RECEIVABLE_STATUS_LABELS[status]}</Badge>
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
