import { cn } from "@/lib/utils"
import { HelpTip, type HelpTipProps } from "@/components/ui/help-tip"

/**
 * Cabecera de página del panel (sistema "Libro").
 *
 * Una sola fila: título a la izquierda, acciones a la derecha. Antes eran
 * cuatro pisos —migas, recuadro con icono, título de 32 px y un párrafo de dos
 * o tres renglones— que se comían 150 px de cada página antes del primer dato
 * y repetían lo que ya dice el menú. Ahora la página empieza con su contenido.
 *
 * La explicación no se pierde: pasa a la interrogación junto al título, que es
 * donde la busca quien no sabe qué está mirando, y deja de estorbar a quien
 * entra a diario.
 *
 * `section` e `icon` se aceptan por compatibilidad con las ~40 páginas que
 * los pasan, pero ya no se pintan: el menú lateral ya dice dónde estás.
 */
export function PageHeader({
  title,
  titleHelp,
  description,
  actions,
  className,
}: {
  title: string
  /** Interrogación junto al título para un término raro ("Kárdex", "P&L"). */
  titleHelp?: HelpTipProps
  /** Se muestra dentro de la interrogación del título, no debajo. */
  description?: React.ReactNode
  /** @deprecated El menú lateral ya dice la sección. */
  section?: string
  /** @deprecated La cabecera ya no lleva icono. */
  icon?: React.ElementType | null
  actions?: React.ReactNode
  className?: string
}) {
  const help: HelpTipProps | undefined =
    titleHelp ?? (description ? { title, children: description } : undefined)

  return (
    <div
      className={cn(
        "mb-6 flex min-h-9 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <h1 className="flex min-w-0 items-center gap-2 text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-foreground">
        <span className="truncate">{title}</span>
        {help && <HelpTip {...help} side="bottom" className="size-4" />}
      </h1>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  )
}
