"use client"

import Image from "next/image"
import { Layers } from "lucide-react"
import { money } from "@/lib/pos/format"
import { Badge } from "@/components/ui/badge"
import {
  axesOf,
  axisLabel,
  sortVariants,
  variantLabel,
  type VariantGroup,
} from "@/components/pos/variant-picker"
import { cn } from "@/lib/utils"

/**
 * Tarjeta de un producto con variantes (una camisa y sus tallas).
 *
 * Enseña de qué producto se trata, cuántas tallas quedan con existencias y
 * desde qué precio; el detalle se elige en el selector. Se distingue de una
 * tarjeta normal por el galón de "tallas" y el borde teñido: pulsarla NO
 * agrega nada a la cuenta todavía, y eso hay que verlo antes de tocarla.
 *
 * Comparte maquetación con las tarjetas sueltas de la rejilla a propósito: en
 * una caja, dos tarjetas que se comportan distinto pero se ven iguales son un
 * error esperando a pasar.
 */
export function VariantGroupCard({
  group,
  inCart,
  showImages,
  onOpen,
}: {
  group: VariantGroup
  /** Unidades de cualquier talla de este grupo ya en la cuenta. */
  inCart: number
  showImages: boolean
  onOpen: () => void
}) {
  const ordenadas = sortVariants(group.variants)
  const disponibles = ordenadas.filter((v) => v.stock > 0)
  const agotado = disponibles.length === 0
  const desde = Math.min(...group.variants.map((v) => v.salePrice))
  const variosPrecios = new Set(group.variants.map((v) => v.salePrice)).size > 1
  const foto = group.variants.find((v) => v.imageUrl)?.imageUrl ?? null
  const ejes = axesOf(group.variants)
  const eje = ejes.length === 1 ? ejes[0] : "variante"

  return (
    <button
      type="button"
      disabled={agotado}
      onClick={onOpen}
      aria-label={`${group.name}: elegir ${eje.toLowerCase()}`}
      className={cn(
        "group relative flex flex-col items-start gap-0.5 rounded-xl border border-primary/30 bg-card p-2.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm active:translate-y-0",
        agotado &&
          "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-xs",
      )}
    >
      {inCart > 0 && (
        <span className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {inCart}
        </span>
      )}
      {showImages &&
        (foto ? (
          <Image
            src={foto}
            width={200} height={200} sizes="(min-width: 1024px) 160px, 30vw"
            alt=""
            loading="lazy"
            className="mb-1 aspect-square w-full rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="mb-1 flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <Layers className="size-6" aria-hidden />
          </span>
        ))}
      <span className="flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-bold text-primary">
        <Layers className="size-3" aria-hidden />
        {group.variants.length} {axisLabel(eje, group.variants.length)}
      </span>
      <span className="line-clamp-2 w-full pr-5 text-[0.8125rem] font-medium leading-snug text-balance">
        {group.name}
      </span>
      <span className="line-clamp-1 w-full text-[11px] text-muted-foreground">
        {disponibles.length > 0
          ? disponibles.slice(0, 6).map(variantLabel).join(" · ")
          : "Sin existencias"}
      </span>
      <span className="mt-1 flex w-full flex-wrap items-center justify-between gap-1">
        <span className="font-display text-lg">
          {variosPrecios ? `desde ${money(desde)}` : money(desde)}
        </span>
        {agotado ? (
          <Badge variant="destructive">Agotado</Badge>
        ) : disponibles.length < group.variants.length ? (
          <Badge className="border-transparent bg-warning/15 text-warning-ink">
            {disponibles.length}/{group.variants.length}
          </Badge>
        ) : null}
      </span>
    </button>
  )
}
