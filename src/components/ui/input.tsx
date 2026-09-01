import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Campo de texto del producto.
 *
 * Sube a 36 px de alto (antes 32) por la misma razón que el botón: se rellena
 * de pie y muchas veces con el dedo. El borde es visible en reposo —un campo
 * que solo se dibuja al enfocarlo obliga a adivinar dónde hay que escribir— y
 * la superficie es la de la tarjeta, no transparente, para que se despegue del
 * fondo del formulario.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-1 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground/80",
        "hover:border-ring/45",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm dark:bg-input/25 dark:hover:bg-input/35 dark:disabled:bg-input/50",
        "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

/**
 * Área de texto con el mismo lenguaje visual que `Input`.
 *
 * Existía la necesidad en varias fichas (descripción del producto, notas del
 * parte de producción) y cada una la resolvía con un `<textarea>` suelto y sus
 * propias clases, así que ninguna se parecía a la de al lado.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full rounded-xl border border-input bg-card px-3 py-2 text-base shadow-xs transition-[color,background-color,border-color,box-shadow] outline-none",
        "placeholder:text-muted-foreground/80",
        "hover:border-ring/45",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm dark:bg-input/25",
        className
      )}
      {...props}
    />
  )
}

/**
 * Campo con adorno delante (icono de lupa, símbolo de moneda, unidad…).
 *
 * El adorno va posicionado y el `<input>` recibe el padding correspondiente,
 * que es lo que evita el error clásico de escribir "debajo" del icono.
 */
function InputWithIcon({
  icon: Icon,
  suffix,
  className,
  inputClassName,
  ...props
}: React.ComponentProps<"input"> & {
  icon?: React.ElementType
  /** Texto corto a la derecha (unidad, "%", "COP"…). */
  suffix?: React.ReactNode
  className?: string
  inputClassName?: string
}) {
  return (
    <div className={cn("relative", className)}>
      {Icon && (
        <Icon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <Input
        className={cn(Icon && "pl-9", suffix && "pr-12", inputClassName)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

export { Input, InputWithIcon, Textarea }
