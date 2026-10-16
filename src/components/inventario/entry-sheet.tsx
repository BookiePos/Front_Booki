"use client"

import * as React from "react"
import { PackagePlus, Loader2 } from "lucide-react"
import {
  updateProduct,
  createEntry,
  type Sede,
  type InvProduct,
} from "@/lib/erp/api-inventory"
import {
  convertUnits,
  describirContenido,
  precioDePresentacion,
  presentacionDeCompra,
} from "@/lib/erp/purchase-unit"
import { unidad, unidadCorta, unidadNombre } from "@/lib/erp/unidades"
import { UnidadSelect } from "@/components/erp/unidad-fields"
import { type Supplier } from "@/lib/erp/api-suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import { FormDialog, FormSection } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import {
  ENTRY_FORM_ID,
  money,
  normalizeName,
  errorMessage,
} from "@/components/inventario/helpers"
import {
  initialSupplierSel,
  SupplierSelect,
  localDateStr,
  FormError,
} from "@/components/inventario/ui-comunes"

// ─── Entry sheet (entrada de mercancía) ──────────────────────────────────────

export interface OperationSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  sedes: Sede[]
  onSuccess: () => void
  /** Preselección al abrir desde una fila de existencias. */
  preset?: { productId?: string; sedeId?: string }
  /** Proveedores registrados (solo lo usa la entrada). */
  suppliers?: Supplier[]
}

