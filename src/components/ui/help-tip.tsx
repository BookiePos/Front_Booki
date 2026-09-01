"use client"

import * as React from "react"
import { CircleQuestionMark } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GLOSARIO, type TerminoGlosario } from "@/lib/glosario"
import { cn } from "@/lib/utils"

type LadoHelpTip = "top" | "bottom" | "left" | "right"

interface PropsComunes {
  /** Por dónde sale la burbuja. Arriba por defecto. */
  side?: LadoHelpTip
  /** Clases extra para el botón (no para la burbuja). */
  className?: string
}

/**
 * Dos formas de usarlo, excluyentes entre sí:
 * - `term`: toma título y texto del glosario (se valida en compilación).
 * - `title` + `children`: explicación suelta, para lo que no está en el glosario.
 */
export type HelpTipProps =
  | (PropsComunes & {
      term: TerminoGlosario
      title?: never
      children?: never
    })
  | (PropsComunes & {
      term?: never
      title: string
      children: React.ReactNode
    })

/**
 * Interrogación de ayuda junto a una etiqueta técnica (SKU, IVA, lote…).
 *
 * Por qué es un Tooltip *controlado* y no el Tooltip suelto:
 * el Tooltip de Base UI engancha el hover con `mouseOnly: true`, así que en un
 * celular —donde no hay hover— nunca se abriría; y el comerciante que está de
 * pie en el mostrador con la tablet es justo quien más necesita la explicación.
 * Llevando `open` nosotros conseguimos las tres entradas:
 *   • mouse  → hover, que lo abre el propio Tooltip;
 *   • teclado→ foco visible, que también lo abre el propio Tooltip;
 *   • táctil → `onClick`, que alterna el estado (un tap dispara click).
 * `closeOnClick={false}` es imprescindible: por defecto el Tooltip se cierra al
 * pulsar el disparador, y esa cerrada pelearía con nuestro toggle dejando la
 * burbuja parpadeando en el primer tap. El cierre táctil lo sigue dando el
 * `useDismiss` interno (tocar fuera o pulsar Escape).
 *
 * Se prefirió esto a un Popover porque el Popover mueve el foco dentro de la
 * burbuja al abrirse: para un texto de dos frases que no tiene nada pulsable,
 * eso le roba el sitio al teclado y obliga a pulsar Escape para seguir
 * llenando el formulario.
 */
export function HelpTip({
  term,
  title,
  children,
  side = "top",
  className,
}: HelpTipProps) {
  const [abierto, setAbierto] = React.useState(false)

  const entrada = term ? GLOSARIO[term] : undefined
  const titulo = entrada ? entrada.titulo : (title as string)
  const texto: React.ReactNode = entrada ? entrada.texto : children

  return (
    <Tooltip open={abierto} onOpenChange={setAbierto}>
      <TooltipTrigger
        type="button"
        // Sin esto el propio Tooltip cerraría al pulsar y anularía el toggle
        // táctil de `onClick`. Ver la nota de arriba.
        closeOnClick={false}
        delay={120}
        closeDelay={0}
        aria-label={`Qué significa ${titulo}`}
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          // El icono mide 14 px para no competir con la etiqueta, pero el área
          // pulsable se agranda con un ::after invisible hasta ~24 px, que es
          // el mínimo táctil (WCAG 2.5.8) — y no ocupa sitio en el layout.
          "relative inline-flex size-3.5 shrink-0 items-center justify-center rounded-full align-middle text-primary/70 outline-none transition-colors after:absolute after:-inset-[5px] after:content-[''] hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        <CircleQuestionMark className="size-3.5" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="block max-w-64 px-3 py-2 text-left text-xs"
      >
        <span className="block font-semibold">{titulo}</span>
        <span className="mt-1 block leading-relaxed">{texto}</span>
      </TooltipContent>
    </Tooltip>
  )
}
