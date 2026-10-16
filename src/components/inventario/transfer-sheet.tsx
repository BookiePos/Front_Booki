"use client"

import * as React from "react"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import { createTransfer } from "@/lib/erp/api-inventory"
import { unidadCorta } from "@/lib/erp/unidades"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuantityInput } from "@/components/ui/money-input"
import { FormDialog, FormSection } from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { TRANSFER_FORM_ID, errorMessage } from "@/components/inventario/helpers"
import { FormError } from "@/components/inventario/ui-comunes"
import { OperationSheetProps } from "@/components/inventario/entry-sheet"

export function TransferSheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [fromSedeId, setFromSedeId] = React.useState("")
  const [toSedeId, setToSedeId] = React.useState("")
  const [qty, setQty] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setProductId(preset?.productId ?? "")
      setFromSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setToSedeId("")
      setQty(null)
      setNote("")
      setError(null)
    }
    void reset()
  }, [open, preset, sedes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createTransfer({
        productId,
        fromSedeId,
        toSedeId,
        qty: qty ?? 0,
        note: note || undefined,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={ArrowLeftRight}
      title="Traslado entre sedes"
      description="Mueve existencias de una sede a otra conservando los lotes y sus vencimientos. No es una venta ni una compra."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={TRANSFER_FORM_ID}
            disabled={saving || !productId || !fromSedeId || !toSedeId || !qty}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
            {saving ? "Trasladando…" : "Trasladar"}
          </Button>
        </>
      }
    >
      <form
        id={TRANSFER_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué se mueve">
          <FieldGrid cols={2}>
            <FieldSpan span={2}>
              <Field id="t-product" label="Producto" required>
                <NativeSelect
                  id="t-product"
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

            <Field
              id="t-from"
              label="Desde"
              required
              help={{ term: "traslado" }}
            >
              <NativeSelect
                id="t-from"
                value={fromSedeId}
                onChange={setFromSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Sede origen"
              />
            </Field>
            <Field id="t-to" label="Hacia" required>
              <NativeSelect
                id="t-to"
                value={toSedeId}
                onChange={setToSedeId}
                options={sedes
                  .filter((s) => s._id !== fromSedeId)
                  .map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Sede destino"
              />
            </Field>

            <Field
              id="t-qty"
              label={`Cantidad${product ? ` (${unidadCorta(product.unit)})` : ""}`}
              required
            >
              <QuantityInput
                id="t-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={product ? unidadCorta(product.unit) : undefined}
              />
            </Field>
            <Field id="t-note" label="Nota">
              <Input
                id="t-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo del traslado (opcional)"
              />
            </Field>
          </FieldGrid>
        </FormSection>
      </form>
    </FormDialog>
  )
}
