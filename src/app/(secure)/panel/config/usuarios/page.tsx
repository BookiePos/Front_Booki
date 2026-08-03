"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Trash2,
  ShieldOff,
  Mail,
  Copy,
  Check,
  Send,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listUsers,
  createUser,
  updateUser,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listPermissionGroups,
  listInvitations,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  type AdminUser,
  type AdminRole,
  type PermissionGroup,
  type AdminInvitation,
  type CreatedInvitation,
  type CreateUserPayload,
  type UpdateUserPayload,
  type CreateRolePayload,
  type UpdateRolePayload,
} from "@/lib/api-admin"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

// ─── Acceso al POS ──────────────────────────────────────────────────────────
// El acceso al punto de venta se gobierna con el permiso `pos.sell`. Al
// activarlo también se concede `inventory.view` para que el trabajador vea la
// sección de inventario del POS. Las sedes del usuario definen DÓNDE puede
// vender (aislamiento por sede, validado en el backend).
const POS_PERMISSION = "pos.sell"
const POS_BUNDLE = ["pos.sell", "inventory.view"]

/** ¿El rol (por sus permisos) ya concede acceso al POS? */
function roleGrantsPos(roleKey: string, roles: AdminRole[]): boolean {
  return (
    roles.find((r) => r.key === roleKey)?.permissions.includes(POS_PERMISSION) ??
    false
  )
}

