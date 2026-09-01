"use client"

import * as React from "react"
import { CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { HelpTip, type HelpTipProps } from "@/components/ui/help-tip"

/**
 * Campo de formulario: etiqueta, ayuda, control, pista y error.
 *
 * Antes cada ficha montaba a mano un `div` con `flex flex-col gap-1.5`, un
 * `Label` y el control. Salía bien mientras el campo no necesitara nada más;
 * en cuanto hacía falta explicar qué es un SKU o avisar de un valor inválido,
 * cada pantalla lo resolvía distinto y ninguna quedaba igual que la de al
 * lado. Aquí está resuelto una vez: la pista va SIEMPRE debajo del control
 * (leerla antes de saber qué se pide no ayuda) y el error la sustituye, para
 * no apilar dos líneas de texto pequeño que compiten.
 *
 * El `id` se propaga al control con `htmlFor` + `aria-describedby`, así que el
 * lector de pantalla anuncia etiqueta, pista y error como un solo campo.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  help,
  className,
  children,
}: {
  /** Id del control. Necesario para que la etiqueta lo enfoque al pulsarla. */
  id?: string
  label: React.ReactNode
  /** Explicación corta bajo el campo ("Se genera solo si lo dejas vacío"). */
  hint?: React.ReactNode
  /** Mensaje de validación. Sustituye a la pista mientras esté presente. */
  error?: string | null
  required?: boolean
  /** Interrogación de ayuda junto a la etiqueta (glosario o texto suelto). */
  help?: HelpTipProps
  className?: string
  children: React.ReactNode
}) {
  const describedBy = error
    ? `${id ?? ""}-error`
    : hint
      ? `${id ?? ""}-hint`
      : undefined

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
        {help && <HelpTip {...help} />}
      </Label>

      {/* El control se clona solo si es un elemento: así `Field` sirve igual
          para un Input, un Select de Base UI o un bloque compuesto. */}
      {React.isValidElement(children) && describedBy
        ? React.cloneElement(
            children as React.ReactElement<{
              "aria-describedby"?: string
              "aria-invalid"?: boolean
            }>,
            {
              "aria-describedby": describedBy,
              ...(error ? { "aria-invalid": true } : {}),
            },
          )
        : children}

      {error ? (
        <p
          id={`${id ?? ""}-error`}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id ?? ""}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Rejilla de campos. `cols` es el máximo en escritorio; siempre arranca en una
 * sola columna, que es como se rellena un formulario en un celular.
 */
export function FieldGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const grid = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols]
  return (
    <div className={cn("grid grid-cols-1 gap-x-4 gap-y-3.5", grid, className)}>
      {children}
    </div>
  )
}
