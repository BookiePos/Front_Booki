"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Store,
  MapPin,
  LayoutDashboard,
  Loader2,
  ChevronRight,
  Repeat,
  Compass,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { navItems } from "@/lib/pos/navigation"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { guideForPath } from "@/lib/onboarding/guides"
import { ProductTour } from "@/components/onboarding/product-tour"
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

function NavLinks({ vertical }: { vertical?: boolean }) {
  const pathname = usePathname()
  return (
    <nav
      // El tour resalta la navegación del terminal; marca solo la barra lateral
      // (vertical) para no apuntar dos veces al mismo objetivo en móvil.
      data-tour={vertical ? "pos-nav" : undefined}
      className={cn(
        vertical
          ? "flex flex-col gap-1"
          : "flex items-stretch justify-around",
      )}
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 font-medium transition-colors",
              vertical
                ? "h-12 text-sm"
                : "flex-1 flex-col justify-center gap-0.5 rounded-none px-1 py-1.5 text-[11px]",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={cn(vertical ? "size-5" : "size-5")} />
            <span className={cn(!vertical && "leading-none text-center")}>
              {item.title}
            </span>
            {item.wip && vertical && (
              <Badge variant="outline" className="ml-auto text-[10px]">
                pronto
              </Badge>
            )}
          </Link>
        )
      })}
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

/** Botón “Guía”: abre el recorrido de la pantalla actual del terminal. */
function GuideButton() {
  const pathname = usePathname()
  const { startGuide } = useOnboarding()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      data-tour="pos-guia"
      aria-label="Abrir la guía de esta pantalla"
      title="Guía de uso"
      onClick={() => {
        const match = guideForPath(pathname)
        if (match) startGuide(match.id)
      }}
    >
      <Compass className="size-4" />
      <span className="hidden sm:inline">Guía</span>
    </Button>
  )
}

/** Pantalla de elección de sede al entrar al POS (cuando hay varias). */
function SedePicker() {
  const { sedes, chooseSede, error } = useSede()
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <span className="font-display text-lg">Punto de venta</span>
        </div>
        <h1 className="mt-4 font-display text-2xl">
          ¿En qué sede vas a trabajar?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige tu sede para abrir el punto de venta. Todo lo que vendas y tu
          caja quedan en esa sede.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {sedes.map((s) => (
            <button
              key={s._id}
              type="button"
              onClick={() => chooseSede(s._id)}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                {s.address ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {s.address}
                  </p>
                ) : null}
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function UserMenu() {
  const { user, logout, canUseOperation } = useAuth()
  const { sedes, changeSede } = useSede()
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
        <Avatar className="size-10">
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
      <div className="flex min-h-screen items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    )
  }

  // Al entrar al POS (con más de una sede) se elige primero dónde se trabaja.
  if (!chosen) {
    return <SedePicker />
  }

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Barra lateral (desktop / tablet) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-background p-3 md:flex">
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
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <SedeBadge />
          <div className="ml-auto flex items-center gap-1.5">
            <GuideButton />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <NavLinks />
      </div>

      {/* Recorrido guiado (spotlight) del terminal. */}
      <ProductTour />
      <GuideAutoStart />
    </div>
  )
}
