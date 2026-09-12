"use client"

import * as React from "react"
import { CircleQuestionMark } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  GLOSARIO,
  resolverTermino,
  type TerminoGlosario,
} from "@/lib/glosario"
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
 * Contenido de la burbuja: título arriba, explicación debajo.
 *
 * Lo comparten `HelpTip` (la interrogación junto a una etiqueta) y `Termino`
 * (la palabra subrayada dentro de un texto) para que la misma palabra se
 * explique igual la encuentres donde la encuentres.
 */
function FichaGlosario({
  titulo,
  texto,
}: {
  titulo: string
  texto: React.ReactNode
}) {
  return (
    <span className="block">
      <span className="block text-[0.8125rem] leading-tight font-bold tracking-[-0.01em] text-foreground">
        {titulo}
      </span>
      <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
        {texto}
      </span>
    </span>
  )
}

/**
 * Las tres entradas de una ayuda que tiene que funcionar en mostrador.
 *
 * El Tooltip de Base UI engancha el hover con `mouseOnly: true`, así que en un
 * celular —donde no hay hover— nunca se abriría; y el comerciante que está de
 * pie con la tablet es justo quien más necesita la explicación. Llevando `open`
 * nosotros conseguimos las tres:
 *   • mouse   → hover, que lo abre el propio Tooltip;
 *   • teclado → foco visible, que también lo abre el propio Tooltip;
 *   • táctil  → `onClick`, que alterna el estado (un tap dispara click).
 *
 * `closeOnClick={false}` es imprescindible: por defecto el Tooltip se cierra al
 * pulsar el disparador, y esa cerrada pelearía con nuestro toggle dejando la
 * burbuja parpadeando en el primer tap. El cierre táctil lo sigue dando el
 * `useDismiss` interno (tocar fuera o pulsar Escape).
 */
function useAperturaTactil() {
  const [abierto, setAbierto] = React.useState(false)
  return {
    abierto,
    setAbierto,
    props: {
      closeOnClick: false as const,
      delay: 120,
      closeDelay: 0,
      onClick: () => setAbierto((v) => !v),
    },
  }
}

/**
 * Interrogación de ayuda junto a una etiqueta técnica (SKU, IVA, lote…).
 *
 * Se prefirió a un Popover porque el Popover mueve el foco dentro de la burbuja
 * al abrirse: para un texto de dos frases que no tiene nada pulsable, eso le
 * roba el sitio al teclado y obliga a pulsar Escape para seguir llenando el
 * formulario.
 */
export function HelpTip({
  term,
  title,
  children,
  side = "top",
  className,
}: HelpTipProps) {
  const { abierto, setAbierto, props } = useAperturaTactil()

  const entrada = term ? GLOSARIO[term] : undefined
  const titulo = entrada ? entrada.titulo : (title as string)
  const texto: React.ReactNode = entrada ? entrada.texto : children

  return (
    <Tooltip open={abierto} onOpenChange={setAbierto}>
      <TooltipTrigger
        type="button"
        {...props}
        aria-label={`Qué significa ${titulo}`}
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
        variant="card"
        className="block max-w-72 px-3.5 py-3 text-left"
      >
        <FichaGlosario titulo={titulo} texto={texto} />
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * La palabra rara, explicada donde aparece.
 *
 * `HelpTip` resuelve la etiqueta de un campo, pero la mitad del vocabulario
 * difícil no está en un formulario: está en la cabecera de una tabla («Kárdex»,
 * «Devengado»), en una insignia («FEFO»), en el título de una pantalla («CxP»).
 * Ahí no cabe una interrogación al lado de cada palabra sin ensuciar la
 * pantalla, así que la marca es la palabra misma: subrayado punteado discreto y
 * la misma ficha al pasar el mouse, enfocar con el teclado o tocarla.
 *
 * Uso normal — el término se deduce del propio texto:
 *   <Termino>Kárdex</Termino>
 *   <Termino>Devengado</Termino>
 *
 * Y si la palabra escrita no coincide con ninguna del glosario, se nombra:
 *   <Termino term="cxp">Por pagar</Termino>
 *
 * Si el término no existe, no falla ni pinta nada raro: devuelve el texto tal
 * cual. Así se puede envolver vocabulario sin miedo a romper una pantalla.
 */
export function Termino({
  term,
  children,
  side = "top",
  className,
}: {
  /** Clave del glosario. Si se omite, se busca por el texto de `children`. */
  term?: TerminoGlosario
  children: React.ReactNode
  side?: LadoHelpTip
  className?: string
}) {
  const { abierto, setAbierto, props } = useAperturaTactil()

  // El texto visible sirve de clave cuando no se pasa `term`: <Termino>Kárdex</Termino>.
  const literal = typeof children === "string" ? children : undefined
  const clave = term ?? (literal ? resolverTermino(literal) : undefined)

  if (!clave) return <>{children}</>

  const entrada = GLOSARIO[clave]

  return (
    <Tooltip open={abierto} onOpenChange={setAbierto}>
      <TooltipTrigger
        type="button"
        {...props}
        aria-label={`${literal ?? entrada.titulo}: qué significa`}
        className={cn(
          // Subrayado punteado en vez de un icono: marca la palabra sin robarle
          // sitio a la fila de una tabla ni romper el renglón de un párrafo.
          // `decoration-from-font` lo baja a la línea base de la tipografía, que
          // es lo que evita que corte las colas de la "p" y la "g".
          "cursor-help font-[inherit] text-[inherit] underline decoration-primary/40 decoration-dotted decoration-from-font underline-offset-[0.22em] outline-none transition-colors",
          "hover:decoration-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        variant="card"
        className="block max-w-72 px-3.5 py-3 text-left"
      >
        <FichaGlosario titulo={entrada.titulo} texto={entrada.texto} />
      </TooltipContent>
    </Tooltip>
  )
}
