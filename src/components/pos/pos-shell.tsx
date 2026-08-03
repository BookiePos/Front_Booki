"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Store, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { navItems } from "@/lib/pos/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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

function SedeSelector() {
  const { sedes, sedeId, sede, setSedeId } = useSede()

  if (sedes.length === 0) {
    return (
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
        <MapPin className="size-4" />
        Sin sede
      </Badge>
    )
  }

  if (sedes.length === 1) {
    return (
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
        <MapPin className="size-4" />
        {sede?.name}
      </Badge>
    )
  }

  return (
    <Select value={sedeId} onValueChange={(v) => v && setSedeId(v)}>
      <SelectTrigger className="h-10 w-[180px]" aria-label="Seleccionar sede">
        <MapPin className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Sede" />
      </SelectTrigger>
      <SelectContent>
        {sedes.map((s) => (
          <SelectItem key={s._id} value={s._id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
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
          <SedeSelector />
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <NavLinks />
      </div>
    </div>
  )
}
