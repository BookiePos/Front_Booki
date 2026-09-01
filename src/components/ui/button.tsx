import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Botón del producto.
 *
 * Las alturas son deliberadamente generosas: esto se usa de pie, en un
 * mostrador y muchas veces con tablet. Un control de 32 px se falla al tocarlo
 * (WCAG 2.5.8 pide 24 px como mínimo absoluto, y las guías táctiles de Apple y
 * Material piden 44 dp), así que la talla base sube a 36 px y las de acción
 * principal a 40/48. Las variantes "icon-*" mantienen el cuadrado exacto.
 *
 * El relieve tampoco es decorativo: la acción primaria lleva sombra de color
 * —la del propio primario, no negro— y se hunde un píxel al pulsarla, que es
 * la única confirmación táctil que puede dar una pantalla.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "outline-none select-none",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
    "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Acción principal de la pantalla. Solo debería haber una a la vista. */
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_var(--btn-shade),0_6px_16px_-8px_var(--btn-glow)] [--btn-glow:color-mix(in_oklab,var(--primary)_55%,transparent)] [--btn-shade:color-mix(in_oklab,var(--foreground)_16%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary),var(--foreground)_10%)] hover:shadow-[0_2px_4px_var(--btn-shade),0_10px_24px_-10px_var(--btn-glow)]",
        /** Acción secundaria con contorno: la más usada en las cabeceras. */
        outline:
          "border-border bg-card text-foreground shadow-xs hover:border-primary/45 hover:bg-primary/6 hover:text-primary aria-expanded:border-primary/45 aria-expanded:bg-primary/8 aria-expanded:text-primary dark:bg-card dark:hover:bg-primary/10",
        /** Acción secundaria teñida de marca, sin contorno. */
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        /** Acción de marca discreta: color sin el peso del botón sólido. */
        soft: "bg-primary/10 text-primary hover:bg-primary/16 aria-expanded:bg-primary/16 dark:bg-primary/14 dark:hover:bg-primary/22",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/60",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/18 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        /** Confirmación irreversible (borrar de verdad). Sólida a propósito. */
        "destructive-solid":
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-[color-mix(in_oklab,var(--destructive),var(--foreground)_10%)] focus-visible:ring-destructive/30",
        success:
          "bg-success/12 text-success-ink hover:bg-success/20 dark:bg-success/18 dark:hover:bg-success/26",
        link: "font-medium text-primary underline-offset-4 hover:underline",
      },
      size: {
        /** 36 px — la talla de trabajo del panel. */
        default:
          "h-9 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        /** 40 px — acción principal de una cabecera o de un pie de formulario. */
        lg: "h-10 px-4.5 text-[0.9rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        /** 48 px — botonera del POS y llamadas a la acción a pantalla completa. */
        xl: "h-12 rounded-2xl px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10",
        "icon-xl": "size-12 rounded-2xl [&_svg:not([class*='size-'])]:size-5",
      },
      /** Ocupa todo el ancho disponible (útil en móvil y en formularios). */
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      block: false,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  block = false,
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      render={render}
      // Cuando se renderiza como otro elemento (p.ej. un <Link>/<a> con
      // `render`), no es un <button> nativo. Base UI avisa si asume que sí,
      // así que por defecto lo marcamos como no-nativo salvo indicación.
      nativeButton={nativeButton ?? render == null}
      {...props}
    />
  )
}

/**
 * Etiqueta que desaparece en pantallas estrechas y deja solo el icono.
 *
 * Es lo que permite tener seis acciones en la cabecera de Inventario sin que
 * en un móvil se conviertan en tres filas de botones: el icono sigue ahí, el
 * `aria-label` del botón sigue diciendo qué hace, y el texto vuelve en cuanto
 * hay sitio.
 */
function ButtonLabel({
  className,
  from = "sm",
  ...props
}: React.ComponentProps<"span"> & { from?: "sm" | "md" | "lg" | "xl" }) {
  const show = {
    sm: "sm:inline",
    md: "md:inline",
    lg: "lg:inline",
    xl: "xl:inline",
  }[from]
  return <span className={cn("hidden", show, className)} {...props} />
}

export { Button, ButtonLabel, buttonVariants }
