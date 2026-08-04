"use client"

import * as React from "react"
import { KeyRound } from "lucide-react"

import {
  createUser,
  listRoles,
  type AdminRole,
  type AdminUser,
} from "@/lib/api-admin"
import { updateEmployee } from "@/lib/erp/api-employees"
import { ApiError } from "@/lib/api"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function suggestUsername(firstName: string, lastName: string): string {
  const first = slug(firstName)
  const last = slug(lastName)
  const base = last ? `${first}.${last}` : first
  return base.slice(0, 30)
}

export interface EmployeeForAccess {
  _id: string
  firstName: string
  lastName: string
  email?: string
}

interface EmployeeAccessSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  employee: EmployeeForAccess | null
  /** Si se pasa, el nuevo usuario queda asignado a esta sede. */
  sedeId?: string
  onSuccess: (user: AdminUser) => void
}

/**
 * Crea un acceso al sistema (usuario) a partir de un empleado: usuario,
 * contraseña y rol. El nuevo usuario queda vinculado al empleado (`userId`) y,
 * si se pasa `sedeId`, asignado a esa sede.
 */
export function EmployeeAccessSheet({
  open,
  onOpenChange,
  employee,
  sedeId,
  onSuccess,
}: EmployeeAccessSheetProps) {
  const [roles, setRoles] = React.useState<AdminRole[]>([])
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !employee) return
    setUsername(suggestUsername(employee.firstName, employee.lastName))
    setPassword("")
    setError(null)
    listRoles()
      .then((r) => {
        setRoles(r)
        // Rol por defecto: cajero si existe, si no el primero.
        setRole((prev) =>
          prev || r.find((x) => x.key === "cashier")?.key || r[0]?.key || "",
        )
      })
      .catch(() => setRoles([]))
  }, [open, employee])

  const roleItems = React.useMemo(
    () => Object.fromEntries(roles.map((r) => [r.key, r.name])),
    [roles],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    const uname = username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) {
      setError("El usuario debe tener 3-30 caracteres: letras, números, punto, guion o guion bajo")
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
    setSaving(true)
    setError(null)
    try {
      const user = await createUser({
        username: uname,
        password,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        role,
        sedeIds: sedeId ? [sedeId] : [],
      })
      // Vincula el usuario al expediente del empleado.
      await updateEmployee(employee._id, { userId: user.id })
      onSuccess(user)
      onOpenChange(false)
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
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <KeyRound className="size-5 text-primary" />
            Crear acceso
          </SheetTitle>
          <SheetDescription>
            {employee
              ? `Crea un usuario para ${employee.firstName} ${employee.lastName}. Iniciará sesión con su nombre de usuario y contraseña.`
              : "Crea un usuario para el empleado."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-username">Nombre de usuario</Label>
            <Input
              id="acc-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. juan.perez"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <p className="text-xs text-muted-foreground">
              Con esto inicia sesión. Letras, números, punto, guion o guion bajo.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-password">Contraseña</Label>
            <Input
              id="acc-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Compártela con la persona; podrá cambiarla luego.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-role">Rol</Label>
            <Select
              value={role}
              items={roleItems}
              onValueChange={(v) => {
                if (v) setRole(v as string)
              }}
            >
              <SelectTrigger id="acc-role" className="w-full">
                <SelectValue placeholder="Elige un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El rol define si entra al POS, a Operación y qué puede hacer.
            </p>
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
              {saving ? "Creando…" : "Crear acceso"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
