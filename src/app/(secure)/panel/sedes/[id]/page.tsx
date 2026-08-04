"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  RefreshCw,
  Pencil,
  Power,
  PowerOff,
  ShieldOff,
  Store,
  MapPin,
  Wallet,
  Boxes,
  AlertTriangle,
  Clock,
  PackageX,
  Users,
  UserPlus,
  UserMinus,
  CheckCircle2,
  Plus,
  Tag,
  Trash2,
  ShoppingCart,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listSedes,
  getStock,
  getAlerts,
  updateSede,
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type Sede,
  type StockRow,
  type InvAlerts,
  type Discount,
  type DiscountType,
} from "@/lib/erp/api-inventory"
import { getSalesStats, type SalesStats } from "@/lib/erp/api-sales"
import {
  listUsers,
  updateUser,
  listRoles,
  type AdminUser,
  type AdminRole,
} from "@/lib/api-admin"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { SedeSheet } from "@/components/erp/sede-sheet"
import { SedeMap } from "@/components/erp/sede-map"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

// ─── KPI ───────────────────────────────────────────────────────────────────────

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  tone?: "default" | "warning"
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={
            tone === "warning"
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600"
              : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          }
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl leading-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sheet asignar empleados ───────────────────────────────────────────────────

interface AssignSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  sedeName: string
  users: AdminUser[]
  roleName: (key: string) => string
  onChanged: () => void
}

