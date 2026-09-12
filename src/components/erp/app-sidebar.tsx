"use client"

import { BookiPosMark } from "@/components/marketing/bookipos-logo"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { dashboardItem, getNavSections } from "@/lib/erp/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * La raíz de la zona (/panel) solo se marca activa con coincidencia exacta.
 * Sin esta excepción, al estar en /panel/caja se encenderían a la vez "Panel"
 * y "Caja", porque /panel es prefijo de todo lo demás. Antes el caso especial
 * era `href === "/"`; al colgar el ERP de /panel hay que actualizarlo.
 */
const ZONE_ROOT = "/panel"

function isActivePath(pathname: string, href: string) {
  if (href === ZONE_ROOT) return pathname === ZONE_ROOT
  return pathname === href || pathname.startsWith(href + "/")
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
 * cuatro claves fijas y un rol a medida cae en el `??` de abajo mostrando su
 * propia clave, que es preferible a dejar el hueco en blanco.
 */
const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Cajero",
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
  const { user, tipoNegocio, hasPermission, hasFeature } = useAuth()
  const navSections = getNavSections(tipoNegocio, hasPermission, hasFeature)
  const brandCaption = tipoNegocio
    ? BUSINESS_LABEL[tipoNegocio]
    : "Panel operativo"

  // Ítem activo: píldora violeta sólida, no una barrita de 3px. En una lista
  // de 27 destinos, un indicador de bajo contraste obliga a buscar dónde
  // estás; el relleno se ve de reojo. Filas de 40px (antes 36) para que la
  // navegación respire, que es media gracia de lo cómodo que se siente Alegra.
  const itemClass =
    "relative h-10 rounded-xl text-[13px] font-normal text-sidebar-foreground " +
    "transition-colors duration-150 " +
    "group-data-[collapsible=icon]:!size-10 " +
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground " +
    "[&[data-active]]:bg-primary [&[data-active]]:font-medium " +
    "[&[data-active]]:text-primary-foreground " +
    "[&[data-active]]:shadow-[0_6px_16px_-8px_var(--primary)] " +
    "[&[data-active]]:hover:bg-primary [&[data-active]]:hover:text-primary-foreground " +
    "[&[data-active]]:[&_svg]:text-primary-foreground"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          {/* Isotipo real de la marca en vez de la inicial provisional.
              `filled` lo pinta en violeta sólido, que es la versión para
              fondos claros como este sidebar. */}
          <BookiPosMark className="size-7 shrink-0" />

          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-[15px] leading-tight text-sidebar-foreground">
              BookiPos
            </span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
              {brandCaption}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent data-tour="menu" className="gap-0.5">
        {/* Panel — ítem suelto arriba */}
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={itemClass}
                  isActive={isActivePath(pathname, dashboardItem.href)}
                  tooltip={dashboardItem.title}
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
          <SidebarGroup key={section.label} className="py-1">
            <SidebarGroupLabel className="px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      className={itemClass}
                      isActive={isActivePath(pathname, item.href)}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
