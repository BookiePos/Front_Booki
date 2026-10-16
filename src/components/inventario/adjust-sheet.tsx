"use client"

import * as React from "react"
import { Plus, Minus, Loader2, SlidersHorizontal } from "lucide-react"
import {
  createAdjustment,
  ADJUST_REASON_LABELS,
  type AdjustReason,
} from "@/lib/erp/api-inventory"
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
import { Segmented } from "@/components/ui/segmented"
import { ADJUST_FORM_ID, errorMessage } from "@/components/inventario/helpers"
import { FormError } from "@/components/inventario/ui-comunes"
import { OperationSheetProps } from "@/components/inventario/entry-sheet"

export function AdjustSheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [sedeId, setSedeId] = React.useState("")
  const [direction, setDirection] = React.useState<"add" | "remove">("remove")
  const [qty, setQty] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState<AdjustReason>("conteo")
  const [lotCode, setLotCode] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un ajuste positivo de un producto con lotes crea un lote nuevo.
  const createsLot = direction === "add" && Boolean(product?.trackLots)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setProductId(preset?.productId ?? "")
      setSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setDirection("remove")
      setQty(null)
      setReason("conteo")
      setLotCode("")
      setExpiresAt("")
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
      await createAdjustment({
        productId,
        sedeId,
        direction,
        qty: qty ?? 0,
        reason,
        lotCode: createsLot && lotCode ? lotCode : undefined,
        expiresAt: createsLot && expiresAt ? expiresAt : undefined,
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
      size="3xl"
      icon={SlidersHorizontal}
      title="Ajuste de inventario"
      description="Corrige existencias por conteo, daño, vencimiento o merma. Las salidas descuentan primero los lotes más próximos a vencer."
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
            form={ADJUST_FORM_ID}
            disabled={saving || !productId || !sedeId || !qty}
            className="sm:min-w-36"
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SlidersHorizontal />
            )}
            {saving ? "Aplicando…" : "Aplicar ajuste"}
          </Button>
        </>
      }
    >
      <form
        id={ADJUST_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué se ajusta">
          <FieldGrid cols={2}>
            <Field id="a-product" label="Producto" required>
              <NativeSelect
                id="a-product"
                value={productId}
                onChange={setProductId}
                options={products.map((p) => ({
                  value: p._id,
                  label: `${p.name} · ${p.sku}`,
                }))}
                placeholder="Seleccionar producto"
              />
            </Field>
            <Field id="a-sede" label="Sede" required help={{ term: "sede" }}>
              <NativeSelect
                id="a-sede"
                value={sedeId}
                onChange={setSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Seleccionar sede"
              />
            </Field>

            <Field id="a-dir" label="Tipo">
              <Segmented
                fill
                ariaLabel="Tipo de ajuste"
                value={direction}
                onValueChange={(v) => setDirection(v as "add" | "remove")}
                options={[
                  { value: "remove", label: "Salida (−)", icon: Minus },
                  { value: "add", label: "Entrada (+)", icon: Plus },
                ]}
              />
            </Field>
            <Field
              id="a-qty"
              label={`Cantidad${product ? ` (${unidadCorta(product.unit)})` : ""}`}
              required
            >
              <QuantityInput
                id="a-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={product ? unidadCorta(product.unit) : undefined}
              />
            </Field>

            <FieldSpan span={2}>
              <Field
                id="a-reason"
                label="Razón"
                help={{ term: "merma" }}
                hint="Queda registrada en el kárdex con tu nombre."
              >
                <NativeSelect
                  id="a-reason"
                  value={reason}
                  onChange={(v) => setReason(v as AdjustReason)}
                  options={(
                    Object.entries(ADJUST_REASON_LABELS) as [
                      AdjustReason,
                      string,
                    ][]
                  ).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            </FieldSpan>
          </FieldGrid>
        </FormSection>

        {createsLot && (
          <FormSection
            title="Lote que entra"
            description="Las unidades que entran forman un lote propio, para poder sacar primero lo que se vence antes."
            boxed
          >
            <FieldGrid cols={2}>
              <Field
                id="a-lot"
                label="Código de lote"
                help={{ term: "lote" }}
                hint="Se genera solo si lo dejas vacío."
              >
                <Input
                  id="a-lot"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Auto"
                />
              </Field>
              <Field
                id="a-exp"
                label="Vencimiento"
                required={product?.perishable}
                help={{ term: "fefo" }}
              >
                <Input
                  id="a-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={product?.perishable}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        )}

        <Field id="a-note" label="Nota">
          <Input
            id="a-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detalle del ajuste (opcional)"
          />
        </Field>
      </form>
    </FormDialog>
  )
}
// ─── Ficha de traslado entre sedes ───────────────────────────────────────────
