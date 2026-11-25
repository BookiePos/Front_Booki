"use client"

import * as React from "react"
import {
  ShieldOff,
  Loader2,
  Wallet,
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
  RefreshCw,
  PiggyBank,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { actorSeesAllSedes } from "@/lib/access"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import { listEmployees, type Employee } from "@/lib/erp/api-employees"
import {
  getPayrollSettings,
  updatePayrollSettings,
  getValoresLey,
  type ValoresLey,
  respuestaExoneracion,
  previewPayroll,
  createPayrollRun,
  listPayrollRuns,
  getPayrollRun,
  deletePayrollRun,
  closePayrollRun,
  declararPagoNomina,
  guardarLiquidacion,
  crearNovedad,
  listarNovedades,
  anularNovedad,
  TIPOS_NOVEDAD,
  type PayrollNovedad,
  listarLiquidaciones,
  aprobarLiquidacion,
  anularLiquidacion,
  netoLiquidacion,
  tieneRetencion,
  type PayrollLiquidacion,
  MEDIOS_PAGO_NOMINA,
  recalcPayrollRun,
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
import { PrestacionesPagos } from "@/components/erp/prestaciones-pagos"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FormDialog, FormAlert } from "@/components/ui/form-dialog"
import { Termino } from "@/components/ui/help-tip"
import { useLoadEffect } from "@/hooks/use-load-effect"
import { useResetOnChange } from "@/hooks/use-reset-on-change"
import { KpiCelda } from "@/components/ui/kpi"
import { ValoresLeyNomina } from "@/components/nomina/valores-ley"
import { PrimeraQuincena } from "@/components/nomina/primera-quincena"
import { Segmented } from "@/components/ui/segmented"
import { CampoNomina } from "@/components/nomina/campo"
import { MoneyInput } from "@/components/ui/money-input"

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
  // Vacío no es cero: "días trabajados" en blanco son los 30 del mes, no 0.
  if (v.trim() === "") return d
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

type Tab = "correr" | "novedades" | "prestaciones" | "simulador" | "liquidacion" | "historial" | "parametros"

export default function NominaPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("payroll.manage")

  const [tab, setTab] = React.useState<Tab>("correr")
  const [settings, setSettings] = React.useState<PayrollSettings | null>(null)
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [runs, setRuns] = React.useState<PayrollRun[]>([])
  const [ley, setLey] = React.useState<ValoresLey | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!canManage) return
    setLoading(true)
    setError(null)
    try {
      const [st, emps, sd, rs, vl] = await Promise.all([
        getPayrollSettings(),
        listEmployees(),
        listSedes(),
        listPayrollRuns(),
        getValoresLey().catch(() => null),
      ])
      setLey(vl)
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

  useLoadEffect(load)

  if (!canManage) {
    return (
      <>
        <PageHeader section="Personal" title="Nómina" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="text-[15px] font-semibold text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para gestionar la nómina.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "correr", label: "Pagar nómina", icon: Play },
    { key: "novedades", label: "Vacaciones e incapacidades", icon: CalendarClock },
    { key: "prestaciones", label: "Prima y cesantías", icon: PiggyBank },
    { key: "liquidacion", label: "Liquidación por retiro", icon: LogOut },
    { key: "simulador", label: "Calculadora", icon: Calculator },
    { key: "historial", label: "Nóminas anteriores", icon: History },
    { key: "parametros", label: "Valores de ley", icon: SlidersHorizontal },
  ]

  return (
    <>
      <PageHeader
        section="Personal"
        title="Nómina"
        titleHelp={{ term: "nomina" }}
        description={
          <>
            El pago de tus trabajadores con todo lo que exige la ley colombiana:
            sueldo, horas extra y recargos, lo que se les descuenta de salud y
            pensión, y lo que la empresa aporta a la <Termino>PILA</Termino>.
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1" data-tour="nomina-tabs">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <Button
              key={t.key}
              variant={tab === t.key ? "secondary" : "ghost"}
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
          {!settings.exoneracionConfirmada && (
            <PreguntaExoneracion onRespondida={(s) => setSettings(s)} />
          )}
          {tab === "correr" && (
            <CorrerNomina
              sedes={sedes}
              employees={employees}
              runs={runs}
              frecuencia={settings.frecuenciaPago ?? "mensual"}
              ley={ley}
              onFrecuencia={(s) => setSettings(s)}
              onRan={() => void refreshRuns()}
            />
          )}
          {tab === "novedades" && <Novedades employees={employees} />}
          {tab === "prestaciones" && <PrestacionesPagos employees={employees} />}
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
            <ValoresLeyNomina onSettings={(s) => setSettings(s)} />
          )}
        </>
      ) : null}
    </>
  )
}

// ── Pagar nómina ─────────────────────────────────────────────────────────────
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
function nombreMes(period: string): string {
  return `${MESES[Number(period.slice(5, 7)) - 1] ?? period} de ${period.slice(0, 4)}`
}

/**
 * Pago de la nómina del mes. Con pago quincenal son dos pasos: la primera
 * quincena (el 15) y la segunda con el cierre del mes (el 30), que liquida todo
 * el mes y descuenta lo ya pagado. Con pago mensual es solo el segundo.
 */
