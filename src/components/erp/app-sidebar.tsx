"use client"

import * as React from "react"

import { BookiPosMark } from "@/components/marketing/bookipos-logo"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { actorSeesAllSedes } from "@/lib/access"
import { useAuth } from "@/lib/auth-context"
import { dashboardItem, getNavSections } from "@/lib/erp/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

/**
 * La raíz de la zona (/panel) solo se marca activa con coincidencia exacta.
 * Sin esta excepción, al estar en /panel/caja se encenderían a la vez "Panel"
 * y "Caja", porque /panel es prefijo de todo lo demás. Antes el caso especial
 * era `href === "/"`; al colgar el ERP de /panel hay que actualizarlo.
 */
const ZONE_ROOT = "/panel"

function matches(pathname: string, href: string) {
  // /panel/hoy es la versión compacta del tablero: enciende "Panel".
  if (href === ZONE_ROOT) return pathname === ZONE_ROOT || pathname === `${ZONE_ROOT}/hoy`
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * El único destino activo: el más específico que coincide. Comparar solo por
 * prefijo encendía dos a la vez cuando un destino cuelga de otro
 * (/panel/compras/facturas encendía también "Compras", y
 * /panel/clientes/directorio también "Clientes (CxC)").
 */
function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    if (matches(pathname, href) && (!best || href.length > best.length)) best = href
  }
  return best
}

/** Rótulo del giro bajo la marca (Panel · Restaurante / Panel · Tienda). */
const BUSINESS_LABEL: Record<string, string> = {
  restaurante: "Panel · Restaurante",
  retail: "Panel · Tienda",
}

/**
 * Nombre de los roles de fábrica.
 *
 * El pie del menú no pide la lista de roles al backend por un rótulo: son
 * cinco claves fijas y un rol a medida cae en el `??` de abajo mostrando su
 * propia clave, que es preferible a dejar el hueco en blanco.
 */
const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Cajero",
  contador: "Contador",
}

