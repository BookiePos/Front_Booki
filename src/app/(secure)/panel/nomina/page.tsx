"use client"

import * as React from "react"
import {
  ShieldOff,
  Loader2,
  Play,
  Calculator,
  History,
  SlidersHorizontal,
  Printer,
  Trash2,
  Users,
  LogOut,
  CalendarClock,
  Mail,
  AlertTriangle,
  Lock,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import { listEmployees, type Employee } from "@/lib/erp/api-employees"
import {
  getPayrollSettings,
  updatePayrollSettings,
  previewPayroll,
  createPayrollRun,
  listPayrollRuns,
  getPayrollRun,
  deletePayrollRun,
  closePayrollRun,
  computeLiquidacion,
  novedadesTurnos,
  sendPayrollSlip,
  type PayrollSettings,
  type PayrollRun,
  type PayrollSlip,
  type PreviewResult,
  type PayrollNovedades,
  type LiquidacionResult,
} from "@/lib/erp/api-payroll"
import { ApiError } from "@/lib/api"

import { PageHeader } from "@/components/erp/page-header"
import { PayrollSlipView } from "@/components/erp/payroll-slip-view"
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

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}
function numOr(v: string, d = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

type Tab = "correr" | "simulador" | "liquidacion" | "historial" | "parametros"

export default function NominaPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("payroll.manage")

  const [tab, setTab] = React.useState<Tab>("correr")
  const [settings, setSettings] = React.useState<PayrollSettings | null>(null)
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [runs, setRuns] = React.useState<PayrollRun[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    setError(null)
    try {
      const [st, emps, sd, rs] = await Promise.all([
        getPayrollSettings(),
        listEmployees(),
        listSedes(),
        listPayrollRuns(),
      ])
      setSettings(st)
      setEmployees(emps)
      setSedes(sd.filter((s) => s.active))
      setRuns(rs)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canManage])

  // Refresco solo del historial de corridas, SIN togglear `loading` (que
  // desmontaría la pestaña activa y perdería el detalle recién generado).
  const refreshRuns = React.useCallback(async () => {
    if (!canManage) return
    try {
      setRuns(await listPayrollRuns())
    } catch {
      /* no-op */
    }
  }, [canManage])

  React.useEffect(() => {
    void load()
  }, [load])

  if (!canManage) {
    return (
      <>
        <PageHeader section="Personal" title="Nómina" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para gestionar la nómina.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "correr", label: "Correr nómina", icon: Play },
    { key: "simulador", label: "Simulador", icon: Calculator },
    { key: "liquidacion", label: "Liquidación", icon: LogOut },
    { key: "historial", label: "Historial", icon: History },
    { key: "parametros", label: "Parámetros", icon: SlidersHorizontal },
  ]

  return (
    <>
      <PageHeader
        section="Personal"
        title="Nómina"
        description="Cálculo de nómina conforme a la normativa laboral colombiana 2026."
      />

      <div className="mb-4 flex flex-wrap gap-1" data-tour="nomina-tabs">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTab(t.key)}
            >
              <Icon className="size-4" />
              {t.label}
            </Button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">{error}</p>
      ) : settings ? (
        <>
          {tab === "correr" && (
            <CorrerNomina
              sedes={sedes}
              employees={employees}
              runs={runs}
              onRan={() => void refreshRuns()}
            />
          )}
          {tab === "simulador" && (
            <Simulador employees={employees} />
          )}
          {tab === "liquidacion" && (
            <Liquidacion employees={employees} />
          )}
          {tab === "historial" && (
            <Historial runs={runs} onChanged={() => void refreshRuns()} />
          )}
          {tab === "parametros" && (
            <Parametros settings={settings} onSaved={(s) => setSettings(s)} />
          )}
        </>
      ) : null}
    </>
  )
}

