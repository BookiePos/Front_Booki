"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Pencil,
  ShieldOff,
  MapPin,
  Store,
  Power,
  PowerOff,
  ChevronRight,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, updateSede, type Sede } from "@/lib/erp/api-inventory"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { SedeSheet } from "@/components/erp/sede-sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function SedesPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canManage = hasPermission("sede.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<Sede | undefined>()
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  const fetchSedes = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSedes(await listSedes())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!canManage) return
    void fetchSedes()
  }, [canManage, fetchSedes])

  async function handleToggle(sede: Sede) {
    if (
      !window.confirm(
        sede.active
          ? `¿Desactivar la sede "${sede.name}"? No aparecerá para operar hasta reactivarla.`
          : `¿Reactivar la sede "${sede.name}"?`,
      )
    )
      return
    setTogglingId(sede._id)
    try {
      await updateSede(sede._id, { active: !sede.active })
      await fetchSedes()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  // ── Sin permiso ────────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <>
        <PageHeader
          section="Operación"
          title="Sedes"
          description="Administra las sedes y locales del negocio."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para gestionar sedes. Contacta al administrador
              del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const activeCount = sedes.filter((s) => s.active).length

  return (
    <>
      <PageHeader
        section="Operación"
        title="Sedes"
        description="Administra las sedes y locales del negocio."
        actions={
          <Button
            onClick={() => {
              setSheetMode("create")
              setEditing(undefined)
              setSheetOpen(true)
            }}
          >
            <Plus />
            Nueva sede
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : sedes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Store className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">
              Aún no hay sedes
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Crea tu primera sede para empezar a operar inventario, compras y
              ventas por local.
            </p>
            <Button
              className="mt-1"
              onClick={() => {
                setSheetMode("create")
                setEditing(undefined)
                setSheetOpen(true)
              }}
            >
              <Plus />
              Crear sede
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {sedes.length} sede{sedes.length !== 1 ? "s" : ""} ·{" "}
            {activeCount} activa{activeCount !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sedes.map((sede) => (
              <Card
                key={sede._id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/panel/sedes/${sede._id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/panel/sedes/${sede._id}`)
                  }
                }}
                className="flex cursor-pointer flex-col justify-between transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Store className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-base text-foreground">
                          {sede.name}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {sede.code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={sede.active ? "default" : "outline"}>
                        {sede.active ? "Activa" : "Inactiva"}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>

                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      {sede.address || "Sin dirección registrada"}
                    </span>
                  </p>

                  <div className="mt-1 flex items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSheetMode("edit")
                        setEditing(sede)
                        setSheetOpen(true)
                      }}
                    >
                      <Pencil />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        sede.active
                          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                          : ""
                      }
                      disabled={togglingId === sede._id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleToggle(sede)
                      }}
                    >
                      {sede.active ? <PowerOff /> : <Power />}
                      {sede.active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <SedeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        sede={editing}
        onSuccess={fetchSedes}
      />
    </>
  )
}
