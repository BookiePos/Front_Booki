"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CircleAlert, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HelpTip, type HelpTipProps } from "@/components/ui/help-tip"

/**
 * Tarjeta flotante para fichas de alta, edición y detalle.
 *
 * Reemplaza al `Sheet` lateral en todos los formularios del producto. Un cajón
 * de 24 rem pegado al borde obligaba a apilar quince campos en una sola columna
 * y a hacer scroll para llegar a Guardar, mientras el 70 % de la pantalla
 * quedaba en gris: dar de alta un empleado se sentía como rellenar un
 * formulario de impuestos en papel. Aquí la ficha se centra, el ancho da para
 * dos y tres columnas, los campos se agrupan por tema y el pie con
 * Guardar/Cancelar se queda fijo.
 *
 * Decisiones que no son de gusto:
 *
 * - **El velo desenfoca de verdad.** No es decoración: al centrar la ficha, lo
 *   que queda detrás es contenido por los cuatro lados y compite con lo que hay
 *   que leer. El desenfoque lo empuja al fondo sin apagarlo del todo, así que
 *   no se pierde el contexto de qué pantalla hay debajo. Va detrás de
 *   `supports-backdrop-filter` porque donde no exista, el velo sólido al 40 %
 *   ya cumple solo.
 *
 * - **Centrada también en móvil**, en vez del cajón inferior de moda: un cajón
 *   anclado abajo pelea con el teclado virtual, que es justo lo que se abre en
 *   cuanto tocas el primer campo. Centrada y medida en `svh`, el navegador
 *   recalcula el alto disponible él solo.
 *
 * - **Cabecera y pie fijos, solo el cuerpo hace scroll.** Es la diferencia
 *   entre saber siempre qué estás llenando y perderte en el campo doce.
 */
