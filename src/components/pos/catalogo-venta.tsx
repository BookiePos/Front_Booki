"use client"

import * as React from "react"
import Image from "next/image"
import { Search, PackageX, AlertTriangle, ImageOff } from "lucide-react"
import { type PosProduct } from "@/lib/pos/api-sales"
import { money, qty as fmtQty } from "@/lib/pos/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AyudaAtajos } from "@/components/pos/ayuda-atajos"
import { type VariantGroup } from "@/components/pos/variant-picker"
import { cn } from "@/lib/utils"
import {
  CartItem,
  ALL,
  LOW_STOCK,
  type GridEntry,
} from "@/components/pos/venta-helpers"
import { Atajo, CategoryChip } from "@/components/pos/venta-ui"
import { VariantGroupCard } from "@/components/pos/variant-group-card"

interface CatalogoVentaProps {
  products: PosProduct[]
  loading: boolean
  error: string | null
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  category: string
  setCategory: React.Dispatch<React.SetStateAction<string>>
  searchRef: React.RefObject<HTMLInputElement | null>
  flash: string | null
  cart: CartItem[]
  ayudaAbierta: boolean
  setAyudaAbierta: React.Dispatch<React.SetStateAction<boolean>>
  stockSummary: { out: number; low: number; }
  categories: { id: string; name: string; }[]
  addToCart: (p: PosProduct) => void
  handleScan: () => void
  filtered: PosProduct[]
  showImages: boolean
  gridEntries: GridEntry[]
  setPickerGroup: React.Dispatch<React.SetStateAction<VariantGroup | null>>
}

export function CatalogoVenta({
  products,
  loading,
  error,
  search,
  setSearch,
  category,
  setCategory,
  searchRef,
  flash,
  cart,
  ayudaAbierta,
  setAyudaAbierta,
  stockSummary,
  categories,
  addToCart,
  handleScan,
  filtered,
  showImages,
  gridEntries,
  setPickerGroup,
}: CatalogoVentaProps) {
  return (
    <div className="flex flex-col gap-3 lg:col-span-2 2xl:col-span-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          data-tour="pos-buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleScan()
            }
          }}
          placeholder="Escanea un código o busca por nombre / SKU…"
          className="h-11 pl-9"
          aria-label="Buscar o escanear producto"
        />
        {flash && (
          <span
            role="status"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {flash}
          </span>
        )}
      </div>

      {/* Filtro por categoría, y a su derecha —donde antes solo había aire
          en un monitor ancho— los dos atajos que ya existen y que casi
          nadie descubre solo. */}
      <div className="flex items-center gap-3">
        {categories.length > 0 && (
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
            <CategoryChip
              active={category === ALL}
              onClick={() => setCategory(ALL)}
            >
              Todos
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </CategoryChip>
            ))}
          </div>
        )}
        <p className="ml-auto hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground xl:flex">
          <Atajo tecla="Enter">agrega lo escaneado</Atajo>
          <Atajo tecla="Ctrl K">busca en todo el terminal</Atajo>
          <Atajo tecla="F2">busca</Atajo>
          <Atajo tecla="F4">cobra</Atajo>
        </p>
        <div className="ml-auto shrink-0 xl:ml-0">
          <AyudaAtajos open={ayudaAbierta} onOpenChange={setAyudaAbierta} />
        </div>
      </div>

      {/* Aviso de existencias (agotados / pocas unidades) */}
      {!loading && !error && (stockSummary.out > 0 || stockSummary.low > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {stockSummary.out > 0 &&
              `${stockSummary.out} producto(s) sin stock`}
            {stockSummary.out > 0 && stockSummary.low > 0 && " · "}
            {stockSummary.low > 0 &&
              `${stockSummary.low} con pocas unidades`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <PackageX className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {products.length === 0
                ? "No hay productos con precio de venta en esta sede."
                : "Sin resultados para esta búsqueda o categoría."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
          {gridEntries.map((entry) => {
            // Un grupo de variantes ocupa UNA casilla y abre el selector de
            // talla; el resto de productos se pintan como siempre.
            if (entry.kind === "group") {
              return (
                <VariantGroupCard
                  key={entry.group.groupId}
                  group={entry.group}
                  showImages={showImages}
                  inCart={entry.group.variants.reduce(
                    (n, v) =>
                      n +
                      (cart.find((i) => i.product._id === v._id)?.qty ?? 0),
                    0,
                  )}
                  onOpen={() => setPickerGroup(entry.group)}
                />
              )
            }
            const p = entry.product
            const inCart =
              cart.find((i) => i.product._id === p._id)?.qty ?? 0
            const out = p.stock <= 0 || inCart >= p.stock
            return (
              <button
                key={p._id}
                type="button"
                disabled={out}
                onClick={() => addToCart(p)}
                className={cn(
                  "group relative flex flex-col items-start gap-0.5 rounded-xl border border-border bg-card p-2.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0",
                  out &&
                    "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-xs",
                )}
              >
                {inCart > 0 && (
                  <span className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {inCart}
                  </span>
                )}
                {showImages &&
                  (p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      width={200} height={200} sizes="(min-width: 1024px) 160px, 30vw"
                      alt=""
                      loading="lazy"
                      className="mb-1 aspect-square w-full rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="mb-1 flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <ImageOff className="size-6" aria-hidden />
                    </span>
                  ))}
                {/* `text-balance` reparte el nombre entre los dos renglones
                    en vez de dejar la primera palabra sola arriba, que es
                    lo que pasaba con las tarjetas anchas. */}
                <span className="line-clamp-2 w-full pr-5 text-[0.8125rem] font-medium leading-snug text-balance">
                  {p.name}
                </span>
                <span className="flex w-full min-w-0 items-baseline gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <span className="truncate">{p.sku}</span>
                  {/* Las existencias que no son aviso solo caben en pantalla
                      ancha; ahí es dato útil, en móvil sería ruido. */}
                  {p.stock >= LOW_STOCK && (
                    <span className="ml-auto hidden shrink-0 tabular-nums xl:inline">
                      {fmtQty(p.stock)} {p.unit}
                    </span>
                  )}
                </span>
                <span className="mt-1 flex w-full flex-wrap items-center justify-between gap-1">
                  <span className="font-display text-lg">
                    {money(p.salePrice)}
                  </span>
                  {/* Solo se avisa el stock si quedan pocas unidades (<10). */}
                  {p.stock <= 0 ? (
                    <Badge variant="destructive">Agotado</Badge>
                  ) : p.stock < LOW_STOCK ? (
                    <Badge className="border-transparent bg-warning/15 text-warning-ink">
                      Quedan {fmtQty(p.stock)}
                    </Badge>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
