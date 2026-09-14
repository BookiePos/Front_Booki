"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Una de las tres columnas del cobro.
 *
 * El cobro cabía antes en una columna de 512 px con catorce bloques apilados:
 * el cajero tenía que hacer scroll para llegar a la devuelta y el ticket de lo
 * que estaba cobrando quedaba detrás del velo, así que cobraba a ciegas. Con
 * tres columnas cada pregunta tiene su sitio —qué cobro, cómo paga, de quién
 * es la venta— y ninguna tapa a la otra.
 *
 * La columna scrollea SOLA en escritorio (`lg:`) y en móvil no: ahí las tres se
 * apilan y quien hace scroll es el cuerpo del modal. Dos scrolls anidados en
 * una pantalla de teléfono es la forma más rápida de perder el botón de cobrar.
 */
export function CheckoutColumn({
  title,
  icon: Icon,
  /** Dato de una línea a la derecha del título (el número de ítems, la sede). */
  hint,
  children,
  /** Pie que NO se mueve al scrollear: el total de la columna izquierda. */
  footer,
  className,
}: {
  title: string
  icon?: React.ElementType
  hint?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col lg:min-h-0 lg:overflow-hidden",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/45 px-4 py-2.5">
        {Icon && (
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <h3 className="text-[0.8125rem] font-bold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {hint && (
          <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </header>
      <div className="flex flex-col gap-3 px-4 py-3.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        {children}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-3">
          {footer}
        </div>
      )}
    </section>
  )
}

/**
 * Bloque plegable de la columna derecha, con resumen de una línea.
 *
 * Es la respuesta al "tenemos demasiadas opciones": siguen estando todas, pero
 * la que no se toca en esta venta ocupa un renglón que además dice cómo quedó
 * ("Consumidor final", "Mostrador"). Ver el estado sin abrir el bloque es lo
 * que evita el gesto de abrirlo solo para comprobar que estaba bien.
 *
 * `forceOpen` es para cuando el bloque pide un dato sin el que no se puede
 * cobrar —un domicilio sin dirección, una factura sin cédula—: ahí desaparece
 * el plegado, porque dejar esconder el campo que bloquea el botón de cobrar es
 * dejar al cajero adivinando por qué no puede cobrar.
 */
export function CheckoutGroup({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  forceOpen = false,
  /**
   * Estado de fuera, para el bloque cuyo abrir/cerrar significa algo más que
   * mostrar campos (el de empaque extra dispara la carga del inventario).
   */
  open: openProp,
  onOpenChange,
  /** Aviso corto junto al título cuando el bloque está abierto a la fuerza. */
  requiredHint,
  children,
}: {
  title: string
  icon?: React.ElementType
  summary?: React.ReactNode
  defaultOpen?: boolean
  forceOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  requiredHint?: React.ReactNode
  children: React.ReactNode
}) {
  const [interno, setInterno] = React.useState(defaultOpen)
  const abierto = openProp ?? interno
  const open = abierto || forceOpen

  function setAbierto(siguiente: (v: boolean) => boolean) {
    const valor = siguiente(abierto)
    if (openProp === undefined) setInterno(valor)
    onOpenChange?.(valor)
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        forceOpen ? "border-primary/45" : "border-border",
      )}
    >
      {forceOpen ? (
        <div className="flex items-center gap-2 px-3 py-2.5">
          {Icon && (
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1 text-[0.8125rem] font-semibold text-foreground">
            {title}
          </span>
          {requiredHint && (
            <span className="shrink-0 text-xs font-medium text-primary">
              {requiredHint}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setAbierto((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
        >
          {Icon && (
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] font-semibold text-foreground">
              {title}
            </span>
            {!open && summary && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      )}

      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3">
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * Botonera de una sola elección (medio de pago, tipo de pedido, cómo se paga
 * la cuenta). Antes cada una repetía las mismas doce clases con un `cn` a mano
 * y ninguna quedaba del mismo alto que la de al lado.
 *
 * `size="lg"` es la del medio de pago: se pulsa con prisa y con el cliente
 * delante, así que va con icono, a 64 px y sin miedo a ocupar sitio.
 */
export function OptionGroup<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  columns = 2,
  ariaLabel,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly {
    value: T
    label: string
    icon?: React.ElementType
    hint?: string
  }[]
  size?: "sm" | "lg"
  columns?: 2 | 3 | 4
  ariaLabel?: string
  className?: string
}) {
  const cols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[columns]

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-1 rounded-xl border border-border bg-muted p-1",
        cols,
        className,
      )}
    >
      {options.map((o) => {
        const Icon = o.icon
        const activo = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
              size === "lg"
                ? "h-16 flex-col gap-1 px-1 text-[0.8125rem]"
                : "px-2 py-1.5 text-xs",
              activo
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && (
              <Icon
                className={cn(size === "lg" ? "size-6" : "size-4")}
                aria-hidden
              />
            )}
            <span className="max-w-full truncate leading-tight">{o.label}</span>
            {size === "lg" && o.hint && (
              <span className="max-w-full truncate text-[10px] font-normal opacity-70">
                {o.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Fila del desglose de la venta: concepto a la izquierda, cifra a la derecha. */
export function SummaryRow({
  label,
  value,
  tone = "muted",
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: "muted" | "positive" | "strong"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
      <span
        className={cn(
          tone === "strong" ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          tone === "positive" && "font-medium text-success-ink",
          tone === "strong" && "font-medium text-foreground",
          tone === "muted" && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}
