"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import type { Employee } from "@/lib/erp/api-employees"
import { MEDIOS_PAGO_NOMINA } from "@/lib/erp/api-payroll"
import {
  DESTINOS_CESANTIAS,
  TIPOS_PRESTACION,
  anularPagoPrestacion,
  faltaEnFormulario,
  listarPagosPrestaciones,
  payloadDeFormulario,
  periodoSugerido,
  registrarPagoPrestacion,
  type FormularioPrestacion,
  type PagoPrestacion,
  type TipoPrestacion,
} from "@/lib/erp/pago-prestaciones"
import { ApiError } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useLoadEffect } from "@/hooks/use-load-effect"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function mensaje(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/** Fecha de hoy en Colombia (YYYY-MM-DD): la fecha de pago no puede ser futura allá. */
function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date())
}

function formularioInicial(hoy: string): FormularioPrestacion {
  const p = periodoSugerido("prima", hoy)
  return {
    employeeId: "",
    tipo: "prima",
    desde: p.desde,
    hasta: p.hasta,
    monto: "",
    retencion: "",
    medioPago: "47",
    fechaPago: hoy,
    destino: "fondo",
    fondo: "",
    observacion: "",
  }
}

const etiquetaTipo = (t: string) => TIPOS_PRESTACION.find((x) => x.value === t)?.label ?? t
const etiquetaMedio = (m: string) => MEDIOS_PAGO_NOMINA.find((x) => x.value === m)?.label ?? m

/**
 * Pestaña «Prestaciones» de Nómina: registrar y ver los pagos de prima,
 * cesantías e intereses (decisión 2, Fase 8). Vive detrás de `payroll.manage`,
 * como el resto de la página que la monta.
 *
 * El pago no se edita: se anula (queda el contra-asiento) y se registra otro.
 */
