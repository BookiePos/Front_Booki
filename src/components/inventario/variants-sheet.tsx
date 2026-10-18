"use client"

import * as React from "react"
import {
  Plus,
  X,
  PackagePlus,
  Layers,
  CheckCircle2,
  Package,
} from "lucide-react"
import {
  createProductVariants,
  type InvCategory,
} from "@/lib/erp/api-inventory"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormDialog,
  FormDivider,
  FormSection,
} from "@/components/ui/form-dialog"
import { Field, FieldGrid } from "@/components/ui/field"
import { VARIANTS_FORM_ID, errorMessage } from "@/components/inventario/helpers"
import { FormError } from "@/components/inventario/ui-comunes"
import { useResetOnChange } from "@/hooks/use-reset-on-change"

// ─── Tallas y variantes (comercio sin recetas) ───────────────────────────────

export interface AxisRow {
  name: string
  /** Valores ya elegidos para el eje ("S", "M", "L"…). */
  values: string[]
}

/**
 * Plantillas de ejes de uso corriente.
 *
 * Escribir "XS, S, M, L, XL, XXL" a mano en cada alta es justo el trabajo que
 * hace que nadie use la función. Con un toque queda el eje montado y luego se
 * quitan los valores que no se manejen.
 */
export const AXIS_PRESETS: { label: string; name: string; values: string[] }[] =
  [
    {
      label: "Tallas de ropa",
      name: "Talla",
      values: ["XS", "S", "M", "L", "XL", "XXL"],
    },
    {
      label: "Tallas numéricas",
      name: "Talla",
      values: ["28", "30", "32", "34", "36", "38", "40"],
    },
    {
      label: "Calzado (CO)",
      name: "Talla",
      values: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
    },
    {
      label: "Colores básicos",
      name: "Color",
      values: ["Negro", "Blanco", "Azul", "Rojo", "Verde", "Gris"],
    },
    {
      label: "Presentación",
      name: "Presentación",
      values: ["Pequeño", "Mediano", "Grande"],
    },
  ]

/** Cuántas combinaciones se enseñan en la vista previa antes de resumir. */
export const PREVIEW_LIMIT = 12

/**
 * Alta de un producto con variantes: una fila de inventario por cada
 * combinación de los ejes (talla × color), con SKU y existencias propias.
 *
 * Está pensada para el comercio que NO trabaja con recetas —ropa, calzado,
 * accesorios—, donde "una camisa" no es un producto sino quince: cada talla se
 * compra, se cuenta y se vende por separado. Darlas de alta una a una era
 * media hora de trabajo y quince oportunidades de equivocarse con el SKU.
 *
 * Los valores se eligen como fichas (no como texto separado por comas) porque
 * así se ve exactamente qué se va a crear y se puede quitar uno sin volver a
 * escribir la lista entera. La vista previa de abajo enseña el SKU real que va
 * a salir, que es lo que después se busca en el POS y se pega en la etiqueta.
 */
