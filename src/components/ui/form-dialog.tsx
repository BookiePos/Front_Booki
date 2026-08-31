"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Diálogo ancho para fichas de alta y edición.
 *
 * Reemplaza al `Sheet` lateral en los formularios largos. Un cajón de 24 rem
 * obligaba a apilar quince campos en una sola columna y a hacer scroll para ver
 * el botón de guardar, mientras el 70% de la pantalla quedaba en gris: dar de
 * alta un producto se sentía como rellenar un formulario de impuestos. Aquí el
 * ancho da para dos y tres columnas, los campos se agrupan por tema y el pie
 * con Guardar/Cancelar se queda fijo.
 *
 * El `Sheet` sigue siendo lo correcto para fichas cortas o de solo lectura; lo
 * que se muda son las de muchos campos.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  /** Ancho máximo. `2xl` va bien para dos columnas; `4xl` para tres. */
  size = "3xl",
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  icon?: React.ElementType
  size?: "2xl" | "3xl" | "4xl" | "5xl"
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const maxWidth = {
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  }[size]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-brand-950/45 dark:bg-navy-950/70 transition-opacity duration-150",
            "data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            // `max-h` + columna flexible: la cabecera y el pie se quedan fijos
            // y solo hace scroll el cuerpo, para que Guardar esté siempre a un
            // clic por largo que sea el formulario.
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-h-[calc(100svh-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-xl",
            "transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            "data-ending-style:scale-95 data-starting-style:scale-95",
            maxWidth,
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-6 py-4">
            {Icon && (
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon className="size-4.5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-lg leading-tight">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cerrar"
                  className="-mr-1.5 -mt-0.5 text-muted-foreground"
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>

          {footer && (
            <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Bloque de campos con título. Es lo que convierte una lista de quince campos
 * en algo que se lee de un vistazo: "Identificación", "Precio", "Control de
 * existencias". Cada grupo responde a una pregunta distinta del comerciante.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/** Separador entre bloques del formulario. */
export function FormDivider({ className }: { className?: string }) {
  return <hr className={cn("border-t border-border", className)} />
}
