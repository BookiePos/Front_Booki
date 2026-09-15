"use client"

import * as React from "react"
import {
  KeyRound,
  LayoutDashboard,
  Loader2,
  ShoppingCart,
  ShieldCheck,
} from "lucide-react"

import {
  createUser,
  listRoles,
  type AdminRole,
  type AdminUser,
} from "@/lib/api-admin"
import { updateEmployee } from "@/lib/erp/api-employees"
import {
  POS_BUNDLE,
  permsAllowOperation,
  permsAllowPos,
  roleFitsArea,
  type AccessArea,
} from "@/lib/access"
import { ApiError } from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import {
  FormDialog,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import { Field, NativeSelect } from "@/components/ui/field"

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/** Quita tildes y caracteres no alfanuméricos para sugerir un usuario. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function suggestUsername(firstName: string, lastName: string): string {
  const first = slug(firstName)
  const last = slug(lastName)
  const base = last ? `${first}.${last}` : first
  return base.slice(0, 30)
}

/**
 * Rol sugerido para un área: el habitual si existe (Cajero para el POS,
 * Gerente o Administrador para Operación), si no el primero que habilite el
 * área y, en último caso, el primero de la lista. Es solo la preselección: la
 * lista completa sigue disponible.
 */
function defaultRoleFor(area: AccessArea, roles: AdminRole[]): string {
  const prefer = area === "pos" ? ["cashier"] : ["manager", "admin"]
  for (const key of prefer) {
    const found = roles.find((r) => r.key === key)
    if (found) return found.key
  }
  const fitting = roles.find((r) => roleFitsArea(r.permissions, area))
  return fitting?.key ?? roles[0]?.key ?? ""
}

export interface EmployeeForAccess {
  _id: string
  firstName: string
  lastName: string
  email?: string
  /** Sede del expediente del empleado; se usa como sede del acceso si no se
   * pasa una `sedeId` explícita. Sin ella, un acceso al POS quedaría sin sede. */
  sedeId?: string
}

interface EmployeeAccessDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  employee: EmployeeForAccess | null
  /** Si se pasa, el nuevo usuario queda asignado a esta sede. */
  sedeId?: string
  /** Área inicial. Por defecto "pos". */
  area?: AccessArea
  /** Fija el área (oculta el selector). Úsalo desde el POS para forzar POS. */
  lockArea?: boolean
  onSuccess: (user: AdminUser) => void
}

/** Id del `<form>`, para que el botón del pie —que vive fuera— lo envíe. */
const FORM_ID = "employee-access-form"

/**
 * Crea un acceso al sistema (usuario) a partir de un empleado: área (POS u
 * Operación), usuario, contraseña y rol. El nuevo usuario queda vinculado al
 * empleado (`userId`) y, si se pasa `sedeId`, asignado a esa sede.
 *
 * **Los roles son exactamente los de Configuración → Usuarios y roles**: la
 * misma lista, en el mismo orden y con los mismos nombres. Antes se filtraban
 * por área y un rol creado a medida (o un Gerente sin permiso de venta) no
 * aparecía aquí aunque sí en Usuarios, lo que obligaba a crear el acceso por
 * otro lado. El área ya no esconde roles: si se da acceso al POS con un rol que
 * no lo incluye, se agrega el POS como permiso extra, que es exactamente lo que
 * hace el interruptor "Acceso al punto de venta" en Usuarios.
 *
 * El `<form>` se conserva aunque el botón de envío esté en el pie de la ficha:
 * `form={FORM_ID}` los vuelve a unir, y con eso Enter sigue creando el acceso
 * sin tener que bajar a buscar el botón.
 */
