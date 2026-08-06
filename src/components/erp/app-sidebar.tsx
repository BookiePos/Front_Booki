"use client"

import { GoCheckMark } from "@/components/marketing/gocheck-logo"
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

export function AppSidebar() {
  const pathname = usePathname()
  const { tipoNegocio, hasPermission } = useAuth()
  const navSections = getNavSections(tipoNegocio, hasPermission)
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
          <GoCheckMark className="size-7 shrink-0" filled />

          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-[15px] leading-tight text-sidebar-foreground">
              GoCheck
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

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
            SM
          </div>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-[13px] font-medium text-sidebar-foreground">
              Samuel Múnera
            </span>
            <span className="text-[11px] text-muted-foreground">
              Administrador
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
