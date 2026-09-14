"use client"

import * as React from "react"
import { Loader2, Receipt } from "lucide-react"

import type {
  ApplyAsExpensePayload,
  ExtractedInvoice,
} from "@/lib/erp/api-invoice-scans"
import type { Sede } from "@/lib/erp/api-inventory"
import {
  PAYMENT_METHOD_LABELS,
  type ExpenseStatus,
  type FinanceCategory,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
import { money } from "@/lib/erp/finance-format"

import { Button } from "@/components/ui/button"
import { FormDialog, FormSection } from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"

/** Diferencia aceptable contra el total impreso, la misma de la revisión. */
const TOLERANCIA = 100

const TARIFAS_IVA = [19, 5, 0] as const

/** Hoy en la zona del navegador, YYYY-MM-DD (en-CA formatea así). */
function hoy(): string {
  return new Date().toLocaleDateString("en-CA")
}

interface ExpenseForm {
  sedeId: string
  categoryId: string
  concept: string
  date: string
  base: number | null
  iva: number | null
  reteFuente: number | null
  reteIva: number | null
  reteIca: number | null
  status: ExpenseStatus
  paymentMethod: PaymentMethod | ""
  dueDate: string
  note: string
}

/** El formulario con lo que la factura ya dice. */
function formDesdeFactura(
  draft: ExtractedInvoice,
  defaultSedeId: string,
  sumaLineas: number,
): ExpenseForm {
  const totales = draft.totals ?? {}
  const baseLeida =
    totales.subtotal ??
    (totales.total != null ? totales.total - (totales.iva ?? 0) : sumaLineas)
  const numero = draft.invoice?.number
    ? `Factura ${draft.invoice.number}`
    : "Factura"
  const proveedor = draft.supplier?.name
  return {
    sedeId: defaultSedeId,
    categoryId: "",
    concept: (proveedor ? `${numero} · ${proveedor}` : numero).slice(0, 200),
    date: draft.invoice?.issueDate ?? hoy(),
    base: baseLeida > 0 ? baseLeida : null,
    iva: totales.iva ?? null,
    reteFuente: totales.retentions ?? null,
    reteIva: null,
    reteIca: null,
    status: draft.invoice?.paymentTerms === "contado" ? "paid" : "payable",
    paymentMethod: "",
    dueDate: draft.invoice?.dueDate ?? "",
    note: "",
  }
}

interface ApplyExpenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: ExtractedInvoice
  sedes: Sede[]
  categories: FinanceCategory[]
  defaultSedeId: string
  /** Suma de los renglones, por si la factura no trae totales legibles. */
  sumaLineas: number
  submitting: boolean
  onSubmit: (payload: ApplyAsExpensePayload) => void
}

/**
 * "Aplicar en gastos": la factura entera como UN gasto, sin inventario.
 *
 * Es para las facturas que no son mercancía —servicios, arriendo,
 * mantenimiento—. Pide lo que la contabilidad necesita por separado: la base,
 * el IVA (descontable) y las retenciones (que se le deben a la DIAN y no al
 * proveedor). Lo que la factura ya dice viene prellenado.
 */