export function EmployeeAccessDialog({
  open,
  onOpenChange,
  employee,
  sedeId,
  area: areaProp = "pos",
  lockArea = false,
  onSuccess,
}: EmployeeAccessDialogProps) {
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [area, setArea] = React.useState<AccessArea>(areaProp)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !employee) return
    setUsername(suggestUsername(employee.firstName, employee.lastName))
    setPassword("")
    setArea(areaProp)
    setError(null)
    listRoles()
      .then(setRoles)
      .catch(() => setRoles([]))
  }, [open, employee, areaProp])

  // Al cambiar de área (o al cargar roles) se propone un rol habitual para esa
  // área, pero solo si el elegido ya no existe: si la persona escogió uno a
  // mano, se respeta.
  React.useEffect(() => {
    setRole((prev) =>
      roles.some((r) => r.key === prev) ? prev : defaultRoleFor(area, roles),
    )
  }, [area, roles])

  const selectedRole = roles.find((r) => r.key === role)
  const roleHasPos = selectedRole ? permsAllowPos(selectedRole.permissions) : false
  const roleHasOperation = selectedRole
    ? permsAllowOperation(selectedRole.permissions)
    : false
  /** Acceso al POS pedido con un rol que no lo trae: va como permiso extra. */
  const addsPos = area === "pos" && Boolean(selectedRole) && !roleHasPos

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    const uname = username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) {
      setError(
        "El usuario debe tener 3-30 caracteres: letras, números, punto, guion o guion bajo",
      )
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (!role) {
      setError("Elige un rol")
      return
    }
    // Sede del acceso: la explícita (creado desde una sede) o, si no, la del
    // expediente del empleado. El POS opera por sede: sin ella, el usuario
    // entraría al terminal sin ninguna sede y no podría vender.
    const effectiveSedeId = sedeId ?? employee.sedeId
    if (area === "pos" && !effectiveSedeId) {
      setError(
        "Este empleado no tiene una sede asignada. Asígnale una sede en su expediente para poder darle acceso al POS.",
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      const user = await createUser({
        username: uname,
        password,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        role,
        sedeIds: effectiveSedeId ? [effectiveSedeId] : [],
        // Igual que el interruptor de POS en Usuarios y roles.
        extraPermissions: addsPos ? [...POS_BUNDLE] : [],
      })
      // Vincula el usuario al expediente y asegura que el empleado quede en esa
      // sede (para su nómina y control de horas).
      await updateEmployee(employee._id, {
        userId: user.id,
        ...(effectiveSedeId ? { sedeId: effectiveSedeId } : {}),
      })
      onSuccess(user)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const roleHint = !selectedRole
    ? "Un paquete de permisos con nombre: Cajero, Administrador… Son los mismos de Usuarios y roles."
    : addsPos
      ? `${selectedRole.name} no incluye el punto de venta: se le dará acceso al POS como permiso extra, igual que en Usuarios y roles.`
      : area === "operacion" && !roleHasOperation
        ? `${selectedRole.name} no da acceso al panel de operación: con este rol ${roleHasPos ? "solo podrá entrar al punto de venta" : "no podrá entrar a ninguna sección"}. Elige otro rol o cambia el área.`
        : (selectedRole.description ?? "Son los mismos roles de Usuarios y roles.")

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !saving && onOpenChange(v)}
      size="xl"
      icon={KeyRound}
      title="Crear acceso"
      description={
        employee
          ? `Un usuario para ${employee.firstName} ${employee.lastName}. Iniciará sesión con su nombre de usuario y contraseña.`
          : "Crea un usuario para el empleado."
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
            form={FORM_ID}
            disabled={saving || roles.length === 0}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {saving ? "Creando…" : "Crear acceso"}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        {error && <FormAlert>{error}</FormAlert>}

        <FormSection
          icon={ShoppingCart}
          title="¿A qué tendrá acceso?"
          description={
            area === "pos"
              ? "Entra al punto de venta a vender y cobrar. No ve el panel de operación."
              : "Entra al panel de operación a administrar el negocio."
          }
        >
          {lockArea ? (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.06] px-3.5 py-3 text-sm">
              <ShoppingCart className="size-4 shrink-0 text-primary" />
              <span className="font-semibold">Acceso al punto de venta</span>
              <span className="text-muted-foreground">· solo POS</span>
            </div>
          ) : (
            <Segmented
              fill
              size="lg"
              ariaLabel="Área de acceso"
              value={area}
              onValueChange={(v) => setArea(v as AccessArea)}
              options={[
                { value: "pos", label: "Punto de venta", icon: ShoppingCart },
                {
                  value: "operacion",
                  label: "Operación",
                  icon: LayoutDashboard,
                },
              ]}
            />
          )}
        </FormSection>

        <FormSection
          icon={ShieldCheck}
          title="Credenciales y rol"
          description="Con esto entra al sistema. El rol decide exactamente qué puede tocar."
        >
          <div className="flex flex-col gap-3.5">
            <Field
              id="acc-username"
              label="Nombre de usuario"
              required
              hint="Letras, números, punto, guion o guion bajo. Entre 3 y 30 caracteres."
            >
              <Input
                id="acc-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="juan.perez"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </Field>

            <Field
              id="acc-password"
              label="Contraseña"
              required
              hint="Compártela con la persona; podrá cambiarla luego. Mínimo 6 caracteres."
            >
              {/* `type="text"` a propósito: quien crea el acceso tiene que poder
                  leer la clave para dictársela a la persona en el mostrador. */}
              <Input
                id="acc-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                required
              />
            </Field>

            <Field
              id="acc-role"
              label="Rol"
              required
              help={{ term: "rol" }}
              error={
                roles.length === 0
                  ? "No hay roles. Créalos en Configuración → Usuarios y roles."
                  : null
              }
              hint={roleHint}
            >
              {/* Misma lista, orden y nombres que el selector de rol de
                  Configuración → Usuarios y roles. */}
              <NativeSelect
                id="acc-role"
                value={role}
                onChange={setRole}
                options={roles.map((r) => ({ value: r.key, label: r.name }))}
                placeholder={roles.length === 0 ? "Sin roles" : undefined}
                disabled={roles.length === 0}
              />
            </Field>
          </div>
        </FormSection>
      </form>
    </FormDialog>
  )
}
