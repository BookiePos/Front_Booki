"use client"

import * as React from "react"
import { GitMerge, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import {
  getSimilarProducts,
  mergeProducts,
  type InvProduct,
  type SimilarProduct,
  type StockRow,
} from "@/lib/erp/api-inventory"
import { errorMessage } from "@/lib/erp/finance-format"
import { canonicalUnit, productSimilarity } from "@/lib/erp/product-match"
import { unidadCorta } from "@/lib/erp/unidades"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { FormDialog, FormSection } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

interface MergeProductDialogProps {
  /** El producto que se queda. `null` = cerrado. */
  target: InvProduct | null
  products: InvProduct[]
  stock: StockRow[]
  onOpenChange: (open: boolean) => void
  onMerged: () => void
}

/**
 * "Fusionar producto": junta duplicados en el producto que se queda.
 *
 * Pasa, por ejemplo, cuando alguien creó a mano "Coca cola original" y una
 * factura leída por foto trajo "Coca cola regular friopack". Ofrece primero los
 * parecidos que encuentra el servidor y deja buscar cualquier otro. Solo se
 * pueden marcar productos de la misma unidad: las existencias se suman.
 *
 * El padre lo monta con `key` por producto, así cada apertura empieza limpia
 * sin reiniciar estado en un efecto.
 */
export function MergeProductDialog({
  target,
  products,
  stock,
  onOpenChange,
  onMerged,
}: MergeProductDialogProps) {
  const confirm = useConfirm()
  const [similar, setSimilar] = React.useState<{
    id: string
    rows: SimilarProduct[]
  } | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [query, setQuery] = React.useState("")
  const [merging, setMerging] = React.useState(false)

  const targetId = target?._id
  React.useEffect(() => {
    if (!targetId) return
    let cancelled = false
    getSimilarProducts(targetId)
      .then((rows) => {
        if (!cancelled) setSimilar({ id: targetId, rows })
      })
      .catch(() => {
        // Sin sugerencias igual se puede buscar a mano.
        if (!cancelled) setSimilar({ id: targetId, rows: [] })
      })
    return () => {
      cancelled = true
    }
  }, [targetId])

  if (!target) return null

  const loading = similar?.id !== target._id
  const suggestions = similar?.id === target._id ? similar.rows : []
  const suggestedIds = new Set(suggestions.map((s) => s.product._id))
  const q = query.trim().toLowerCase()
  const searchResults =
    q.length < 2
      ? []
      : products
          .filter(
            (p) =>
              p._id !== target._id &&
              p.active &&
              !suggestedIds.has(p._id) &&
              (p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)),
          )
          .slice(0, 8)

  function stockOf(id: string): number {
    return stock
      .filter((row) => row.product._id === id)
      .reduce((sum, row) => sum + row.qty, 0)
  }

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function renderRow(product: InvProduct, score?: number) {
    const sameUnit = canonicalUnit(product.unit) === canonicalUnit(target!.unit)
    return (
      <label
        key={product._id}
        className={cn(
          "flex items-start gap-3 rounded-lg border border-border px-3 py-2",
          sameUnit ? "cursor-pointer hover:bg-muted/40" : "opacity-60",
        )}
      >
        <Checkbox
          checked={selected.has(product._id)}
          disabled={!sameUnit || merging}
          onCheckedChange={(v) => toggle(product._id, v === true)}
          aria-label={`Fusionar ${product.name}`}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            {product.sku} · {nf.format(stockOf(product._id))}{" "}
            {unidadCorta(product.unit)} en stock
            {!sameUnit &&
              ` · Se mide en ${unidadCorta(product.unit)}: no se puede fusionar`}
          </span>
        </span>
        {score !== undefined && (
          <Badge variant="outline" className="shrink-0">
            {Math.round(score * 100)}% parecido
          </Badge>
        )}
      </label>
    )
  }

  async function handleMerge() {
    if (!target || selected.size === 0) return
    const names = [...suggestions.map((s) => s.product), ...products]
      .filter((p, i, all) => selected.has(p._id) && all.findIndex((x) => x._id === p._id) === i)
      .map((p) => `“${p.name}”`)
    const ok = await confirm({
      title: `¿Fusionar ${selected.size} producto(s) en “${target.name}”?`,
      description: `${names.join(", ")} pasarán a “${target.name}” sus existencias, lotes, recetas, compras abiertas y alias de proveedor, y quedarán inactivos. Las ventas y compras ya recibidas conservan su historial. No se deshace con un clic.`,
      confirmLabel: "Fusionar",
      destructive: true,
    })
    if (!ok) return

    setMerging(true)
    try {
      const result = await mergeProducts(target._id, [...selected])
      toast.success(
        `Fusionado en “${target.name}”: ${nf.format(result.stockMoved)} ${unidadCorta(target.unit)} trasladadas`,
      )
      onMerged()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setMerging(false)
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      size="2xl"
      icon={GitMerge}
      title="Fusionar productos"
      description={
        <>
          Marca los productos repetidos. Todo pasa a{" "}
          <strong>{target.name}</strong> y ellos quedan inactivos.
        </>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={merging}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleMerge()}
            disabled={selected.size === 0 || merging}
            className="sm:min-w-40"
          >
            {merging ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <GitMerge className="size-4" aria-hidden />
            )}
            {selected.size > 0 ? `Fusionar ${selected.size}` : "Fusionar"}
          </Button>
        </>
      }
    >
      <FormSection title="Se queda" boxed>
        <div className="flex flex-col">
          <span className="font-medium">{target.name}</span>
          <span className="text-xs text-muted-foreground">
            {target.sku} · {nf.format(stockOf(target._id))}{" "}
            {unidadCorta(target.unit)} en stock
          </span>
        </div>
      </FormSection>

      <FormSection
        title="Parecidos"
        description="Por nombre o código de barras. Revisa antes de marcar: no todo lo parecido es lo mismo (500 g y 1 kg son productos distintos)."
      >
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Buscando parecidos…
          </p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No encontramos productos parecidos. Búscalo abajo.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => renderRow(s.product, s.score))}
          </div>
        )}
      </FormSection>

      <FormSection title="Buscar otro">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o SKU"
            aria-label="Buscar otro producto para fusionar"
            className="pl-9"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((p) =>
              renderRow(p, productSimilarity(target.name, p.name) || undefined),
            )}
          </div>
        )}
      </FormSection>

      {selected.size > 0 && (
        <FormSection title="Qué va a pasar" boxed>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              Las existencias de cada sede se suman a “{target.name}” y el
              kardex de los dos registra la fusión.
            </li>
            <li>
              Recetas, empaques, compras y órdenes de producción abiertas y los
              alias de proveedor pasan a usar “{target.name}”.
            </li>
            <li>
              Ventas, devoluciones y compras ya recibidas no cambian: conservan
              su historial.
            </li>
            <li>Los fusionados quedan inactivos; no se borran.</li>
          </ul>
        </FormSection>
      )}
    </FormDialog>
  )
}
