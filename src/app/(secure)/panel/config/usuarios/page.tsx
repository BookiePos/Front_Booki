"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Trash2,
  ShieldOff,
  ShieldCheck,
  Info,
  Mail,
  Copy,
  Check,
  Send,
  Store,
  KeyRound,
  Loader2,
  UserPlus,
  UserCog,
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
  FormDialog,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"
import { HelpTip, Termino } from "@/components/ui/help-tip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { PASSWORD_REQUISITOS, validarPassword } from "@/lib/password-policy"
import {
  POS_BUNDLE,
  POS_PERMISSION,
  OWNER_ROLE,
  isOwnerActor,
  actorSeesAllSedes,
  actorCanGrant,
  actorCanGrantSede,
  type Actor,
} from "@/lib/access"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/**
 * ¿Puede el actor asignar este rol? Espejo de `assertPuedeAsignarRol`: el rol
 * Dueño es solo del Dueño y nadie asigna un rol con permisos que no tiene.
 */
function actorCanAssignRole(actor: Actor, role: AdminRole): boolean {
  if (role.key === OWNER_ROLE && !isOwnerActor(actor)) return false
  return role.permissions.every((p) => actorCanGrant(actor, p))
}

/** Roles que el actor puede ofrecer; `keep` conserva el rol actual del usuario. */
function assignableRolesFor(
  roles: AdminRole[],
  actor: Actor,
  keep?: string,
): AdminRole[] {
  return roles.filter((r) => r.key === keep || actorCanAssignRole(actor, r))
}

/** Estado del catálogo de permisos (GET /permissions exige roles.manage). */
type CatalogState = "loading" | "ready" | "denied" | "error"

function CatalogPlaceholder({ state }: { state: CatalogState }) {
  return (
    <p
      role={state === "loading" ? undefined : "status"}
      className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
    >
      {state === "denied"
        ? "No tienes acceso al catálogo de permisos (requiere el permiso de gestionar roles), así que no puedes asignar permisos adicionales desde aquí."
        : state === "error"
          ? "No se pudo cargar el catálogo de permisos. Cierra la ficha e inténtalo de nuevo."
          : "Cargando catálogo de permisos…"}
    </p>
  )
}

// ─── Acceso al POS ──────────────────────────────────────────────────────────
// El acceso al punto de venta se gobierna con el permiso `pos.sell`. Al
// activarlo también se concede `inventory.view` para que el trabajador vea la
// sección de inventario del POS. Las sedes del usuario definen DÓNDE puede
// vender (aislamiento por sede, validado en el backend).

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

// ─── Ficha de usuario ────────────────────────────────────────────────────────

/**
 * Ids de los `<form>` de cada ficha.
 *
 * El botón de guardar vive en el pie fijo de la tarjeta, que está fuera del
 * `<form>`; `form={ID}` los vuelve a unir. Sin eso habría que renunciar al
 * envío con Enter, que es como se rellenan estos formularios de verdad.
 */
const USER_FORM_ID = "usuario-form"
const ROLE_FORM_ID = "rol-form"
const ROLE_LOCK_REASON_ID = "rol-bloqueo-motivo"
const INVITE_FORM_ID = "invitacion-form"

interface UserDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  user?: AdminUser
  roles: AdminRole[]
  sedes: Sede[]
  permissionGroups: PermissionGroup[]
  catalogState: CatalogState
  /** Dueños activos hoy: para avisar si se toca al último. */
  activeOwners: number
  /** Quien edita: de él dependen las reglas de jerarquía (espejo del backend). */
  actor: Actor
  onSuccess: () => void
}

