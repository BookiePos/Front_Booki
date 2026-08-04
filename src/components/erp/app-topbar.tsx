"use client"

import { Bell, Search, Compass } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { sedes } from "@/lib/erp/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppTopbar() {
  const { user, logout } = useAuth()
  const { openGuide } = useOnboarding()
  const router = useRouter()

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

      {/* Selector de sede */}
      <div data-tour="sede" className="flex items-center">
        <Select defaultValue={sedes[0].id}>
          <SelectTrigger
            className="h-9 w-[160px]"
            aria-label="Seleccionar sede"
          >
            <SelectValue placeholder="Sede" />
          </SelectTrigger>
          <SelectContent>
            {sedes.map((sede) => (
              <SelectItem key={sede.id} value={sede.id}>
                {sede.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
          onClick={openGuide}
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
            <DropdownMenuSeparator />
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
