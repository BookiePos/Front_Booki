"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Etiqueta de campo.
 *
 * `required` pinta el asterisco de obligatorio con su texto accesible: un `*`
 * suelto no lo anuncia ningún lector de pantalla, y "opcional / obligatorio" es
 * justo lo que hay que saber antes de escribir, no después de que el
 * formulario rebote.
 */
function Label({
  className,
  children,
  required = false,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-[0.8125rem] leading-none font-semibold text-foreground select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive" aria-hidden>
          *
        </span>
      )}
      {required && <span className="sr-only">(obligatorio)</span>}
    </label>
  )
}

export { Label }
