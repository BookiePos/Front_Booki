"use client"

import * as React from "react"
import { FondoLibro } from "@/components/ui/fondo-libro"
import { useRouter } from "next/navigation"
import { ChevronRight, LogOut, Store } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import { getCurrentCaja, type CajaSession } from "@/lib/pos/api-caja"
import { useCerrarSesion } from "@/hooks/use-cerrar-sesion"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"

/** `undefined` = consultando; `"?"` = no se pudo saber. */
type Estado = CajaSession | null | "?" | undefined

const hora = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
})

/**
 * Elección de sede al entrar al POS, cuando la persona trabaja en varias.
 *
 * Es una lista, no un muro de tarjetas: nombre, dirección y, sobre todo, si
 * la caja de esa sede ya está abierta y desde cuándo. Ese dato es el que
 * decide en la práctica ("¿me toca abrir o ya abrió mi compañero?"). Cada
 * fila lleva su número para elegir con el teclado sin tocar el ratón.
 */
export function SelectorSede() {
  const { sedes, chooseSede, error } = useSede()
  const { user } = useAuth()
  const router = useRouter()
  const cerrarSesion = useCerrarSesion()
  const [estados, setEstados] = React.useState<Record<string, Estado>>({})
  const [ahora] = React.useState(() => new Date())

  // Estado de la caja de cada sede. Son pocas (una por local), así que se
  // piden en paralelo; si alguna falla, esa fila simplemente no lo muestra.
  React.useEffect(() => {
    let vivo = true
    void Promise.all(
      sedes.map((s) =>
        getCurrentCaja(s._id)
          .then((r) => [s._id, r.session] as const)
          .catch(() => [s._id, "?"] as const),
      ),
    ).then((pares) => {
      if (vivo) setEstados(Object.fromEntries(pares))
    })
    return () => {
      vivo = false
    }
  }, [sedes])

  // Atajo: el número de la fila elige la sede.
  React.useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > sedes.length) return
      const destino = e.target as HTMLElement | null
      if (destino?.closest("input, textarea, [contenteditable]")) return
      chooseSede(sedes[n - 1]._id)
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [sedes, chooseSede])

  async function salir() {
    if (await cerrarSesion()) router.replace("/login")
  }

  const nombre = user?.name?.split(" ")[0]
  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ahora)

  return (
    <main className="isolate flex min-h-screen flex-col bg-background">
      <FondoLibro />
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" />
          </span>
          <span className="text-sm font-semibold">Punto de venta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle size="sm" />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void salir()}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        </div>
      </header>

      <div className="libro-aparece mx-auto w-full max-w-2xl px-4 pb-16 pt-[9vh] md:px-6">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.015em]">
          ¿En qué sede trabajas hoy?
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {nombre ? `Hola, ${nombre}` : "Hola"} · {fecha}. Lo que vendas y tu
          caja quedan en la sede que elijas.
        </p>

        {error && (
          <p className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {sedes.map((s, i) => {
            const lugar = [s.address, s.ciudad].filter(Boolean).join(" · ")
            return (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => chooseSede(s._id)}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left outline-none transition-colors duration-100 hover:bg-muted/60 focus-visible:bg-muted/60 md:px-5"
                >
                  <kbd className="hidden size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-sans text-xs tabular-nums text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary sm:flex">
                    {i + 1}
                  </kbd>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{s.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {lugar || "Sin dirección registrada"}
                    </p>
                    <EstadoCaja estado={estados[s._id]} className="sm:hidden" />
                  </div>
                  <EstadoCaja
                    estado={estados[s._id]}
                    className="hidden shrink-0 sm:flex"
                  />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-salida group-hover:translate-x-0.5 motion-reduce:transform-none" />
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            Pulsa el número de la sede para entrar rápido.{" "}
          </span>
          Puedes cambiar de sede después desde tu menú.
        </p>
      </div>
    </main>
  )
}

function EstadoCaja({
  estado,
  className,
}: {
  estado: Estado
  className?: string
}) {
  if (estado === "?") return null
  if (estado === undefined) {
    return (
      <span
        className={cn(
          "mt-1 block h-3 w-24 animate-pulse rounded bg-muted sm:mt-0",
          className,
        )}
        aria-hidden="true"
      />
    )
  }
  const abierta = estado !== null
  return (
    <span
      className={cn(
        "mt-1 flex items-center gap-2 text-[13px] sm:mt-0",
        abierta ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          abierta ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      {abierta
        ? `Caja abierta desde ${hora.format(new Date(estado.openedAt))}`
        : "Caja cerrada"}
    </span>
  )
}
