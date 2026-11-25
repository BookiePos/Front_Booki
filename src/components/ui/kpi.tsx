import * as React from "react"

import { cn } from "@/lib/utils"

export type KpiTono = "default" | "positive" | "negative" | "warning"

/**
 * Cifra de resumen de una página (sistema "Libro").
 *
 * Había 18 versiones locales de esta pieza, cada una con su tarjeta, su icono
 * y su color: en Gastos tres de cuatro cifras salían en morado sin significar
 * nada. Ahora todas son la misma: rótulo, cifra en tinta y una nota opcional.
 * El color solo aparece cuando dice algo (vencido en rojo, a favor en verde,
 * por atender en ámbar).
 *
 * Va sin tarjeta propia. Cuando varias van juntas en una rejilla, la regla
 * `[data-kpi]` de globals.css convierte esa rejilla en una sola franja
 * dividida por líneas de 1 px, sin tocar el marcado de cada página.
 *
 * `icon` se acepta por compatibilidad y no se pinta: el rótulo ya dice qué es.
 */
export function KpiCelda({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: KpiTono
  icon?: React.ElementType
  className?: string
}) {
  return (
    <div data-kpi className={cn("flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5", className)}>
      <span className="truncate text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] tabular-nums",
          tone === "positive" && "text-success-ink",
          tone === "negative" && "text-destructive-ink",
          tone === "warning" && "text-warning-ink",
        )}
      >
        {value}
      </span>
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}