/** Acceso efectivo al POS de un usuario: por su rol o por permisos extra. */
function userHasPos(user: AdminUser, roles: AdminRole[]): boolean {
  return (
    roleGrantsPos(user.role, roles) ||
    user.extraPermissions.includes(POS_PERMISSION)
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── User Sheet ───────────────────────────────────────────────────────────────

interface UserSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  user?: AdminUser
  roles: AdminRole[]
  sedes: Sede[]
  permissionGroups: PermissionGroup[]
  onSuccess: () => void
}

function UserSheet({ open, onOpenChange, mode, user, roles, sedes, permissionGroups, onSuccess }: UserSheetProps) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState("")
  const [active, setActive] = React.useState(true)
  const [posAccess, setPosAccess] = React.useState(false)
  const [selectedSedes, setSelectedSedes] = React.useState<Set<string>>(new Set())
  // Permisos concedidos a ESTE usuario además de los de su rol.
  const [extraPerms, setExtraPerms] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Si el rol elegido ya trae POS, el acceso es inherente (toggle bloqueado).
  const rolePos = roleGrantsPos(role, roles)
  // Acceso efectivo mostrado: inherente por rol, o activado a mano.
  const posEnabled = rolePos || posAccess
  // Permisos que ya concede el rol elegido (se muestran marcados y bloqueados).
  const rolePermSet = React.useMemo(
    () => new Set(roles.find((r) => r.key === role)?.permissions ?? []),
    [roles, role],
  )

  // Reset on open/mode change — use async wrapper to satisfy set-state-in-effect rule
  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && user) {
        setName(user.name)
        setEmail(user.email)
        setPassword("")
        setRole(user.role)
        setActive(user.active)
        setPosAccess(user.extraPermissions.includes(POS_PERMISSION))
        setSelectedSedes(new Set(user.sedeIds))
        setExtraPerms(new Set(user.extraPermissions))
      } else {
        setName("")
        setEmail("")
        setPassword("")
        setRole(roles[0]?.key ?? "")
        setActive(true)
        setPosAccess(false)
        setSelectedSedes(new Set())
        setExtraPerms(new Set())
      }
      setError(null)
    }
    void reset()
  }, [open, mode, user, roles])

  function toggleSede(id: string) {
    setSelectedSedes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExtraPerm(key: string) {
    setExtraPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Sedes a mostrar: activas + cualquiera ya asignada aunque esté inactiva.
  const visibleSedes = sedes.filter(
    (s) => s.active || selectedSedes.has(s._id),
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const sedeIds = Array.from(selectedSedes)

      // Sin sede no puede operar el POS (el backend valida el aislamiento).
      if (posEnabled && sedeIds.length === 0) {
        setError(
          "Selecciona al menos una sede donde esta persona pueda usar el POS.",
        )
        setSaving(false)
        return
      }

      // Permisos extra del usuario: se parte de los seleccionados en el grid
      // (permisos adicionales al rol) y se aplica encima el acceso al POS del
      // toggle. Al desactivar POS solo se quita `pos.sell`.
      const extra = new Set(extraPerms)
      if (posAccess && !rolePos) {
        POS_BUNDLE.forEach((p) => extra.add(p))
      } else if (!posAccess) {
        extra.delete(POS_PERMISSION)
      }
      const extraPermissions = Array.from(extra)

      if (mode === "create") {
        const payload: CreateUserPayload = {
          email,
          password,
          name,
          role,
          sedeIds,
          extraPermissions,
        }
        await createUser(payload)
      } else if (user) {
        const payload: UpdateUserPayload = {
          name,
          role,
          active,
          sedeIds,
          extraPermissions,
        }
        if (password.trim()) payload.password = password
        await updateUser(user.id, payload)
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Crea una cuenta nueva para un miembro del equipo."
              : "Modifica el rol o estado del usuario."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-name">Nombre</Label>
            <Input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan García"
              required
            />
          </div>

          {mode === "create" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="u-email">Correo electrónico</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@empresa.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="u-password">Contraseña</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
            </>
          )}

          {mode === "edit" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-password-edit">Nueva contraseña (opcional)</Label>
              <Input
                id="u-password-edit"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="u-role">Rol</Label>
            <Select value={role} onValueChange={(v) => { if (v !== null) setRole(v) }}>
              <SelectTrigger id="u-role" className="w-full">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acceso al punto de venta (POS) */}
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={posEnabled}
                disabled={rolePos}
                onCheckedChange={(v) => setPosAccess(Boolean(v))}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Acceso al punto de venta (POS)
                </span>
                <span className="text-xs text-muted-foreground">
                  Permite entrar al POS y vender en las sedes asignadas abajo.
                </span>
              </span>
            </label>
            {rolePos && (
              <p className="text-xs text-muted-foreground">
                El rol seleccionado ya incluye acceso al POS.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sedes{posEnabled ? " del POS" : ""}</Label>
            <p className="text-xs text-muted-foreground">
              {posEnabled
                ? "Sedes donde puede vender. Si asignas varias, elegirá una al iniciar el POS."
                : "Sedes donde esta persona puede operar."}
            </p>
            {visibleSedes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                No hay sedes registradas. Crea una en Operación → Sedes.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {visibleSedes.map((s) => (
                  <label
                    key={s._id}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted last:rounded-b-lg first:rounded-t-lg"
                  >
                    <Checkbox
                      checked={selectedSedes.has(s._id)}
                      onCheckedChange={() => toggleSede(s._id)}
                    />
                    <span className="text-sm text-foreground">{s.name}</span>
                    {!s.active && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        Inactiva
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="u-active"
                checked={active}
                onCheckedChange={(v) => setActive(Boolean(v))}
              />
              <Label htmlFor="u-active">Usuario activo</Label>
            </div>
          )}

          {/* Permisos de este usuario (además de los de su rol) */}
          <div className="flex flex-col gap-2">
            <Label>Permisos del usuario</Label>
            <p className="text-xs text-muted-foreground">
              Concede permisos a esta persona <span className="font-medium">además</span>{" "}
              de los de su rol. Los que ya da el rol salen marcados como
              «por rol» y no se quitan aquí. El acceso al POS se controla arriba.
            </p>
            {permissionGroups.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Cargando catálogo de permisos…
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {permissionGroups.map((group) => {
                  const items = group.items.filter(
                    (i) => !POS_BUNDLE.includes(i.key),
                  )
                  if (items.length === 0) return null
                  return (
                    <div
                      key={group.group}
                      className="rounded-lg border border-border"
                    >
                      <div className="rounded-t-lg bg-muted px-3 py-2 text-sm font-medium">
                        {group.label}
                      </div>
                      <div className="flex flex-col divide-y divide-border">
                        {items.map((item) => {
                          const byRole = rolePermSet.has(item.key)
                          const checked = byRole || extraPerms.has(item.key)
                          return (
                            <label
                              key={item.key}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 transition-colors last:rounded-b-lg",
                                byRole
                                  ? "cursor-not-allowed opacity-70"
                                  : "cursor-pointer hover:bg-muted",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={byRole}
                                onCheckedChange={() => toggleExtraPerm(item.key)}
                              />
                              <span className="text-sm text-foreground">
                                {item.label}
                              </span>
                              {byRole && (
                                <Badge
                                  variant="outline"
                                  className="ml-auto text-[11px]"
                                >
                                  por rol
                                </Badge>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <SheetFooter className="px-0 pt-2">
            <SheetClose
              render={
                <Button variant="outline" type="button" />
              }
            >
              Cancelar
            </SheetClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : mode === "create" ? "Crear usuario" : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Role Sheet ───────────────────────────────────────────────────────────────

interface RoleSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  role?: AdminRole
  permissionGroups: PermissionGroup[]
  onSuccess: () => void
}

function RoleSheet({ open, onOpenChange, mode, role, permissionGroups, onSuccess }: RoleSheetProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [selectedPerms, setSelectedPerms] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && role) {
        setName(role.name)
        setDescription(role.description ?? "")
        setSelectedPerms(new Set(role.permissions))
      } else {
        setName("")
        setDescription("")
        setSelectedPerms(new Set())
      }
      setError(null)
    }
    void reset()
  }, [open, mode, role])

  function togglePerm(key: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleGroup(items: PermissionGroup["items"]) {
    const allSelected = items.every((item) => selectedPerms.has(item.key))
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        items.forEach((item) => next.delete(item.key))
      } else {
        items.forEach((item) => next.add(item.key))
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (mode === "create") {
        const payload: CreateRolePayload = {
          name,
          description: description || undefined,
          permissions: Array.from(selectedPerms),
        }
        await createRole(payload)
      } else if (role) {
        const payload: UpdateRolePayload = {
          name,
          description: description || undefined,
          permissions: Array.from(selectedPerms),
        }
        await updateRole(role.id, payload)
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {mode === "create" ? "Nuevo rol" : "Editar rol"}
          </SheetTitle>
          <SheetDescription>
            Define el nombre y los permisos que tendrá este rol.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-name">Nombre del rol</Label>
            <Input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cajero, Bodeguero…"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-desc">Descripción (opcional)</Label>
            <Input
              id="r-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de este rol"
            />
          </div>

          {permissionGroups.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Permisos</p>
              {permissionGroups.map((group) => {
                const allSelected = group.items.every((item) =>
                  selectedPerms.has(item.key),
                )
                const someSelected = group.items.some((item) =>
                  selectedPerms.has(item.key),
                )
                return (
                  <div key={group.group} className="rounded-lg border border-border">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items)}
                      className="flex w-full items-center gap-2.5 rounded-t-lg px-3 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                          allSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : someSelected
                              ? "border-primary bg-primary/20"
                              : "border-input bg-transparent",
                        )}
                        aria-hidden="true"
                      >
                        {allSelected && (
                          <svg viewBox="0 0 10 10" fill="none" className="size-3">
                            <path
                              d="M2 5l2.5 2.5L8 2.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {!allSelected && someSelected && (
                          <svg viewBox="0 0 10 10" fill="none" className="size-3">
                            <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-medium">{group.label}</span>
                    </button>

                    {/* Permission items */}
                    <div className="flex flex-col divide-y divide-border">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-muted transition-colors last:rounded-b-lg"
                        >
                          <Checkbox
                            checked={selectedPerms.has(item.key)}
                            onCheckedChange={() => togglePerm(item.key)}
                          />
                          <span className="text-sm text-foreground">{item.label}</span>
                          <span className="ml-auto text-xs text-muted-foreground font-mono">
                            {item.key}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {permissionGroups.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Cargando catálogo de permisos…
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <SheetFooter className="px-0 pt-2">
            <SheetClose
              render={
                <Button variant="outline" type="button" />
              }
            >
              Cancelar
            </SheetClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : mode === "create" ? "Crear rol" : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Invite Sheet ─────────────────────────────────────────────────────────────

interface InviteSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  roles: AdminRole[]
  onSuccess: () => void
}

function InviteSheet({ open, onOpenChange, roles, onSuccess }: InviteSheetProps) {
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<CreatedInvitation | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setEmail("")
      setRole(roles[0]?.key ?? "")
      setError(null)
      setResult(null)
      setCopied(false)
    }
    void reset()
  }, [open, roles])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const inv = await createInvitation({ email, role })
      setResult(inv)
      onSuccess()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard bloqueado: el usuario puede copiar manualmente
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Invitar por correo
          </SheetTitle>
          <SheetDescription>
            Enviaremos un enlace para que la persona defina su contraseña y se
            una con el rol que elijas.
          </SheetDescription>
        </SheetHeader>

        {!result ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-email">Correo electrónico</Label>
              <Input
                id="i-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-role">Rol</Label>
              <Select value={role} onValueChange={(v) => { if (v !== null) setRole(v) }}>
                <SelectTrigger id="i-role" className="w-full">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <SheetFooter className="px-0 pt-2">
              <SheetClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </SheetClose>
              <Button type="submit" disabled={saving || !role}>
                <Send />
                {saving ? "Enviando…" : "Enviar invitación"}
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-2">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 py-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-5" />
              </span>
              <p className="font-display text-base text-foreground">
                Invitación creada
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {result.emailSent
                  ? `Enviamos un correo a ${result.email}.`
                  : `No se pudo enviar el correo (revisa la API key de Resend). Comparte el enlace manualmente con ${result.email}.`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Enlace de invitación</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.inviteUrl}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  aria-label="Copiar enlace"
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Válido hasta que expire o se acepte.
              </p>
            </div>

            <SheetFooter className="px-0 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setResult(null)
                  setEmail("")
                  setRole(roles[0]?.key ?? "")
                }}
              >
                Invitar a otro
              </Button>
              <SheetClose render={<Button type="button" />}>Listo</SheetClose>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Invitation status badge ──────────────────────────────────────────────────

function InvitationBadge({ status }: { status: AdminInvitation["status"] }) {
  const map: Record<
    AdminInvitation["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    pending: { label: "Pendiente", variant: "secondary" },
    accepted: { label: "Aceptada", variant: "default" },
    expired: { label: "Expirada", variant: "outline" },
    revoked: { label: "Revocada", variant: "outline" },
  }
  const { label, variant } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { hasPermission } = useAuth()

  // Tab state
  const [tab, setTab] = React.useState<"usuarios" | "roles">("usuarios")

  // Users state
  const [users, setUsers] = React.useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = React.useState(true)
  const [usersError, setUsersError] = React.useState<string | null>(null)

  // Roles state
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [rolesLoading, setRolesLoading] = React.useState(true)
  const [rolesError, setRolesError] = React.useState<string | null>(null)

  // Permission groups (for role editor)
  const [permGroups, setPermGroups] = React.useState<PermissionGroup[]>([])

  // Sedes (para asignar a usuarios y mostrarlas en la tabla)
  const [sedes, setSedes] = React.useState<Sede[]>([])

  // Invitations state
  const [invitations, setInvitations] = React.useState<AdminInvitation[]>([])
  const [invitesLoading, setInvitesLoading] = React.useState(true)
  const [invitesError, setInvitesError] = React.useState<string | null>(null)
  const [inviteSheetOpen, setInviteSheetOpen] = React.useState(false)

  // User sheet
  const [userSheetOpen, setUserSheetOpen] = React.useState(false)
  const [userSheetMode, setUserSheetMode] = React.useState<"create" | "edit">("create")
  const [editingUser, setEditingUser] = React.useState<AdminUser | undefined>()

  // Role sheet
  const [roleSheetOpen, setRoleSheetOpen] = React.useState(false)
  const [roleSheetMode, setRoleSheetMode] = React.useState<"create" | "edit">("create")
  const [editingRole, setEditingRole] = React.useState<AdminRole | undefined>()

  // Fetch functions
  async function fetchUsers() {
    setUsersLoading(true)
    setUsersError(null)
    try {
      const data = await listUsers()
      setUsers(data)
    } catch (err) {
      setUsersError(errorMessage(err))
    } finally {
      setUsersLoading(false)
    }
  }

  async function fetchRoles() {
    setRolesLoading(true)
    setRolesError(null)
    try {
      const data = await listRoles()
      setRoles(data)
    } catch (err) {
      setRolesError(errorMessage(err))
    } finally {
      setRolesLoading(false)
    }
  }

  async function fetchPermGroups() {
    try {
      const data = await listPermissionGroups()
      setPermGroups(data)
    } catch {
      // non-critical: catalog may not be ready yet
    }
  }

  async function fetchSedes() {
    try {
      setSedes(await listSedes())
    } catch {
      // non-critical: el selector de sedes queda vacío
    }
  }

  async function fetchInvitations() {
    setInvitesLoading(true)
    setInvitesError(null)
    try {
      const data = await listInvitations()
      setInvitations(data)
    } catch (err) {
      setInvitesError(errorMessage(err))
    } finally {
      setInvitesLoading(false)
    }
  }

  // On mount load everything
  React.useEffect(() => {
    async function init() {
      if (!hasPermission("users.manage")) return
      await Promise.all([
        fetchUsers(),
        fetchRoles(),
        fetchPermGroups(),
        fetchInvitations(),
        fetchSedes(),
      ])
    }
    void init()
  }, [hasPermission])

  async function handleResendInvite(inv: AdminInvitation) {
    try {
      await resendInvitation(inv.id)
      await fetchInvitations()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  async function handleRevokeInvite(inv: AdminInvitation) {
    if (!window.confirm(`¿Revocar la invitación de ${inv.email}?`)) return
    try {
      await revokeInvitation(inv.id)
      await fetchInvitations()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  // ── No permission ────────────────────────────────────────────────────────────
  if (!hasPermission("users.manage")) {
    return (
      <>
        <PageHeader
          section="Configuración"
          title="Usuarios y roles"
          description="Gestiona el acceso y los permisos del equipo."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para gestionar usuarios y roles. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  // ── Role/sede badge helpers ──────────────────────────────────────────────────
  const roleNameMap = Object.fromEntries(roles.map((r) => [r.key, r.name]))
  const sedeNameMap = Object.fromEntries(sedes.map((s) => [s._id, s.name]))

  async function handleDeleteRole(r: AdminRole) {
    if (!window.confirm(`¿Eliminar el rol "${r.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteRole(r.id)
      await fetchRoles()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        section="Configuración"
        title="Usuarios y roles"
        description="Gestiona el acceso y los permisos del equipo."
        actions={
          tab === "usuarios" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setInviteSheetOpen(true)}
              >
                <Mail />
                Invitar
              </Button>
              <Button
                onClick={() => {
                  setUserSheetMode("create")
                  setEditingUser(undefined)
                  setUserSheetOpen(true)
                }}
              >
                <Plus />
                Nuevo usuario
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setRoleSheetMode("create")
                setEditingRole(undefined)
                setRoleSheetOpen(true)
              }}
            >
              <Plus />
              Nuevo rol
            </Button>
          )
        }
      />

      {/* Segmented control */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("usuarios")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "usuarios"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Usuarios
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "roles"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Roles
        </button>
      </div>

      {/* ── Usuarios view ──────────────────────────────────────────────────── */}
      {tab === "usuarios" && (
        <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Usuarios</CardTitle>
            <CardDescription>Cuentas con acceso al GoCheck.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            {usersLoading ? (
              <TableSkeleton cols={6} rows={5} />
            ) : usersError ? (
              <p className="px-4 py-6 text-sm text-destructive">{usersError}</p>
            ) : users.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No hay usuarios registrados aún.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="hidden md:table-cell">Sedes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="secondary">
                            {roleNameMap[u.role] ?? u.role}
                          </Badge>
                          {userHasPos(u, roles) && (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              POS
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {u.sedeIds.length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.sedeIds.map((id) => (
                              <Badge key={id} variant="outline">
                                {sedeNameMap[id] ?? "Sede"}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.active ? "default" : "outline"}>
                          {u.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setUserSheetMode("edit")
                            setEditingUser(u)
                            setUserSheetOpen(true)
                          }}
                        >
                          <Pencil />
                          <span className="sr-only">Editar {u.name}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invitaciones pendientes */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Invitaciones</CardTitle>
            <CardDescription>
              Personas invitadas que aún no han activado su cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            {invitesLoading ? (
              <TableSkeleton cols={4} rows={2} />
            ) : invitesError ? (
              <p className="px-4 py-6 text-sm text-destructive">
                {invitesError}
              </p>
            ) : invitations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No hay invitaciones. Usa “Invitar” para agregar a alguien por
                correo.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => {
                    const closed =
                      inv.status === "accepted" || inv.status === "revoked"
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{inv.roleName}</Badge>
                        </TableCell>
                        <TableCell>
                          <InvitationBadge status={inv.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {!closed && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(inv)}
                              >
                                <Send />
                                Reenviar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRevokeInvite(inv)}
                              >
                                <Trash2 />
                                <span className="sr-only">
                                  Revocar invitación de {inv.email}
                                </span>
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* ── Roles view ─────────────────────────────────────────────────────── */}
      {tab === "roles" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Roles</CardTitle>
            <CardDescription>
              Define qué puede hacer cada tipo de usuario en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : rolesError ? (
              <p className="py-6 text-sm text-destructive">{rolesError}</p>
            ) : roles.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay roles configurados.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-medium text-foreground">
                          {r.name}
                        </span>
                        {r.isSystem && (
                          <Badge variant="outline" className="text-xs">
                            Sistema
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {r.permissions.length} permiso
                          {r.permissions.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {r.userCount} usuario
                          {r.userCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {r.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setRoleSheetMode("edit")
                          setEditingRole(r)
                          setRoleSheetOpen(true)
                        }}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {r.name}</span>
                      </Button>
                      {!r.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRole(r)}
                        >
                          <Trash2 />
                          <span className="sr-only">Eliminar {r.name}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sheets ─────────────────────────────────────────────────────────── */}
      <UserSheet
        open={userSheetOpen}
        onOpenChange={setUserSheetOpen}
        mode={userSheetMode}
        user={editingUser}
        roles={roles}
        sedes={sedes}
        permissionGroups={permGroups}
        onSuccess={fetchUsers}
      />

      <RoleSheet
        open={roleSheetOpen}
        onOpenChange={setRoleSheetOpen}
        mode={roleSheetMode}
        role={editingRole}
        permissionGroups={permGroups}
        onSuccess={fetchRoles}
      />

      <InviteSheet
        open={inviteSheetOpen}
        onOpenChange={setInviteSheetOpen}
        roles={roles}
        onSuccess={fetchInvitations}
      />
    </>
  )
}
