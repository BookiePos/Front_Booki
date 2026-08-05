"use client"

import * as React from "react"
import {
  CalendarClock,
  ShieldOff,
  MapPin,
  Users,
  Clock,
  Save,
  Check,
  X,
  Inbox,
  Loader2,
  ArrowRight,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  attendanceSummary,
  listAttendanceWorkers,
  listAttendanceDay,
  adminSetAttendance,
  listEditRequests,
  resolveEditRequest,
  type AttendanceSummaryRow,
  type Worker,
  type AttendanceEditRequest,
} from "@/lib/erp/api-attendance"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "all"

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA")
}

function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}

function fmtHours(h: number): string {
  return `${h.toFixed(2)} h`
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export default function TurnosPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("attendance.manage")
  // Editar horas y aprobar solicitudes exige el permiso de gestión de empleados
  // (igual que en el backend), no solo ver la asistencia.
  const canEdit = hasPermission("employees.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [rows, setRows] = React.useState<AttendanceSummaryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Carga inicial de sedes (para el filtro).
  React.useEffect(() => {
    if (!canView) return
    let active = true
    listSedes()
      .then((all) => {
        if (!active) return
        setSedes(all.filter((s) => s.active))
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await attendanceSummary(
        from,
        to,
        sedeId === ALL ? undefined : sedeId,
      )
      setRows(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [from, to, sedeId])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  const totalDays = rows.reduce((s, r) => s + r.days, 0)
  const workerCount = new Set(rows.map((r) => r.userId)).size

  if (!canView) {
    return (
      <>
        <PageHeader section="Personal" title="Turnos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los turnos.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const sedeItems = {
    [ALL]: "Todas las sedes",
    ...Object.fromEntries(sedes.map((s) => [s._id, s.name])),
  }

  const sedeSelector = (
    <div data-tour="turnos-sede">
      <Select
        value={sedeId}
        items={sedeItems}
        onValueChange={(v) => {
          if (v !== null) setSedeId(v as string)
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Sede" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las sedes</SelectItem>
          {sedes.map((s) => (
            <SelectItem key={s._id} value={s._id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <>
      <PageHeader
        section="Personal"
        title="Turnos"
        description="Horas trabajadas por trabajador y sede (control de horas de nómina)."
        actions={sedeSelector}
      />

      {canEdit && (
        <div className="mb-4 flex flex-col gap-4">
          <EditRequestsPanel onResolved={load} />
          <DayEditor sedes={sedes} onSaved={load} />
        </div>
      )}

      {/* Filtros de rango + KPIs */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1" data-tour="turnos-rango">
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="desde" className="text-xs">
                Desde
              </Label>
              <Input
                id="desde"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hasta" className="text-xs">
                Hasta
              </Label>
              <Input
                id="hasta"
                type="date"
                value={to}
                min={from}
                max={todayLocal()}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4 lg:col-span-2" data-tour="turnos-kpis">
          <Kpi icon={Clock} label="Horas" value={fmtHours(totalHours)} />
          <Kpi icon={Users} label="Trabajadores" value={String(workerCount)} />
          <Kpi icon={CalendarClock} label="Días-turno" value={String(totalDays)} />
        </div>
      </div>

      <Card data-tour="turnos-tabla">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <CalendarClock className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay horas registradas en este rango.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.userId}-${r.sedeId}`}>
                    <TableCell className="font-medium">{r.userName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="size-3" />
                        {r.sedeName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.days}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtHours(r.hours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totalDays}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtHours(totalHours)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** Panel de solicitudes de edición pendientes: aprobar / rechazar. */
function EditRequestsPanel({ onResolved }: { onResolved: () => void }) {
  const [reqs, setReqs] = React.useState<AttendanceEditRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setReqs(await listEditRequests("pending"))
    } catch {
      setReqs([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function resolve(id: string, approve: boolean) {
    setBusyId(id)
    try {
      await resolveEditRequest(id, approve)
      await load()
      onResolved()
    } catch (err) {
      alert(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  // Se oculta si no hay nada pendiente, para no ocupar espacio.
  if (loading) {
    return <Skeleton className="h-24 rounded-xl" />
  }
  if (reqs.length === 0) return null

  return (
    <Card className="border-amber-300/60">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-amber-600" />
          <p className="font-display text-base">
            Solicitudes de edición de horas
          </p>
          <Badge className="bg-amber-500/10 text-amber-600">{reqs.length}</Badge>
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {reqs.map((r) => (
            <li
              key={r._id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {r.employeeName}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {r.workDate}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {r.currentCheckIn || "—"} → {r.currentCheckOut || "—"}
                  </span>
                  <ArrowRight className="size-3" />
                  <span className="font-medium text-foreground tabular-nums">
                    {r.proposedCheckIn ?? r.currentCheckIn ?? "—"} →{" "}
                    {r.proposedCheckOut ?? r.currentCheckOut ?? "—"}
                  </span>
                </p>
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  “{r.reason}”
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busyId === r._id}
                  onClick={() => void resolve(r._id, false)}
                >
                  <X className="size-4" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={busyId === r._id}
                  onClick={() => void resolve(r._id, true)}
                >
                  {busyId === r._id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Aprobar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Editor de horas de un día: registrar (agregar) o corregir por trabajador. */
function DayEditor({
  sedes,
  onSaved,
}: {
  sedes: Sede[]
  onSaved: () => void
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [date, setDate] = React.useState(todayLocal())
  const [workers, setWorkers] = React.useState<Worker[]>([])
  const [draft, setDraft] = React.useState<
    Record<string, { checkIn: string; checkOut: string }>
  >({})
  const [loading, setLoading] = React.useState(false)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Primera sede activa por defecto.
  React.useEffect(() => {
    if (!sedeId && sedes[0]) setSedeId(sedes[0]._id)
  }, [sedes, sedeId])

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [ws, recs] = await Promise.all([
        listAttendanceWorkers(sedeId),
        listAttendanceDay(sedeId, date),
      ])
      setWorkers(ws)
      const m: Record<string, { checkIn: string; checkOut: string }> = {}
      for (const w of ws) m[w.id] = { checkIn: "", checkOut: "" }
      for (const r of recs) {
        m[r.employeeId] = { checkIn: r.checkIn ?? "", checkOut: r.checkOut ?? "" }
      }
      setDraft(m)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, date])

  React.useEffect(() => {
    void load()
  }, [load])

  async function save(w: Worker) {
    const d = draft[w.id] ?? { checkIn: "", checkOut: "" }
    setSavingId(w.id)
    setError(null)
    try {
      await adminSetAttendance({
        sedeId,
        employeeId: w.id,
        workDate: date,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  function setField(id: string, field: "checkIn" | "checkOut", value: string) {
    setDraft((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { checkIn: "", checkOut: "" }), [field]: value },
    }))
  }

  const sedeItems = Object.fromEntries(sedes.map((s) => [s._id, s.name]))

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <p className="font-display text-base">Registrar / corregir horas</p>
              <p className="text-xs text-muted-foreground">
                Agrega o modifica las horas de un día. A diferencia del POS, aquí
                puedes sobrescribir lo ya registrado.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Sede</Label>
              <Select
                value={sedeId}
                items={sedeItems}
                onValueChange={(v) => v && setSedeId(v as string)}
              >
                <SelectTrigger className="w-44">
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
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-date" className="text-xs">
                Día
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                max={todayLocal()}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : workers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay empleados activos asignados a esta sede.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {workers.map((w) => {
              const d = draft[w.id] ?? { checkIn: "", checkOut: "" }
              return (
                <li
                  key={w.id}
                  className="flex flex-wrap items-end gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.position || "Sin cargo"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Entrada
                    </Label>
                    <Input
                      type="time"
                      value={d.checkIn}
                      onChange={(e) => setField(w.id, "checkIn", e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Salida
                    </Label>
                    <Input
                      type="time"
                      value={d.checkOut}
                      onChange={(e) => setField(w.id, "checkOut", e.target.value)}
                      className="w-28"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={savingId === w.id}
                    onClick={() => void save(w)}
                  >
                    {savingId === w.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Guardar
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
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
