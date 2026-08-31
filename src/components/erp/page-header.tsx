import { cn } from "@/lib/utils"
import { dashboardItem, navSections } from "@/lib/erp/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/**
 * Icono de cada módulo, tomado del propio menú lateral.
 *
 * Se saca de `navigation.ts` en vez de pedírselo a cada página por un motivo
 * práctico: así el icono de la cabecera y el del menú NO pueden divergir. Si
 * mañana Inventario cambia de icono, cambia en los dos sitios a la vez, y
 * ninguna de las treinta páginas del panel tiene que enterarse.
 *
 * El mapa guarda ELEMENTOS ya construidos, no componentes. Construirlos aquí,
 * una sola vez al cargar el módulo, evita que el tipo del JSX salga de una
 * búsqueda hecha durante el render —lo que reinicia el estado del componente en
 * cada pintado y que la regla `no-create-components-during-render` marca con
 * razón.
 */
const ICON_NODES = new Map(
  [dashboardItem, ...navSections.flatMap((s) => s.items)].map((item) => [
    item.title.toLowerCase(),
    <item.icon key={item.title} className="size-5.5" aria-hidden />,
  ]),
)

/**
 * Cabecera de página del panel.
 *
 * Tres niveles de jerarquía y no dos: rastro de migas (dónde estoy), título
 * (qué es esto) y subtítulo (para qué sirve). El subtítulo se lee de verdad
 * —está en el ancho de una columna de texto, no estirado a toda la pantalla—
 * porque en la mitad de los módulos es lo único que explica el modelo mental
 * del sistema.
 *
 * El icono no es adorno: es lo que hace reconocible la pantalla de un vistazo
 * cuando se salta entre Inventario, Producción y Productos, que de otro modo
 * se ven iguales.
 *
 * La botonera envuelve en varias filas en cuanto no cabe. Antes era un `flex`
 * sin `wrap` y en un móvil los seis botones de Inventario se salían de la
 * pantalla por la derecha, sin scroll que los alcanzara.
 */
export function PageHeader({
  title,
  description,
  section,
  icon: Icon,
  actions,
  className,
}: {
  title: string
  description?: string
  section?: string
  /** Se toma del menú lateral si no se pasa; `null` lo quita del todo. */
  icon?: React.ElementType | null
  actions?: React.ReactNode
  className?: string
}) {
  const iconNode =
    Icon === null ? null : Icon ? (
      <Icon className="size-5.5" aria-hidden />
    ) : (
      (ICON_NODES.get(title.trim().toLowerCase()) ?? null)
    )

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <Breadcrumb className="mb-2.5">
          <BreadcrumbList>
            <BreadcrumbItem>{section ?? "BookiPos"}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-3">
          {iconNode && (
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
              {iconNode}
            </span>
          )}
          <h1 className="font-display text-[1.75rem] leading-tight tracking-[-0.02em] text-foreground sm:text-[2rem]">
            {title}
          </h1>
        </div>

        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