export function PrestacionesPagos({ employees }: { employees: Employee[] }) {
  const [hoy] = React.useState(hoyColombia)
  const [form, setForm] = React.useState<FormularioPrestacion>(() => formularioInicial(hoy))
  const [anio, setAnio] = React.useState(hoy.slice(0, 4))
  const [filas, setFilas] = React.useState<PagoPrestacion[]>([])
  const [cargando, setCargando] = React.useState(true)
  const [errorLista, setErrorLista] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [avisos, setAvisos] = React.useState<string[]>([])
  const [ocupado, setOcupado] = React.useState(false)
  const confirm = useConfirm()

  const cargar = React.useCallback(async () => {
    if (!/^\d{4}$/.test(anio)) return
    try {
      setFilas(await listarPagosPrestaciones(anio))
      setErrorLista(null)
    } catch (err) {
      setErrorLista(mensaje(err))
    } finally {
      setCargando(false)
    }
  }, [anio])
  useLoadEffect(cargar)

  const set = <K extends keyof FormularioPrestacion>(k: K, v: FormularioPrestacion[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  function cambiarTipo(tipo: TipoPrestacion) {
    const p = periodoSugerido(tipo, hoy)
    setForm((f) => ({ ...f, tipo, desde: p.desde, hasta: p.hasta, retencion: "" }))
  }

  const falta = faltaEnFormulario(form)
  // Solo quienes causan prestaciones: ni contratistas ni salario integral (el backend lo valida igual).
  const elegibles = employees.filter((e) => e.contractType !== "prestacion_servicios" && e.salaryType !== "integral")

  async function guardar() {
    if (falta) return
    setOcupado(true)
    setError(null)
    setAvisos([])
    try {
      const r = await registrarPagoPrestacion(payloadDeFormulario(form))
      setAvisos(["Pago registrado.", ...r.advertencias])
      setForm((f) => ({ ...f, employeeId: "", monto: "", retencion: "", observacion: "" }))
      // El pago puede caer en otro año que el de la lista: se muestra el suyo.
      const suAnio = r.pago.fecha.slice(0, 4)
      if (suAnio !== anio) setAnio(suAnio)
      else await cargar()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(false)
    }
  }

  async function anular(p: PagoPrestacion) {
    const ok = await confirm({
      title: "¿Anular este pago?",
      description: `${etiquetaTipo(p.tipo)} de ${p.employeeName ?? "el empleado"} por ${money.format(p.monto)}. La contabilidad lo devuelve con un contra-asiento; si la nómina electrónica de ese mes ya fue aceptada, hay que corregirla.`,
      destructive: true,
    })
    if (!ok) return
    setError(null)
    try {
      const r = await anularPagoPrestacion(p._id)
      setAvisos(["Pago anulado.", ...r.advertencias])
      await cargar()
    } catch (err) {
      setError(mensaje(err))
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <p className="text-sm font-semibold">Registrar pago de prestaciones</p>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="pre-emp">Empleado</Label>
            <select id="pre-emp" className={inputClass} value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
              <option value="">Elige</option>
              {elegibles.map((e) => (
                <option key={e._id} value={e._id}>
                  {`${e.firstName} ${e.lastName}`.trim()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="pre-tipo">Qué se pagó</Label>
            <select id="pre-tipo" className={inputClass} value={form.tipo} onChange={(e) => cambiarTipo(e.target.value as TipoPrestacion)}>
              {TIPOS_PRESTACION.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-desde">Cubre desde</Label>
              <Input id="pre-desde" type="date" value={form.desde} onChange={(e) => set("desde", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-hasta">Hasta (incluido)</Label>
              <Input id="pre-hasta" type="date" value={form.hasta} onChange={(e) => set("hasta", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="pre-monto">Monto pagado (pesos)</Label>
            <Input id="pre-monto" inputMode="numeric" value={form.monto} onChange={(e) => set("monto", e.target.value)} />
          </div>
          {form.tipo === "prima" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-ret">Retención en la fuente practicada (opcional)</Label>
              <Input id="pre-ret" inputMode="numeric" value={form.retencion} onChange={(e) => set("retencion", e.target.value)} />
            </div>
          )}
          {form.tipo === "cesantias" && (
            <>
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="pre-destino">Destino</Label>
                <select id="pre-destino" className={inputClass} value={form.destino} onChange={(e) => set("destino", e.target.value)}>
                  {DESTINOS_CESANTIAS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs" htmlFor="pre-fondo">Fondo de cesantías (opcional)</Label>
                <Input id="pre-fondo" value={form.fondo} maxLength={120} onChange={(e) => set("fondo", e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-medio">Medio de pago</Label>
              <select id="pre-medio" className={inputClass} value={form.medioPago} onChange={(e) => set("medioPago", e.target.value)}>
                {MEDIOS_PAGO_NOMINA.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-fecha">Fecha real del pago</Label>
              <Input id="pre-fecha" type="date" max={hoy} value={form.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="pre-obs">Observación</Label>
            <Input id="pre-obs" value={form.observacion} maxLength={300} onChange={(e) => set("observacion", e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            La nómina de cada mes solo provisiona estas prestaciones. Al registrar el pago, la contabilidad baja esa
            provisión contra la caja (efectivo) o el banco, y la nómina electrónica lo reporta en el mes en que se pagó.
            La prima va por semestre; las cesantías y sus intereses, por año. El pago no se edita: se anula y se registra
            de nuevo.
          </p>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          {avisos.map((a) => (
            <p key={a} className="text-sm text-warning-ink" role="status">
              {a}
            </p>
          ))}
          {falta && form.employeeId && <p className="text-xs text-muted-foreground">{falta}</p>}
          <Button disabled={!!falta || ocupado} onClick={() => void guardar()}>
            {ocupado && <Loader2 className="size-4 animate-spin" />}
            Registrar pago
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-semibold">Pagos del año</p>
            <div className="flex flex-col gap-1">
              <Label className="text-xs" htmlFor="pre-anio">Año del pago</Label>
              <Input
                id="pre-anio"
                inputMode="numeric"
                maxLength={4}
                className="w-24"
                value={anio}
                onChange={(e) => setAnio(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          {errorLista && <p className="text-sm text-destructive" role="alert">{errorLista}</p>}
          {cargando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : filas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin pagos de prestaciones en {anio}.</p>
          ) : (
            filas.map((p) => (
              <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {p.employeeName ?? p.employeeId} · {etiquetaTipo(p.tipo)} · {money.format(p.monto)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cubre {p.periodoDesde} a {p.periodoHasta} ({p.dias} días) · pagado el {p.pago.fecha} por{" "}
                    {etiquetaMedio(p.pago.medio).toLowerCase()}
                    {p.retencionFuente > 0 ? ` · retención ${money.format(p.retencionFuente)}` : ""}
                    {p.destino === "trabajador" ? " · entregadas al trabajador" : ""}
                    {p.fondo ? ` · ${p.fondo}` : ""}
                    {p.registradoPor ? ` · lo registró ${p.registradoPor}` : ""}
                    {p.observacion ? ` · ${p.observacion}` : ""}
                  </p>
                </div>
                {p.estado === "registrado" ? (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void anular(p)}>
                    Anular
                  </Button>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Anulado</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