function UserDialog({ open, onOpenChange, mode, user, roles, sedes, permissionGroups, catalogState, activeOwners, actor, onSuccess }: UserDialogProps) {
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

  // ── Jerarquía (el backend responde 403 a todo esto; aquí no se ofrece) ──
  // Solo el Dueño asigna el rol Dueño, y nadie un rol con permisos que no tiene;
  // al editar se conserva el rol actual aunque el actor no pudiera asignarlo.
  const currentRole = mode === "edit" ? user?.role : undefined
  const assignableRoles = React.useMemo(
    () => assignableRolesFor(roles, actor, currentRole),
    [roles, actor, currentRole],
  )
  const isSelf = mode === "edit" && !!user && user.id === actor.id
  // Solo el Dueño edita al Dueño: la ficha queda de solo lectura.
  const ownerLocked =
    mode === "edit" && user?.role === OWNER_ROLE && !isOwnerActor(actor)
  // Quien tiene permisos que el actor no tiene no se puede tocar (clave, estado,
  // rol, extras ni sedes).
  const outranked = React.useMemo(() => {
    if (mode !== "edit" || !user || isSelf) return false
    const perms = [
      ...(roles.find((r) => r.key === user.role)?.permissions ?? []),
      ...user.extraPermissions,
    ]
    return perms.some((p) => !actorCanGrant(actor, p))
  }, [mode, user, isSelf, roles, actor])
  const locked = ownerLocked || outranked
  // Reactivar a alguien "superado" se permite (no toma su cuenta); solo se
  // prohíbe desactivarlo. El Dueño sigue siendo intocable para quien no lo es.
  const activeLocked = ownerLocked || (outranked && !!user?.active)
  // Último Dueño activo: el backend rechaza desactivarlo o degradarlo.
  const isLastOwner =
    mode === "edit" && user?.role === OWNER_ROLE && !!user.active && activeOwners <= 1
  const lastOwnerRisk = isLastOwner && (!active || role !== OWNER_ROLE)
  const lockReason = ownerLocked
    ? "Solo el Dueño puede editar al Dueño."
    : outranked
      ? "Esta persona tiene permisos que tú no tienes: no puedes cambiar su contraseña, rol, permisos ni sedes, ni desactivarla."
      : isSelf
        ? "No puedes cambiar tu propio rol ni tus permisos, ni ampliar tus sedes: pídeselo a otra persona que gestione usuarios."
        : null

  // Si el rol elegido ya trae POS, el acceso es inherente (toggle bloqueado).
  const rolePos = roleGrantsPos(role, roles)
  // Acceso efectivo mostrado: inherente por rol, o activado a mano.
  const posEnabled = rolePos || posAccess
  // Dar el POS concede `pos.sell` + `inventory.view`: hay que tenerlos. Quitarlo
  // siempre se puede, salvo en la propia cuenta o en una ficha bloqueada.
  const posToggleBlocked =
    locked ||
    isSelf ||
    (!posAccess && !POS_BUNDLE.every((p) => actorCanGrant(actor, p)))
  // Permisos que ya concede el rol elegido (se muestran marcados y bloqueados).
  const rolePermSet = React.useMemo(
    () => new Set(roles.find((r) => r.key === role)?.permissions ?? []),
    [roles, role],
  )

  // Reinicia solo al ABRIR (false→true): si cambiara `actor` o `roles` con la
  // ficha abierta, se perdería lo que la persona ya escribió.
  const wasOpen = React.useRef(false)
  React.useEffect(() => {
    async function reset() {
      if (!open) {
        wasOpen.current = false
        return
      }
      if (wasOpen.current) return
      wasOpen.current = true
      await Promise.resolve()
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
        setRole(assignableRoles[0]?.key ?? "")
        setActive(true)
        setPosAccess(false)
        setSelectedSedes(new Set())
        setExtraPerms(new Set())
      }
      setError(null)
    }
    void reset()
  }, [open, mode, user, roles, assignableRoles])

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

  // Una sede ya asignada siempre se puede quitar; sumar una nueva exige poder
  // repartirla y, en la auto-edición, ver todas las sedes.
  function sedeDisabled(id: string): boolean {
    if (locked) return true
    if (user?.sedeIds.includes(id)) return false
    if (isSelf && !actorSeesAllSedes(actor)) return true
    return !actorCanGrantSede(actor, id)
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
      // Misma política de contraseña que el backend (Create/UpdateUserDto,
      // ítem 4.9). Al editar solo se valida si se escribió una nueva.
      if (mode === "create" || password.trim()) {
        const motivo = validarPassword(password)
        if (motivo) {
          setError(motivo)
          setSaving(false)
          return
        }
      }

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
      toast.success(mode === "create" ? "Usuario creado" : "Usuario actualizado")
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="4xl"
      icon={mode === "create" ? UserPlus : UserCog}
      title={mode === "create" ? "Nuevo usuario" : "Editar usuario"}
      description={
        mode === "create"
          ? "Una cuenta para alguien del equipo. El rol decide qué puede hacer; las sedes, dónde."
          : `Rol, sedes y permisos de ${user?.name ?? "la cuenta"}.`
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={USER_FORM_ID}
            disabled={saving || ownerLocked || !role}
            className="sm:min-w-36"
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : mode === "create" ? (
              <UserPlus />
            ) : (
              <UserCog />
            )}
            {saving
              ? "Guardando…"
              : mode === "create"
                ? "Crear usuario"
                : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form id={USER_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        {lockReason && (
          <FormAlert tone="info" icon={Info}>
            {lockReason}
          </FormAlert>
        )}
        {lastOwnerRisk && (
          <FormAlert tone="warning">
            Esta persona es el último Dueño activo: la empresa debe conservar al
            menos uno, así que el sistema rechazará desactivarla o cambiarle el
            rol. Nombra primero a otro Dueño.
          </FormAlert>
        )}

        {/* ── Quién es ─────────────────────────────────────────── */}
        <FormSection
          icon={UserCog}
          title="La cuenta"
          description="Con esto inicia sesión en el sistema."
        >
          <FieldGrid cols={3}>
            <Field id="u-name" label="Nombre" required>
              <Input
                id="u-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan García"
                disabled={ownerLocked}
                required
              />
            </Field>

            {mode === "create" ? (
              <>
                <Field id="u-email" label="Correo electrónico" required>
                  <Input
                    id="u-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan@empresa.com"
                    required
                  />
                </Field>
                <Field
                  id="u-password"
                  label="Contraseña"
                  required
                  hint={PASSWORD_REQUISITOS}
                >
                  <Input
                    id="u-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                </Field>
              </>
            ) : (
              <Field
                id="u-password-edit"
                label="Nueva contraseña"
                hint={`Déjala vacía para no cambiarla. ${PASSWORD_REQUISITOS}`}
              >
                <Input
                  id="u-password-edit"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sin cambios"
                  disabled={locked}
                />
              </Field>
            )}

            <Field
              id="u-role"
              label="Rol"
              required
              help={{ term: "rol" }}
              hint={
                isSelf
                  ? "No puedes cambiar tu propio rol."
                  : "El paquete de permisos base de esta persona."
              }
            >
              <NativeSelect
                id="u-role"
                value={role}
                onChange={setRole}
                disabled={locked || isSelf}
                options={assignableRoles.map((r) => ({ value: r.key, label: r.name }))}
                placeholder={assignableRoles.length === 0 ? "Sin roles que puedas asignar" : undefined}
              />
            </Field>
          </FieldGrid>

          {mode === "edit" && (
            <CheckboxField
              id="u-active"
              label="Usuario activo"
              hint={
                outranked && user?.active
                  ? "No puedes desactivar a alguien con permisos que tú no tienes."
                  : outranked
                    ? "Puedes reactivar esta cuenta, pero no cambiar nada más de ella."
                    : "Un usuario inactivo no puede iniciar sesión, pero conserva su historial."
              }
              checked={active}
              disabled={activeLocked}
              onCheckedChange={setActive}
            />
          )}
        </FormSection>

        {/* ── Dónde opera ──────────────────────────────────────── */}
        <FormSection
          icon={Store}
          title="Punto de venta y sedes"
          description="Dónde puede trabajar esta persona."
        >
          <CheckboxField
            id="u-pos"
            label="Acceso al punto de venta"
            help={{ term: "pos" }}
            hint={
              rolePos
                ? "El rol seleccionado ya incluye acceso al POS, así que no se puede quitar aquí."
                : posToggleBlocked
                  ? "No puedes darlo: requiere permisos que tú no tienes, o es tu propia cuenta."
                  : "Permite entrar al POS y vender en las sedes marcadas abajo."
            }
            checked={posEnabled}
            disabled={rolePos || posToggleBlocked}
            onCheckedChange={setPosAccess}
          />

          <div className="flex flex-col gap-1.5">
            <Label>
              Sedes{posEnabled ? " del POS" : ""}
              <HelpTip term="sede" />
            </Label>
            <p className="text-xs text-muted-foreground">
              {posEnabled
                ? "Sedes donde puede vender. Si marcas varias, elegirá una al iniciar el POS."
                : "Sedes donde esta persona puede operar."}
            </p>
            {visibleSedes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No hay sedes registradas. Crea una en Operación → Sedes.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSedes.map((s) => (
                  <label
                    key={s._id}
                    title={
                      sedeDisabled(s._id)
                        ? "No puedes asignar esta sede: no es tuya o es tu propia cuenta."
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors",
                      sedeDisabled(s._id)
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:border-primary/35 hover:bg-primary/[0.03]",
                      "has-data-checked:border-primary/45 has-data-checked:bg-primary/[0.05]",
                    )}
                  >
                    <Checkbox
                      checked={selectedSedes.has(s._id)}
                      disabled={sedeDisabled(s._id)}
                      onCheckedChange={() => toggleSede(s._id)}
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {s.name}
                    </span>
                    {!s.active && (
                      <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                        Inactiva
                      </Badge>
                    )}
                    {sedeDisabled(s._id) && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[0.6875rem]",
                          s.active && "ml-auto",
                        )}
                      >
                        {locked ? "bloqueada" : isSelf ? "tu cuenta" : "no es tuya"}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </FormSection>

        {/* ── Permisos extra ───────────────────────────────────── */}
        <FormSection
          icon={KeyRound}
          title="Permisos adicionales"
          description="Cosas que esta persona puede hacer además de lo que ya trae su rol. Lo que da el rol sale marcado como «por rol» y no se quita aquí."
        >
          {permissionGroups.length === 0 ? (
            <CatalogPlaceholder state={catalogState} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {permissionGroups.map((group) => {
                const items = group.items.filter(
                  (i) => !POS_BUNDLE.includes(i.key),
                )
                if (items.length === 0) return null
                return (
                  <div
                    key={group.group}
                    className="h-fit overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="bg-muted/60 px-3.5 py-2.5 text-sm font-bold">
                      {group.label}
                    </div>
                    <div className="flex flex-col divide-y divide-border">
                      {items.map((item) => {
                        const byRole = rolePermSet.has(item.key)
                        const checked = byRole || extraPerms.has(item.key)
                        // Quitar un extra siempre se puede; darlo exige tenerlo.
                        const cantGrant =
                          !checked && !actorCanGrant(actor, item.key)
                        const blocked = byRole || locked || isSelf || cantGrant
                        return (
                          <label
                            key={item.key}
                            title={
                              cantGrant
                                ? "No puedes conceder un permiso que tú no tienes."
                                : undefined
                            }
                            className={cn(
                              "flex items-center gap-2.5 px-3.5 py-2 transition-colors",
                              blocked
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer hover:bg-primary/[0.04]",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={blocked}
                              onCheckedChange={() => toggleExtraPerm(item.key)}
                            />
                            <span className="min-w-0 text-sm text-foreground">
                              {item.label}
                            </span>
                            {byRole && (
                              <Badge
                                variant="outline"
                                className="ml-auto shrink-0 text-[0.6875rem]"
                              >
                                por rol
                              </Badge>
                            )}
                            {cantGrant && !byRole && (
                              <Badge
                                variant="outline"
                                className="ml-auto shrink-0 text-[0.6875rem]"
                              >
                                no lo tienes
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
        </FormSection>
      </form>
    </FormDialog>
  )
}

// ─── Ficha de rol ───────────────────────────────────────────────────────────────

interface RoleDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  role?: AdminRole
  permissionGroups: PermissionGroup[]
  catalogState: CatalogState
  actor: Actor
  onSuccess: () => void
}

/** Llaves que el rol Dueño nunca pierde (el backend responde 400 si faltan). */
const OWNER_KEY_PERMISSIONS: readonly string[] = ["users.manage", "roles.manage"]

function RoleDialog({ open, onOpenChange, mode, role, permissionGroups, catalogState, actor, onSuccess }: RoleDialogProps) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [selectedPerms, setSelectedPerms] = React.useState<Set<string>>(new Set())
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reglas del backend: solo el Dueño edita el rol Dueño, y nadie (salvo el
  // Dueño) cambia los permisos de su propio rol.
  const ownerRoleLocked =
    mode === "edit" && role?.key === OWNER_ROLE && !isOwnerActor(actor)
  const ownRoleLocked =
    mode === "edit" &&
    !!role &&
    role.key === actor.role &&
    !isOwnerActor(actor)
  const permsLocked = ownerRoleLocked || ownRoleLocked
  const roleLockReason = ownerRoleLocked
    ? "Solo el Dueño puede editar el rol Dueño."
    : ownRoleLocked
      ? "No puedes cambiar los permisos de tu propio rol: pídeselo a otra persona que gestione roles. Sí puedes cambiar su nombre y descripción."
      : null
  // En el rol Dueño, gestionar usuarios y roles no se puede desmarcar.
  const editingOwnerRole = mode === "edit" && role?.key === OWNER_ROLE
  function isOwnerKey(key: string): boolean {
    return editingOwnerRole && OWNER_KEY_PERMISSIONS.includes(key)
  }
  // Un permiso se puede sumar solo si se tiene; quitarlo siempre se puede.
  function permDisabled(key: string): boolean {
    if (permsLocked) return true
    if (isOwnerKey(key)) return true
    return !selectedPerms.has(key) && !actorCanGrant(actor, key)
  }
  // Por qué está deshabilitado, en texto visible (no solo en `title`).
  function permReason(key: string): string | null {
    if (permsLocked || !permDisabled(key)) return null
    return isOwnerKey(key) ? "obligatorio del Dueño" : "no lo tienes"
  }

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
    if (permsLocked) return
    const allSelected = items.every((item) => selectedPerms.has(item.key))
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        items
          .filter((item) => !isOwnerKey(item.key))
          .forEach((item) => next.delete(item.key))
      } else {
        items
          .filter((item) => actorCanGrant(actor, item.key))
          .forEach((item) => next.add(item.key))
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
        toast.success("Rol creado")
      } else if (role) {
        const payload: UpdateRolePayload = {
          name,
          description: description || undefined,
        }
        // Los permisos solo viajan si cambiaron: el backend marca el rol como
        // «editado a mano» con solo recibirlos, y renombrar a Dueño o
        // Administrador no debe congelarles las funciones nuevas.
        const before = new Set(role.permissions)
        const changed =
          before.size !== selectedPerms.size ||
          Array.from(selectedPerms).some((p) => !before.has(p))
        if (changed && !permsLocked) payload.permissions = Array.from(selectedPerms)
        await updateRole(role.id, payload)
        toast.success("Rol actualizado")
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={ShieldCheck}
      title={mode === "create" ? "Nuevo rol" : "Editar rol"}
      description="Un rol es un paquete de permisos con nombre. En vez de darle permisos uno por uno a cada persona, le asignas el rol."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ROLE_FORM_ID}
            disabled={saving || ownerRoleLocked}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {saving
              ? "Guardando…"
              : mode === "create"
                ? "Crear rol"
                : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form id={ROLE_FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        {roleLockReason && (
          <FormAlert tone="info" icon={Info}>
            {roleLockReason}
          </FormAlert>
        )}
        {permsLocked && roleLockReason && (
          <p id={ROLE_LOCK_REASON_ID} className="sr-only">
            {roleLockReason}
          </p>
        )}
        {editingOwnerRole && (
          <FormAlert tone="info" icon={Info}>
            El rol Dueño siempre conserva gestionar usuarios y roles: sin ellos
            nadie podría volver a abrir estas pantallas.
          </FormAlert>
        )}

        {/* Los roles que trae el sistema ya se pueden ajustar enteros —un
            "Gerente" no significa lo mismo en una galletería que en un
            restaurante—, pero el cambio tiene una consecuencia que no se ve y
            que conviene decir ANTES de tocar nada: mientras el rol está como
            viene, cada función nueva que se publique le llega sola. En cuanto
            se ajusta a mano, deja de pasar y hay que dársela cuando salga. */}
        {mode === "edit" && role?.isSystem && !role.permissionsCustomized && (
          <FormAlert tone="info" icon={Info}>
            <strong>{role.name}</strong> es un rol que trae el sistema, y puedes
            cambiarlo a tu gusto. Ten en cuenta una cosa: tal como está ahora,
            cada función nueva de BookiPos le llega sola. Si le ajustas los
            permisos, mandará lo que tú dejes escrito y las funciones que salgan
            después tendrás que dárselas tú. Cambiar solo el nombre o la
            descripción no afecta a esto.
          </FormAlert>
        )}

        <FormSection title="Identificación del rol">
          <FieldGrid cols={2}>
            <Field
              id="r-name"
              label="Nombre del rol"
              required
              hint="Como lo llamas tú: Cajero, Bodeguero, Administrador."
            >
              <Input
                id="r-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cajero"
                disabled={ownerRoleLocked}
                required
              />
            </Field>
            <Field id="r-desc" label="Descripción">
              <Input
                id="r-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vende y cierra caja, no toca precios"
                disabled={ownerRoleLocked}
              />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          icon={KeyRound}
          title="Permisos"
          description="Lo que puede hacer quien tenga este rol. Pulsa el título de un grupo para marcarlo o desmarcarlo entero."
          action={
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary tabular-nums">
              {selectedPerms.size} activos
            </span>
          }
        >
          {permissionGroups.length === 0 ? (
            <CatalogPlaceholder state={catalogState} />
          ) : (
            // Dos columnas en escritorio: la lista de permisos es larga y en una
            // sola columna obliga a un scroll interminable dentro de la ficha.
            <div className="grid gap-3 lg:grid-cols-2">
              {permissionGroups.map((group) => {
                const allSelected = group.items.every((item) =>
                  selectedPerms.has(item.key),
                )
                const someSelected = group.items.some((item) =>
                  selectedPerms.has(item.key),
                )
                return (
                  <div
                    key={group.group}
                    className="h-fit overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.items)}
                      aria-disabled={permsLocked}
                      aria-describedby={
                        permsLocked && roleLockReason ? ROLE_LOCK_REASON_ID : undefined
                      }
                      className="flex w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-70 items-center gap-2.5 bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "flex size-[1.125rem] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors",
                          allSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : someSelected
                              ? "border-primary bg-primary/25 text-primary"
                              : "border-input bg-card",
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
                            <path
                              d="M2 5h6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-bold">{group.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {group.items.filter((i) => selectedPerms.has(i.key)).length}
                        /{group.items.length}
                      </span>
                    </button>

                    <div className="flex flex-col divide-y divide-border">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          title={
                            permReason(item.key) === "no lo tienes"
                              ? "No puedes conceder un permiso que tú no tienes."
                              : undefined
                          }
                          className={cn(
                            "flex items-center gap-2.5 px-3.5 py-2 transition-colors",
                            permDisabled(item.key)
                              ? "cursor-not-allowed opacity-70"
                              : "cursor-pointer hover:bg-primary/[0.04]",
                          )}
                        >
                          <Checkbox
                            checked={selectedPerms.has(item.key)}
                            disabled={permDisabled(item.key)}
                            onCheckedChange={() => togglePerm(item.key)}
                          />
                          <span className="min-w-0 text-sm text-foreground">
                            {item.label}
                          </span>
                          {permReason(item.key) && (
                            <Badge
                              variant="outline"
                              className="ml-auto shrink-0 text-[0.6875rem]"
                            >
                              {permReason(item.key)}
                            </Badge>
                          )}
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[0.6875rem] text-muted-foreground",
                              !permReason(item.key) && "ml-auto",
                            )}
                          >
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
        </FormSection>
      </form>
    </FormDialog>
  )
}

// ─── Ficha de invitación ─────────────────────────────────────────────────────────────

interface InviteDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  roles: AdminRole[]
  actor: Actor
  onSuccess: () => void
}

function InviteDialog({ open, onOpenChange, roles, actor, onSuccess }: InviteDialogProps) {
  // Solo el Dueño asigna el rol Dueño y nadie un rol con permisos que no tiene.
  const assignableRoles = React.useMemo(
    () => assignableRolesFor(roles, actor),
    [roles, actor],
  )
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<CreatedInvitation | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Reinicia solo al abrir (false→true), no cuando cambia `actor` o `roles`.
  const wasOpen = React.useRef(false)
  React.useEffect(() => {
    async function reset() {
      if (!open) {
        wasOpen.current = false
        return
      }
      if (wasOpen.current) return
      wasOpen.current = true
      await Promise.resolve()
      setEmail("")
      setRole(assignableRoles[0]?.key ?? "")
      setError(null)
      setResult(null)
      setCopied(false)
    }
    void reset()
  }, [open, assignableRoles])

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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      icon={Mail}
      title="Invitar por correo"
      description="Enviamos un enlace para que la persona defina su propia contraseña y entre con el rol que elijas."
      footer={
        result ? (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setResult(null)
                setEmail("")
                setRole(assignableRoles[0]?.key ?? "")
              }}
              className="sm:min-w-28"
            >
              Invitar a otro
            </Button>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="sm:min-w-36"
            >
              Listo
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="sm:min-w-28"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={INVITE_FORM_ID}
              disabled={saving || !role}
              className="sm:min-w-36"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Send />}
              {saving ? "Enviando…" : "Enviar invitación"}
            </Button>
          </>
        )
      }
    >
      {!result ? (
        <form
          id={INVITE_FORM_ID}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          {error && <FormAlert>{error}</FormAlert>}

          <FormSection
            icon={Mail}
            title="¿A quién invitas?"
            description="La persona recibe un enlace, elige su contraseña y entra. Tú nunca ves su clave."
          >
            <FieldGrid cols={2}>
              <Field id="i-email" label="Correo electrónico" required>
                <Input
                  id="i-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="persona@empresa.com"
                  required
                />
              </Field>
              <Field
                id="i-role"
                label="Rol"
                required
                help={{ term: "rol" }}
                hint="Puedes cambiárselo después."
              >
                <NativeSelect
                  id="i-role"
                  value={role}
                  onChange={setRole}
                  options={assignableRoles.map((r) => ({ value: r.key, label: r.name }))}
                  placeholder={assignableRoles.length === 0 ? "Sin roles que puedas asignar" : undefined}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] px-4 py-7 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-success/15 text-success-ink">
              <Check className="size-5" />
            </span>
            <p className="font-display text-base text-foreground">
              Invitación creada
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {result.emailSent
                ? `Enviamos un correo a ${result.email}.`
                : `No se pudo enviar el correo (revisa la API key de Resend). Comparte el enlace manualmente con ${result.email}.`}
            </p>
          </div>

          <Field
            id="i-link"
            label="Enlace de invitación"
            hint="Válido hasta que expire o se acepte."
          >
            <div className="flex items-center gap-2">
              <Input
                id="i-link"
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
                className="shrink-0"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </Field>
        </div>
      )}
    </FormDialog>
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
  const { hasPermission, user: me } = useAuth()
  const confirm = useConfirm()
  const canManageRoles = hasPermission("roles.manage")
  // Acción en curso (reenviar/revocar/borrar): evita doble clic y da feedback.
  const [busy, setBusy] = React.useState<string | null>(null)
  const actor = React.useMemo<Actor>(
    () => ({
      id: me?.id ?? "",
      role: me?.role ?? "",
      permissions: me?.permissions ?? [],
      sedeIds: me?.sedeIds ?? [],
    }),
    [me],
  )

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
  const [catalogState, setCatalogState] = React.useState<CatalogState>("loading")

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
    // GET /permissions exige roles.manage: sin él ni se pide, y la ficha lo dice.
    if (!canManageRoles) {
      setCatalogState("denied")
      return
    }
    try {
      const data = await listPermissionGroups()
      setPermGroups(data)
      setCatalogState("ready")
    } catch (err) {
      setCatalogState(
        err instanceof ApiError && err.status === 403 ? "denied" : "error",
      )
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
    if (busy) return
    setBusy(`resend:${inv.id}`)
    try {
      await resendInvitation(inv.id)
      await fetchInvitations()
      toast.success(`Invitación reenviada a ${inv.email}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleRevokeInvite(inv: AdminInvitation) {
    if (busy) return
    if (!(await confirm({ title: `¿Revocar la invitación de ${inv.email}?`, destructive: true }))) return
    setBusy(`revoke:${inv.id}`)
    try {
      await revokeInvitation(inv.id)
      await fetchInvitations()
      toast.success("Invitación revocada")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
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
    if (busy) return
    if (!(await confirm({ title: `¿Eliminar el rol "${r.name}"?`, description: "Esta acción no se puede deshacer.", destructive: true }))) return
    setBusy(`delete:${r.id}`)
    try {
      await deleteRole(r.id)
      await fetchRoles()
      toast.success("Rol eliminado")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        section="Configuración"
        title="Usuarios y roles"
        description={
          <>
            Quién entra al sistema y qué puede tocar. Cada persona tiene un{" "}
            <Termino>rol</Termino>, que es un paquete de{" "}
            <Termino>permisos</Termino>, y una o varias{" "}
            <Termino>sedes</Termino> donde puede operar.
          </>
        }
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
          ) : canManageRoles ? (
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
          ) : null
        }
      />

      {/* Segmented control */}
      <div
        data-tour="usuarios-tabs"
        className="mb-5 flex gap-1 rounded-lg border border-border bg-muted p-1 w-fit"
      >
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
        <Card data-tour="usuarios-lista">
          <CardHeader>
            <CardTitle className="font-display text-lg">Usuarios</CardTitle>
            <CardDescription>Cuentas con acceso al BookiPos.</CardDescription>
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
                    <TableHead>
                      <Termino>Rol</Termino>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <Termino>Sedes</Termino>
                    </TableHead>
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
                            <Badge className="bg-success/15 text-success-ink">
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
        <Card data-tour="usuarios-invitaciones">
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
                    // Reenviar/revocar es actuar sobre ese rol: mismas reglas que asignarlo.
                    const invRole = roles.find((r) => r.key === inv.role)
                    const canAssignInv = invRole
                      ? actorCanAssignRole(actor, invRole)
                      : true
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
                          {!closed && !canAssignInv && (
                            <span className="text-xs text-muted-foreground">
                              Rol que no puedes asignar
                            </span>
                          )}
                          {!closed && canAssignInv && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy !== null}
                                onClick={() => handleResendInvite(inv)}
                              >
                                {busy === `resend:${inv.id}` ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <Send />
                                )}
                                Reenviar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={busy !== null}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRevokeInvite(inv)}
                              >
                                {busy === `revoke:${inv.id}` ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <Trash2 />
                                )}
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
                      {canManageRoles && (
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
                      )}
                      {canManageRoles && !r.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy !== null}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteRole(r)}
                        >
                          {busy === `delete:${r.id}` ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
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
      <UserDialog
        open={userSheetOpen}
        onOpenChange={setUserSheetOpen}
        mode={userSheetMode}
        user={editingUser}
        roles={roles}
        sedes={sedes}
        permissionGroups={permGroups}
        catalogState={catalogState}
        activeOwners={users.filter((u) => u.role === OWNER_ROLE && u.active).length}
        actor={actor}
        onSuccess={fetchUsers}
      />

      <RoleDialog
        open={roleSheetOpen}
        onOpenChange={setRoleSheetOpen}
        mode={roleSheetMode}
        role={editingRole}
        permissionGroups={permGroups}
        catalogState={catalogState}
        actor={actor}
        onSuccess={fetchRoles}
      />

      <InviteDialog
        open={inviteSheetOpen}
        onOpenChange={setInviteSheetOpen}
        roles={roles}
        actor={actor}
        onSuccess={fetchInvitations}
      />
    </>
  )
}
