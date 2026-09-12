"use client"

import * as React from "react"
import {
  Receipt,
  Plus,
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

const ALL = "all"

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
          <Field id="cxpf-sede" label="Sede" className="w-48">
            <NativeSelect
              id="cxpf-sede"
              value={sedeId}
              onChange={setSedeId}
              options={[
                { value: ALL, label: "Todas las sedes" },
                ...sedes.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
          </Field>
          <Field id="cxpf-estado" label="Estado" className="w-44">
            <NativeSelect
              id="cxpf-estado"
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
          <NewPayableDialog
            open={newOpen}
            onOpenChange={setNewOpen}
            sedes={sedes}
            onSaved={() => {
              setNewOpen(false)
              void load()
            }}
          />
          <PaymentDialog
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

function NewPayableDialog({
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={Receipt}
      title="Nueva cuenta por pagar"
      description="Una factura de proveedor que todavía no has pagado."
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

      <FormSection title="A quién le debes">
        <FieldGrid cols={2}>
          <Field id="cxp-sede" label="Sede" required help={{ term: "sede" }}>
            <NativeSelect
              id="cxp-sede"
              value={sedeId}
              onChange={setSedeId}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
              placeholder="Selecciona…"
            />
          </Field>
          <Field id="cxp-supplier" label="Proveedor" required>
            <Input
              id="cxp-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Distribuidora ABC"
            />
          </Field>
          <FieldSpan span={2}>
            <Field id="cxp-doc" label="N.º de documento">
              <Input
                id="cxp-doc"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Opcional — el de su factura"
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      <FormSection title="Cuánto y para cuándo">
        <FieldGrid cols={3}>
          <Field id="cxp-amount" label="Monto" required>
            <MoneyInput
              id="cxp-amount"
              value={numOr(amount) || null}
              onValueChange={(v) => setAmount(v == null ? "" : String(v))}
              placeholder="0"
            />
          </Field>
          <Field id="cxp-issue" label="Emisión">
            <Input
              id="cxp-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
          <Field
            id="cxp-due"
            label="Vencimiento"
            help={{ term: "plazoPago" }}
            hint="La fecha límite que te dio el proveedor."
          >
            <Input
              id="cxp-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
          <FieldSpan span={3}>
            <Field id="cxp-note" label="Nota">
              <Input
                id="cxp-note"
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
    <FormDialog
      open={payable !== null}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={HandCoins}
      title="Registrar abono"
      description={
        payable
          ? `${payable.supplierName} · saldo de ${money.format(saldo)}`
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
      {payable && (
        <>
          {error && <FormAlert>{error}</FormAlert>}

          <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-muted/35">
            {[
              { label: "Total", value: payable.amount, tone: "" },
              { label: "Abonado", value: payable.paidAmount, tone: "" },
              { label: "Saldo", value: saldo, tone: "text-primary" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-0.5 px-3.5 py-3">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <span className={`stat-figure text-base ${c.tone}`}>
                  {money.format(c.value)}
                </span>
              </div>
            ))}
          </div>

          <FormSection title="El abono">
            <FieldGrid cols={3}>
              <Field id="cxpa-date" label="Fecha">
                <Input
                  id="cxpa-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field
                id="cxpa-method"
                label="Medio de pago"
                help={{ term: "nequi" }}
              >
                <NativeSelect
                  id="cxpa-method"
                  value={method}
                  onChange={(v) => setMethod(v as PaymentMethod)}
                  options={(
                    Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]
                  ).map((k) => ({ value: k, label: PAYMENT_METHOD_LABELS[k] }))}
                />
              </Field>
              <Field
                id="cxpa-amount"
                label="Monto del abono"
                help={{ term: "abono" }}
                error={val > saldo ? "El abono no puede superar el saldo." : null}
              >
                <MoneyInput
                  id="cxpa-amount"
                  value={val || null}
                  onValueChange={(v) => setAmount(v == null ? "" : String(v))}
                  placeholder="0"
                />
              </Field>
              <FieldSpan span={3}>
                <Field id="cxpa-note" label="Nota">
                  <Input
                    id="cxpa-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </FieldSpan>
            </FieldGrid>
          </FormSection>

          {payable.payments.length > 0 && (
            <FormSection
              title="Abonos anteriores"
              description={`${payable.payments.length} pago${payable.payments.length === 1 ? "" : "s"} registrado${payable.payments.length === 1 ? "" : "s"}.`}
              boxed
            >
              <ul className="flex flex-col gap-1.5">
                {payable.payments.map((p, i) => (
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
      <Badge className="gap-1 border-success/30 bg-success/10 text-success-ink">
        Pagada
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
