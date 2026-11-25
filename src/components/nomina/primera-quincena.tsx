"use client"

import * as React from "react"
import { Loader2, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  anularQuincena,
  listarQuincenas,
  MEDIOS_PAGO_NOMINA,
  propuestaQuincena,
  registrarQuincena,
  type PagoQuincena,
  type PropuestaQuincena,
  type PropuestaQuincenaRespuesta,
} from "@/lib/erp/api-payroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Termino } from "@/components/ui/help-tip"
import { useLoadEffect } from "@/hooks/use-load-effect"

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})
const fechaCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" })
const fecha = (iso: string) => fechaCorta.format(new Date(`${iso}T00:00:00Z`))

function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}
/** El día 15 del mes, o hoy si todavía no ha llegado (la fecha es la del pago real). */
function fechaSugerida(period: string): string {
  const hoy = hoyColombia()
  const quince = `${period}-15`
  if (hoy.slice(0, 7) === period) return hoy < quince ? hoy : quince
  return quince < hoy ? quince : hoy
}
function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message
  return "No se pudo completar la acción."
}
/** "4 h nocturnas · 2 h extra", en palabras de todos los días. */
const NOMBRE_HORA: Record<string, string> = {
  recargoNocturno: "nocturnas",
  dominical: "de domingo o festivo",
  nocturnoDominical: "nocturnas de domingo",
  extraDiurna: "extra de día",
  extraNocturna: "extra de noche",
  extraDiurnaDominical: "extra de día en domingo",
  extraNocturnaDominical: "extra de noche en domingo",
}
function resumenHoras(h: PropuestaQuincena["horas"]): string {
  return Object.entries(h ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${horasCortas.format(v ?? 0)} h ${NOMBRE_HORA[k] ?? k}`)
    .join(" · ")
}
const horasCortas = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 })
const nombreMedio = (m: string) => MEDIOS_PAGO_NOMINA.find((x) => x.value === m)?.label.toLowerCase() ?? m

/**
 * Paso 1 del pago quincenal: la primera quincena (días 1 a 15).
 *
 * Se paga el sueldo de esos días, su auxilio y las horas extra y recargos de
 * los turnos del 1 al 15, menos salud y pensión. La retención se liquida con el
 * mes completo en la segunda quincena, que descuenta lo que aquí se pagó. Se puede pagar
 * menos de lo calculado a un trabajador, nunca más.
 */
export function PrimeraQuincena({
  period,
  coverage,
  sedeId,
  onCambio,
}: {
  period: string
  coverage: "all" | "sede"
  sedeId?: string
  /** Se pagó o se anuló: la nómina del mes en borrador se recalculó. */
  onCambio: () => void
}) {
  const [prop, setProp] = React.useState<PropuestaQuincenaRespuesta | null>(null)
  const [pagos, setPagos] = React.useState<PagoQuincena[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const listoParaCargar = coverage === "all" || !!sedeId

  const cargar = React.useCallback(async () => {
    if (!listoParaCargar) return
    setCargando(true)
    try {
      const [p, l] = await Promise.all([
        propuestaQuincena(period, coverage, sedeId),
        listarQuincenas(period),
      ])
      setProp(p)
      setPagos(
        l.filter(
          (q) =>
            q.estado === "pagada" &&
            q.coverage === coverage &&
            (coverage === "all" || String(q.sedeId) === sedeId),
        ),
      )
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCargando(false)
    }
  }, [period, coverage, sedeId, listoParaCargar])

  useLoadEffect(cargar)

  if (!listoParaCargar) {
    return <p className="text-sm text-muted-foreground">Elige la sede para ver la quincena.</p>
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (cargando && !prop) return <Skeleton className="h-40 rounded-lg" />
  if (!prop) return null

  return (
    <div className="flex flex-col gap-4">
      {pagos.map((q) => (
        <QuincenaPagada key={q._id} q={q} onAnulada={() => {
          void cargar()
          onCambio()
        }} />
      ))}
      {prop.cerrada ? (
        <p className="text-sm text-muted-foreground">
          La nómina de este mes ya está cerrada: no se puede registrar la primera quincena.
        </p>
      ) : (
        <PorPagar
          key={`${period}-${coverage}-${sedeId ?? ""}-${pagos.length}`}
          prop={prop}
          coverage={coverage}
          sedeId={sedeId}
          hayPagos={pagos.length > 0}
          onPagada={() => {
            void cargar()
            onCambio()
          }}
        />
      )}
    </div>
  )
}

function QuincenaPagada({ q, onAnulada }: { q: PagoQuincena; onAnulada: () => void }) {
  const confirm = useConfirm()
  const [anulando, setAnulando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function anular() {
    const ok = await confirm({
      title: "¿Anular este pago de la primera quincena?",
      description:
        "Úsalo solo si lo registraste por error. Se reversa la salida de plata en la contabilidad y la nómina del mes deja de descontarlo. Si de verdad le pagaste, no lo anules.",
      confirmLabel: "Sí, anular",
      destructive: true,
    })
    if (!ok) return
    setAnulando(true)
    setError(null)
    try {
      await anularQuincena(q._id)
      onAnulada()
    } catch (err) {
      setError(errorMessage(err))
      setAnulando(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-success" />
          <span className="font-medium">Pagada el {fecha(q.pago.fecha)}</span>
          <span className="text-muted-foreground">
            por {nombreMedio(q.pago.medio)} · {q.lineas.length} trabajador{q.lineas.length !== 1 ? "es" : ""}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums">{pesos.format(q.total)}</span>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={anulando} onClick={() => void anular()}>
            {anulando && <Loader2 className="animate-spin" />}
            Anular
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border text-[13px]">
        {q.lineas.map((l) => (
          <li key={l.employeeId} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="min-w-0 truncate">{l.employeeName}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {l.dias} días · <span className="text-foreground">{pesos.format(l.neto)}</span>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="px-4 pb-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}

function PorPagar({
  prop,
  coverage,
  sedeId,
  hayPagos,
  onPagada,
}: {
  prop: PropuestaQuincenaRespuesta
  coverage: "all" | "sede"
  sedeId?: string
  hayPagos: boolean
  onPagada: () => void
}) {
  const confirm = useConfirm()
  const pagables = prop.lineas.filter((l) => l.dias > 0 && l.neto > 0)
  const sinDias = prop.lineas.filter((l) => l.dias === 0 || l.neto <= 0)
  const [incluidos, setIncluidos] = React.useState<Set<string>>(() => new Set(pagables.map((l) => l.employeeId)))
  const [montos, setMontos] = React.useState<Record<string, number | null>>(() =>
    Object.fromEntries(pagables.map((l) => [l.employeeId, l.neto])),
  )
  const [medio, setMedio] = React.useState("47")
  const [fechaPago, setFechaPago] = React.useState(() => fechaSugerida(prop.period))
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (pagables.length === 0 && sinDias.length === 0) {
    return hayPagos ? null : (
      <p className="text-sm text-muted-foreground">No hay trabajadores activos con sueldo en esta cobertura.</p>
    )
  }
  if (pagables.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        {hayPagos ? "No queda nadie por pagar en la primera quincena." : "Nadie tiene días para pagar en la primera quincena."}
        <SinDias lineas={sinDias} />
      </div>
    )
  }

  const elegidos = pagables.filter((l) => incluidos.has(l.employeeId))
  const excedidos = elegidos.filter((l) => (montos[l.employeeId] ?? 0) > l.neto)
  const vacios = elegidos.filter((l) => !montos[l.employeeId])
  const total = elegidos.reduce((s, l) => s + (montos[l.employeeId] ?? 0), 0)
  const valido = elegidos.length > 0 && excedidos.length === 0 && vacios.length === 0 && fechaPago !== ""

  async function registrar() {
    const ok = await confirm({
      title: `¿Registrar el pago de ${pesos.format(total)}?`,
      description: `Queda registrado que el ${fecha(fechaPago)} pagaste la primera quincena a ${elegidos.length} trabajador${
        elegidos.length !== 1 ? "es" : ""
      } por ${nombreMedio(medio)}. La plata sale de ${
        medio === "10" ? "la caja" : "bancos"
      } en la contabilidad y la nómina del mes la descontará. Si te equivocas, puedes anularlo mientras el mes no esté cerrado.`,
      confirmLabel: "Sí, registrar pago",
    })
    if (!ok) return
    setGuardando(true)
    setError(null)
    try {
      await registrarQuincena({
        period: prop.period,
        coverage,
        sedeId: coverage === "sede" ? sedeId : undefined,
        medioPago: medio,
        fechaPago,
        lineas: elegidos.map((l) => ({
          employeeId: l.employeeId,
          ...(montos[l.employeeId] !== l.neto ? { neto: montos[l.employeeId] ?? undefined } : {}),
        })),
      })
      onPagada()
    } catch (err) {
      setError(errorMessage(err))
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[720px] text-[13px] tabular-nums">
          <thead>
            <tr className="h-9 border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-10 px-4">
                <input
                  type="checkbox"
                  aria-label="Pagar a todos"
                  checked={incluidos.size === pagables.length}
                  onChange={(e) =>
                    setIncluidos(e.target.checked ? new Set(pagables.map((l) => l.employeeId)) : new Set())
                  }
                />
              </th>
              <th className="px-2 font-medium">Trabajador</th>
              <th className="px-2 text-right font-medium">Días</th>
              <th className="px-2 text-right font-medium">Sueldo</th>
              <th className="px-2 text-right font-medium">
                <Termino term="auxilioTransporte">Auxilio</Termino>
              </th>
              <th className="px-2 text-right font-medium">
                <Termino term="horasExtra">Extras y recargos</Termino>
              </th>
              <th className="px-2 text-right font-medium">Salud y pensión</th>
              <th className="w-40 px-4 text-right font-medium">A pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagables.map((l) => {
              const on = incluidos.has(l.employeeId)
              const monto = montos[l.employeeId] ?? null
              const pasado = monto !== null && monto > l.neto
              return (
                <tr key={l.employeeId} className={cn("align-top", !on && "text-muted-foreground")}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Pagar a ${l.employeeName}`}
                      checked={on}
                      onChange={(e) =>
                        setIncluidos((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(l.employeeId)
                          else n.delete(l.employeeId)
                          return n
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="font-medium text-foreground">{l.employeeName}</p>
                    {l.avisos.map((a) => (
                      <p key={a} className="mt-0.5 text-xs text-muted-foreground">
                        {a}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-2.5 text-right">{l.dias}</td>
                  <td className="px-2 py-2.5 text-right">{pesos.format(l.sueldo)}</td>
                  <td className="px-2 py-2.5 text-right">{l.auxilioTransporte ? pesos.format(l.auxilioTransporte) : "—"}</td>
                  <td className="px-2 py-2.5 text-right">
                    {l.recargos + l.horasExtra > 0 ? (
                      <>
                        {pesos.format(l.recargos + l.horasExtra)}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{resumenHoras(l.horas)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">− {pesos.format(l.salud + l.pension + l.fsp)}</td>
                  <td className="px-4 py-1.5">
                    <MoneyInput
                      aria-label={`A pagar a ${l.employeeName}`}
                      value={monto}
                      disabled={!on}
                      onValueChange={(v) => setMontos((m) => ({ ...m, [l.employeeId]: v }))}
                      className={cn("h-8 text-right", pasado && "border-destructive")}
                    />
                    {pasado && (
                      <p className="mt-1 text-right text-[11px] text-destructive">Máximo {pesos.format(l.neto)}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <SinDias lineas={sinDias} />

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-medio" className="text-[13px]">
              Cómo se pagó
            </Label>
            <select
              id="q-medio"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
            >
              {MEDIOS_PAGO_NOMINA.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-fecha" className="text-[13px]">
              Día del pago
            </Label>
            <Input
              id="q-fecha"
              type="date"
              className="w-44"
              value={fechaPago}
              min={`${prop.period}-01`}
              max={hoyColombia()}
              onChange={(e) => setFechaPago(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {elegidos.length} trabajador{elegidos.length !== 1 ? "es" : ""}
            </p>
            <p className="text-lg font-semibold tabular-nums">{pesos.format(total)}</p>
          </div>
          <Button disabled={!valido || guardando} onClick={() => void registrar()}>
            {guardando && <Loader2 className="animate-spin" />}
            Registrar pago de la primera quincena
          </Button>
        </div>
      </div>
      {error && (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

function SinDias({ lineas }: { lineas: PropuestaQuincenaRespuesta["lineas"] }) {
  if (lineas.length === 0) return null
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {lineas.map((l) => (
        <li key={l.employeeId}>
          <span className="text-foreground">{l.employeeName}</span>: {l.avisos[0] ?? "sin días en la quincena."}
        </li>
      ))}
    </ul>
  )
}