/** Iniciales para el avatar: "Paulo Morales" → "PM". */
function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .map((parte) => parte[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function AppSidebar() {
  const pathname = usePathname()
  // En móvil la barra es una hoja superpuesta y `openMobile` vive en el
  // provider, que NO se desmonta al navegar: sin cerrarla a mano, tras pulsar
  // cualquiera de los 27 destinos la hoja se quedaba abierta encima de la
  // página recién cargada y había que cerrarla con el backdrop. Se cierra solo
  // en móvil; en escritorio `setOpenMobile(false)` es inocuo pero innecesario.
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  // El destino pulsado se marca al instante, sin esperar a que cargue la
  // página: si no, el clic parece no haber hecho nada durante la navegación.
  const [pulsado, setPulsado] = React.useState<{ href: string; desde: string } | null>(null)
  const irA = (href: string) => {
    setPulsado({ href, desde: pathname })
    if (isMobile) setOpenMobile(false)
  }

  // Tablet (768–1023px): por encima de 768 la barra deja de ser hoja y pasa a
  // ocupar 256px fijos. En un iPad en vertical eso es un tercio de la pantalla
  // robado a la tabla que el usuario está leyendo. Se arranca colapsada a
  // iconos (48px) en esa franja. Solo colapsa, nunca abre: si el usuario la
  // despliega a mano, su decisión manda hasta que vuelva a entrar en la franja.
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px) and (max-width: 1023px)")
    const apply = () => {
      if (mql.matches) setOpen(false)
    }
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [setOpen])
  const { user, tipoNegocio, hasPermission, hasFeature } = useAuth()
  const navSections = getNavSections(
    tipoNegocio,
    hasPermission,
    hasFeature,
    user ? actorSeesAllSedes(user) : undefined,
  )
  const llegado = activeHref(pathname, [
    dashboardItem.href,
    ...navSections.flatMap((s) => s.items.map((i) => i.href)),
  ])
  // Vale solo mientras la ruta no cambie: al llegar manda la ruta real.
  const active = pulsado && pulsado.desde === pathname ? pulsado.href : llegado
  const brandCaption = tipoNegocio
    ? BUSINESS_LABEL[tipoNegocio]
    : "Panel operativo"

  // Ítem activo (sistema "Libro"): un velo violeta plano con la letra y el
  // icono en violeta. Sin degradado, sin brillo y sin sombra: se ve dónde
  // estás sin que el menú le grite al contenido. Filas de 32 px: caben los 8 grupos.
  const itemClass =
    "relative h-8 rounded-lg text-[13.5px] font-normal text-sidebar-foreground " +
    "transition-colors duration-100 " +
    "group-data-[collapsible=icon]:!size-8 " +
    "[&_svg]:size-[17px] [&_svg]:text-muted-foreground " +
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground " +
    "[&[data-active]]:bg-[color-mix(in_oklch,var(--primary)_11%,transparent)] " +
    "[&[data-active]]:font-medium [&[data-active]]:text-primary " +
    "[&[data-active]]:hover:bg-[color-mix(in_oklch,var(--primary)_15%,transparent)] " +
    "[&[data-active]]:hover:text-primary [&[data-active]]:[&_svg]:text-primary"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          {/* Isotipo real de la marca en vez de la inicial provisional.
              `filled` lo pinta en violeta sólido, que es la versión para
              fondos claros como este sidebar. */}
          <BookiPosMark className="size-7 shrink-0" />

          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-[14px] font-semibold leading-tight text-foreground">
              BookiPos
            </span>
            <span className="text-[12px] text-muted-foreground">
              {brandCaption}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent data-tour="menu" className="gap-0 px-1">
        {/* Panel — ítem suelto arriba */}
        <SidebarGroup className="py-1 pb-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={itemClass}
                  isActive={active === dashboardItem.href}
                  tooltip={dashboardItem.title}
                  onClick={() => irA(dashboardItem.href)}
                  render={<Link href={dashboardItem.href} />}
                >
                  <dashboardItem.icon />
                  <span>{dashboardItem.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navSections.map((section) => (
          <NavGroup
            key={section.label}
            label={section.label}
            containsActive={section.items.some((i) => i.href === active)}
          >
            {section.items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  className={itemClass}
                  isActive={active === item.href}
                  tooltip={item.title}
                  onClick={() => irA(item.href)}
                  render={<Link href={item.href} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </NavGroup>
        ))}
      </SidebarContent>

      {/* Quien de verdad tiene la sesión abierta. Estaba escrito a mano con el
          nombre del desarrollador, así que toda cuenta veía a otra persona
          como administrador de su propio negocio. */}
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
            {user ? iniciales(user.name) : "—"}
          </div>
          <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-medium text-sidebar-foreground">
              {user?.name ?? "Sin sesión"}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {user ? (ROLE_LABEL[user.role] ?? user.role) : ""}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * Grupos que quien usa el menú dejó abiertos (por dispositivo). De entrada
 * solo está abierto "Vender": con los 8 grupos abiertos el menú no cabe en
 * pantalla, que era justo la queja.
 */
const ABIERTOS_KEY = "bookipos.menu.abiertos"
const ABIERTOS_DE_ENTRADA = ["Vender"]

const EVENTO_MENU = "bookipos:menu-abiertos"

function leerAbiertos(raw: string | null): string[] {
  try {
    return raw ? (JSON.parse(raw) as string[]) : ABIERTOS_DE_ENTRADA
  } catch {
    return ABIERTOS_DE_ENTRADA
  }
}

function suscribirMenu(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENTO_MENU, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENTO_MENU, cb)
  }
}

/**
 * Lo guardado, leído con `useSyncExternalStore`: en el servidor no hay
 * `localStorage`, así que allí vale la entrada por defecto y React corrige al
 * hidratar sin discrepancia (el mismo patrón que el tema).
 */
function useAbiertos(): string[] {
  const raw = React.useSyncExternalStore(
    suscribirMenu,
    () => {
      try {
        return localStorage.getItem(ABIERTOS_KEY)
      } catch {
        return null
      }
    },
    () => null,
  )
  return leerAbiertos(raw)
}

/**
 * Grupo del menú que se pliega. El grupo de la página actual siempre se ve
 * abierto: no se esconde dónde estás. La altura se
 * anima con `grid-template-rows` (0fr → 1fr), que no mide nada en JS.
 */
function NavGroup({
  label,
  containsActive,
  children,
}: {
  label: string
  containsActive: boolean
  children: React.ReactNode
}) {
  const abiertos = useAbiertos()
  const abierto = containsActive || abiertos.includes(label)

  function alternar() {
    const nuevo = !abierto
    const lista = abiertos.filter((l) => l !== label)
    if (nuevo) lista.push(label)
    try {
      localStorage.setItem(ABIERTOS_KEY, JSON.stringify(lista))
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
    window.dispatchEvent(new Event(EVENTO_MENU))
  }

  return (
    <SidebarGroup className="py-0.5">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground group-data-[collapsible=icon]:hidden"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={`size-3.5 transition-transform duration-200 ease-salida ${abierto ? "" : "-rotate-90"}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-salida motion-reduce:transition-none group-data-[collapsible=icon]:grid-rows-[1fr] ${
          abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px pb-1">{children}</SidebarMenu>
          </SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  )
}
