"use client"

import { Bell, Search, Compass, ShoppingCart } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { guideForPath } from "@/lib/onboarding/guides"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  const { user, logout, canUsePos } = useAuth()
  const { openGuide, startGuide } = useOnboarding()
  const router = useRouter()
  const pathname = usePathname()

  // El botón "Guía" abre el recorrido de la sección actual (registrado en
  // `guides/`). Si la sección no tiene uno propio, cae a la bienvenida.
  function handleGuide() {
    const match = guideForPath(pathname)
    if (match) startGuide(match.id)
    else openGuide()
  }

  const initials = (user?.name ?? "Usuario")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <SidebarTrigger className="size-9" aria-label="Alternar menú lateral" />
      <Separator orientation="vertical" className="mr-1 hidden h-6 md:block" />

      {/* Buscador */}
      <div
        data-tour="buscar"
        className="relative ml-1 hidden max-w-md flex-1 sm:block"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="topbar-search" className="sr-only">
          Buscar en GoCheck
        </label>
        <Input
          id="topbar-search"
          type="search"
          placeholder="Buscar productos, facturas, clientes…"
          className="h-9 pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 sm:inline-flex"
          data-tour="guia"
          onClick={handleGuide}
          aria-label="Abrir la guía de uso"
          title="Guía de uso"
        >
          <Compass className="size-4" />
          Guía
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Notificaciones"
        >
          <Bell />
        </Button>

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
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
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
            <DropdownMenuItem>Mi perfil</DropdownMenuItem>
            <DropdownMenuItem>Preferencias</DropdownMenuItem>
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
