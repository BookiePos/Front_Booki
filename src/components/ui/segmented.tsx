"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  icon?: React.ElementType
  /** Contador a la derecha del rótulo (nº de filas, alertas…). */
  badge?: React.ReactNode
  /** Texto accesible cuando el rótulo visible es solo un icono. */
  srLabel?: string
  disabled?: boolean
}

/**
 * Control segmentado: dos o tres opciones excluyentes, todas a la vista.
 *
 * Se prefiere a un menú desplegable siempre que las opciones quepan: enseña de
 * un vistazo qué hay y cambia en un solo toque, mientras que un desplegable
 * cuesta dos y esconde las alternativas. Ese fue justo el problema del selector
 * de tema, que obligaba a abrir un menú para descubrir que existía "seguir al
 * sistema".
 *
 * Semántica de radiogroup (no de pestañas) porque lo que hay debajo no siempre
 * es un panel: a veces es un filtro. Se navega con flechas, como manda el
 * patrón APG, y solo la opción activa entra en el orden de tabulación.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  ariaLabel,
  className,
  fill = false,
}: {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: "sm" | "md" | "lg"
  ariaLabel: string
  className?: string
  /** Reparte el ancho disponible entre las opciones (útil en móvil). */
  fill?: boolean
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const box = {
    sm: "gap-0.5 rounded-lg p-0.5",
    md: "gap-0.5 rounded-lg p-[3px]",
    lg: "gap-1 rounded-xl p-1",
  }[size]

  const item = {
    sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
    md: "h-8 gap-2 rounded-md px-3 text-[0.8125rem]",
    lg: "h-10 gap-2 rounded-lg px-4 text-sm",
  }[size]

  const glyph = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-4.5",
  }[size]

  function move(from: number, delta: number) {
    const enabled = options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled)
    if (enabled.length === 0) return
    const at = enabled.findIndex(({ i }) => i === from)
    const next = enabled[(at + delta + enabled.length) % enabled.length]
    onValueChange(next.o.value)
    refs.current[next.i]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center border border-border bg-muted/70 shadow-inner",
        box,
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.srLabel}
            disabled={option.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault()
                move(index, 1)
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                move(index, -1)
              }
            }}
            className={cn(
              "inline-flex shrink-0 items-center justify-center whitespace-nowrap outline-none",
              "transition-[background-color,color,box-shadow] duration-150",
              "focus-visible:ring-3 focus-visible:ring-ring/45",
              "disabled:pointer-events-none disabled:opacity-45",
              item,
              fill && "flex-1",
              active
                ? "bg-card text-foreground font-medium shadow-[0_1px_2px_rgba(20,16,30,0.08),0_0_0_1px_rgba(20,16,30,0.04)] dark:bg-accent dark:shadow-none"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && (
              <Icon
                className={cn(glyph)}
                aria-hidden
              />
            )}
            {option.label}
            {option.badge != null && (
              <span
                className={cn(
                  "ml-0.5 text-[0.75rem] font-medium tabular-nums",
                  active
                    ? "text-muted-foreground"
                    : "text-muted-foreground/80",
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
