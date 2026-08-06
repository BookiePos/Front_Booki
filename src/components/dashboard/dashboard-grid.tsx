"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  X,
  Plus,
  Pencil,
  Check,
  RotateCcw,
  RefreshCw,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data"
import {
  availableWidgets,
  WIDGET_BY_ID,
  DEFAULT_LAYOUT,
} from "@/lib/dashboard/registry"
import { readLayout, writeLayout } from "@/lib/dashboard/layout-store"
import type { LayoutItem, WidgetSize } from "@/lib/dashboard/types"
import { Button } from "@/components/ui/button"

/** Clases de columnas según el ancho del widget (grilla de 3 columnas en xl). */
function spanClass(size: WidgetSize): string {
  if (size === "full") return "md:col-span-2 xl:col-span-3"
  if (size === "wide") return "md:col-span-2 xl:col-span-2"
  return ""
}

export function DashboardGrid() {
  const { user, hasPermission, tipoNegocio } = useAuth()
  const userId = user?.id ?? null
  const { data, loading, reload } = useDashboardData()

  const available = React.useMemo(
    () => availableWidgets(hasPermission, tipoNegocio),
    [hasPermission, tipoNegocio],
  )
  const availableIds = React.useMemo(
    () => new Set(available.map((w) => w.id)),
    [available],
  )

  const defaultLayout = React.useCallback(
    (): LayoutItem[] => DEFAULT_LAYOUT.filter((it) => availableIds.has(it.id)),
    [availableIds],
  )

  const [layout, setLayout] = React.useState<LayoutItem[]>([])
  const [editing, setEditing] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  // Carga el layout guardado del usuario (o el de por defecto), descartando
  // widgets a los que ya no tiene acceso.
  React.useEffect(() => {
    if (!userId) return
    const stored = readLayout(userId)
    const base = stored ?? defaultLayout()
    setLayout(base.filter((it) => availableIds.has(it.id) && WIDGET_BY_ID[it.id]))
    setReady(true)
  }, [userId, availableIds, defaultLayout])

  const persist = React.useCallback(
    (next: LayoutItem[]) => {
      setLayout(next)
      if (userId) writeLayout(userId, next)
    },
    [userId],
  )

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= layout.length) return
    const next = [...layout]
    ;[next[index], next[target]] = [next[target], next[index]]
    persist(next)
  }

  const resize = (index: number) => {
    const item = layout[index]
    const def = WIDGET_BY_ID[item.id]
    if (!def || def.sizes.length < 2) return
    const i = def.sizes.indexOf(item.size)
    const nextSize = def.sizes[(i + 1) % def.sizes.length]
    const next = [...layout]
    next[index] = { ...item, size: nextSize }
    persist(next)
  }

  const remove = (index: number) => {
    persist(layout.filter((_, i) => i !== index))
  }

  const add = (id: string) => {
    const def = WIDGET_BY_ID[id]
    if (!def) return
    persist([...layout, { id, size: def.defaultSize }])
  }

  const reset = () => persist(defaultLayout())

  const shownIds = new Set(layout.map((it) => it.id))
  const hidden = available.filter((w) => !shownIds.has(w.id))

  if (!ready) return null

  return (
    <div>
      {/* Barra de controles */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          title="Actualizar datos"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Actualizar
        </Button>
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw />
              Restablecer
            </Button>
            <Button size="sm" onClick={() => setEditing(false)}>
              <Check />
              Listo
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Personalizar
          </Button>
        )}
      </div>

      {/* Grilla de widgets */}
      {layout.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Tu tablero está vacío. Pulsa “Personalizar” para agregar widgets.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {layout.map((item, index) => {
            const def = WIDGET_BY_ID[item.id]
            if (!def) return null
            const Widget = def.Component
            return (
              <div
                key={item.id}
                className={`relative ${spanClass(item.size)} ${
                  editing ? "rounded-2xl ring-2 ring-primary/30" : ""
                }`}
              >
                {editing && (
                  <div className="absolute -top-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-md">
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover antes"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    {def.sizes.length > 1 && (
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        onClick={() => resize(index)}
                        aria-label="Cambiar tamaño"
                        title="Cambiar tamaño"
                      >
                        <Maximize2 className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                      onClick={() => move(index, 1)}
                      disabled={index === layout.length - 1}
                      aria-label="Mover después"
                    >
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
                      onClick={() => remove(index)}
                      aria-label="Quitar widget"
                      title="Quitar del tablero"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                <div
                  className={
                    editing ? "pointer-events-none select-none opacity-95" : ""
                  }
                >
                  <Widget data={data} loading={loading} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selector para agregar widgets (solo en modo edición) */}
      {editing && (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Agregar widgets
          </p>
          {hidden.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ya tienes todos los widgets disponibles en tu tablero.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hidden.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => add(w.id)}
                  className="group flex max-w-xs items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_28px_-18px_var(--primary)]"
                >
                  <span className="mt-0.5 flex size-6 items-center justify-center rounded-md bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:size-3.5">
                    <Plus />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {w.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {w.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