export function EntrySheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
  suppliers = [],
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [productQuery, setProductQuery] = React.useState("")
  const [productListOpen, setProductListOpen] = React.useState(false)
  const [sedeId, setSedeId] = React.useState("")
  const [entryUnit, setEntryUnit] = React.useState("und")
  const [entryWeight, setEntryWeight] = React.useState<number | null>(null)
  const [qty, setQty] = React.useState<number | null>(null)
  const [unitCost, setUnitCost] = React.useState<number | null>(null)
  /** Lo que costó la vez pasada. Solo se enseña; nunca se guarda por su cuenta. */
  const [costoAnterior, setCostoAnterior] = React.useState<number | null>(null)
  const [supplierSel, setSupplierSel] = React.useState("none")
  const [legacySupplier, setLegacySupplier] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un montaje (menaje, utensilios) no vence ni se pesa.
  const isAssembly = product?.itemType === "assembly"

  // Cómo llega el insumo. Con presentación definida, la mercancía se cuenta y
  // se cobra en bultos —que es como viene en la factura del proveedor— y la
  // conversión a unidades de consumo la hace el backend.
  const pres = product ? presentacionDeCompra(product) : null
  const enPresentacion = pres?.definida ?? false
  const equivalencia =
    enPresentacion && pres && qty != null && qty > 0
      ? describirContenido(qty * pres.factor, product?.unit ?? "und")
      : null

  const productMatches = React.useMemo(() => {
    const q = normalizeName(productQuery)
    if (!q) return products
    return products.filter(
      (p) =>
        normalizeName(p.name).includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [products, productQuery])

  // Sugerir vencimiento (fecha del producto o vida útil), costo, unidad y
  // peso al elegir producto.
  const applyProductDefaults = React.useCallback(
    (p: InvProduct | undefined) => {
      if (p?.perishable && p.expiresAt) {
        setExpiresAt(p.expiresAt.slice(0, 10))
      } else if (p?.perishable && p.shelfLifeDays) {
        const d = new Date()
        d.setDate(d.getDate() + p.shelfLifeDays)
        setExpiresAt(localDateStr(d))
      } else {
        setExpiresAt("")
      }
      // La casilla del costo se queda VACÍA a propósito: ver el comentario del
      // campo. Lo que se compró la vez pasada se guarda aparte, para enseñarlo
      // debajo como referencia, en la presentación en que se compra —para la
      // harina, el precio del bulto, no el del gramo—.
      setUnitCost(null)
      setCostoAnterior(
        p?.cost
          ? precioDePresentacion(p.cost, presentacionDeCompra(p).factor)
          : null,
      )
      setEntryUnit(p?.unit ?? "und")
      setEntryWeight(p?.weight != null && p.weight > 0 ? p.weight : null)
      setLegacySupplier(p?.supplier ?? "")
      setSupplierSel(initialSupplierSel(suppliers, p?.supplierId, p?.supplier))
    },
    [suppliers],
  )

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      const presetProduct = preset?.productId
        ? products.find((p) => p._id === preset.productId)
        : undefined
      setProductId(preset?.productId ?? "")
      setProductQuery(
        presetProduct ? `${presetProduct.name} · ${presetProduct.sku}` : "",
      )
      setProductListOpen(false)
      setSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setQty(null)
      setError(null)
      applyProductDefaults(presetProduct)
    }
    void reset()
  }, [open, preset, sedes, products, applyProductDefaults])

  function handlePick(p: InvProduct) {
    setProductId(p._id)
    setProductQuery(`${p.name} · ${p.sku}`)
    setProductListOpen(false)
    applyProductDefaults(p)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (expiresAt && expiresAt < localDateStr(new Date())) {
      setError("La fecha de vencimiento no puede ser anterior a hoy")
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Con presentación definida —"3 bultos a $95.000 el bulto"— la cantidad
      // y el precio viajan tal cual y los convierte el backend, que es donde
      // vive esa cuenta. Sin ella se conserva lo de siempre: la entrada puede
      // venir en otra unidad compatible (kg cuando el producto va en g) y se
      // reexpresa aquí, precio incluido para no inflar el costo.
      const rawQty = qty ?? 0
      const targetUnit = product?.unit ?? entryUnit
      const convertedQty = convertUnits(rawQty, entryUnit, targetUnit)
      const qtyFinal = enPresentacion ? rawQty : (convertedQty ?? rawQty)
      const costFinal = enPresentacion
        ? (unitCost ?? undefined)
        : unitCost && qtyFinal > 0
          ? (unitCost * rawQty) / qtyFinal
          : (unitCost ?? undefined)
      // Proveedor: registrado (id + nombre como texto) o texto legado.
      const chosenSupplier = suppliers.find((sp) => sp._id === supplierSel)
      const supplierText =
        chosenSupplier?.name ?? (supplierSel === "legacy" ? legacySupplier : "")
      await createEntry({
        productId,
        sedeId,
        qty: qtyFinal,
        unitCost: costFinal,
        inPurchaseUnits: enPresentacion ? true : undefined,
        supplier: supplierText || undefined,
        supplierId: chosenSupplier?._id,
        expiresAt: !isAssembly && expiresAt ? expiresAt : undefined,
      })
      // Si cambió el peso por unidad, se refleja en el producto (convertido).
      const w = !isAssembly && entryWeight ? entryWeight : undefined
      const wFinal =
        w != null && w > 0
          ? (convertUnits(w, entryUnit, targetUnit) ?? w)
          : undefined
      if (
        product &&
        wFinal != null &&
        wFinal > 0 &&
        wFinal !== product.weight
      ) {
        await updateProduct(product._id, { weight: wFinal }).catch(() => {})
      }
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
      icon={PackagePlus}
      title="Entrada de mercancía"
      description="Una recepción de compra o la carga inicial de existencias. Lo que entra forma un lote."
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
          {/* El costo entra en la condición: una entrada sin precio valoraba la
              mercancía al costo viejo del producto y descuadraba el inventario
              en silencio. Si de verdad no se sabe lo que costó, para eso está
              el ajuste, que no pretende ser una compra. */}
          <Button
            type="submit"
            form={ENTRY_FORM_ID}
            disabled={saving || !productId || !sedeId || !qty || !unitCost}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {saving ? "Registrando…" : "Registrar entrada"}
          </Button>
        </>
      }
    >
      <form
        id={ENTRY_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué entra y dónde">
          <FieldGrid cols={2}>
            <Field id="e-product" label="Producto" required>
              <div className="relative">
                <Input
                  id="e-product"
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value)
                    setProductListOpen(true)
                    setProductId("")
                  }}
                  onFocus={() => setProductListOpen(true)}
                  onBlur={() => setProductListOpen(false)}
                  placeholder="Escribe para buscar…"
                  autoComplete="off"
                  required
                />
                {productListOpen && productMatches.length > 0 && (
                  <div
                    className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {productMatches.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => handlePick(p)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field id="e-sede" label="Sede" required help={{ term: "sede" }}>
              <NativeSelect
                id="e-sede"
                value={sedeId}
                onChange={setSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Seleccionar sede"
              />
            </Field>

            {/* Con presentación definida no hay nada que elegir: la mercancía
                se cuenta en bultos y el backend la convierte. El selector solo
                tiene sentido para el insumo que se recibe en su propia unidad
                y a veces llega en kilos en vez de gramos. */}
            {!enPresentacion && (
              <Field
                id="e-unit"
                label="Unidad de medida"
                help={{ term: "unidad" }}
                hint={
                  product && entryUnit !== product.unit
                    ? `Lo llevas en ${unidadNombre(product.unit)}: lo convertimos al guardar.`
                    : unidad(entryUnit)?.ejemplo
                }
              >
                <UnidadSelect
                  id="e-unit"
                  value={entryUnit}
                  onChange={setEntryUnit}
                />
              </Field>
            )}
            {!isAssembly && (
              <Field
                id="e-weight"
                label={`Peso por unidad (${unidadCorta(entryUnit)})`}
                hint="Para productos que se compran por peso."
              >
                <QuantityInput
                  id="e-weight"
                  value={entryWeight}
                  onValueChange={setEntryWeight}
                  sufijo={unidadCorta(entryUnit)}
                  placeholder="500"
                />
              </Field>
            )}
          </FieldGrid>
        </FormSection>

        <FormSection title="Cantidad y costo">
          <FieldGrid cols={2}>
            <Field
              id="e-qty"
              label={enPresentacion ? `Cantidad (${pres!.unidad})` : "Cantidad"}
              required
              hint={
                equivalencia
                  ? `Entran ${equivalencia} al inventario.`
                  : enPresentacion
                    ? `Cada ${pres!.unidad} trae ${pres!.contenido}.`
                    : undefined
              }
            >
              <QuantityInput
                id="e-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={enPresentacion ? pres!.unidad : unidadCorta(entryUnit)}
              />
            </Field>
            {/* Obligatorio, y en blanco cada vez.

                Antes esta casilla venía rellena con el último costo del
                producto. Parecía una comodidad y era una trampa: quien recibía
                una factura de $680 encontraba un $500 ya escrito, lo daba por
                bueno y la mercancía entraba valorada a $500. El descuadre no
                avisaba en ninguna parte, porque para el sistema ese 500 lo
                había confirmado una persona.

                Lo que se compró antes se cuenta debajo, como dato, no como
                valor puesto: sirve para notar que algo subió y no se puede
                guardar sin querer. */}
            <Field
              id="e-cost"
              label="Precio de compra"
              required
              help={{ term: "costo" }}
              hint={
                enPresentacion
                  ? `Lo que te costó un ${pres!.unidad} completo, tal como viene en la factura.`
                  : `Por ${unidadNombre(entryUnit, 1)}, tal como viene en la factura.`
              }
            >
              <MoneyInput
                id="e-cost"
                value={unitCost}
                onValueChange={setUnitCost}
                placeholder={
                  enPresentacion
                    ? `Por ${pres!.unidad}`
                    : `Por ${unidadNombre(entryUnit, 1)}`
                }
              />
              {costoAnterior != null && costoAnterior > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  La vez pasada lo compraste a{" "}
                  <span className="font-medium text-foreground">
                    {money.format(costoAnterior)}
                  </span>
                  {enPresentacion ? ` el ${pres!.unidad}` : ""}.
                </p>
              )}
            </Field>

            <Field id="e-supplier" label="Proveedor">
              <SupplierSelect
                id="e-supplier"
                suppliers={suppliers}
                value={supplierSel}
                legacyText={legacySupplier}
                onChange={setSupplierSel}
              />
            </Field>
            {!isAssembly && (
              <Field
                id="e-exp"
                label="Fecha de vencimiento"
                required={Boolean(product?.perishable)}
                help={{ term: "fefo" }}
                hint={
                  product?.perishable
                    ? "Obligatoria: este producto es perecedero."
                    : "Opcional."
                }
              >
                <Input
                  id="e-exp"
                  type="date"
                  min={localDateStr(new Date())}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={Boolean(product?.perishable)}
                />
              </Field>
            )}
          </FieldGrid>
        </FormSection>
      </form>
    </FormDialog>
  )
}

// ─── Adjust sheet (ajuste / merma) ───────────────────────────────────────────