function CorrerNomina({
  sedes,
  employees,
  runs,
  frecuencia,
  ley,
  onFrecuencia,
  onRan,
}: {
  sedes: Sede[]
  employees: Employee[]
  runs: PayrollRun[]
  frecuencia: "mensual" | "quincenal"
  /** Valores de ley vigentes, para avisar de sueldos por debajo del mínimo. */
  ley?: ValoresLey | null
  onFrecuencia: (s: PayrollSettings) => void
  onRan: () => void
}) {
  const { user } = useAuth()
  const confirm = useConfirm()
  // Quien no ve todas las sedes solo liquida la nómina de una de las suyas: el
  // backend rechaza la consolidada (ítem 3.9).
  const veTodas = user ? actorSeesAllSedes(user) : false
  const [period, setPeriod] = React.useState(currentMonth())
  const [coverage, setCoverage] = React.useState<"all" | "sede">(
    veTodas ? "all" : "sede",
  )
  const [sedeId, setSedeId] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [run, setRun] = React.useState<PayrollRun | null>(null)
  const [cambiandoFrecuencia, setCambiandoFrecuencia] = React.useState(false)
  // Id de la nómina que ya está mostrada (evita recargarla en bucle).
  const shownIdRef = React.useRef<string | null>(null)
  const quincenal = frecuencia === "quincenal"

  // La nómina más reciente que coincide con lo seleccionado (mes +
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

  // Muestra abajo "cómo va" la nómina del mes: carga su detalle (con los
  // desprendibles) cuando cambia.
  useResetOnChange(() => {
    if (!targetRun) setRun(null)
  }, [targetRun])

  const cargarRun = React.useCallback((id: string) => {
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
  }, [])

  React.useEffect(() => {
    const id = targetRun?._id ?? null
    if (id === shownIdRef.current) return
    if (!id) {
      shownIdRef.current = null
      return
    }
    return cargarRun(id)
  }, [targetRun, cargarRun])

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
  // Sueldos por debajo del mínimo del año: casi siempre es que no se
  // actualizaron en enero. Se avisa antes de pagar, no después.
  const smmlv = ley?.enUso.smmlv ?? 0
  const bajoMinimo = eligible.filter((e) => e.salaryType !== "integral" && (e.salary ?? 0) > 0 && (e.salary ?? 0) < smmlv)

  async function cambiarFrecuencia(v: "mensual" | "quincenal") {
    if (v === frecuencia) return
    const ok = await confirm({
      title: v === "quincenal" ? "¿Pagar por quincenas?" : "¿Pagar una sola vez al mes?",
      description:
        v === "quincenal"
          ? "El 15 pagas la primera quincena: el sueldo de esos días con sus horas extra y recargos, menos salud y pensión. El 30 pagas la segunda, con sus propias horas extra y recargos, la retención y los descuentos del mes. La nómina se sigue liquidando por mes completo, como pide la ley."
          : "Toda la nómina del mes se paga en un solo pago al final del mes.",
      confirmLabel: "Sí, cambiar",
    })
    if (!ok) return
    setCambiandoFrecuencia(true)
    try {
      onFrecuencia(await updatePayrollSettings({ frecuenciaPago: v }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCambiandoFrecuencia(false)
    }
  }

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
    <div className="flex flex-col gap-6">
      {/* Qué mes y a quién */}
      <div className="flex flex-wrap items-end justify-between gap-4" data-tour="nomina-correr">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom-mes" className="text-[13px]">Mes</Label>
            <Input
              id="nom-mes"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom-quien" className="text-[13px]">¿A quién se le paga?</Label>
            <select
              id="nom-quien"
              className={`${inputClass} h-9 w-48`}
              value={coverage}
              onChange={(e) => setCoverage(e.target.value as "all" | "sede")}
            >
              {veTodas && <option value="all">A toda la empresa</option>}
              <option value="sede">A una sede</option>
            </select>
          </div>
          {coverage === "sede" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom-sede" className="text-[13px]">Sede</Label>
              <select
                id="nom-sede"
                className={`${inputClass} h-9 w-48`}
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
              >
                <option value="">Elige la sede</option>
                {sedes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Se paga</span>
          <Segmented
            size="sm"
            ariaLabel="Cada cuánto se paga"
            value={frecuencia}
            onValueChange={(v) => void cambiarFrecuencia(v)}
            options={[
              { value: "quincenal", label: "Por quincenas", disabled: cambiandoFrecuencia },
              { value: "mensual", label: "Una vez al mes", disabled: cambiandoFrecuencia },
            ]}
          />
        </div>
      </div>

      {bajoMinimo.length > 0 && ley && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/[0.07] px-4 py-3 text-sm text-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">
              {bajoMinimo.length === 1 ? "Un trabajador gana" : `${bajoMinimo.length} trabajadores ganan`} menos que el
              salario mínimo de {ley.year} ({money.format(smmlv)}).
            </p>
            <p className="mt-0.5">
              {bajoMinimo.map((e) => `${e.firstName} ${e.lastName} (${money.format(e.salary ?? 0)})`).join(", ")}.
              Si trabajan tiempo completo, súbeles el sueldo en Equipo → Personas antes de pagar: la ley no
              permite pagar menos del mínimo.
            </p>
          </div>
        </div>
      )}

      {quincenal && (
        <Paso
          numero={1}
          titulo="Primera quincena"
          detalle={`Del 1 al 15 de ${nombreMes(period)} · se paga el 15. Sueldo de esos días, su auxilio de transporte y las horas extra y recargos de esos turnos, menos salud y pensión.`}
        >
          <PrimeraQuincena
            period={period}
            coverage={coverage}
            sedeId={coverage === "sede" ? sedeId || undefined : undefined}
            onCambio={() => {
              onRan()
              if (targetRun) cargarRun(targetRun._id)
            }}
          />
        </Paso>
      )}

      <Paso
        numero={quincenal ? 2 : undefined}
        titulo={quincenal ? "Segunda quincena y cierre del mes" : `Nómina de ${nombreMes(period)}`}
        detalle={
          quincenal
            ? "Se calcula el mes completo (las horas extra y recargos del 16 en adelante, vacaciones, incapacidades, retención y descuentos) y se resta lo que ya pagaste en la primera quincena. Lo que queda es lo que pagas el 30."
            : "Se calcula el mes completo: sueldo, horas extra y recargos de los turnos, vacaciones, incapacidades, salud, pensión y retención."
        }
      >
        {!run && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="nom-nombre" className="text-[13px]">Nombre (opcional)</Label>
              <Input
                id="nom-nombre"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={`Ej.: Nómina de ${nombreMes(period)}`}
              />
            </div>
            <Button
              className="gap-2"
              disabled={busy || !sedeChosen || eligible.length === 0}
              onClick={() => void run_()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Calcular la nómina del mes
            </Button>
          </div>
        )}

        {/* Por qué no se puede calcular (evita el "no me la calcula" sin razón). */}
        {!run && sedeChosen && eligible.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-warning-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">No hay trabajadores para pagar aquí.</p>
              <p>
                Solo entran trabajadores <span className="font-medium">activos y
                con sueldo</span> en su ficha
                {coverage === "sede" && " y asignados a esta sede"}. Revísalo en{" "}
                <span className="font-medium">Equipo → Personas</span>.
              </p>
            </div>
          </div>
        ) : (
          !run &&
          sedeChosen && (
            <p className="text-sm text-muted-foreground">
              Entran{" "}
              <span className="font-medium text-foreground">
                {eligible.length} trabajador{eligible.length !== 1 ? "es" : ""}
              </span>{" "}
              activos y con sueldo. Los días se toman de sus turnos.
            </p>
          )
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
      </Paso>
    </div>
  )
}

/** Un paso del pago, con su número y una línea que dice qué se paga en él. */
function Paso({
  numero,
  titulo,
  detalle,
  children,
}: {
  numero?: number
  titulo: string
  detalle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-baseline gap-2 text-base font-semibold">
          {numero !== undefined && <span className="tabular-nums text-muted-foreground">{numero}.</span>}
          {titulo}
        </h2>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{detalle}</p>
      </div>
      {children}
    </section>
  )
}

// ── Detalle de la nómina del mes (totales + tabla + desprendible) ───────────
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
  const [recalcing, setRecalcing] = React.useState(false)
  const [sendMsg, setSendMsg] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const confirm = useConfirm()

  const isClosed = run.status === "cerrada"
  const pagadoQuincena = run.slips.reduce((t, s) => t + (s.pagadoQuincena ?? 0), 0)
  const hayQuincena = pagadoQuincena > 0
  // Medio y fecha real del pago (nómina electrónica): se declaran al cerrar o después.
  const [medioPago, setMedioPago] = React.useState(run.pago?.medio ?? "")
  const [fechaPago, setFechaPago] = React.useState(run.pago?.fecha ?? "")
  const [savingPago, setSavingPago] = React.useState(false)
  const [pagoMsg, setPagoMsg] = React.useState<{ ok: boolean; text: string } | null>(null)
  const pagoCompleto = medioPago !== "" && fechaPago !== ""
  const pagoAMedias = (medioPago !== "") !== (fechaPago !== "")

  async function handleGuardarPago() {
    if (!pagoCompleto) return
    setSavingPago(true)
    setPagoMsg(null)
    try {
      const updated = await declararPagoNomina(run._id, { medioPago, fechaPago })
      onChanged?.(updated)
      setPagoMsg({ ok: true, text: "Pago guardado." })
    } catch (e) {
      setPagoMsg({ ok: false, text: e instanceof ApiError ? e.message : "No se pudo guardar el pago." })
    } finally {
      setSavingPago(false)
    }
  }

  async function handleRecalc() {
    setRecalcing(true)
    try {
      const updated = await recalcPayrollRun(run._id)
      onChanged?.(updated)
    } catch (e) {
      alert(
        e instanceof ApiError ? e.message : "No se pudo recalcular la nómina.",
      )
    } finally {
      setRecalcing(false)
    }
  }

  function openSlip(s: PayrollSlip) {
    setSlip(s)
    setSendMsg(null)
  }

  async function handleClose() {
    if (
      !(await confirm({
        title: `¿Cerrar la nómina de ${nombreMes(run.period)}?`,
        description: pagoCompleto
          ? "Queda fija como comprobante del mes y ya no se puede eliminar ni recalcular. Se registra en la contabilidad y la salida de la plata."
          : "Queda fija como comprobante del mes y ya no se puede eliminar ni recalcular. No dijiste cómo ni qué día pagaste: indícalo después, sin eso no sale la nómina electrónica.",
        confirmLabel: "Sí, cerrar el mes",
        destructive: true,
      }))
    )
      return
    setClosing(true)
    try {
      const updated = await closePayrollRun(
        run._id,
        pagoCompleto ? { medioPago, fechaPago } : undefined,
      )
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
            Nómina de {nombreMes(run.period)}
            {run.label ? ` · ${run.label}` : ""}
          </span>
          <Badge
            className={
              isClosed
                ? "bg-success/10 text-success-ink"
                : "bg-warning/10 text-warning-ink"
            }
          >
            {isClosed ? "Cerrada" : "Borrador: aún se puede recalcular"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {run.slips.length} trabajador{run.slips.length !== 1 ? "es" : ""}
          </span>
        </div>
        {isClosed ? (
          <span className="text-xs text-muted-foreground">
            Cerrada el {run.closedAt ? fmtDate(run.closedAt) : "—"}
          </span>
        ) : (
          onChanged && (
            <div className="flex items-center gap-2">
              {/* Recalcular: vuelve a jalar los consumos aprobados (p. ej. si se
                  aprobó uno después de generar la corrida). */}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={recalcing || closing}
                onClick={() => void handleRecalc()}
                title="Vuelve a calcular con los turnos, consumos y ausencias de hoy"
              >
                {recalcing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Recalcular
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={closing || recalcing || run.slips.length === 0 || pagoAMedias}
                onClick={() => void handleClose()}
              >
                {closing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                Cerrar el mes
              </Button>
            </div>
          )
        )}
      </div>

      {onChanged && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">
                {hayQuincena ? "Pago de la segunda quincena" : "Pago de la nómina"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isClosed && run.pago
                  ? "Registrado. Si ya emitiste la nómina electrónica del mes, al cambiarlo corrígela con una nota de ajuste."
                  : "Cómo y qué día pagaste de verdad. Sin estos datos no sale la nómina electrónica del mes."}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`medio-${run._id}`}>Cómo se pagó</Label>
              <select
                id={`medio-${run._id}`}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-44"
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
              >
                <option value="">Sin indicar</option>
                {MEDIOS_PAGO_NOMINA.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`fecha-${run._id}`}>Día del pago</Label>
              <Input
                id={`fecha-${run._id}`}
                type="date"
                className="sm:w-44"
                value={fechaPago}
                min={`${run.period}-01`}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            {isClosed && (
              <Button
                size="sm"
                variant="outline"
                disabled={!pagoCompleto || savingPago}
                onClick={() => void handleGuardarPago()}
              >
                {savingPago && <Loader2 className="size-4 animate-spin" />}
                Guardar pago
              </Button>
            )}
          </CardContent>
          {(pagoAMedias || pagoMsg) && (
            <p
              className={`px-4 pb-3 text-xs ${pagoMsg?.ok ? "text-success-ink" : "text-destructive"}`}
              role="status"
            >
              {pagoMsg ? pagoMsg.text : "Indica cómo y qué día, o ninguno de los dos."}
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={hayQuincena ? "Por pagar en la segunda quincena" : "Por pagar a los trabajadores"}
          value={money.format(run.totals.neto)}
          accent
        />
        {hayQuincena ? (
          <Kpi label="Ya pagado en la primera quincena" value={money.format(pagadoQuincena)} />
        ) : (
          <Kpi label="Lo que ganaron (devengado)" value={money.format(run.totals.devengado)} />
        )}
        <Kpi label="Aportes de la empresa" value={money.format(run.totals.aportes)} />
        <Kpi label="Costo total para la empresa" value={money.format(run.totals.costo)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {run.slips.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay trabajadores en esta nómina.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Ganó</TableHead>
                  <TableHead className="text-right">Descuentos</TableHead>
                  {hayQuincena && <TableHead className="text-right">1.ª quincena</TableHead>}
                  <TableHead className="text-right">Por pagar</TableHead>
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
                    {hayQuincena && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.pagadoQuincena ? money.format(s.pagadoQuincena) : "—"}
                      </TableCell>
                    )}
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

      <FormDialog
        open={slip !== null}
        onOpenChange={(v) => {
          if (!v) {
            setSlip(null)
            setSendMsg(null)
          }
        }}
        size="2xl"
        icon={Wallet}
        title={slip?.employeeName ?? "Desprendible"}
        description={`Desprendible de pago de ${nombreMes(run.period)}.`}
        footer={
          <>
            <Button
              variant="outline"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer />
              Imprimir / PDF
            </Button>
            <Button
              className="no-print"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? <Loader2 className="animate-spin" /> : <Mail />}
              Enviar al correo
            </Button>
          </>
        }
      >
        {slip && (
          <>
            {sendMsg && (
              <FormAlert tone={sendMsg.ok ? "success" : "error"}>
                {sendMsg.text}
              </FormAlert>
            )}
            <PayrollSlipView
              breakdown={slip.breakdown}
              otrasDetalle={slip.otrasDeduccionesDetalle}
              alertas={slip.alertas}
              pagadoQuincena={slip.pagadoQuincena ?? 0}
              header={
                <div className="invoice-printable mb-2 border-b border-border pb-2 text-sm">
                  <p className="font-semibold">{slip.employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {slip.docNumber ? `Doc. ${slip.docNumber} · ` : ""}
                    {slip.positionName ?? "Sin cargo"} · Sueldo{" "}
                    {money.format(slip.salarioBase)}
                  </p>
                </div>
              }
            />
          </>
        )}
      </FormDialog>
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
              <option value="">Ningún trabajador: escribo el sueldo</option>
              {withSalary.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName} ({money.format(e.salary ?? 0)})
                </option>
              ))}
            </select>
          </div>

          {employeeId && (
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Mes de los turnos</Label>
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
                  Traer las horas de sus turnos
                </Button>
              </div>
              {turnoMsg && (
                <p className="text-xs text-muted-foreground">{turnoMsg}</p>
              )}
            </div>
          )}

          {!employeeId && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="col-span-1 flex flex-col gap-1">
                <Label className="text-xs" htmlFor="sim-salario">Sueldo mensual</Label>
                <MoneyInput
                  id="sim-salario"
                  value={salarioBase.trim() === "" ? null : Number(salarioBase)}
                  onValueChange={(n) => setSalarioBase(n === null ? "" : String(n))}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tipo de salario</Label>
                <select
                  className={inputClass}
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="ordinario">Normal</option>
                  <option value="integral">Integral (13 salarios mínimos o más)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Nivel de riesgo ARL</Label>
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

          <CampoNomina
            id="sim-dias"
            label="Días trabajados en el mes"
            unidad="dias"
            value={dias}
            onChange={setDias}
            ayuda="El mes de nómina siempre cuenta 30 días, aunque tenga 28 o 31."
          />

          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <p className="text-sm font-medium">Horas con recargo en el mes</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoNomina id="sim-recn" label="Horas normales de noche" termino="recargoNocturno" unidad="horas" value={recN} onChange={setRecN} ayuda="Dentro de la jornada, de 7 p. m. a 6 a. m." />
              <CampoNomina id="sim-dom" label="Horas normales en domingo o festivo" termino="dominicales" unidad="horas" value={dom} onChange={setDom} />
              <CampoNomina id="sim-ndom" label="Horas de noche en domingo o festivo" unidad="horas" value={ndom} onChange={setNdom} />
              <CampoNomina id="sim-exd" label="Horas extra de día" termino="horasExtra" unidad="horas" value={exD} onChange={setExD} ayuda="Las que pasan de la jornada, de 6 a. m. a 7 p. m." />
              <CampoNomina id="sim-exn" label="Horas extra de noche" unidad="horas" value={exN} onChange={setExN} />
              <CampoNomina id="sim-exddom" label="Horas extra de día en domingo o festivo" unidad="horas" value={exDdom} onChange={setExDdom} />
              <CampoNomina id="sim-exndom" label="Horas extra de noche en domingo o festivo" unidad="horas" value={exNdom} onChange={setExNdom} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <p className="text-sm font-medium">Otros pagos y descuentos</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoNomina id="sim-bonos" label="Bonificación que cuenta como salario" unidad="pesos" value={bonoSal} onChange={setBonoSal} ayuda="Comisiones o bonos habituales. Suman para salud, pensión, prima y cesantías." />
              <CampoNomina id="sim-bonons" label="Bonificación que no es salario" unidad="pesos" value={bonoNoSal} onChange={setBonoNoSal} ayuda="Un bono ocasional pactado por escrito como no salarial." />
              <CampoNomina id="sim-otras" label="Otros descuentos" unidad="pesos" value={otras} onChange={setOtras} ayuda="Préstamos, libranzas o consumos que el trabajador autorizó descontar." />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dependientes}
              onChange={(e) => setDependientes(e.target.checked)}
            />
            Tiene personas a cargo (hijos, padres): baja la retención en la fuente
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="gap-2" disabled={busy} onClick={() => void calc()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Calcular el pago
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
                  Sueldo {money.format(result.input.salarioBase)} ·{" "}
                  {result.input.salaryType === "integral" ? "salario integral" : "salario normal"}
                </p>
              </div>
            }
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <Calculator className="size-9 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Calcula cuánto le queda a un trabajador en un mes con horas
                extra, recargos o bonos, sin guardar nada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
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
  // Revisión contable: las cesantías de años anteriores ya se consignaron y las
  // vacaciones disfrutadas se descuentan (CST arts. 186 y 189).
  const [inicioCesantias, setInicioCesantias] = React.useState("")
  const [vacDisfrutadas, setVacDisfrutadas] = React.useState("")
  const [result, setResult] = React.useState<LiquidacionResult | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [guardando, setGuardando] = React.useState(false)
  const [guardadas, setGuardadas] = React.useState(0)

  function payload() {
    return {
      employeeId: employeeId || undefined,
      salarioBase: employeeId ? undefined : numOr(salarioBase),
      salaryType: employeeId ? undefined : salaryType,
      contractType: employeeId ? undefined : contractType,
      fechaInicio: fechaInicio || undefined,
      fechaFin,
      motivo,
      salariosPendientes: numOr(salariosPend),
      diasFaltantesContrato: numOr(diasFaltantes),
      inicioCesantias: inicioCesantias || undefined,
      vacacionesDisfrutadasDias: vacDisfrutadas === "" ? undefined : numOr(vacDisfrutadas),
    }
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await guardarLiquidacion(payload())
      setGuardadas((n) => n + 1)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  async function calc() {
    setBusy(true)
    setError(null)
    try {
      const r = await computeLiquidacion(payload())
      setResult(r)
      // Precarga los días disfrutados con las vacaciones registradas como novedad (se puede corregir).
      if (vacDisfrutadas === "" && r.sugerencias) setVacDisfrutadas(String(r.sugerencias.vacacionesDisfrutadasDias))
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
              <option value="">Ningún trabajador: escribo los datos</option>
              {withSalary.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>

          {!employeeId && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <CampoNomina id="liq-salario" label="Sueldo mensual" unidad="pesos" value={salarioBase} onChange={setSalarioBase} />
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tipo de salario</Label>
                <select
                  className={inputClass}
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value)}
                >
                  <option value="ordinario">Normal</option>
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">
                Fecha de ingreso {employeeId ? "(vacía = la del expediente)" : ""}
              </Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Último día de trabajo</Label>
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CampoNomina
              id="liq-pend"
              label="Sueldo que se le debe"
              unidad="pesos"
              value={salariosPend}
              onChange={setSalariosPend}
              ayuda="Lo trabajado y aún no pagado. Para guardar la liquidación déjalo en 0: el último sueldo va en la nómina del mes."
            />
            {motivo === "sin_justa_causa" && (
              <CampoNomina
                id="liq-faltantes"
                label="Días que le faltaban al contrato"
                unidad="dias"
                value={diasFaltantes}
                onChange={setDiasFaltantes}
                ayuda="Solo para contrato a término fijo u obra: los días entre el despido y la fecha en que terminaba."
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CampoNomina
              id="liq-vac"
              label="Días de vacaciones que ya tomó"
              unidad="dias"
              value={vacDisfrutadas}
              onChange={setVacDisfrutadas}
              ayuda="Días hábiles ya disfrutados en todo el contrato. Escribe 0 si nunca tomó. Se necesita para aprobar."
            />
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Cesantías pendientes desde (vacía = 1 de enero de este año)</Label>
              <Input
                type="date"
                value={inicioCesantias}
                onChange={(e) => setInicioCesantias(e.target.value)}
              />
            </div>
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
                {b.diasCesantias !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Cesantías desde {b.inicioCesantias} ({b.diasCesantias} días) · vacaciones
                    pendientes {b.diasVacacionesPendientes} de {b.diasVacacionesCausados} días
                  </p>
                )}
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
                <span className="text-[15px] font-semibold tabular-nums text-foreground">
                  {money.format(b.total)}
                </span>
              </div>
              {tieneRetencion(b) && (
                <>
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                    <span>Retención en la fuente</span>
                    <span className="tabular-nums text-destructive">
                      − {money.format(b.retencionFuente ?? 0)}
                    </span>
                  </div>
                  {b.detalleRetencion && (
                    <p className="text-[11px] text-muted-foreground">{b.detalleRetencion}</p>
                  )}
                  {b.porcentajeExentoCesantias !== undefined && b.porcentajeExentoCesantias > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Cesantías e intereses exentos: {Math.round(b.porcentajeExentoCesantias * 100)} % (art. 206-4 ET), sin retención.
                    </p>
                  )}
                  <div className="mt-2 flex items-baseline justify-between rounded-md bg-primary/10 px-3 py-2">
                    <span className="font-semibold">Neto a pagar</span>
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {money.format(netoLiquidacion(b))}
                    </span>
                  </div>
                </>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimación. La indemnización y casos especiales pueden requerir
                revisión del contador o abogado.
              </p>
              {(result?.advertencias ?? []).map((a) => (
                <p key={a} className="mt-2 text-[11px] text-warning-ink" role="status">
                  {a}
                </p>
              ))}
              {employeeId && (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={guardando || numOr(salariosPend) > 0 || vacDisfrutadas === ""}
                    onClick={() => void guardar()}
                  >
                    {guardando && <Loader2 className="size-4 animate-spin" />}
                    Guardar como borrador
                  </Button>
                  {vacDisfrutadas === "" && (
                    <p className="text-[11px] text-muted-foreground">
                      Indica cuántos días de vacaciones ya disfrutó (0 si ninguno): se descuentan de las pendientes.
                    </p>
                  )}
                  {numOr(salariosPend) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Para guardarla deja «salarios pendientes» en 0: el último sueldo
                      se paga en la nómina del mes del retiro, con salud y pensión.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <LogOut className="size-9 text-muted-foreground" aria-hidden />
              <p className="max-w-xs text-sm text-muted-foreground">
                Calcula cesantías, intereses, prima y vacaciones proporcionales
                más la indemnización al terminar el contrato.
              </p>
            </CardContent>
          </Card>
        )}
        {employeeId && <LiquidacionesGuardadas employeeId={employeeId} recargar={guardadas} />}
      </div>
    </div>
  )
}

/**
 * Liquidaciones guardadas del empleado. La aprobada (con el medio y la fecha
 * real del pago) es la que la nómina electrónica del mes del retiro reporta.
 */
function LiquidacionesGuardadas({ employeeId, recargar }: { employeeId: string; recargar: number }) {
  const [filas, setFilas] = React.useState<PayrollLiquidacion[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [ocupada, setOcupada] = React.useState<string | null>(null)
  const [avisos, setAvisos] = React.useState<string[]>([])
  const [medio, setMedio] = React.useState("")
  const [fecha, setFecha] = React.useState("")
  const confirm = useConfirm()

  const cargar = React.useCallback(async () => {
    try {
      setFilas(await listarLiquidaciones(employeeId))
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
    // `recargar` sube cuando se guarda una liquidación nueva: vuelve a pedir la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, recargar])

  useLoadEffect(cargar)

  async function aprobar(l: PayrollLiquidacion) {
    setOcupada(l._id)
    setError(null)
    try {
      const r = await aprobarLiquidacion(l._id, { medioPago: medio, fechaPago: fecha })
      setAvisos(r.advertencias ?? [])
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setOcupada(null)
    }
  }

  async function anular(l: PayrollLiquidacion) {
    if (
      !(await confirm({
        title: "¿Anular esta liquidación?",
        description:
          l.estado === "aprobada"
            ? "Si ya salió en la nómina electrónica, corrige ese documento con una nota de ajuste."
            : "El borrador queda anulado.",
        destructive: true,
      }))
    )
      return
    setOcupada(l._id)
    try {
      const r = await anularLiquidacion(l._id)
      setAvisos(r.advertencias ?? [])
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setOcupada(null)
    }
  }

  if (filas.length === 0 && !error) return null
  return (
    <Card className="mt-4">
      <CardContent className="space-y-3 py-4">
        <p className="text-sm font-semibold">Liquidaciones guardadas</p>
        <p className="text-xs text-muted-foreground">
          Conviene aprobar la liquidación ANTES de cerrar la nómina del mes del retiro: así la nómina le paga solo
          los días hasta el retiro, con salud y pensión.
        </p>
        {avisos.map((a) => (
          <p key={a} className="text-sm text-warning-ink" role="status">
            {a}
          </p>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {filas.map((l) => (
          <div key={l._id} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                Retiro {l.fechaRetiro} · {money.format(l.breakdown.total)}
                {tieneRetencion(l.breakdown) && (
                  <>
                    {" "}
                    · retención − {money.format(l.breakdown.retencionFuente ?? 0)} ·{" "}
                    <strong>neto {money.format(netoLiquidacion(l.breakdown))}</strong>
                  </>
                )}
              </span>
              <Badge
                className={
                  l.estado === "aprobada"
                    ? "bg-success/10 text-success-ink"
                    : l.estado === "borrador"
                      ? "bg-warning/10 text-warning-ink"
                      : "bg-muted text-muted-foreground"
                }
              >
                {l.estado === "aprobada" ? "Aprobada" : l.estado === "borrador" ? "Borrador" : "Anulada"}
              </Badge>
            </div>
            {l.estado === "aprobada" && l.pago && (
              <p className="text-xs text-muted-foreground">
                Pagada el {l.pago.fecha} ·{" "}
                {MEDIOS_PAGO_NOMINA.find((m) => m.value === l.pago!.medio)?.label ?? l.pago.medio}
              </p>
            )}
            {l.estado === "borrador" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor={`liq-medio-${l._id}`}>Medio de pago</Label>
                  <select
                    id={`liq-medio-${l._id}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-40"
                    value={medio}
                    onChange={(e) => setMedio(e.target.value)}
                  >
                    <option value="">Elige</option>
                    {MEDIOS_PAGO_NOMINA.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`liq-fecha-${l._id}`}>Fecha real de pago</Label>
                  <Input
                    id={`liq-fecha-${l._id}`}
                    type="date"
                    className="sm:w-40"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!medio || !fecha || ocupada === l._id || l.breakdown.vacacionesDisfrutadasDias === undefined}
                  title={l.breakdown.vacacionesDisfrutadasDias === undefined ? "Guárdala de nuevo con los días de vacaciones disfrutados" : undefined}
                  onClick={() => void aprobar(l)}
                >
                  {ocupada === l._id && <Loader2 className="size-4 animate-spin" />}
                  Aprobar
                </Button>
              </div>
            )}
            {l.estado !== "anulada" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={ocupada === l._id}
                onClick={() => void anular(l)}
              >
                Anular
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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
/**
 * Novedades del mes (decisión 3 del dueño): vacaciones disfrutadas,
 * incapacidades y licencias. La corrida del mes las liquida; si ya está en
 * borrador, recalcúlala para tomarlas. Con la nómina cerrada no se tocan.
 */
function Novedades({ employees }: { employees: Employee[] }) {
  const [periodo, setPeriodo] = React.useState(currentMonth())
  const [filas, setFilas] = React.useState<PayrollNovedad[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [employeeId, setEmployeeId] = React.useState("")
  const [tipo, setTipo] = React.useState<string>("vacaciones")
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [diasHabiles, setDiasHabiles] = React.useState("")
  const [previos, setPrevios] = React.useState("")
  const [promedio, setPromedio] = React.useState("")
  const [observacion, setObservacion] = React.useState("")
  const [avisos, setAvisos] = React.useState<string[]>([])
  const confirm = useConfirm()

  const cargar = React.useCallback(async () => {
    try {
      setFilas(await listarNovedades(periodo))
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [periodo])
  useLoadEffect(cargar)

  async function guardar() {
    setBusy(true)
    setError(null)
    try {
      const r = await crearNovedad({
        employeeId,
        tipo,
        fechaInicio: desde,
        fechaFin: hasta,
        ...(tipo === "vacaciones" ? { diasHabiles: numOr(diasHabiles) } : {}),
        ...(tipo === "incapacidad_comun" && previos !== "" ? { diasPreviosProrroga: numOr(previos) } : {}),
        ...(tipo === "vacaciones" && numOr(promedio) > 0 ? { salarioPromedio: numOr(promedio) } : {}),
        ...(observacion ? { observacion } : {}),
      })
      setDesde("")
      setHasta("")
      setDiasHabiles("")
      setPrevios("")
      setPromedio("")
      setObservacion("")
      setAvisos([
        ...r.advertencias,
        ...(r.corridasRecalculadas.length > 0 ? [`Se recalculó la nómina en borrador (${r.corridasRecalculadas.length}).`] : []),
      ])
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function anular(n: PayrollNovedad) {
    if (!(await confirm({ title: "¿Anular este registro?", description: "Si la nómina del mes está en borrador, recalcúlala después.", destructive: true })))
      return
    try {
      const r = await anularNovedad(n._id)
      setAvisos([
        ...r.advertencias,
        ...(r.corridasRecalculadas.length > 0 ? [`Se recalculó la nómina en borrador (${r.corridasRecalculadas.length}).`] : []),
      ])
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const listo = employeeId && desde && hasta && (tipo !== "vacaciones" || numOr(diasHabiles) > 0)
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm font-semibold">Registrar vacaciones, incapacidad o licencia</p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="nov-emp">Trabajador</Label>
            <select id="nov-emp" className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Elige</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {`${e.firstName} ${e.lastName}`.trim()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="nov-tipo">Qué pasó</Label>
            <select id="nov-tipo" className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_NOVEDAD.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="nov-desde">Desde</Label>
              <Input id="nov-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="nov-hasta">Hasta (ese día incluido)</Label>
              <Input id="nov-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          {tipo === "vacaciones" && (
            <>
              <CampoNomina
                id="nov-habiles"
                label="Días hábiles de vacaciones"
                unidad="dias"
                value={diasHabiles}
                onChange={setDiasHabiles}
                ayuda="Sin contar domingos ni festivos. Por cada año trabajado le tocan 15."
              />
              <CampoNomina
                id="nov-promedio"
                label="Sueldo promedio del último año"
                termino="salarioPromedio"
                unidad="pesos"
                value={promedio}
                onChange={setPromedio}
                placeholder="Vacío si gana un sueldo fijo"
                ayuda="Solo si su pago cambia mes a mes (comisiones, extras frecuentes): cuánto ganó en promedio cada mes, en pesos. Si gana un sueldo fijo, déjalo vacío y se usa su sueldo actual."
              />
            </>
          )}
          {tipo === "incapacidad_comun" && (
            <CampoNomina
              id="nov-previos"
              label="Días de la incapacidad anterior"
              unidad="dias"
              value={previos}
              onChange={setPrevios}
              ayuda="Solo si esta incapacidad es prórroga de otra por la misma causa. Si no, déjalo vacío."
            />
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="nov-obs">Nota (opcional)</Label>
            <Input id="nov-obs" value={observacion} maxLength={300} onChange={(e) => setObservacion(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Incapacidad por enfermedad: se paga 2/3 del sueldo (nunca menos del mínimo). Los 2 primeros días los
            pagas tú; desde el tercero, la EPS. Accidente de trabajo: el 100 %, lo paga la ARL. Licencia no
            remunerada: esos días no se pagan, pero el trabajador sigue aportando su 4 % de pensión. Si la nómina
            del mes ya está calculada, se recalcula sola.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {avisos.map((a) => (
            <p key={a} className="text-sm text-warning-ink" role="status">
              {a}
            </p>
          ))}
          <Button disabled={!listo || busy} onClick={() => void guardar()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Registrar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-semibold">Registradas en el mes</p>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="nov-periodo">Mes</Label>
              <Input id="nov-periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
          </div>
          {filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay vacaciones, incapacidades ni licencias en este mes.</p>
          ) : (
            filas.map((n) => (
              <div key={n._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {n.employeeName ?? n.employeeId} · {TIPOS_NOVEDAD.find((t) => t.value === n.tipo)?.label ?? n.tipo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Del {n.fechaInicio} al {n.fechaFin}
                    {n.diasHabiles ? ` · ${n.diasHabiles} días hábiles` : ""}
                    {n.observacion ? ` · ${n.observacion}` : ""}
                  </p>
                </div>
                {n.estado === "activa" ? (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void anular(n)}>
                    Anular
                  </Button>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Anulada</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Historial({
  runs,
  onChanged,
}: {
  runs: PayrollRun[]
  onChanged: () => void
}) {
  const [open, setOpen] = React.useState<PayrollRun | null>(null)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const confirm = useConfirm()

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
    if (!(await confirm({ title: "¿Eliminar esta nómina?", description: "Se puede porque sigue en borrador: aún no se ha cerrado.", destructive: true }))) return
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
            Aún no has calculado ninguna nómina.
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
                <TableHead>Mes</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Pagado a trabajadores</TableHead>
                <TableHead className="text-right">Costo para la empresa</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">{nombreMes(r.period)}</TableCell>
                  <TableCell>{r.label ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.status === "cerrada"
                          ? "bg-success/10 text-success-ink"
                          : "bg-warning/10 text-warning-ink"
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

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  void accent
  return <KpiCelda label={label} value={value} />
}

/**
 * Pregunta de la exoneración de aportes (ítem 1.15). No se presume: solo la
 * tienen las sociedades declarantes de renta y las personas naturales con dos
 * o más trabajadores (art. 114-1 ET), y de ella depende si el empleador paga
 * salud, SENA e ICBF. Mientras no se responda, el backend no liquida nóminas.
 */
function PreguntaExoneracion({
  onRespondida,
}: {
  onRespondida: (s: PayrollSettings) => void
}) {
  const [guardando, setGuardando] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function responder(exonerada: boolean) {
    setGuardando(exonerada)
    setError(null)
    try {
      onRespondida(
        await updatePayrollSettings(respuestaExoneracion(exonerada)),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(null)
    }
  }

  return (
    <Card className="mb-4 border-warning/40 bg-warning/5">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              ¿La empresa está exonerada de aportes?
            </p>
            <p className="mt-1 text-muted-foreground">
              Aplica a sociedades que declaran renta y a personas naturales con
              dos o más trabajadores (art. 114-1 del Estatuto Tributario): no
              pagan salud, SENA ni ICBF por quienes ganan menos de 10 salarios
              mínimos. Si no estás seguro, pregúntale a tu contador. Hasta que
              respondas no se puede liquidar la nómina.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={guardando !== null}
            onClick={() => void responder(true)}
          >
            {guardando === true && <Loader2 className="size-4 animate-spin" />}
            Sí, está exonerada
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={guardando !== null}
            onClick={() => void responder(false)}
          >
            {guardando === false && <Loader2 className="size-4 animate-spin" />}
            No, paga todos los aportes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