export function ApplyExpenseDialog({
  open,
  onOpenChange,
  draft,
  sedes,
  categories,
  defaultSedeId,
  sumaLineas,
  submitting,
  onSubmit,
}: ApplyExpenseDialogProps) {
  const [form, setForm] = React.useState<ExpenseForm>(() =>
    formDesdeFactura(draft, defaultSedeId, sumaLineas),
  )

  // Cada vez que se abre se rellena otra vez con lo que dice la factura, que
  // pudo corregirse en la revisión. Se ajusta durante el render y no en un
  // efecto: así nunca se pinta el diálogo con los datos de la vez anterior.
  const [estabaAbierto, setEstabaAbierto] = React.useState(open)
  if (open !== estabaAbierto) {
    setEstabaAbierto(open)
    if (open) setForm(formDesdeFactura(draft, defaultSedeId, sumaLineas))
  }

  function set<K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) {
    setForm((actual) => ({ ...actual, [key]: value }))
  }

  const totalImpreso = draft.totals?.total
  const base = form.base ?? 0
  const iva = form.iva ?? 0
  const retenciones =
    (form.reteFuente ?? 0) + (form.reteIva ?? 0) + (form.reteIca ?? 0)
  const totalFactura = base + iva
  const neto = totalFactura - retenciones
  const descuadre =
    totalImpreso != null && Math.abs(totalImpreso - totalFactura) > TOLERANCIA

  const error = !form.sedeId
    ? "Elige la sede."
    : !form.categoryId
      ? "Elige la categoría del gasto."
      : !form.concept.trim()
        ? "Escribe el concepto."
        : !form.date
          ? "Indica la fecha de la factura."
          : totalFactura <= 0
            ? "El gasto no tiene valor: completa la base."
            : retenciones > totalFactura
              ? "Las retenciones no pueden superar el total."
              : form.status === "paid" && !form.paymentMethod
                ? "Indica con qué se pagó."
                : form.status === "payable" &&
                    form.dueDate &&
                    form.dueDate < form.date
                  ? "El vencimiento no puede ser anterior a la fecha."
                  : null

  function handleSubmit() {
    if (error) return
    const detalle = [
      form.reteFuente ? `ReteFuente ${money.format(form.reteFuente)}` : null,
      form.reteIva ? `ReteIVA ${money.format(form.reteIva)}` : null,
      form.reteIca ? `ReteICA ${money.format(form.reteIca)}` : null,
    ].filter(Boolean)
    const nota = [
      form.note.trim(),
      detalle.length > 0 ? `Retenciones: ${detalle.join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 400)

    onSubmit({
      sedeId: form.sedeId,
      categoryId: form.categoryId,
      concept: form.concept.trim(),
      date: form.date,
      amount: Math.round(base),
      taxAmount: Math.round(iva),
      withholdingAmount: Math.round(retenciones),
      status: form.status,
      paymentMethod:
        form.status === "paid" ? (form.paymentMethod as PaymentMethod) : undefined,
      dueDate:
        form.status === "payable" && form.dueDate ? form.dueDate : undefined,
      note: nota || undefined,
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={Receipt}
      title="Aplicar en gastos"
      description="La factura completa se registra como un gasto, sin pasar por inventario. Revisa los valores: lo que la factura ya dice viene completado."
      footer={
        <>
          {error && (
            <p className="text-sm text-muted-foreground sm:mr-auto">{error}</p>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={Boolean(error) || submitting}
            className="sm:min-w-40"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Receipt className="size-4" aria-hidden />
            )}
            Registrar gasto
          </Button>
        </>
      }
    >
      <FormSection
        title="Gasto"
        description="Dónde se registra y cómo lo vas a encontrar en Finanzas."
      >
        <FieldGrid cols={2}>
          <Field id="ae-sede" label="Sede" required>
            <NativeSelect
              id="ae-sede"
              value={form.sedeId}
              onChange={(v) => set("sedeId", v)}
              placeholder="Elige la sede"
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
            />
          </Field>
          <Field id="ae-cat" label="Categoría" required>
            <NativeSelect
              id="ae-cat"
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              placeholder="Elige la categoría"
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
            />
          </Field>
          <Field id="ae-concept" label="Concepto" required>
            <Input
              id="ae-concept"
              value={form.concept}
              maxLength={200}
              onChange={(e) => set("concept", e.target.value)}
            />
          </Field>
          <Field id="ae-date" label="Fecha de la factura" required>
            <Input
              id="ae-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Valores e impuestos"
        description="La base es el valor antes de IVA. El IVA queda como descontable."
      >
        <FieldGrid cols={2}>
          <Field id="ae-base" label="Base (antes de IVA)" required>
            <MoneyInput
              id="ae-base"
              value={form.base}
              onValueChange={(v) => set("base", v)}
            />
          </Field>
          <Field
            id="ae-iva"
            label="IVA"
            hint="Calcúlalo desde la base o escríbelo como viene en la factura."
          >
            <MoneyInput
              id="ae-iva"
              value={form.iva}
              onValueChange={(v) => set("iva", v)}
            />
          </Field>
          <FieldSpan span={2}>
            <div className="flex flex-wrap gap-1.5">
              {TARIFAS_IVA.map((tarifa) => (
                <Button
                  key={tarifa}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={base <= 0}
                  onClick={() => set("iva", Math.round((base * tarifa) / 100))}
                >
                  {tarifa === 0 ? "Sin IVA" : `IVA ${tarifa}%`}
                </Button>
              ))}
              {totalImpreso != null && totalImpreso > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // Para facturas con el IVA incluido en el total, como
                    // las tirillas de supermercado.
                    const sinIva = Math.round(totalImpreso / 1.19)
                    setForm((actual) => ({
                      ...actual,
                      base: sinIva,
                      iva: totalImpreso - sinIva,
                    }))
                  }}
                >
                  Separar IVA 19% del total impreso
                </Button>
              )}
            </div>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Retenciones"
        description="Solo si tu negocio es agente retenedor. Lo retenido no se le paga al proveedor: se le declara a la DIAN."
      >
        <FieldGrid cols={3}>
          <Field id="ae-rtf" label="ReteFuente">
            <MoneyInput
              id="ae-rtf"
              value={form.reteFuente}
              onValueChange={(v) => set("reteFuente", v)}
            />
          </Field>
          <Field id="ae-rtiva" label="ReteIVA">
            <MoneyInput
              id="ae-rtiva"
              value={form.reteIva}
              onValueChange={(v) => set("reteIva", v)}
            />
          </Field>
          <Field id="ae-rtica" label="ReteICA">
            <MoneyInput
              id="ae-rtica"
              value={form.reteIca}
              onValueChange={(v) => set("reteIca", v)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Pago"
        description="Si queda a crédito se crea la cuenta por pagar con su vencimiento."
      >
        <FieldGrid cols={2}>
          <Field id="ae-status" label="Estado" required>
            <NativeSelect
              id="ae-status"
              value={form.status}
              onChange={(v) => set("status", v as ExpenseStatus)}
              options={[
                { value: "paid", label: "Pagada (de contado)" },
                { value: "payable", label: "Por pagar (a crédito)" },
              ]}
            />
          </Field>
          {form.status === "paid" ? (
            <Field id="ae-method" label="Medio de pago" required>
              <NativeSelect
                id="ae-method"
                value={form.paymentMethod}
                onChange={(v) => set("paymentMethod", v as PaymentMethod)}
                placeholder="¿Con qué se pagó?"
                options={(
                  Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]
                ).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              />
            </Field>
          ) : (
            <Field
              id="ae-due"
              label="Vence"
              hint="Si lo dejas vacío se usa el plazo de crédito configurado."
            >
              <Input
                id="ae-due"
                type="date"
                value={form.dueDate}
                min={form.date || undefined}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </Field>
          )}
          <FieldSpan span={2}>
            <Field id="ae-note" label="Nota">
              <Input
                id="ae-note"
                value={form.note}
                maxLength={300}
                placeholder="Opcional"
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      <FormSection title="Resumen" boxed>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Base</dt>
            <dd>{money.format(base)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">IVA</dt>
            <dd>{money.format(iva)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Total de la factura</dt>
            <dd>{money.format(totalFactura)}</dd>
          </div>
          {retenciones > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Retenciones</dt>
              <dd>− {money.format(retenciones)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1.5 font-display text-base">
            <dt>
              {form.status === "paid"
                ? "Pagado al proveedor"
                : "Por pagar al proveedor"}
            </dt>
            <dd>{money.format(Math.max(neto, 0))}</dd>
          </div>
        </dl>
        {descuadre && totalImpreso != null && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink">
            La factura dice {money.format(totalImpreso)} y aquí suman{" "}
            {money.format(totalFactura)}. Revisa la base y el IVA antes de
            registrar.
          </p>
        )}
      </FormSection>
    </FormDialog>
  )
}