function AssignEmployeesSheet({
  open,
  onOpenChange,
  sedeId,
  sedeName,
  users,
  roleName,
  onChanged,
}: AssignSheetProps) {
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const candidates = users.filter(
    (u) => u.active && !u.sedeIds.includes(sedeId),
  )

  async function assign(u: AdminUser) {
    setBusyId(u.id)
    setError(null)
    try {
      await updateUser(u.id, { sedeIds: [...u.sedeIds, sedeId] })
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Asignar empleados
          </SheetTitle>
          <SheetDescription>
            Agrega empleados a <span className="font-medium">{sedeName}</span>.
            Solo se muestran usuarios activos aún no asignados.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 py-2">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {candidates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay usuarios disponibles para asignar.
            </p>
          ) : (
            candidates.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <Badge variant="secondary">{roleName(u.role)}</Badge>
                <Button
                  size="sm"
                  disabled={busyId === u.id}
                  onClick={() => void assign(u)}
                >
                  <UserPlus />
                  Agregar
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function SedeDetailPage() {
  const params = useParams<{ id: string }>()
  const sedeId = params.id
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canManage = hasPermission("sede.manage")
  const canManageUsers = hasPermission("users.manage")

  const [sede, setSede] = React.useState<Sede | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [stock, setStock] = React.useState<StockRow[]>([])
  const [alerts, setAlerts] = React.useState<InvAlerts | null>(null)
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [salesStats, setSalesStats] = React.useState<SalesStats | null>(null)
  const [discounts, setDiscounts] = React.useState<Discount[]>([])

  const [editOpen, setEditOpen] = React.useState(false)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [discountSheetOpen, setDiscountSheetOpen] = React.useState(false)
  const [editingDiscount, setEditingDiscount] = React.useState<Discount | null>(null)
  const [toggling, setToggling] = React.useState(false)
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null)
  const [busyDiscountId, setBusyDiscountId] = React.useState<string | null>(null)

  const fetchSede = React.useCallback(async () => {
    const all = await listSedes()
    const found = all.find((s) => s._id === sedeId) ?? null
    setSede(found)
    setNotFound(!found)
  }, [sedeId])

  const fetchUsers = React.useCallback(async () => {
    if (!canManageUsers) return
    setUsers(await listUsers())
  }, [canManageUsers])

  const loadAll = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      setError(null)
      // La sede es esencial; el resto de secciones degradan de forma independiente
      // (p. ej. un usuario con sede.manage pero sin inventory.view igual ve la sede).
      try {
        await fetchSede()
      } catch (err) {
        setError(errorMessage(err))
      }
      await Promise.all([
        getStock(sedeId).then(setStock).catch(() => setStock([])),
        getAlerts(sedeId).then(setAlerts).catch(() => setAlerts(null)),
        getSalesStats(sedeId).then(setSalesStats).catch(() => setSalesStats(null)),
        listDiscounts(sedeId).then(setDiscounts).catch(() => setDiscounts([])),
        fetchUsers().catch(() => {}),
        canManageUsers
          ? listRoles().then(setRoles).catch(() => {})
          : Promise.resolve(),
      ])
      setLoading(false)
    },
    [sedeId, fetchSede, fetchUsers, canManageUsers],
  )

  React.useEffect(() => {
    if (!canManage) return
    void loadAll()
  }, [canManage, loadAll])

  // Mantener fresco: al volver a la pestaña/ventana se recarga en silencio,
  // para que los cambios hechos en Inventario se reflejen sin recargar a mano.
  React.useEffect(() => {
    if (!canManage) return
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadAll({ silent: true })
      }
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [canManage, loadAll])

  const roleName = React.useCallback(
    (key: string) => roles.find((r) => r.key === key)?.name ?? key,
    [roles],
  )

  // Valor del inventario a costo real = Σ del valor de cada referencia
  // (que el backend calcula por lote: Σ qty × unitCost de cada lote).
  const inventoryValue = React.useMemo(
    () => stock.reduce((sum, r) => sum + r.value, 0),
    [stock],
  )
  const skusWithStock = React.useMemo(
    () => stock.filter((r) => r.qty > 0).length,
    [stock],
  )
  const alertCount =
    (alerts?.lowStock.length ?? 0) +
    (alerts?.expired.length ?? 0) +
    (alerts?.expiringSoon.length ?? 0)

  const employees = React.useMemo(
    () => users.filter((u) => u.sedeIds.includes(sedeId)),
    [users, sedeId],
  )

  async function handleToggle() {
    if (!sede) return
    if (
      !window.confirm(
        sede.active
          ? `¿Desactivar la sede "${sede.name}"?`
          : `¿Reactivar la sede "${sede.name}"?`,
      )
    )
      return
    setToggling(true)
    try {
      const updated = await updateSede(sede._id, { active: !sede.active })
      setSede(updated)
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setToggling(false)
    }
  }

  async function removeEmployee(u: AdminUser) {
    if (!window.confirm(`¿Quitar a ${u.name} de esta sede?`)) return
    setBusyUserId(u.id)
    try {
      await updateUser(u.id, {
        sedeIds: u.sedeIds.filter((id) => id !== sedeId),
      })
      await fetchUsers()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyUserId(null)
    }
  }

  const refreshDiscounts = React.useCallback(async () => {
    try {
      setDiscounts(await listDiscounts(sedeId))
    } catch {
      /* silencioso */
    }
  }, [sedeId])

  async function handleToggleDiscount(d: Discount) {
    setBusyDiscountId(d._id)
    try {
      await updateDiscount(d._id, { active: !d.active })
      await refreshDiscounts()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyDiscountId(null)
    }
  }

  async function handleDeleteDiscount(d: Discount) {
    if (!window.confirm(`¿Eliminar el descuento "${d.name}"?`)) return
    setBusyDiscountId(d._id)
    try {
      await deleteDiscount(d._id)
      await refreshDiscounts()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyDiscountId(null)
    }
  }

  function discountLabel(d: Discount): string {
    return d.type === "percent" ? `${d.value}%` : money.format(d.value)
  }

  // ── Sin permiso ────────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <>
        <PageHeader section="Sedes" title="Detalle de sede" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para gestionar sedes.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const backButton = (
    <Button variant="outline" onClick={() => router.push("/panel/sedes")}>
      <ArrowLeft />
      Volver
    </Button>
  )

  if (notFound) {
    return (
      <>
        <PageHeader section="Sedes" title="Sede no encontrada" actions={backButton} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Store className="size-10 text-muted-foreground" />
            <p className="max-w-xs text-sm text-muted-foreground">
              La sede que buscas no existe o fue eliminada.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Sedes"
        title={sede ? sede.name : "Cargando…"}
        description={
          sede
            ? `Código ${sede.code}${sede.address ? ` · ${sede.address}` : ""}`
            : undefined
        }
        actions={
          <>
            {backButton}
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void loadAll({ silent: true })}
            >
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              Actualizar
            </Button>
            {sede && (
              <>
                <Button
                  variant="outline"
                  data-tour="sede-editar"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  className={
                    sede.active
                      ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                      : ""
                  }
                  disabled={toggling}
                  onClick={() => void handleToggle()}
                >
                  {sede.active ? <PowerOff /> : <Power />}
                  {sede.active ? "Desactivar" : "Activar"}
                </Button>
              </>
            )}
          </>
        }
      />

      {sede && (
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {sede.address || "Sin dirección registrada"}
          </span>
          <Badge variant={sede.active ? "default" : "outline"} className="ml-auto">
            {sede.active ? "Activa" : "Inactiva"}
          </Badge>
        </div>
      )}

      {error && (
        <Card className="mb-4">
          <CardContent className="py-6 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* ── Ventas de hoy ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kpi
            icon={Wallet}
            label="Ventas de hoy"
            value={money.format(salesStats?.total ?? 0)}
            hint="Total facturado hoy (sin anuladas)"
          />
          <Kpi
            icon={ShoppingCart}
            label="N.º de ventas hoy"
            value={nf.format(salesStats?.count ?? 0)}
            hint="Ventas completadas hoy"
          />
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi
            icon={Wallet}
            label="Valor del inventario"
            value={money.format(inventoryValue)}
            hint="Costo real por lote"
          />
          <Kpi
            icon={Boxes}
            label="Referencias con stock"
            value={nf.format(skusWithStock)}
            hint={`${stock.length} referencia(s) en total`}
          />
          <Kpi
            icon={AlertTriangle}
            label="Alertas activas"
            value={nf.format(alertCount)}
            hint="Stock bajo y vencimientos"
            tone={alertCount > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* ── Ubicación ─────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Ubicación</CardTitle>
          <CardDescription>
            {sede?.address
              ? sede.address
              : "Ubicación de la sede en el mapa."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full rounded-lg" />
          ) : (
            <SedeMap
              address={sede?.address}
              ciudad={sede?.ciudad}
              departamento={sede?.departamento}
              name={sede?.name}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Alertas ───────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Notificaciones</CardTitle>
          <CardDescription>
            Stock bajo el mínimo e ingredientes próximos a vencer o vencidos en
            esta sede.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : alertCount === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-8 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Todo en orden. No hay alertas de stock ni vencimientos.
              </p>
            </div>
          ) : (
            <>
              {/* Stock bajo */}
              {(alerts?.lowStock.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <PackageX className="size-4 text-amber-600" />
                    Stock bajo el mínimo ({alerts!.lowStock.length})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {alerts!.lowStock.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          Tienes poco <span className="font-medium">{row.product.name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {nf.format(row.qty)} / mín {nf.format(row.minStock)}{" "}
                          {row.product.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Vencidos */}
              {(alerts?.expired.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle className="size-4 text-destructive" />
                    Ingredientes vencidos ({alerts!.expired.length})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {alerts!.expired.map((lot) => (
                      <li
                        key={lot._id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">
                            {lot.productId.name}
                          </span>{" "}
                          · lote {lot.lotCode}
                        </span>
                        <span className="shrink-0 font-mono text-xs text-destructive">
                          venció {formatDate(lot.expiresAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Próximos a vencer */}
              {(alerts?.expiringSoon.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Clock className="size-4 text-amber-600" />
                    Próximos a vencer ({alerts!.expiringSoon.length})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {alerts!.expiringSoon.map((lot) => {
                      const d = daysUntil(lot.expiresAt)
                      return (
                        <li
                          key={lot._id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium">
                              {lot.productId.name}
                            </span>{" "}
                            está a punto de vencer · lote {lot.lotCode}
                          </span>
                          <span className="shrink-0 font-mono text-xs text-amber-600">
                            {d !== null && d >= 0
                              ? `en ${d} día${d !== 1 ? "s" : ""}`
                              : formatDate(lot.expiresAt)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Descuentos ────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-lg">Descuentos</CardTitle>
              <CardDescription>
                Descuentos de esta sede. Se aplican por producto al vender en el
                POS.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingDiscount(null)
                setDiscountSheetOpen(true)
              }}
            >
              <Plus />
              Nuevo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Tag className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aún no hay descuentos en esta sede.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {discounts.map((d) => (
                <li
                  key={d._id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Tag className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.type === "percent" ? "Porcentaje" : "Monto fijo"} ·{" "}
                      {discountLabel(d)}
                    </p>
                  </div>
                  <Badge variant={d.active ? "default" : "outline"}>
                    {d.active ? "Activo" : "Inactivo"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyDiscountId === d._id}
                    onClick={() => void handleToggleDiscount(d)}
                  >
                    {d.active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => {
                      setEditingDiscount(d)
                      setDiscountSheetOpen(true)
                    }}
                  >
                    <Pencil />
                    <span className="sr-only">Editar {d.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busyDiscountId === d._id}
                    onClick={() => void handleDeleteDiscount(d)}
                  >
                    <Trash2 />
                    <span className="sr-only">Eliminar {d.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Empleados ─────────────────────────────────────────────────────── */}
      {canManageUsers && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="font-display text-lg">Empleados</CardTitle>
                <CardDescription>
                  Personas asignadas a operar en esta sede.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <UserPlus />
                Asignar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Users className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Aún no hay empleados asignados a esta sede.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {employees.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase text-muted-foreground">
                      {u.name.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                    <Badge variant="secondary">{roleName(u.role)}</Badge>
                    <Badge variant={u.active ? "default" : "outline"}>
                      {u.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busyUserId === u.id}
                      onClick={() => void removeEmployee(u)}
                    >
                      <UserMinus />
                      <span className="sr-only">Quitar a {u.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sheets ────────────────────────────────────────────────────────── */}
      {sede && (
        <SedeSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          sede={sede}
          onSuccess={(updated) => setSede(updated)}
        />
      )}

      {sede && canManageUsers && (
        <AssignEmployeesSheet
          open={assignOpen}
          onOpenChange={setAssignOpen}
          sedeId={sedeId}
          sedeName={sede.name}
          users={users}
          roleName={roleName}
          onChanged={fetchUsers}
        />
      )}

      <DiscountSheet
        open={discountSheetOpen}
        onOpenChange={setDiscountSheetOpen}
        sedeId={sedeId}
        discount={editingDiscount}
        onSuccess={() => {
          setDiscountSheetOpen(false)
          void refreshDiscounts()
        }}
      />
    </>
  )
}

// ─── Sheet crear/editar descuento ──────────────────────────────────────────────

interface DiscountSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  discount: Discount | null
  onSuccess: () => void
}

function DiscountSheet({
  open,
  onOpenChange,
  sedeId,
  discount,
  onSuccess,
}: DiscountSheetProps) {
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<DiscountType>("percent")
  const [value, setValue] = React.useState("")
  const [active, setActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (discount) {
        setName(discount.name)
        setType(discount.type)
        setValue(String(discount.value))
        setActive(discount.active)
      } else {
        setName("")
        setType("percent")
        setValue("")
        setActive(true)
      }
      setError(null)
    }
    void reset()
  }, [open, discount])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (!(n > 0)) {
      setError("Ingresa un valor mayor que cero")
      return
    }
    if (type === "percent" && n > 100) {
      setError("El porcentaje no puede superar 100")
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (discount) {
        await updateDiscount(discount._id, { name: name.trim(), type, value: n, active })
      } else {
        await createDiscount({ sedeId, name: name.trim(), type, value: n, active })
      }
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {discount ? "Editar descuento" : "Nuevo descuento"}
          </SheetTitle>
          <SheetDescription>
            Define un descuento que se podrá aplicar por producto en el POS.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-name">Nombre</Label>
            <Input
              id="d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cliente frecuente, Empleado…"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-type">Tipo</Label>
              <Select
                value={type}
                items={{ percent: "Porcentaje (%)", amount: "Monto fijo ($)" }}
                onValueChange={(v) => {
                  if (v === "percent" || v === "amount") setType(v)
                }}
              >
                <SelectTrigger id="d-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentaje (%)</SelectItem>
                  <SelectItem value="amount">Monto fijo ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-value">
                {type === "percent" ? "Porcentaje" : "Monto"}
              </Label>
              <Input
                id="d-value"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percent" ? "10" : "2000"}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="d-active"
              checked={active}
              onCheckedChange={(v) => setActive(Boolean(v))}
            />
            <Label htmlFor="d-active">Descuento activo</Label>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : discount ? "Guardar" : "Crear descuento"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
