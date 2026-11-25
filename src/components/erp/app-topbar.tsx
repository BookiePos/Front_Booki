"use client"

import Link from "next/link"
import { CircleHelp, Compass, ShoppingCart } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { abrirAyuda, cerrarAyuda, useAyudaAbierta } from "@/lib/ayuda/panel-store"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { GlobalSearch } from "@/components/erp/global-search"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useCerrarSesion } from "@/hooks/use-cerrar-sesion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppTopbar() {
  const { user, canUsePos } = useAuth()
  const cerrarSesion = useCerrarSesion()
  const router = useRouter()
  const ayudaAbierta = useAyudaAbierta()
  const { openGuide } = useOnboarding()

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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/88 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
      <SidebarTrigger className="size-8 shrink-0 text-muted-foreground" aria-label="Alternar menú lateral" />

      {/* Buscador: productos, clientes, proveedores y secciones del negocio */}
      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        {/* En móvil el botón se queda solo con el icono en vez de
            desaparecer: la guía es justo lo que necesita quien abre el panel
            por primera vez, y ahí suele hacerlo desde el teléfono. */}
        {/* Abre el panel de Ayuda de la sección: cómo se hace cada tarea, qué
            significa cada palabra y, desde ahí, el recorrido guiado. Antes
            lanzaba el recorrido directo, que tapa la pantalla: para una duda
            rápida era demasiado. */}
        <Button
          variant="ghost"
          size="sm"
          className={ayudaAbierta ? "gap-1.5 px-2 text-primary sm:px-3" : "gap-1.5 px-2 sm:px-3"}
          data-tour="guia"
          onClick={() => (ayudaAbierta ? cerrarAyuda() : abrirAyuda())}
          aria-label="Ayuda de esta pantalla"
          aria-expanded={ayudaAbierta}
          title="Ayuda de esta pantalla"
        >
          <CircleHelp className="size-4" />
          <span className="hidden sm:inline">Ayuda</span>
        </Button>
        <ThemeToggle size="sm" />
        {/* Una sola acción principal en toda la barra: vender. La campana se
            quitó: no hacía nada y prometía avisos que no existían (los
            pendientes reales están en Inicio). */}
        {canUsePos && (
          <Button size="sm" data-tour="nueva-venta" className="ml-1 hidden sm:inline-flex" render={<Link href="/pos" />}>
            <ShoppingCart />
            Vender
          </Button>
        )}

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
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/12 text-[11px] font-semibold text-primary">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
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
            {canUsePos && (
              <>
                <DropdownMenuItem onClick={() => router.push("/pos")}>
                  <ShoppingCart className="size-4" />
                  Ir al punto de venta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {/* Aquí había "Mi perfil" y "Preferencias", que no llevaban a
                ninguna parte: un botón que no hace nada enseña a no confiar
                en los demás. Van las dos ayudas que sí existen. */}
            <DropdownMenuItem onClick={abrirAyuda}>
              <CircleHelp className="size-4" />
              Ayuda de esta pantalla
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openGuide}>
              <Compass className="size-4" />
              Recorrido por BookiPos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void handleLogout()
              }}
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