export function VariantsSheet({
  open,
  onOpenChange,
  categories,
  onSuccess,
  onRegisterEntry,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: InvCategory[]
  onSuccess: () => void
  /** Abre la entrada de mercancía al terminar (el paso natural siguiente). */
  onRegisterEntry?: () => void
}) {
  const [skuPrefix, setSkuPrefix] = React.useState("")
  const [name, setName] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("none")
  const [salePrice, setSalePrice] = React.useState<number | null>(null)
  const [cost, setCost] = React.useState<number | null>(null)
  const [minStock, setMinStock] = React.useState<number | null>(null)
  const [axes, setAxes] = React.useState<AxisRow[]>([
    { name: "Talla", values: [] },
  ])
  const [drafts, setDrafts] = React.useState<string[]>([""])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [doneMsg, setDoneMsg] = React.useState<string | null>(null)

  useResetOnChange(() => {
    if (!open) return
    setSkuPrefix("")
    setName("")
    setCategoryId("none")
    setSalePrice(null)
    setCost(null)
    setMinStock(null)
    setAxes([{ name: "Talla", values: [] }])
    setDrafts([""])
    setError(null)
    setDoneMsg(null)
  }, [open])

  /** Ejes con nombre y al menos un valor: los únicos que generan variantes. */
  const parsedAxes = axes
    .map((a) => ({ name: a.name.trim(), values: a.values }))
    .filter((a) => a.name && a.values.length > 0)

  const willCreate =
    parsedAxes.length > 0
      ? parsedAxes.reduce((n, a) => n * a.values.length, 1)
      : 0

  /**
   * Firma de los ejes. `parsedAxes` se recalcula en cada render, así que como
   * dependencia no vale de nada; lo que de verdad cambia la vista previa es su
   * contenido, y eso es lo que se compara.
   */
  const axesKey = JSON.stringify(parsedAxes)

  /** Todas las combinaciones (producto cartesiano), como las hace el backend. */
  const combos = React.useMemo(() => {
    if (parsedAxes.length === 0) return [] as string[][]
    return parsedAxes.reduce<string[][]>(
      (acc, axis) => acc.flatMap((row) => axis.values.map((v) => [...row, v])),
      [[]],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axesKey])

  function updateAxis(i: number, patch: Partial<AxisRow>) {
    setAxes((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    )
  }

  /** Añade uno o varios valores (acepta "S, M, L" pegado de un tirón). */
  function addValues(i: number, raw: string) {
    const nuevos = raw
      .split(/[,;\n\t]/)
      .map((v) => v.trim())
      .filter(Boolean)
    if (nuevos.length === 0) return
    setAxes((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) return r
        const merged = [...r.values]
        for (const v of nuevos) {
          if (!merged.some((x) => x.toLowerCase() === v.toLowerCase())) {
            merged.push(v)
          }
        }
        return { ...r, values: merged }
      }),
    )
    setDrafts((d) => d.map((v, idx) => (idx === i ? "" : v)))
  }

  function removeValue(i: number, value: string) {
    setAxes((rows) =>
      rows.map((r, idx) =>
        idx === i ? { ...r, values: r.values.filter((v) => v !== value) } : r,
      ),
    )
  }

  function applyPreset(preset: (typeof AXIS_PRESETS)[number]) {
    setAxes((rows) => {
      const at = rows.findIndex(
        (r) => r.name.trim().toLowerCase() === preset.name.toLowerCase(),
      )
      // Si ya hay un eje con ese nombre se rellena; si no, se añade otro.
      if (at >= 0) {
        const merged = [...rows[at].values]
        for (const v of preset.values) {
          if (!merged.some((x) => x.toLowerCase() === v.toLowerCase())) {
            merged.push(v)
          }
        }
        return rows.map((r, idx) =>
          idx === at ? { ...r, name: preset.name, values: merged } : r,
        )
      }
      const vacio = rows.findIndex(
        (r) => !r.name.trim() && r.values.length === 0,
      )
      if (vacio >= 0) {
        return rows.map((r, idx) =>
          idx === vacio ? { name: preset.name, values: preset.values } : r,
        )
      }
      setDrafts((d) => [...d, ""])
      return [...rows, { name: preset.name, values: preset.values }]
    })
  }

  function addAxis() {
    setAxes((rows) => [...rows, { name: "", values: [] }])
    setDrafts((d) => [...d, ""])
  }

  function removeAxis(i: number) {
    setAxes((rows) =>
      rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
    )
    setDrafts((d) => (d.length > 1 ? d.filter((_, idx) => idx !== i) : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!skuPrefix.trim()) {
      setError("Escribe un SKU base para derivar los de cada variante")
      return
    }
    if (!name.trim()) {
      setError("Escribe el nombre del producto")
      return
    }
    if (parsedAxes.length === 0) {
      setError("Agrega al menos un eje (p. ej. Talla) con sus valores")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await createProductVariants({
        skuPrefix: skuPrefix.trim(),
        name: name.trim(),
        categoryId: categoryId === "none" ? undefined : categoryId,
        salePrice: salePrice ?? undefined,
        cost: cost ?? undefined,
        minStock: minStock ?? undefined,
        axes: parsedAxes,
      })
      onSuccess()
      setDoneMsg(
        `Se crearon ${res.variants.length} variante(s). Ya están en el catálogo: registra su entrada de mercancía para poder venderlas.`,
      )
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
      title="Tallas y variantes"
      description="Una fila de inventario por cada combinación, con su SKU y sus existencias propias. Pensado para ropa, calzado y todo lo que se vende por talla o color."
      icon={Layers}
      size="3xl"
      footer={
        doneMsg ? (
          <>
            {onRegisterEntry && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onRegisterEntry()
                }}
              >
                <PackagePlus />
                Registrar entrada
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </>
        ) : (
          <>
            <FormError error={error} />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={VARIANTS_FORM_ID}
              disabled={saving || willCreate === 0}
            >
              {saving
                ? "Creando…"
                : willCreate > 0
                  ? `Crear ${willCreate} variante(s)`
                  : "Crear variantes"}
            </Button>
          </>
        )
      }
    >
      {doneMsg ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/8 p-4 text-sm text-success-ink">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <span>{doneMsg}</span>
        </div>
      ) : (
        <form
          id={VARIANTS_FORM_ID}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <FormSection
            title="Producto base"
            description="Lo común a todas las variantes. Cada una hereda esto y le añade su talla o su color."
            icon={Package}
          >
            <FieldGrid cols={2}>
              <Field
                id="v-name"
                label="Nombre"
                required
                hint="Se le añade la variante al final: “Camisa manga larga · M”."
              >
                <Input
                  id="v-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Camisa manga larga"
                  required
                />
              </Field>
              <Field
                id="v-sku"
                label="SKU base"
                required
                help={{ term: "sku" }}
                hint="De aquí salen los SKU de cada variante (CAMISA-M, CAMISA-L…)."
              >
                <Input
                  id="v-sku"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="p. ej. CAMISA"
                  className="font-mono"
                  required
                />
              </Field>
            </FieldGrid>

            <FieldGrid cols={4}>
              <Field id="v-cat" label="Categoría">
                <Select
                  value={categoryId}
                  items={{
                    none: "Sin categoría",
                    ...Object.fromEntries(
                      categories.map((c) => [c._id, c.name]),
                    ),
                  }}
                  onValueChange={(val) => {
                    if (val !== null) setCategoryId(val)
                  }}
                >
                  <SelectTrigger id="v-cat" className="w-full">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="v-price"
                label="Precio de venta"
                hint="Con precio, entran solas al POS."
              >
                <MoneyInput
                  id="v-price"
                  value={salePrice}
                  onValueChange={setSalePrice}
                  placeholder="Opcional"
                />
              </Field>
              <Field id="v-cost" label="Costo">
                <MoneyInput
                  id="v-cost"
                  value={cost}
                  onValueChange={setCost}
                  placeholder="Opcional"
                />
              </Field>
              <Field
                id="v-min"
                label="Stock mínimo"
                hint="Por variante, no del total."
              >
                <QuantityInput
                  id="v-min"
                  value={minStock}
                  onValueChange={setMinStock}
                  sufijo="und"
                  placeholder="Opcional"
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormDivider />

          <FormSection
            title="Ejes de variación"
            description="Talla, color, presentación… Se crea una variante por cada combinación."
            icon={Layers}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAxis}
              >
                <Plus />
                Otro eje
              </Button>
            }
          >
            {/* Plantillas: montan un eje entero de un toque. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Empezar con:
              </span>
              {AXIS_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/8 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {axes.map((axis, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={axis.name}
                      onChange={(e) => updateAxis(i, { name: e.target.value })}
                      placeholder="Nombre del eje (Talla, Color…)"
                      className="max-w-56 font-semibold"
                      aria-label="Nombre del eje"
                    />
                    <Badge variant="outline" className="ml-auto">
                      {axis.values.length} valor(es)
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar eje"
                      disabled={axes.length <= 1}
                      onClick={() => removeAxis(i)}
                    >
                      <X />
                    </Button>
                  </div>

                  {axis.values.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {axis.values.map((value) => (
                        <span
                          key={value}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pr-1 pl-2.5 text-xs font-semibold text-primary"
                        >
                          {value}
                          <button
                            type="button"
                            aria-label={`Quitar ${value}`}
                            onClick={() => removeValue(i, value)}
                            className="grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      value={drafts[i] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) =>
                          d.map((v, idx) => (idx === i ? e.target.value : v)),
                        )
                      }
                      onKeyDown={(e) => {
                        // Enter añade el valor sin enviar el formulario: aquí
                        // se escriben diez seguidos y enviar en el primero
                        // sería exactamente lo contrario de lo que se quiere.
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          addValues(i, drafts[i] ?? "")
                        }
                      }}
                      onBlur={() => addValues(i, drafts[i] ?? "")}
                      placeholder="Escribe un valor y pulsa Enter (o pega “S, M, L”)"
                      aria-label="Nuevo valor del eje"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Agregar valor"
                      onClick={() => addValues(i, drafts[i] ?? "")}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <FormDivider />

          <FormSection
            title="Se van a crear"
            description="Repásalo antes de guardar: los SKU son los que después se buscan en el POS y se imprimen en la etiqueta."
            icon={CheckCircle2}
            boxed
          >
            {willCreate === 0 ? (
              <p className="text-sm text-muted-foreground">
                Elige al menos un valor —por ejemplo la talla M— y aquí verás la
                lista exacta de variantes.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {combos.slice(0, PREVIEW_LIMIT).map((combo, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-xs"
                    >
                      <span className="font-semibold">{combo.join(" / ")}</span>
                      <span className="font-mono text-[0.6875rem] text-muted-foreground">
                        {(skuPrefix.trim().toUpperCase() || "SKU") +
                          "-" +
                          combo.map(slugPreview).join("-")}
                      </span>
                    </span>
                  ))}
                </div>
                {combos.length > PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    …y {combos.length - PREVIEW_LIMIT} más. En total{" "}
                    <span className="font-semibold text-foreground">
                      {willCreate} variante(s)
                    </span>
                    .
                  </p>
                )}
              </>
            )}
          </FormSection>
        </form>
      )}
    </FormDialog>
  )
}

/** Vista previa del token de SKU de un valor (igual criterio que el backend). */
export function slugPreview(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "")
}
