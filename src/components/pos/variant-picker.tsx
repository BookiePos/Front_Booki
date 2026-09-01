"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Check, Layers, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PosProduct } from "@/lib/pos/api-sales"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/** Todas las variantes de un mismo producto padre (una camisa y sus tallas). */
export interface VariantGroup {
  groupId: string
  name: string
  variants: PosProduct[]
}

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const money = (n: number) => moneyFmt.format(n)

/**
 * Etiqueta corta de una variante: "M", "M · Rojo", o el nombre completo si no
 * trae atributos (producto creado antes de que existieran las variantes).
 */
export function variantLabel(p: PosProduct): string {
  const attrs = p.variantAttrs
  if (attrs && Object.keys(attrs).length > 0) {
    return Object.values(attrs).filter(Boolean).join(" · ")
  }
  return p.name
}

/** Nombres de los ejes del grupo (Talla, Color…), en orden de aparición. */
export function axesOf(variants: PosProduct[]): string[] {
  const declarados = variants.find((v) => v.variantAxes?.length)?.variantAxes
  if (declarados?.length) return declarados.map((a) => a.name)
  const names: string[] = []
  for (const v of variants) {
    for (const key of Object.keys(v.variantAttrs ?? {})) {
      if (!names.includes(key)) names.push(key)
    }
  }
  return names
}

/**
 * Ordena las variantes como se dieron de alta: XS, S, M, L, XL, XXL.
 *
 * El catálogo llega ordenado por nombre, y por nombre una talla queda
 * "L · M · S · XL": correcto para una máquina, absurdo para quien busca una M.
 * El orden bueno es el de `variantAxes` del producto padre, que es el que
 * escribió el comerciante. Si por lo que sea no viene (producto creado antes de
 * que existieran los ejes), se cae al orden alfabético de siempre.
 */
export function sortVariants(variants: PosProduct[]): PosProduct[] {
  const ejes = variants.find((v) => v.variantAxes?.length)?.variantAxes
  if (!ejes?.length) return variants

  const rank = (p: PosProduct) => {
    const attrs = p.variantAttrs ?? {}
    // Peso posicional: el primer eje manda, el segundo desempata, etc.
    return ejes.reduce((acc, eje) => {
      const at = eje.values.indexOf(attrs[eje.name] ?? "")
      return acc * 1000 + (at < 0 ? 999 : at)
    }, 0)
  }

  return [...variants].sort((a, b) => rank(a) - rank(b))
}

/**
 * "6 tallas", "3 colores", "4 variantes". El plural se hace a mano porque el
 * nombre del eje lo escribe el comerciante y puede ser cualquier cosa.
 */
export function axisLabel(name: string | undefined, count: number): string {
  const base = (name ?? "variante").toLowerCase()
  if (count === 1) return base
  if (base.endsWith("s") || base.endsWith("x")) return base
  if (/[aeiou]$/.test(base)) return base + "s"
  return base + "es"
}

/**
 * Selector de talla del POS.
 *
 * Sin esto, una camisa con cinco tallas y tres colores metía quince tarjetas
 * casi idénticas en la rejilla y el cajero tenía que leerse el final del nombre
 * de cada una para dar con la que le pedían. Aquí el producto es UNA tarjeta y
 * la talla se elige en un paso, con las existencias de cada una a la vista: lo
 * agotado no se puede pulsar, que es la mitad del trabajo en una tienda de
 * ropa.
 *
 * Los botones son grandes a propósito (48 px de alto): esto se usa con el dedo
 * sobre el mostrador y con el cliente delante esperando.
 */
export function VariantPicker({
  group,
  open,
  onOpenChange,
  inCartByProduct,
  onPick,
}: {
  group: VariantGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Unidades ya en la cuenta, por id de vendible. */
  inCartByProduct: Map<string, number>
  onPick: (product: PosProduct) => void
}) {
  if (!group) return null

  const axes = axesOf(group.variants)
  const orden = sortVariants(group.variants)
  // Con un solo eje (el caso de la talla) los botones caben de tres en tres.
  // Con dos o más, cada botón enseña la combinación completa ("XL · Azul") y
  // necesita más ancho.
  const single = axes.length <= 1
  const disponibles = group.variants.filter((v) => v.stock > 0).length
  const precios = new Set(group.variants.map((v) => v.salePrice))
  const desde = Math.min(...group.variants.map((v) => v.salePrice))

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-brand-950/45 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs dark:bg-navy-950/70" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-3xl border border-border bg-card shadow-xl",
            "transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <header className="flex items-start gap-3 border-b border-border bg-primary/[0.055] px-5 py-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/12 text-primary">
              <Layers className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-lg leading-tight">
                {group.name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                Elige{" "}
                {axes.length > 0 ? axes.join(" y ").toLowerCase() : "la variante"}
                {" · "}
                {disponibles} de {group.variants.length} con existencias
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cerrar"
                  className="-mr-1.5 text-muted-foreground"
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div
              className={cn(
                "grid gap-2",
                single
                  ? "grid-cols-3 sm:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {orden.map((v) => {
                const enCuenta = inCartByProduct.get(v._id) ?? 0
                const agotado = v.stock <= 0 || enCuenta >= v.stock
                return (
                  <button
                    key={v._id}
                    type="button"
                    disabled={agotado}
                    onClick={() => {
                      onPick(v)
                      onOpenChange(false)
                    }}
                    className={cn(
                      "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2.5 text-center outline-none transition-all",
                      "focus-visible:ring-3 focus-visible:ring-ring/45",
                      agotado
                        ? "cursor-not-allowed border-border bg-muted/50 opacity-55"
                        : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/6 hover:shadow-md active:translate-y-0",
                    )}
                  >
                    {enCuenta > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] font-bold text-primary-foreground shadow-sm">
                        {enCuenta}
                      </span>
                    )}
                    <span className="text-sm leading-tight font-bold">
                      {variantLabel(v)}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {agotado ? "Agotado" : `${v.stock} disp.`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
            <span className="flex items-center gap-2">
              <span className="stat-figure text-base text-foreground">
                {money(desde)}
              </span>
              {precios.size > 1 && (
                <Badge variant="outline">varios precios</Badge>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" aria-hidden />
              Se agrega a la cuenta al elegir
            </span>
          </footer>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
