"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Store,
  MapPin,
  LayoutDashboard,
  Loader2,
  Repeat,
  CircleHelp,
  Ellipsis,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { FondoLibro } from "@/components/ui/fondo-libro"
import { TituloPestana } from "@/components/ui/titulo-pestana"
import { PanelAyuda } from "@/components/ayuda/panel-ayuda"
import { abrirAyuda, cerrarAyuda, useAyudaAbierta } from "@/lib/ayuda/panel-store"
import { useAuth } from "@/lib/auth-context"
import { useCerrarSesion } from "@/hooks/use-cerrar-sesion"
import { AvisoFiscal } from "@/components/onboarding/aviso-fiscal"
import { useSede } from "@/lib/pos/sede-context"
import { navItems } from "@/lib/pos/navigation"
import { ProductTour } from "@/components/onboarding/product-tour"
import { PosSearch } from "@/components/pos/pos-search"
import { SelectorSede } from "@/components/pos/selector-sede"
import { GuideAutoStart } from "@/components/onboarding/guide-autostart"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** ¿La ruta actual corresponde a este ítem de navegación? */
/**
 * La raíz de la zona (/pos) solo se marca activa con coincidencia exacta: si
 * no, al estar en /pos/caja se encenderían "Venta" y "Caja" a la vez, porque
 * /pos es prefijo de todas las demás rutas del punto de venta.
 */
const ZONE_ROOT = "/pos"

function isActive(pathname: string, href: string): boolean {
  if (href === ZONE_ROOT) return pathname === ZONE_ROOT
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Destinos que van a la vista en la barra inferior del celular. Con los ocho
 * no cabían: en 375 px cada uno quedaba de 47 px, "Factura electrónica" se
 * partía en tres renglones y el último se salía de la pantalla. Quedan los
 * cuatro del turno y "Más" con el resto.
 */
const EN_BARRA = new Set(["/pos", "/pos/ventas", "/pos/caja", "/pos/domicilios"])

function NavLinks({ vertical }: { vertical?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  // Se marca al instante el destino pulsado, sin esperar a que cargue.
  const [pulsado, setPulsado] = React.useState<{ href: string; desde: string } | null>(null)
  const esActivo = (href: string) =>
    pulsado && pulsado.desde === pathname ? pulsado.href === href : isActive(pathname, href)
  const visibles = vertical ? navItems : navItems.filter((i) => EN_BARRA.has(i.href))
  const resto = vertical ? [] : navItems.filter((i) => !EN_BARRA.has(i.href))
  const claseItem = (active: boolean) =>
    cn(
      "group flex items-center gap-3 rounded-lg px-3 transition-colors duration-100",
      vertical
        ? "h-12 text-sm"
        : "flex-1 flex-col justify-center gap-0.5 rounded-none px-1 py-1.5 text-[11px]",
      // Activo como en el panel: velo violeta plano, letra e icono en
      // violeta. Sin degradado ni brillo: lo único que grita en esta
      // pantalla es el botón de cobrar.
      active
        ? vertical
          ? "bg-[color-mix(in_oklch,var(--primary)_11%,transparent)] font-medium text-primary [&_svg]:text-primary"
          : "font-medium text-primary [&_svg]:text-primary"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground [&_svg]:text-muted-foreground",
    )
  return (
    <nav
      // El tour resalta la navegación del terminal; marca solo la barra lateral
      // (vertical) para no apuntar dos veces al mismo objetivo en móvil.
      data-tour={vertical ? "pos-nav" : undefined}
      className={cn(vertical ? "flex flex-col gap-1" : "flex h-full items-stretch justify-around")}
    >
      {visibles.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setPulsado({ href: item.href, desde: pathname })}
            className={claseItem(Boolean(esActivo(item.href)))}
          >
            <Icon className="size-5" />
            <span className={cn(!vertical && "leading-none text-center")}>{item.title}</span>
          </Link>
        )
      })}
      {resto.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={claseItem(resto.some((i) => esActivo(i.href)))}
            aria-label="Más opciones del terminal"
          >
            <Ellipsis className="size-5" />
            <span className="leading-none text-center">Más</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-56">
            {resto.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.href}
                  className={cn("h-11 gap-3", esActivo(item.href) && "font-medium text-primary [&_svg]:text-primary")}
                  onClick={() => {
                    setPulsado({ href: item.href, desde: pathname })
                    router.push(item.href)
                  }}
                >
                  <Icon className="size-4" />
                  {item.title}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  )
}

