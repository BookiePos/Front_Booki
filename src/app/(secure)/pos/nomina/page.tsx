"use client"

import * as React from "react"
import {
  Clock,
  Users,
  ShieldOff,
  MapPin,
  Check,
  CheckCircle2,
  Loader2,
  CalendarClock,
  Lock,
  Pencil,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  listWorkers,
  listAttendance,
  upsertAttendance,
  attendanceSummary,
  requestAttendanceEdit,
  type Worker,
  type AttendanceSummaryRow,
} from "@/lib/pos/api-attendance"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA") // YYYY-MM-DD (zona local)
}

function monthStart(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function computeHours(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0
  const toMin = (t: string) => {
    const [h, m] = t.split(":")
    return Number(h ?? 0) * 60 + Number(m ?? 0)
  }
  let mins = toMin(checkOut) - toMin(checkIn)
  if (mins < 0) mins += 24 * 60
  return Math.round((mins / 60) * 100) / 100
}

function fmtHours(h: number): string {
  return `${h.toFixed(2)} h`
}

interface Row {
  checkIn: string
  checkOut: string
}

const EMPTY: Row = { checkIn: "", checkOut: "" }

function sameRow(a: Row, b: Row): boolean {
  return a.checkIn === b.checkIn && a.checkOut === b.checkOut
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

export default function NominaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("pos.sell")
  const { sedeId, sede } = useSede()

  const [date, setDate] = React.useState(todayLocal())
  const [workers, setWorkers] = React.useState<Worker[]>([])
  // Borrador editable + base confirmada (lo que está guardado en el servidor).
  const [rows, setRows] = React.useState<Record<string, Row>>({})
  const [saved, setSaved] = React.useState<Record<string, Row>>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [flash, setFlash] = React.useState<string | null>(null)

  // Solicitud de edición de horas ya bloqueadas (la aprueba Operación).
  const [reqWorker, setReqWorker] = React.useState<Worker | null>(null)
  const [reqIn, setReqIn] = React.useState("")
  const [reqOut, setReqOut] = React.useState("")
  const [reqReason, setReqReason] = React.useState("")
  const [reqBusy, setReqBusy] = React.useState(false)
  const [reqError, setReqError] = React.useState<string | null>(null)

  function openEditRequest(w: Worker) {
    const cur = saved[w.id] ?? EMPTY
    setReqWorker(w)
    setReqIn(cur.checkIn)
    setReqOut(cur.checkOut)
    setReqReason("")
    setReqError(null)
  }

  async function submitEditRequest() {
    if (!reqWorker || !sedeId) return
    if (reqReason.trim().length < 3) {
      setReqError("Escribe el motivo del cambio.")
      return
    }
    const cur = saved[reqWorker.id] ?? EMPTY
    if (reqIn === cur.checkIn && reqOut === cur.checkOut) {
      setReqError("Cambia la entrada o la salida que quieres corregir.")
      return
    }
    setReqBusy(true)
    setReqError(null)
    try {
      await requestAttendanceEdit({
        sedeId,
        employeeId: reqWorker.id,
        workDate: date,
        proposedCheckIn: reqIn || undefined,
        proposedCheckOut: reqOut || undefined,
        reason: reqReason.trim(),
      })
      setReqWorker(null)
      setFlash("Solicitud enviada a Operación para aprobación")
    } catch (err) {
      setReqError(errorMessage(err))
    } finally {
      setReqBusy(false)
    }
  }

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [ws, records] = await Promise.all([
        listWorkers(sedeId),
        listAttendance(sedeId, date),
      ])
      setWorkers(ws)
      const map: Record<string, Row> = {}
      for (const w of ws) map[w.id] = { ...EMPTY }
      for (const r of records) {
        map[r.employeeId] = { checkIn: r.checkIn ?? "", checkOut: r.checkOut ?? "" }
      }
      setRows(map)
      setSaved(map)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, date])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  // Trabajadores con cambios sin confirmar respecto a lo guardado.
  const dirtyIds = React.useMemo(
    () =>
      workers
        .filter((w) => !sameRow(rows[w.id] ?? EMPTY, saved[w.id] ?? EMPTY))
        .map((w) => w.id),
    [workers, rows, saved],
  )

  function edit(userId: string, next: Row) {
    // Los campos ya registrados (guardados) son inmutables.
    const s = saved[userId] ?? EMPTY
    setRows((prev) => ({
      ...prev,
      [userId]: {
        checkIn: s.checkIn || next.checkIn,
        checkOut: s.checkOut || next.checkOut,
      },
    }))
    setFlash(null)
  }

  async function confirm() {
    if (!sedeId || dirtyIds.length === 0) return
    setConfirming(true)
    setError(null)
    try {
      let count = 0
      for (const id of dirtyIds) {
        const r = rows[id] ?? EMPTY
        const s = saved[id] ?? EMPTY
        // Solo se envían las horas nuevas (las ya registradas no se re-mandan).
        const checkIn = !s.checkIn && r.checkIn ? r.checkIn : undefined
        const checkOut = !s.checkOut && r.checkOut ? r.checkOut : undefined
        if (!checkIn && !checkOut) continue
        await upsertAttendance({
          sedeId,
          employeeId: id,
          workDate: date,
          checkIn,
          checkOut,
        })
        count++
      }
      await load()
      void loadSummary()
      setFlash(`Horas registradas (${count})`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setConfirming(false)
    }
  }

  // Total del borrador (en vivo, mientras se edita).
  const draftTotal = React.useMemo(
    () =>
      Object.values(rows).reduce(
        (sum, r) => sum + computeHours(r.checkIn, r.checkOut),
        0,
      ),
    [rows],
  )

  // Horas confirmadas por persona (fuente: lo guardado en el servidor).
  const confirmed = React.useMemo(
    () =>
      workers
        .map((w) => {
          const r = saved[w.id] ?? EMPTY
          return { worker: w, row: r, hours: computeHours(r.checkIn, r.checkOut) }
        })
        .filter((c) => c.row.checkIn || c.row.checkOut),
    [workers, saved],
  )
  const confirmedTotal = confirmed.reduce((s, c) => s + c.hours, 0)

  // ── Turnos: horas trabajadas por trabajador y sede en un rango ───────────────
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [summary, setSummary] = React.useState<AttendanceSummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = React.useState(true)
  const [summaryError, setSummaryError] = React.useState<string | null>(null)

  const loadSummary = React.useCallback(async () => {
    if (!canView) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const rows = await attendanceSummary(from, to)
      setSummary(rows)
    } catch (err) {
      setSummaryError(errorMessage(err))
    } finally {
      setSummaryLoading(false)
    }
  }, [canView, from, to])

  React.useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const summaryTotal = summary.reduce((s, r) => s + r.hours, 0)

  if (!canView) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin acceso</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            No tienes permiso para el control de horas.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!sedeId) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin className="size-10 text-muted-foreground" />
          <p className="font-display text-lg">Sin sede</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Selecciona una sede para registrar las horas.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Control de horas</h1>
          <p className="text-sm text-muted-foreground">
            Entrada y salida de los trabajadores{sede ? ` de ${sede.name}` : ""}.
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Cada hora se registra una sola vez; al confirmarla queda bloqueada.
          </p>
        </div>
        <div data-tour="pos-horas-fecha" className="flex flex-col gap-1">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Editor de horas del día */}
      <Card data-tour="pos-horas-editor">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : workers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Users className="size-9 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                No hay empleados activos asignados a esta sede. Regístralos en el
                panel de administración (Personal → Empleados) y asígnales esta
                sede.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {workers.map((w) => {
                const row = rows[w.id] ?? EMPTY
                const savedRow = saved[w.id] ?? EMPTY
                const hours = computeHours(row.checkIn, row.checkOut)
                const isDirty = dirtyIds.includes(w.id)
                return (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-end gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground">
                        {w.name.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {w.name}
                          {isDirty && (
                            <span
                              className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
                              title="Cambios sin confirmar"
                            />
                          )}
                        </p>
                        <Badge variant="secondary" className="mt-0.5 text-[11px]">
                          {w.position || "Sin cargo"}
                        </Badge>
                      </div>
                    </div>

                    <TimeField
                      label="Entrada"
                      value={row.checkIn}
                      locked={Boolean(savedRow.checkIn)}
                      onChange={(v) => edit(w.id, { ...row, checkIn: v })}
                      onNow={() => edit(w.id, { ...row, checkIn: nowHHMM() })}
                    />
                    <TimeField
                      label="Salida"
                      value={row.checkOut}
                      locked={Boolean(savedRow.checkOut)}
                      onChange={(v) => edit(w.id, { ...row, checkOut: v })}
                      onNow={() => edit(w.id, { ...row, checkOut: nowHHMM() })}
                    />

                    <div className="w-16 text-right">
                      <p className="text-xs text-muted-foreground">Horas</p>
                      <p className="stat-figure text-base">{hours.toFixed(2)}</p>
                    </div>

                    {/* Horas ya registradas (bloqueadas): no se editan aquí, se
                        solicita el cambio para que Operación lo apruebe. */}
                    {(savedRow.checkIn || savedRow.checkOut) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground"
                        onClick={() => openEditRequest(w)}
                      >
                        <Pencil className="size-3.5" />
                        Solicitar edición
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Barra de confirmación */}
      {!loading && workers.length > 0 && (
        <div
          data-tour="pos-horas-confirmar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3"
        >
          <div className="text-sm">
            <span className="text-muted-foreground">Total del día (borrador): </span>
            <span className="stat-figure text-base">{draftTotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            {flash && (
              <span className="flex items-center gap-1 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" />
                {flash}
              </span>
            )}
            <Button
              className="gap-2"
              disabled={confirming || dirtyIds.length === 0}
              onClick={() => void confirm()}
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {dirtyIds.length > 0
                ? `Confirmar (${dirtyIds.length})`
                : "Sin cambios"}
            </Button>
          </div>
        </div>
      )}

      {/* Cuadro: horas por persona (confirmadas) del día */}
      {!loading && workers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base">Horas por persona</h2>
              <Badge variant="outline" className="text-[11px]">
                Confirmadas · {date}
              </Badge>
            </div>
            {confirmed.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aún no hay horas confirmadas para este día.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {confirmed.map((c) => (
                  <li
                    key={c.worker.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{c.worker.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {c.row.checkIn || "—"} → {c.row.checkOut || "—"}
                    </span>
                    <span className="stat-figure w-16 shrink-0 text-right text-sm">
                      {fmtHours(c.hours)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between pt-2 text-sm font-semibold">
                  <span>Total confirmado</span>
                  <span className="stat-figure">{fmtHours(confirmedTotal)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Turnos: horas trabajadas por trabajador y sede en un rango */}
      <Card data-tour="pos-horas-turnos">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-muted-foreground" />
              <div>
                <h2 className="font-display text-base">Turnos trabajados</h2>
                <p className="text-xs text-muted-foreground">
                  Horas acumuladas por trabajador y sede.
                </p>
              </div>
            </div>
            <div className="flex items-end gap-2">
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
            </div>
          </div>

          {summaryLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : summaryError ? (
            <p className="py-6 text-center text-sm text-destructive">
              {summaryError}
            </p>
          ) : summary.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay horas registradas en este rango.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Trabajador</th>
                    <th className="pb-2 font-medium">Sede</th>
                    <th className="pb-2 text-right font-medium">Días</th>
                    <th className="pb-2 text-right font-medium">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r) => (
                    <tr
                      key={`${r.userId}-${r.sedeId}`}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-2 font-medium">{r.userName}</td>
                      <td className="py-2 pr-2">
                        <Badge variant="secondary" className="gap-1 text-[11px]">
                          <MapPin className="size-3" />
                          {r.sedeName}
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">{r.days}</td>
                      <td className="py-2 text-right stat-figure">
                        {fmtHours(r.hours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-sm font-semibold">
                    <td className="pt-2" colSpan={3}>
                      Total de horas
                    </td>
                    <td className="pt-2 text-right stat-figure">
                      {fmtHours(summaryTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: solicitar edición de horas bloqueadas */}
      {reqWorker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Solicitar edición de horas"
          onClick={() => !reqBusy && setReqWorker(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg">Solicitar edición</p>
                <p className="text-sm text-muted-foreground">
                  {reqWorker.name} · {date}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => !reqBusy && setReqWorker(null)}
                className="-mr-1 -mt-1 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Las horas registradas están bloqueadas. Tu solicitud queda
              pendiente hasta que Operación la apruebe.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="req-in" className="text-xs">
                  Entrada
                </Label>
                <Input
                  id="req-in"
                  type="time"
                  value={reqIn}
                  onChange={(e) => setReqIn(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="req-out" className="text-xs">
                  Salida
                </Label>
                <Input
                  id="req-out"
                  type="time"
                  value={reqOut}
                  onChange={(e) => setReqOut(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <Label htmlFor="req-reason" className="text-xs">
                Motivo del cambio
              </Label>
              <Input
                id="req-reason"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="Ej. marqué mal la salida"
              />
            </div>

            {reqError && (
              <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {reqError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={reqBusy}
                onClick={() => setReqWorker(null)}
              >
                Cancelar
              </Button>
              <Button
                className="gap-2"
                disabled={reqBusy}
                onClick={() => void submitEditRequest()}
              >
                {reqBusy && <Loader2 className="size-4 animate-spin" />}
                Enviar solicitud
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TimeField({
  label,
  value,
  locked,
  onChange,
  onNow,
}: {
  label: string
  value: string
  locked?: boolean
  onChange: (v: string) => void
  onNow: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {locked ? (
        <div
          className="flex h-9 w-28 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-sm text-muted-foreground"
          title={`${label} registrada · no se puede modificar`}
        >
          <Lock className="size-3.5 shrink-0" />
          <span className="tabular-nums text-foreground">{value || "—"}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-28"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title={`${label} ahora`}
            onClick={onNow}
          >
            <Clock className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