/** Campos en los que tiene sentido empezar a escribir. */
const FIRST_FIELD = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([disabled]):not([readonly])',
  "textarea:not([disabled]):not([readonly])",
  "select:not([disabled])",
].join(",")

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  /** Ancho máximo. `2xl` va bien para dos columnas; `4xl` para tres. */
  size = "3xl",
  /** Franja de color en la cabecera. `destructive` para fichas de borrado. */
  tone = "brand",
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  icon?: React.ElementType
  size?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"
  tone?: "brand" | "destructive"
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  const maxWidth = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  }[size]

  // Hairline bajo la cabecera solo cuando el cuerpo ya está desplazado: sin
  // esto, un formulario corto lleva una línea que no separa nada, y uno largo
  // no avisa de que sigue habiendo campos más arriba.
  const [scrolled, setScrolled] = React.useState(false)

  // Al abrir, el foco va al primer campo del formulario: se abre la ficha y
  // se empieza a escribir, sin tener que tocar el campo antes. Nunca a la "X"
  // de cerrar, que es lo primero del DOM y dejaba el botón de descartar
  // resaltado. Si la ficha no tiene campos (solo lectura, confirmaciones) va a
  // la tarjeta, que conserva Escape, el Tab dentro y el anuncio del título.
  const popupRef = React.useRef<HTMLDivElement | null>(null)
  const bodyRef = React.useRef<HTMLDivElement | null>(null)
  const firstField = React.useCallback(() => {
    const fields = bodyRef.current?.querySelectorAll<HTMLElement>(FIRST_FIELD)
    const visible = Array.from(fields ?? []).find(
      (el) => el.getClientRects().length > 0,
    )
    return visible ?? popupRef.current
  }, [])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-brand-950/40 dark:bg-navy-950/65",
            "transition-opacity duration-200 ease-out",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
            // El saturate acompaña al blur: desenfocar sin él deja el fondo
            // lavado y grisáceo, y el violeta de la marca se apaga.
            "supports-backdrop-filter:backdrop-blur-[10px] supports-backdrop-filter:backdrop-saturate-150",
          )}
        />
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={firstField}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col",
            // `svh` y no `vh`: en móvil la barra del navegador se recoge y con
            // `vh` la ficha se sale por abajo justo cuando aparece el teclado.
            "w-[calc(100%-1.5rem)] max-h-[calc(100svh-2rem)] sm:max-h-[calc(100svh-4rem)]",
            "overflow-hidden rounded-3xl border border-border bg-card text-card-foreground",
            // La tarjeta recibe el foco al abrirse (ver `initialFocus`), y el
            // navegador le pintaría su anillo alrededor de todo el diálogo. Aquí
            // se quita a propósito: lo que hay que ver enfocado es el campo en
            // el que se está escribiendo, no el contenedor.
            "outline-none",
            // Dos sombras: una corta que apoya la tarjeta y una larga y teñida
            // de marca que la despega del velo. Con una sola se ve pegada.
            "shadow-[0_2px_8px_rgba(46,16,101,0.10),0_32px_80px_-20px_rgba(46,16,101,0.35)]",
            "dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),0_32px_80px_-20px_rgba(0,0,0,0.7)]",
            "transition duration-200 ease-out",
            "data-ending-style:scale-[0.97] data-ending-style:opacity-0",
            "data-starting-style:scale-[0.97] data-starting-style:opacity-0",
            maxWidth,
            className,
          )}
        >
          {/* Cabecera teñida: separa el "qué estoy haciendo" del formulario sin
              una línea dura, y da sitio al icono del módulo para que la ficha
              se reconozca antes de leerla. */}
          <header
            className={cn(
              "relative flex shrink-0 items-start gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-6 sm:py-4.5",
              tone === "destructive"
                ? "bg-destructive/[0.07]"
                : "bg-gradient-to-br from-primary/[0.09] via-primary/[0.05] to-transparent",
              // La línea de la cabecera aparece al desplazar. `transition` sobre
              // el color para que no dé un salto duro.
              "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:transition-colors after:duration-200 after:content-['']",
              scrolled ? "after:bg-border" : "after:bg-border/45",
            )}
          >
            {Icon && (
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-2xl border shadow-xs",
                  tone === "destructive"
                    ? "border-destructive/20 bg-destructive/12 text-destructive"
                    : "border-primary/20 bg-primary/12 text-primary",
                )}
              >
                <Icon className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <DialogPrimitive.Title className="font-display text-lg leading-tight tracking-[-0.015em] text-balance sm:text-xl">
                {title}
              </DialogPrimitive.Title>
              {description && (
                // En móvil el subtítulo se aprieta: con la interlínea de
                // escritorio, cuatro renglones de explicación se comían un
                // tercio de la pantalla y empujaban los campos fuera de vista.
                <DialogPrimitive.Description className="mt-1 text-xs leading-snug text-pretty text-muted-foreground sm:text-[0.8125rem] sm:leading-relaxed">
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
                  className="-mr-1.5 -mt-0.5 shrink-0 text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </header>

          <div
            ref={bodyRef}
            onScroll={(e) => {
              const top = e.currentTarget.scrollTop > 4
              setScrolled((prev) => (prev === top ? prev : top))
            }}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4.5 sm:px-6 sm:py-5"
          >
            {children}
          </div>

          {footer && (
            <footer className="flex shrink-0 flex-col-reverse items-stretch gap-2 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6 sm:py-3.5">
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
 * en algo que se lee de un vistazo: "Datos personales", "Contratación",
 * "Seguridad social". Cada grupo responde a una pregunta distinta.
 *
 * `boxed` lo encierra en una superficie propia: se usa para los bloques que no
 * son campos sueltos sino una mini-herramienta dentro de la ficha (los ejes de
 * variantes, la lista de ingredientes, el resumen de lo que se va a crear).
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  action,
  help,
  boxed = false,
  children,
  className,
}: {
  title: string
  description?: React.ReactNode
  icon?: React.ElementType
  /** Botón a la derecha del título ("Agregar eje", "Agregar ingrediente"). */
  action?: React.ReactNode
  /** Interrogación junto al título, cuando el bloque entero necesita glosario. */
  help?: HelpTipProps
  boxed?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3.5",
        boxed && "rounded-2xl border border-border bg-muted/35 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span
              aria-hidden
              className="mt-px grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon className="size-4" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold tracking-[-0.01em] text-foreground">
              {title}
              {help && <HelpTip {...help} />}
            </h3>
            {description && (
              <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Separador entre bloques del formulario. */
export function FormDivider({ className }: { className?: string }) {
  return <hr className={cn("border-t border-border/70", className)} />
}

/**
 * Aviso dentro de la ficha: el error del servidor, una advertencia, un dato.
 *
 * Cada formulario pintaba el suyo con clases distintas —unos un `<p>` rojo,
 * otros una caja teñida— así que el mismo error se veía de cinco maneras. El
 * `role="alert"` es lo que hace que un lector de pantalla lo anuncie sin que el
 * usuario tenga que ir a buscarlo.
 */
export function FormAlert({
  tone = "error",
  icon: Icon = CircleAlert,
  children,
  className,
}: {
  tone?: "error" | "warning" | "info" | "success"
  icon?: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    error: "border-destructive/25 bg-destructive/8 text-destructive-ink",
    warning: "border-warning/30 bg-warning/10 text-warning-ink",
    info: "border-info/25 bg-info/8 text-foreground",
    success: "border-success/25 bg-success/8 text-success-ink",
  }[tone]

  const iconTone = {
    error: "text-destructive",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
  }[tone]

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-[0.8125rem] leading-relaxed",
        tones,
        className,
      )}
    >
      <Icon className={cn("mt-px size-4 shrink-0", iconTone)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * Pie estándar: Cancelar a la izquierda, la acción principal a la derecha.
 *
 * Existe para que no haya que acordarse en cada ficha del orden de los botones,
 * del `flex-1` en móvil ni de poner el spinner. En pantalla ancha los botones
 * van a la derecha y al tamaño normal; en móvil se estiran y se apilan con la
 * acción principal arriba, que es donde cae el pulgar.
 */
export function FormActions({
  onCancel,
  onSubmit,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  busy = false,
  disabled = false,
  destructive = false,
  icon: Icon,
  extra,
}: {
  onCancel: () => void
  onSubmit: () => void
  submitLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  busy?: boolean
  disabled?: boolean
  destructive?: boolean
  /** Icono de la acción principal. Se oculta mientras gira el spinner. */
  icon?: React.ElementType
  /** Contenido suelto a la izquierda del pie (un contador, una nota). */
  extra?: React.ReactNode
}) {
  return (
    <>
      {extra && (
        <div className="mr-auto hidden text-xs text-muted-foreground sm:block">
          {extra}
        </div>
      )}
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={busy}
        className="sm:min-w-28"
      >
        {cancelLabel}
      </Button>
      <Button
        variant={destructive ? "destructive-solid" : "default"}
        onClick={onSubmit}
        disabled={busy || disabled}
        className="sm:min-w-36"
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          Icon && <Icon aria-hidden />
        )}
        {submitLabel}
      </Button>
    </>
  )
}