// ── Correr nómina ────────────────────────────────────────────────────────────
function CorrerNomina({
  sedes,
  employees,
  runs,
  onRan,
}: {
  sedes: Sede[]
  employees: Employee[]
  runs: PayrollRun[]
  onRan: () => void
}) {
  const [period, setPeriod] = React.useState(currentMonth())
  const [coverage, setCoverage] = React.useState<"all" | "sede">("all")
  const [sedeId, setSedeId] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [run, setRun] = React.useState<PayrollRun | null>(null)
  // Id de la corrida que ya está mostrada (evita recargarla en bucle).
  const shownIdRef = React.useRef<string | null>(null)

  // La corrida más reciente que coincide con lo seleccionado (período +
  // cobertura + sede). `runs` viene ordenado por fecha desc del backend.
  const targetRun = React.useMemo(
    () =>
      runs.find(
        (r) =>
          r.period === period &&
          r.coverage === coverage &&
          (coverage === "all" || r.sedeId === sedeId),
      ) ?? null,
    [runs, period, coverage, sedeId],
  )

  // Muestra abajo "cómo va" la nómina del período: carga el detalle de la
  // corrida objetivo (con sus desprendibles) cuando cambia.
  React.useEffect(() => {
    const id = targetRun?._id ?? null
    if (id === shownIdRef.current) return
    if (!id) {
      shownIdRef.current = null
      setRun(null)
      return
    }
    let cancelled = false
    getPayrollRun(id)
      .then((full) => {
        if (!cancelled) {
          shownIdRef.current = id
          setRun(full)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [targetRun])

  // Empleados que realmente entran a la nómina: activos, con salario y —si la
  // cobertura es por sede— asignados a esa sede. Es lo mismo que exige el backend.
  const eligible = React.useMemo(
    () =>
      employees.filter(
        (e) =>
          e.status === "activo" &&
          (e.salary ?? 0) > 0 &&
          (coverage === "all" || e.sedeId === sedeId),
      ),
    [employees, coverage, sedeId],
  )
  const sedeChosen = coverage === "all" || sedeId !== ""

  async function run_() {
    setBusy(true)
    setError(null)
    try {
      const r = await createPayrollRun({
        period,
        coverage,
        sedeId: coverage === "sede" ? sedeId : undefined,
        label: label || undefined,
      })
      shownIdRef.current = r._id
      setRun(r)
      onRan()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card data-tour="nomina-correr">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Período</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Cobertura</Label>
            <select
              className={`${inputClass} w-40`}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as "all" | "sede")}
            >
              <option value="all">Todos los empleados</option>
              <option value="sede">Una sede</option>
            </select>
          </div>
          {coverage === "sede" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Sede</Label>
              <select
                className={`${inputClass} w-48`}
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {sedes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">Etiqueta (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Nómina julio 2026"
            />
          </div>
          <Button
            className="gap-2"
            disabled={busy || !sedeChosen || eligible.length === 0}
            onClick={() => void run_()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Generar nómina
          </Button>
        </CardContent>
      </Card>

      {/* Aviso: por qué no se puede generar (evita el "no me genera" sin razón). */}
      {sedeChosen && eligible.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              No hay empleados para nominar en esta cobertura.
            </p>
            <p className="text-amber-700/90">
              Solo se nomina a empleados <span className="font-medium">activos y
              con salario</span> en su expediente
              {coverage === "sede" && " y asignados a esta sede"}. Revísalo en{" "}
              <span className="font-medium">Personal → Empleados</span>.
            </p>
          </div>
        </div>
      ) : (
        sedeChosen && (
          <p className="text-sm text-muted-foreground">
            Se generará la nómina de{" "}
            <span className="font-medium text-foreground">
              {eligible.length} empleado{eligible.length !== 1 ? "s" : ""}
            </span>{" "}
            (activos y con salario, 30 días).
          </p>
        )
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Para casos con horas extra o novedades usa el{" "}
        <span className="font-medium">Simulador</span>.
      </p>

      {run && (
        <RunDetail
          run={run}
          onChanged={(updated) => {
            shownIdRef.current = updated._id
            setRun(updated)
            onRan()
          }}
        />
      )}
    </div>
  )
}

// ── Detalle de una corrida (totales + tabla + desprendible) ──────────────────
function RunDetail({
  run,
  onChanged,
}: {
  run: PayrollRun
  onChanged?: (updated: PayrollRun) => void
}) {
  const [slip, setSlip] = React.useState<PayrollSlip | null>(null)
  const [sending, setSending] = React.useState(false)
  const [closing, setClosing] = React.useState(false)
  const [sendMsg, setSendMsg] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  )

  const isClosed = run.status === "cerrada"

  function openSlip(s: PayrollSlip) {
    setSlip(s)
    setSendMsg(null)
  }

  async function handleClose() {
    if (
      !window.confirm(
        `¿Generar el cierre de la nómina de ${run.period}? Quedará fija en el historial y no se podrá eliminar.`,
      )
    )
      return
    setClosing(true)
    try {
      const updated = await closePayrollRun(run._id)
      onChanged?.(updated)
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "No se pudo cerrar la nómina.")
    } finally {
      setClosing(false)
    }
  }

  async function handleSend() {
    if (!slip) return
    setSending(true)
    setSendMsg(null)
    try {
      const r = await sendPayrollSlip(run._id, slip.employeeId)
      if (r.sent) {
        setSendMsg({ ok: true, text: `Comprobante enviado a ${r.email}.` })
      } else if (r.simulated) {
        setSendMsg({
          ok: true,
          text: `Correo simulado: sin proveedor configurado, se registró en el log (${r.email}).`,
        })
      } else {
        setSendMsg({ ok: false, text: r.error ?? "No se pudo enviar el comprobante." })
      }
    } catch (e) {
      setSendMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Error al enviar el comprobante.",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Estado del período + cierre */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Nómina {run.period}
            {run.label ? ` · ${run.label}` : ""}
          </span>
          <Badge
            className={
              isClosed
                ? "bg-green-500/10 text-green-600"
                : "bg-amber-500/10 text-amber-600"
            }
          >
            {isClosed ? "Cerrada" : "Borrador"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {run.slips.length} empleado{run.slips.length !== 1 ? "s" : ""}
          </span>
        </div>
        {isClosed ? (
          <span className="text-xs text-muted-foreground">
            Cerrada el {run.closedAt ? fmtDate(run.closedAt) : "—"}
          </span>
        ) : (
          onChanged && (
            <Button
              size="sm"
              className="gap-2"
              disabled={closing || run.slips.length === 0}
              onClick={() => void handleClose()}
            >
              {closing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Generar cierre
            </Button>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Neto a pagar" value={money.format(run.totals.neto)} accent />
        <Kpi label="Total devengado" value={money.format(run.totals.devengado)} />
        <Kpi label="Aportes patronales" value={money.format(run.totals.aportes)} />
        <Kpi label="Costo total" value={money.format(run.totals.costo)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {run.slips.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin desprendibles.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Devengado</TableHead>
                  <TableHead className="text-right">Deducciones</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.slips.map((s) => (
                  <TableRow key={s.employeeId}>
                    <TableCell className="font-medium">{s.employeeName}</TableCell>
                    <TableCell>{s.positionName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(s.totalDevengado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money.format(s.totalDeducciones)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(s.netoPagar)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openSlip(s)}>
                        Desprendible
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={slip !== null}
        onOpenChange={(v) => {
          if (!v) {
            setSlip(null)
            setSendMsg(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {slip && (
            <div className="flex flex-col gap-4 px-4 py-2">
              <SheetHeader className="px-0">
                <SheetTitle className="font-display text-lg">
                  {slip.employeeName}
                </SheetTitle>
                <SheetDescription>
                  Desprendible de nómina — período {run.period}.
                </SheetDescription>
              </SheetHeader>
              <PayrollSlipView
                breakdown={slip.breakdown}
                otrasDetalle={slip.otrasDeduccionesDetalle}
                header={
                  <div className="invoice-printable mb-2 border-b border-border pb-2 text-sm">
                    <p className="font-semibold">{slip.employeeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {slip.docNumber ? `Doc. ${slip.docNumber} · ` : ""}
                      {slip.positionName ?? "Sin cargo"} · Salario base{" "}
                      {money.format(slip.salarioBase)}
                    </p>
                  </div>
                }
              />
              <div className="no-print flex flex-col gap-2">
                <Button className="gap-2" onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  Enviar comprobante al correo
                </Button>
                {sendMsg && (
                  <p
                    className={`text-sm ${
                      sendMsg.ok ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {sendMsg.text}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" />
                  Imprimir / PDF
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ── Simulador ────────────────────────────────────────────────────────────────
function Simulador({ employees }: { employees: Employee[] }) {
  const withSalary = employees.filter((e) => e.salary && e.salary > 0)
  const [employeeId, setEmployeeId] = React.useState("")
  const [salarioBase, setSalarioBase] = React.useState("")
  const [salaryType, setSalaryType] = React.useState("ordinario")
  const [arl, setArl] = React.useState("I")
  const [dias, setDias] = React.useState("30")
  const [exD, setExD] = React.useState("")
  const [exN, setExN] = React.useState("")
  const [recN, setRecN] = React.useState("")
  const [dom, setDom] = React.useState("")
  const [ndom, setNdom] = React.useState("")
  const [exDdom, setExDdom] = React.useState("")
  const [exNdom, setExNdom] = React.useState("")
  const [bonoSal, setBonoSal] = React.useState("")
  const [bonoNoSal, setBonoNoSal] = React.useState("")
  const [otras, setOtras] = React.useState("")
  const [dependientes, setDependientes] = React.useState(false)
  const [period, setPeriod] = React.useState(currentMonth())
  const [turnoMsg, setTurnoMsg] = React.useState<string | null>(null)
  const [fetching, setFetching] = React.useState(false)
  const [result, setResult] = React.useState<PreviewResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function fetchTurnos() {
    if (!employeeId) return
    setFetching(true)
    setTurnoMsg(null)
    try {
      const n = await novedadesTurnos(employeeId, `${period}-01`, `${period}-31`)
      const v = (x: number) => (x ? String(x) : "")
      setRecN(v(n.horas.recargoNocturno))
      setDom(v(n.horas.dominical))
      setNdom(v(n.horas.nocturnoDominical))
      setExD(v(n.horas.extraDiurna))
      setExN(v(n.horas.extraNocturna))
      setExDdom(v(n.horas.extraDiurnaDominical))
      setExNdom(v(n.horas.extraNocturnaDominical))
      setDias(String(n.diasTrabajados || 30))
      setTurnoMsg(
        `${n.diasTrabajados} días · ${n.totalHoras} h registradas. Revisa y ajusta antes de calcular.`,
      )
    } catch (err) {
      setTurnoMsg(errorMessage(err))
    } finally {
      setFetching(false)
    }
  }

  async function calc() {
    setBusy(true)
    setError(null)
    const horas = {
      extraDiurna: numOr(exD),
      extraNocturna: numOr(exN),
      recargoNocturno: numOr(recN),
      dominical: numOr(dom),
      nocturnoDominical: numOr(ndom),
      extraDiurnaDominical: numOr(exDdom),
      extraNocturnaDominical: numOr(exNdom),
    }
    const novedades: PayrollNovedades = {
      horas,
      bonificacionSalarial: numOr(bonoSal),
      bonificacionNoSalarial: numOr(bonoNoSal),
      otrasDeducciones: numOr(otras),
      dependientes,
    }
    try {
      const r = await previewPayroll(
        employeeId
          ? { employeeId, diasTrabajados: numOr(dias, 30), novedades }
          : {
              salarioBase: numOr(salarioBase),
              salaryType,
              arlRiskLevel: arl,
              diasTrabajados: numOr(dias, 30),
              novedades,
            },
      )
      setResult(r)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Empleado</Label>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">— Datos manuales —</option>
              {withSalary.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName} ({money.format(e.salary ?? 0)})
                </option>
              ))}
            </select>
          </div>

          {employeeId && (
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-2">
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Período de turnos</Label>
                  <Input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={fetching}
                  onClick={() => void fetchTurnos()}
                >
                  {fetching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarClock className="size-4" />
                  )}
                  Traer horas de Turnos
                </Button>
              </div>
              {turnoMsg && (
                <p className="text-xs text-muted-foreground">{turnoMsg}</p>
              )}
            </div>
          )}

          {!employeeId && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 flex flex-col gap-1">
                <Label className="text-xs">Salario base</Label>
                <Input
                  type="number"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tipo</Label>
                <select
                  className={inputClass}
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="ordinario">Ordinario</option>
                  <option value="integral">Integral</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Riesgo ARL</Label>
                <select
                  className={inputClass}
                  value={arl}
                  onChange={(e) => setArl(e.target.value)}
                >
                  {["I", "II", "III", "IV", "V"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Field label="Días" value={dias} onChange={setDias} />
            <Field label="H. extra diurna" value={exD} onChange={setExD} />
            <Field label="H. extra nocturna" value={exN} onChange={setExN} />
            <Field label="H. recargo nocturno" value={recN} onChange={setRecN} />
            <Field label="H. dominical/festivo" value={dom} onChange={setDom} />
            <Field label="H. nocturna dominical" value={ndom} onChange={setNdom} />
            <Field label="H. extra diurna dom." value={exDdom} onChange={setExDdom} />
            <Field label="H. extra noct. dom." value={exNdom} onChange={setExNdom} />
            <Field label="Otras deducciones" value={otras} onChange={setOtras} />
            <Field label="Bonif. salarial" value={bonoSal} onChange={setBonoSal} />
            <Field label="Bonif. no salarial" value={bonoNoSal} onChange={setBonoNoSal} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dependientes}
              onChange={(e) => setDependientes(e.target.checked)}
            />
            Deducción por dependientes (retención)
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="gap-2" disabled={busy} onClick={() => void calc()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Calcular
          </Button>
        </CardContent>
      </Card>

      <div>
        {result ? (
          <PayrollSlipView
            breakdown={result.breakdown}
            header={
              <div className="mb-2 border-b border-border pb-2 text-sm">
                <p className="font-semibold">
                  {result.input.employeeName ?? "Simulación"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Salario base {money.format(result.input.salarioBase)} ·{" "}
                  {result.input.salaryType}
                </p>
              </div>
            }
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <Calculator className="size-9 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Elige un empleado o ingresa un salario y las novedades, y calcula
                el desprendible.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ── Liquidación definitiva ───────────────────────────────────────────────────
const MOTIVOS: { v: string; l: string }[] = [
  { v: "sin_justa_causa", l: "Despido sin justa causa" },
  { v: "justa_causa", l: "Despido con justa causa" },
  { v: "renuncia", l: "Renuncia" },
  { v: "fin_contrato", l: "Terminación del contrato" },
  { v: "mutuo_acuerdo", l: "Mutuo acuerdo" },
]

function Liquidacion({ employees }: { employees: Employee[] }) {
  const withSalary = employees.filter((e) => e.salary && e.salary > 0)
  const [employeeId, setEmployeeId] = React.useState("")
  const [salarioBase, setSalarioBase] = React.useState("")
  const [salaryType, setSalaryType] = React.useState("ordinario")
  const [contractType, setContractType] = React.useState("indefinido")
  const [fechaInicio, setFechaInicio] = React.useState("")
  const [fechaFin, setFechaFin] = React.useState(
    new Date().toISOString().slice(0, 10),
  )
  const [motivo, setMotivo] = React.useState("sin_justa_causa")
  const [salariosPend, setSalariosPend] = React.useState("")
  const [diasFaltantes, setDiasFaltantes] = React.useState("")
  const [result, setResult] = React.useState<LiquidacionResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function calc() {
    setBusy(true)
    setError(null)
    try {
      const r = await computeLiquidacion({
        employeeId: employeeId || undefined,
        salarioBase: employeeId ? undefined : numOr(salarioBase),
        salaryType: employeeId ? undefined : salaryType,
        contractType: employeeId ? undefined : contractType,
        fechaInicio: fechaInicio || undefined,
        fechaFin,
        motivo,
        salariosPendientes: numOr(salariosPend),
        diasFaltantesContrato: numOr(diasFaltantes),
      })
      setResult(r)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const b = result?.breakdown
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Empleado</Label>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">— Datos manuales —</option>
              {withSalary.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>

          {!employeeId && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Salario base" value={salarioBase} onChange={setSalarioBase} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tipo</Label>
                <select
                  className={inputClass}
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="ordinario">Ordinario</option>
                  <option value="integral">Integral</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Contrato</Label>
                <select
                  className={inputClass}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                >
                  <option value="indefinido">Indefinido</option>
                  <option value="fijo">Término fijo</option>
                  <option value="obra_labor">Obra o labor</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                Inicio {employeeId ? "(vacío = ingreso)" : ""}
              </Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Retiro</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Motivo de retiro</Label>
            <select
              className={inputClass}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Salarios pendientes"
              value={salariosPend}
              onChange={setSalariosPend}
            />
            {motivo === "sin_justa_causa" && (
              <Field
                label="Días faltantes (fijo/obra)"
                value={diasFaltantes}
                onChange={setDiasFaltantes}
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="gap-2" disabled={busy} onClick={() => void calc()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Calcular liquidación
          </Button>
        </CardContent>
      </Card>

      <div>
        {b ? (
          <Card>
            <CardContent className="py-4">
              <div className="mb-2 border-b border-border pb-2">
                <p className="font-semibold">
                  {result?.input.employeeName ?? "Liquidación"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.diasLiquidados} días · base prestacional{" "}
                  {money.format(b.basePrestacional)}
                </p>
              </div>
              <LiqRow label="Cesantías" value={b.cesantias} />
              <LiqRow label="Intereses de cesantías" value={b.interesesCesantias} />
              <LiqRow label="Prima de servicios" value={b.prima} />
              <LiqRow label="Vacaciones" value={b.vacaciones} />
              {b.indemnizacion > 0 && (
                <LiqRow
                  label={`Indemnización${b.detalleIndemnizacion ? ` · ${b.detalleIndemnizacion}` : ""}`}
                  value={b.indemnizacion}
                />
              )}
              {b.salariosPendientes > 0 && (
                <LiqRow label="Salarios pendientes" value={b.salariosPendientes} />
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="font-semibold">Total a liquidar</span>
                <span className="font-display text-lg tabular-nums text-primary">
                  {money.format(b.total)}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimación. La indemnización y casos especiales pueden requerir
                revisión del contador o abogado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <LogOut className="size-9 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Calcula cesantías, intereses, prima y vacaciones proporcionales
                más la indemnización al terminar el contrato.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function LiqRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
      <span>{label}</span>
      <span className="tabular-nums">{money.format(value)}</span>
    </div>
  )
}

// ── Historial ────────────────────────────────────────────────────────────────
function Historial({
  runs,
  onChanged,
}: {
  runs: PayrollRun[]
  onChanged: () => void
}) {
  const [open, setOpen] = React.useState<PayrollRun | null>(null)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)

  async function openRun(id: string) {
    setLoadingId(id)
    try {
      setOpen(await getPayrollRun(id))
    } catch {
      /* no-op */
    } finally {
      setLoadingId(null)
    }
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar esta corrida de nómina?")) return
    try {
      await deletePayrollRun(id)
      onChanged()
      if (open?._id === id) setOpen(null)
    } catch {
      /* no-op */
    }
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <Users className="size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aún no has corrido ninguna nómina.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">{r.period}</TableCell>
                  <TableCell>{r.label ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.status === "cerrada"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-amber-500/10 text-amber-600"
                      }
                    >
                      {r.status === "cerrada" ? "Cerrada" : "Borrador"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(r.totals.neto)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money.format(r.totals.costo)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loadingId === r._id}
                        onClick={() => void openRun(r._id)}
                      >
                        {loadingId === r._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Ver"
                        )}
                      </Button>
                      {r.status !== "cerrada" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void remove(r._id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <div className="mt-4">
          <RunDetail
            run={open}
            onChanged={(updated) => {
              setOpen(updated)
              onChanged()
            }}
          />
        </div>
      )}
    </>
  )
}

// ── Parámetros ───────────────────────────────────────────────────────────────
const RECARGO_LABELS: { k: keyof PayrollSettings["recargos"]; l: string }[] = [
  { k: "recargoNocturno", l: "Recargo nocturno" },
  { k: "dominical", l: "Dominical / festivo" },
  { k: "nocturnoDominical", l: "Nocturno dominical" },
  { k: "extraDiurna", l: "Extra diurna" },
  { k: "extraNocturna", l: "Extra nocturna" },
  { k: "extraDiurnaDominical", l: "Extra diurna dominical" },
  { k: "extraNocturnaDominical", l: "Extra nocturna dominical" },
]
const ARL_KEYS: (keyof PayrollSettings["arlRates"])[] = ["I", "II", "III", "IV", "V"]

function toPctStr(n: number): string {
  return String(Math.round(n * 1e6) / 1e4) // decimal → % con hasta 4 decimales
}

function Parametros({
  settings,
  onSaved,
}: {
  settings: PayrollSettings
  onSaved: (s: PayrollSettings) => void
}) {
  const [smmlv, setSmmlv] = React.useState(String(settings.smmlv))
  const [aux, setAux] = React.useState(String(settings.auxilioTransporte))
  const [uvt, setUvt] = React.useState(String(settings.uvt))
  const [exonera, setExonera] = React.useState(settings.empresaExoneradaAportes)
  const [rec, setRec] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      RECARGO_LABELS.map(({ k }) => [k, toPctStr(settings.recargos[k])]),
    ),
  )
  const [arl, setArl] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(ARL_KEYS.map((k) => [k, toPctStr(settings.arlRates[k])])),
  )
  const [fsp, setFsp] = React.useState(
    settings.fspTramos.map((t) => ({
      hasta: t.hastaSmmlv === null ? "" : String(t.hastaSmmlv),
      rate: toPctStr(t.rate),
    })),
  )
  const [t383, setT383] = React.useState(
    settings.tabla383.map((t) => ({
      desdeUvt: String(t.desdeUvt),
      hastaUvt: t.hastaUvt === null ? "" : String(t.hastaUvt),
      rate: toPctStr(t.rate),
      uvtBase: String(t.uvtBase),
    })),
  )
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const s = await updatePayrollSettings({
        smmlv: numOr(smmlv),
        auxilioTransporte: numOr(aux),
        uvt: numOr(uvt),
        empresaExoneradaAportes: exonera,
        recargos: Object.fromEntries(
          RECARGO_LABELS.map(({ k }) => [k, numOr(rec[k] ?? "0") / 100]),
        ) as unknown as PayrollSettings["recargos"],
        arlRates: Object.fromEntries(
          ARL_KEYS.map((k) => [k, numOr(arl[k] ?? "0") / 100]),
        ) as unknown as PayrollSettings["arlRates"],
        fspTramos: fsp.map((t) => ({
          hastaSmmlv: t.hasta === "" ? null : numOr(t.hasta),
          rate: numOr(t.rate) / 100,
        })),
        tabla383: t383.map((t) => ({
          desdeUvt: numOr(t.desdeUvt),
          hastaUvt: t.hastaUvt === "" ? null : numOr(t.hastaUvt),
          rate: numOr(t.rate) / 100,
          uvtBase: numOr(t.uvtBase),
        })),
      })
      onSaved(s)
      setMsg("Parámetros guardados.")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-semibold">Valores del año ({settings.year})</p>
            <Field label="SMMLV (salario mínimo)" value={smmlv} onChange={setSmmlv} />
            <Field label="Auxilio de transporte" value={aux} onChange={setAux} />
            <Field label="UVT" value={uvt} onChange={setUvt} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exonera}
                onChange={(e) => setExonera(e.target.checked)}
              />
              Empresa exonerada de aportes (art. 114-1), salarios &lt; 10 SMMLV
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-semibold">Recargos y horas extra (%)</p>
            <div className="grid grid-cols-2 gap-2">
              {RECARGO_LABELS.map(({ k, l }) => (
                <Field
                  key={k}
                  label={l}
                  value={rec[k] ?? ""}
                  onChange={(v) => setRec((p) => ({ ...p, [k]: v }))}
                />
              ))}
            </div>
            <p className="mt-1 text-sm font-semibold">ARL por nivel (%)</p>
            <div className="grid grid-cols-5 gap-2">
              {ARL_KEYS.map((k) => (
                <Field
                  key={k}
                  label={k}
                  value={arl[k] ?? ""}
                  onChange={(v) => setArl((p) => ({ ...p, [k]: v }))}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-semibold">
              Fondo de Solidaridad Pensional
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Hasta (SMMLV, vacío = ∞)</span>
              <span>Tarifa (%)</span>
            </div>
            {fsp.map((t, i) => (
              <div key={i} className="mt-1 grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  value={t.hasta}
                  placeholder="∞"
                  onChange={(e) =>
                    setFsp((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, hasta: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  className={inputClass}
                  value={t.rate}
                  onChange={(e) =>
                    setFsp((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, rate: e.target.value } : r,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-semibold">
              Retención en la fuente (art. 383, UVT)
            </p>
            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
              <span>Desde</span>
              <span>Hasta</span>
              <span>Tarifa %</span>
              <span>UVT base</span>
            </div>
            {t383.map((t, i) => (
              <div key={i} className="mt-1 grid grid-cols-4 gap-2">
                <input
                  className={inputClass}
                  value={t.desdeUvt}
                  onChange={(e) =>
                    setT383((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, desdeUvt: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  className={inputClass}
                  value={t.hastaUvt}
                  placeholder="∞"
                  onChange={(e) =>
                    setT383((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, hastaUvt: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  className={inputClass}
                  value={t.rate}
                  onChange={(e) =>
                    setT383((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, rate: e.target.value } : r,
                      ),
                    )
                  }
                />
                <input
                  className={inputClass}
                  value={t.uvtBase}
                  onChange={(e) =>
                    setT383((p) =>
                      p.map((r, idx) =>
                        idx === i ? { ...r, uvtBase: e.target.value } : r,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <div>
        <Button className="gap-2" disabled={busy} onClick={() => void save()}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Guardar parámetros
        </Button>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`font-display text-xl leading-tight ${
            accent ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  )
}

