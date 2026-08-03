"use client"

import * as React from "react"
import { CalendarClock, ShieldOff, MapPin, Users, Clock } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  attendanceSummary,
  type AttendanceSummaryRow,
} from "@/lib/erp/api-attendance"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
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
  )

  return (
    <>
      <PageHeader
        section="Personal"
        title="Turnos"
        description="Horas trabajadas por trabajador y sede (control de horas de nómina)."
        actions={sedeSelector}
      />

      {/* Filtros de rango + KPIs */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
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

        <div className="grid grid-cols-3 gap-4 lg:col-span-2">
          <Kpi icon={Clock} label="Horas" value={fmtHours(totalHours)} />
          <Kpi icon={Users} label="Trabajadores" value={String(workerCount)} />
          <Kpi icon={CalendarClock} label="Días-turno" value={String(totalDays)} />
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