/** Indicador (solo lectura) de la sede en la que se está trabajando. */
function SedeBadge() {
  const { sede } = useSede()
  return (
    <Badge
      data-tour="pos-sede"
      variant="outline"
      className="gap-1.5 px-3 py-1.5 text-sm"
    >
      <MapPin className="size-4" />
      {sede?.name ?? "Sin sede"}
    </Badge>
  )
}

/** Aviso fiscal de la sede en la que se está vendiendo (no bloquea la venta). */
function AvisoFiscalSedeActiva() {
  const { sede } = useSede()
  return <AvisoFiscal sede={sede} />
}

/** Botón “Ayuda”: abre el panel de ayuda de la pantalla actual del terminal. */
function GuideButton() {
  const abierta = useAyudaAbierta()
  return (
    <Button
      variant="ghost"
      size="sm"
      className={abierta ? "gap-1.5 text-primary" : "gap-1.5"}
      data-tour="pos-guia"
      aria-label="Ayuda de esta pantalla"
      aria-expanded={abierta}
      title="Ayuda de esta pantalla"
      onClick={() => (abierta ? cerrarAyuda() : abrirAyuda())}
    >
      <CircleHelp className="size-4" />
      <span className="hidden sm:inline">Ayuda</span>
    </Button>
  )
}

function UserMenu() {
  const { user, canUseOperation } = useAuth()
  const { sedes, changeSede } = useSede()
  const router = useRouter()
  const cerrarSesion = useCerrarSesion()

  const initials = (user?.name ?? "Usuario")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function handleLogout() {
    // Avisa si quedan ventas offline sin registrar (no se borran; ítem 6.3).
    if (await cerrarSesion()) router.replace("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Menú de usuario"
            className="flex items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <Avatar className="size-10" aria-hidden="true">
          <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">
            {initials || "U"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="grid leading-tight">
              <span className="text-sm font-semibold">
                {user?.name ?? "Usuario"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {user?.email ?? ""}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {sedes.length > 1 && (
          <DropdownMenuItem onClick={changeSede}>
            <Repeat className="size-4" />
            Cambiar de sede
          </DropdownMenuItem>
        )}
        {canUseOperation && (
          <DropdownMenuItem onClick={() => router.push("/panel")}>
            <LayoutDashboard className="size-4" />
            Ir a Operación
          </DropdownMenuItem>
        )}
        {(sedes.length > 1 || canUseOperation) && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void handleLogout()
          }}
        >
          Cerrar turno
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PosShell({ children }: { children: React.ReactNode }) {
  const { chosen, loading } = useSede()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </main>
    )
  }

  // Al entrar al POS (con más de una sede) se elige primero dónde se trabaja.
  if (!chosen) {
    return <SelectorSede />
  }

  return (
    <div className="isolate flex min-h-screen bg-muted">
      <FondoLibro />
      <TituloPestana zona="pos" />
      <PanelAyuda />
      {/* Barra lateral — solo desde 1024px.
          Antes aparecía en `md:` (768px) y a la vez se ocultaba la navegación
          inferior. En una tablet en vertical eso costaba 224px de ancho fijo
          justo en la franja donde el carrito ya no cabe como tercera columna:
          el catálogo quedaba estrangulado por los dos lados. Hasta 1024px se
          navega por la barra inferior, que no cuesta ancho. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-2 py-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <div className="grid leading-tight">
            <span className="text-sm font-semibold">Punto de venta</span>
            <span className="text-xs text-muted-foreground">Terminal</span>
          </div>
        </div>
        <NavLinks vertical />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/88 px-4 backdrop-blur-md">
          <SedeBadge />
          <PosSearch />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <GuideButton />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* `min-w-0`: sin él, este flex item crece hasta el ancho de su
            contenido más ancho (aquí, tablas y parrillas que no envuelven) y
            arrastra el documento entero a scroll horizontal.
            El hueco inferior reserva sitio para la barra de navegación fija
            —56px— más aire; desaparece en `lg:`, donde la nav es lateral. */}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-24 lg:pb-6">
          <AvisoFiscalSedeActiva />
          {children}
        </main>
      </div>

      {/* Navegación inferior (móvil y tablet, hasta 1024px). `h-14` es un alto
          conocido a propósito: el resumen de la cuenta del terminal se apoya
          justo encima con `bottom-14`. */}
      <div className="fixed inset-x-0 bottom-0 z-40 h-14 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <NavLinks />
      </div>

      {/* Recorrido guiado (spotlight) del terminal. */}
      <ProductTour />
      <GuideAutoStart />
    </div>
  )
}
