"use client"

import * as React from "react"
import {
  Plus,
  Trash2,
  Tags,
  Loader2,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react"

import { ApiError } from "@/lib/api"
import {
  listPriceLists,
  createPriceList,
  updatePriceList,
  deactivatePriceList,
  type PriceList,
  type PriceListItem,
  type CatalogProduct,
} from "@/lib/erp/api-catalog"
import { resolveUnitPrice } from "@/lib/erp/price-list"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/** Una fila del editor: el precio pactado se escribe como texto mientras se teclea. */
interface FilaPrecio {
  catalogProductId: string
  price: string
  minQty: string
}

/**
 * Listas de precios: vender lo mismo a distinto precio según a quién.
 *
 * El precio del catálogo es el de mostrador y no se toca aquí. Una lista son
 * las reglas que se le aplican encima, y se arma de dos maneras que se
 * combinan: un porcentaje general para todo —con el que se puede arrancar el
 * mismo día— y precios pactados producto por producto, que mandan sobre él.
 *
 * La cantidad mínima de un precio pactado es lo que arma el precio por
 * cantidad: la gaseosa a $2.500 desde 12 y a $2.200 desde 50.
 */
export function PriceListsDialog({
  open,
  onOpenChange,
  products,
  canManage,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: CatalogProduct[]
  canManage: boolean
}) {
  const [lists, setLists] = React.useState<PriceList[]>([])
  const [cargando, setCargando] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)

  /** `null` = ninguna elegida todavía; `"nueva"` = creando. */
  const [selId, setSelId] = React.useState<string>("")
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [discountPercent, setDiscountPercent] = React.useState("")
  const [filas, setFilas] = React.useState<FilaPrecio[]>([])

  const vendibles = React.useMemo(
    () =>
      products
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  )
  const porId = React.useMemo(
    () => new Map(vendibles.map((p) => [p._id, p])),
    [vendibles],
  )

  const cargar = React.useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setLists(await listPriceLists())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }, [])

  React.useEffect(() => {
    let vivo = true
    // El `await` de entrada saca los setState del cuerpo del efecto, que si no
    // encadena renders.
    async function arrancar() {
      await Promise.resolve()
      if (!vivo || !open) return
      await cargar()
    }
    void arrancar()
    return () => {
      vivo = false
    }
  }, [open, cargar])

  function limpiarFormulario() {
    setName("")
    setDescription("")
    setDiscountPercent("")
    setFilas([])
  }

  function nueva() {
    setSelId("nueva")
    setOk(null)
    setError(null)
    limpiarFormulario()
  }

  function editar(l: PriceList) {
    setSelId(l._id)
    setOk(null)
    setError(null)
    setName(l.name)
    setDescription(l.description ?? "")
    setDiscountPercent(l.discountPercent ? String(l.discountPercent) : "")
    setFilas(
      l.items.map((i) => ({
        catalogProductId: i.catalogProductId,
        price: String(i.price),
        minQty: i.minQty != null ? String(i.minQty) : "",
      })),
    )
  }

  function cerrar() {
    onOpenChange(false)
    setSelId("")
    setOk(null)
    setError(null)
    limpiarFormulario()
  }

  /** Filas completas y válidas: las incompletas se descartan al guardar. */
  const items: PriceListItem[] = React.useMemo(() => {
    const out: PriceListItem[] = []
    for (const f of filas) {
      if (!f.catalogProductId) continue
      const price = Number(f.price)
      if (!Number.isFinite(price) || price < 0 || f.price.trim() === "") continue
      const min = Number(f.minQty)
      out.push({
        catalogProductId: f.catalogProductId,
        price,
        minQty: f.minQty.trim() !== "" && Number.isFinite(min) && min > 0 ? min : undefined,
      })
    }
    return out
  }, [filas])

  const pctNum = Number(discountPercent)
  const pctValido =
    discountPercent.trim() === "" ||
    (Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 100)

  /** Dos precios del mismo producto con la misma mínima: el backend lo rechaza. */
  const duplicado = React.useMemo(() => {
    const vistos = new Set<string>()
    for (const i of items) {
      const clave = `${i.catalogProductId}:${i.minQty ?? 0}`
      if (vistos.has(clave)) return true
      vistos.add(clave)
    }
    return false
  }, [items])

  async function guardar() {
    if (!name.trim() || !pctValido || duplicado) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        discountPercent: discountPercent.trim() === "" ? 0 : pctNum,
        items,
      }
      if (selId === "nueva") {
        const creada = await createPriceList(payload)
        setSelId(creada._id)
        setOk(`Lista "${creada.name}" creada.`)
      } else {
        await updatePriceList(selId, payload)
        setOk("Cambios guardados.")
      }
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function desactivar() {
    if (!selId || selId === "nueva") return
    setSaving(true)
    setError(null)
    try {
      await deactivatePriceList(selId)
      setSelId("")
      limpiarFormulario()
      setOk("Lista desactivada. Los clientes que la tenían vuelven a mostrador.")
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const editando = selId !== ""

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) cerrar()
        else onOpenChange(v)
      }}
      size="4xl"
      icon={Tags}
      title="Listas de precios"
      description="Para venderle más barato a quien compra por cajas, sin duplicar productos ni descontar a mano en cada venta."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            Cerrar
          </Button>
          {editando && canManage && (
            <Button
              onClick={guardar}
              disabled={saving || !name.trim() || !pctValido || duplicado}
              className="sm:min-w-40"
            >
              {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {saving ? "Guardando…" : "Guardar lista"}
            </Button>
          )}
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      {ok && (
        <FormAlert tone="success" icon={CheckCircle2}>
          {ok}
        </FormAlert>
      )}

      <FormSection
        title="Tus listas"
        description="El precio del catálogo sigue siendo el de mostrador: es lo que se cobra cuando el cliente no tiene lista."
      >
        <div className="flex flex-wrap items-center gap-2">
          {cargando && <Loader2 className="size-4 animate-spin" />}
          {!cargando &&
            lists.map((l) => (
              <button
                key={l._id}
                type="button"
                onClick={() => editar(l)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  selId === l._id
                    ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
                    : "border-border hover:bg-accent",
                )}
              >
                {l.name}
                {l.discountPercent > 0 && (
                  <Badge variant="secondary">−{l.discountPercent} %</Badge>
                )}
                {l.items.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {l.items.length} precio(s)
                  </span>
                )}
              </button>
            ))}
          {!cargando && lists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Todavía no tienes ninguna. La primera suele llamarse “Mayorista”.
            </p>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={nueva}>
              <Plus />
              Nueva lista
            </Button>
          )}
        </div>
      </FormSection>

      {editando && (
        <>
          <FormSection title="Cómo se llama y cuánto baja">
            <FieldGrid cols={2}>
              <Field id="pl-name" label="Nombre" required>
                <Input
                  id="pl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mayorista"
                  disabled={!canManage}
                />
              </Field>
              <Field
                id="pl-pct"
                label="Descuento general"
                error={pctValido ? null : "Tiene que estar entre 0 y 100."}
                hint="Sobre el precio de mostrador, para todo el catálogo. Déjalo vacío si vas a pactar precio por producto."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="pl-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    className="w-28"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="12"
                    disabled={!canManage}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </Field>
              <Field id="pl-desc" label="Nota" hint="Para acordarte de a quién es.">
                <Input
                  id="pl-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tiendas de barrio que compran por cajas"
                  disabled={!canManage}
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Precios pactados"
            description="Mandan sobre el descuento general. La cantidad mínima es opcional: con ella armas el precio por cantidad."
          >
            {duplicado && (
              <FormAlert tone="warning" icon={TriangleAlert}>
                Hay dos precios del mismo producto con la misma cantidad mínima.
                Deja uno solo: seguramente querías corregir el precio y quedó el
                renglón viejo.
              </FormAlert>
            )}

            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Mostrador</TableHead>
                    <TableHead>Precio de la lista</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f, idx) => {
                    const p = porId.get(f.catalogProductId)
                    return (
                      <TableRow key={idx}>
                        <TableCell className="py-2">
                          <NativeSelect
                            value={f.catalogProductId}
                            onChange={(v) =>
                              setFilas((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, catalogProductId: v } : x,
                                ),
                              )
                            }
                            options={vendibles.map((v) => ({
                              value: v._id,
                              label: v.name,
                            }))}
                            placeholder="Elegir producto"
                            disabled={!canManage}
                          />
                        </TableCell>
                        <TableCell className="tnum py-2 text-right text-muted-foreground">
                          {p ? money.format(p.salePrice) : "—"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className="w-32 text-right tnum"
                            aria-label="Precio de la lista"
                            value={f.price}
                            onChange={(e) =>
                              setFilas((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, price: e.target.value } : x,
                                ),
                              )
                            }
                            disabled={!canManage}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            className="w-24 text-right tnum"
                            aria-label="Cantidad mínima"
                            placeholder="1"
                            value={f.minQty}
                            onChange={(e) =>
                              setFilas((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, minQty: e.target.value } : x,
                                ),
                              )
                            }
                            disabled={!canManage}
                          />
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Quitar este precio"
                              onClick={() =>
                                setFilas((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Sin precios pactados. Con el descuento general ya
                        funciona; agrega precios solo donde quieras otra cosa.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilas((prev) => [
                      ...prev,
                      { catalogProductId: "", price: "", minQty: "" },
                    ])
                  }
                >
                  <Plus />
                  Agregar precio
                </Button>
                {selId !== "nueva" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={desactivar}
                    disabled={saving}
                  >
                    <Trash2 />
                    Desactivar lista
                  </Button>
                )}
              </div>
            )}
          </FormSection>

          <FormSection
            title="Cómo queda"
            description="Lo que se le cobraría llevando una sola unidad. El precio por cantidad se ve al vender."
          >
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Mostrador</TableHead>
                    <TableHead className="text-right">Con esta lista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendibles.slice(0, 60).map((p) => {
                    const precio = resolveUnitPrice({
                      basePrice: p.salePrice,
                      qty: 1,
                      catalogProductId: p._id,
                      list: {
                        discountPercent:
                          discountPercent.trim() === "" ? 0 : pctNum,
                        items,
                      },
                    })
                    const cambia = precio !== Math.round(p.salePrice)
                    return (
                      <TableRow key={p._id}>
                        <TableCell className="py-1.5">{p.name}</TableCell>
                        <TableCell className="tnum py-1.5 text-right text-muted-foreground">
                          {money.format(p.salePrice)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "tnum py-1.5 text-right",
                            cambia && "font-medium text-brand-700 dark:text-brand-300",
                          )}
                        >
                          {money.format(precio)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {vendibles.length > 60 && (
              <p className="text-xs text-muted-foreground">
                Se muestran 60 de {vendibles.length} productos.
              </p>
            )}
          </FormSection>
        </>
      )}
    </FormDialog>
  )
}
