"use client"

import * as React from "react"
import {
  Users,
  UserCheck,
  UserMinus,
  Plus,
  Pencil,
  Trash2,
  ShieldOff,
  Briefcase,
  Loader2,
  Search,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listEmployees,
  deleteEmployee,
  listPositions,
  createPosition,
  deletePosition,
  type Employee,
  type Position,
  type EmployeeStatus,
  type ContractType,
} from "@/lib/erp/api-employees"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { EmployeeSheet } from "@/components/erp/employee-sheet"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
} from "@/components/ui/sheet"

const CONTRACT_LABELS: Record<ContractType, string> = {
  indefinido: "Indefinido",
  fijo: "Término fijo",
  obra_labor: "Obra o labor",
  aprendizaje: "Aprendizaje",
  prestacion_servicios: "Prest. servicios",
}

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  activo: "bg-green-500/10 text-green-600",
  inactivo: "bg-amber-500/10 text-amber-600",
  retirado: "bg-muted text-muted-foreground",
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  retirado: "Retirado",
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export default function EmpleadosPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("employees.view")
  const canManage = hasPermission("employees.manage")

  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [positions, setPositions] = React.useState<Position[]>([])
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<EmployeeStatus | "todos">(
    "todos",
  )

  const [editing, setEditing] = React.useState<Employee | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [positionsOpen, setPositionsOpen] = React.useState(false)

  const sedeName = React.useMemo(
    () => new Map(sedes.map((s) => [s._id, s.name])),
    [sedes],
  )

  const load = React.useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const [emps, pos, sd] = await Promise.all([
        listEmployees(),
        listPositions(),
        listSedes(),
      ])
      setEmployees(emps)
      setPositions(pos)
      setSedes(sd.filter((s) => s.active))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canView])

  React.useEffect(() => {
    void load()
  }, [load])

  const refreshPositions = React.useCallback(async () => {
    try {
      setPositions(await listPositions())
    } catch {
      /* no-op */
    }
  }, [])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees.filter((e) => {
      if (statusFilter !== "todos" && e.status !== statusFilter) return false
      if (!q) return true
      const hay =
        `${e.firstName} ${e.lastName} ${e.docNumber} ${e.positionName ?? ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [employees, query, statusFilter])

  const activeCount = employees.filter((e) => e.status === "activo").length
  const retiredCount = employees.filter((e) => e.status === "retirado").length

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(e: Employee) {
    setEditing(e)
    setSheetOpen(true)
  }

  async function handleDelete(e: Employee) {
    if (
      !window.confirm(
        `¿Eliminar a ${e.firstName} ${e.lastName}? Esta acción no se puede deshacer.`,
      )
    )
      return
    try {
      await deleteEmployee(e._id)
      await load()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  if (!canView) {
    return (
      <>
        <PageHeader section="Personal" title="Empleados" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver empleados.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const actions = canManage ? (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="gap-2" onClick={() => setPositionsOpen(true)}>
        <Briefcase className="size-4" />
        Cargos
      </Button>
      <Button className="gap-2" onClick={openNew}>
        <Plus className="size-4" />
        Añadir empleado
      </Button>
    </div>
  ) : undefined

  return (
    <>
      <PageHeader
        section="Personal"
        title="Empleados"
        description="Registro de RRHH: contratación, seguridad social y documentos."
        actions={actions}
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Kpi icon={Users} label="Total" value={String(employees.length)} />
        <Kpi icon={UserCheck} label="Activos" value={String(activeCount)} />
        <Kpi icon={UserMinus} label="Retirados" value={String(retiredCount)} />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, documento o cargo"
            className="w-72 pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(["todos", "activo", "inactivo", "retirado"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "todos" ? "Todos" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Users className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {employees.length === 0
                  ? "Aún no hay empleados. Añade el primero."
                  : "Ningún empleado coincide con el filtro."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>
                      <p className="font-medium">
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.docType} {e.docNumber}
                      </p>
                    </TableCell>
                    <TableCell>{e.positionName ?? "—"}</TableCell>
                    <TableCell>
                      {e.sedeId ? (sedeName.get(e.sedeId) ?? "—") : "—"}
                    </TableCell>
                    <TableCell>{CONTRACT_LABELS[e.contractType]}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[e.status]}>
                        {STATUS_LABELS[e.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openEdit(e)}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void handleDelete(e)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeSheet
        open={sheetOpen}
        employee={editing}
        positions={positions}
        sedes={sedes}
        onOpenChange={setSheetOpen}
        onSaved={() => void load()}
      />

      <PositionsManager
        open={positionsOpen}
        positions={positions}
        onOpenChange={setPositionsOpen}
        onChanged={() => void refreshPositions()}
      />
    </>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p className="font-display text-2xl leading-tight text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function PositionsManager({
  open,
  positions,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  positions: Position[]
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await createPosition({ name: trimmed })
      setName("")
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deletePosition(id)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">Cargos</SheetTitle>
            <SheetDescription>
              Define los puestos del negocio para asignarlos a los empleados.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Nuevo cargo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cajero, Cocinero, Mesero"
                onKeyDown={(e) => e.key === "Enter" && void add()}
              />
            </div>
            <Button className="gap-1.5" disabled={busy} onClick={() => void add()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Agregar
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {positions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay cargos.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {positions.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy}
                    onClick={() => void remove(p._id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
