"use client"

import * as React from "react"
import { ChevronDown, Loader2, Lock, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import {
  actualizarValoresLey,
  getValoresLey,
  respuestaExoneracion,
  updatePayrollSettings,
  type CambioValoresLey,
  type PayrollSettings,
  type ValoresLey,
} from "@/lib/erp/api-payroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Segmented } from "@/components/ui/segmented"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { FormDialog, FormAlert } from "@/components/ui/form-dialog"
import { Termino } from "@/components/ui/help-tip"
import { useLoadEffect } from "@/hooks/use-load-effect"

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})
const fechaLarga = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/** 0.0833 → "8,33 %"; 0.35 → "35 %". */
function pct(f: number): string {
  const v = Math.round(f * 10000) / 100
  return `${v.toLocaleString("es-CO", { maximumFractionDigits: 3 })} %`
}
function hora(h: number): string {
  const sufijo = h >= 12 ? "p. m." : "a. m."
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:00 ${sufijo}`
}
function fecha(iso: string): string {
  return fechaLarga.format(new Date(`${iso}T00:00:00Z`))
}
function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message
  return "No se pudo completar la acción."
}

/**
 * Valores de ley de la nómina: lo que el Gobierno fija cada año y que define
 * cuánto se le paga a cada trabajador.
 *
 * Se muestra primero en modo lectura, con la norma al lado de cada cifra y lo
 * que vale en plata con el salario mínimo, porque un porcentaje suelto no le
 * dice nada a quien no es contador. Cambiar algo exige pasar por una
 * advertencia y luego confirmar el resumen: de estas cifras depende el pago
 * exacto de cada persona y no deben tocarse como un campo cualquiera.
 *
 * Los valores salen de `GET /payroll/valores-ley`, que usa las mismas
 * funciones que el cálculo: lo que se ve aquí es lo que se liquida.
 */
export function ValoresLeyNomina({
  onSettings,
}: {
  /** Avisa al padre cuando cambian las opciones de la empresa. */
  onSettings?: (s: PayrollSettings) => void
}) {
  const [datos, setDatos] = React.useState<ValoresLey | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [editando, setEditando] = React.useState(false)
  const [verRetencion, setVerRetencion] = React.useState(false)
  const confirm = useConfirm()

  const cargar = React.useCallback(async () => {
    try {
      setDatos(await getValoresLey())
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])
  useLoadEffect(cargar)

  if (error)
    return <p className="py-8 text-center text-sm text-destructive">{error}</p>
  if (!datos) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    )
  }

  const u = datos.enUso
  const ley = datos.ley
  const horaMinimo = u.smmlv / u.horasMes
  const exonerada = u.empresaExoneradaAportes

  async function pedirEdicion() {
    const ok = await confirm({
      title: `¿Cambiar los valores de ley de ${datos!.year}?`,
      description:
        "Estos valores definen cuánto se le paga a cada trabajador: sueldo, auxilio, recargos y horas extra. BookiPos ya trae los que fija la ley. Cámbialos solo si salió un decreto nuevo o si pactaste con tus trabajadores un recargo mayor.",
      confirmLabel: "Sí, quiero cambiarlos",
      cancelLabel: "Dejar los de ley",
    })
    if (ok) setEditando(true)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Estado: ¿lo que uso coincide con la ley? */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            Valores de ley {datos.year}
          </h2>
          <Estado datos={datos} />
        </div>
        <Button variant="outline" onClick={() => void pedirEdicion()}>
          Cambiar valores
        </Button>
      </div>

      <Seccion titulo="Salario y auxilio">
        <Fila
          concepto="Salario mínimo mensual"
          termino="smmlv"
          explicacion="Nadie con jornada completa puede ganar menos. Muchos topes de la nómina se miden en salarios mínimos."
          valor={pesos.format(u.smmlv)}
          norma={ley?.fuentes.smmlv}
          distinto={
            datos.distintosDeLey.includes("smmlv") && ley
              ? pesos.format(ley.smmlv)
              : undefined
          }
        />
        <Fila
          concepto="Auxilio de transporte"
          termino="auxilioTransporte"
          explicacion={`Se paga a quien gana hasta ${u.auxTransporteMaxSmmlv} salarios mínimos (${pesos.format(
            u.smmlv * u.auxTransporteMaxSmmlv,
          )}). En la quincena se paga la mitad.`}
          valor={pesos.format(u.auxilioTransporte)}
          norma={ley?.fuentes.auxilioTransporte}
          distinto={
            datos.distintosDeLey.includes("auxilioTransporte") && ley
              ? pesos.format(ley.auxilioTransporte)
              : undefined
          }
        />
        <Fila
          concepto="UVT"
          termino="uvt"
          explicacion="La unidad que usa la DIAN para calcular la retención en la fuente. Se cambia en Ajustes → Parámetros porque también la usan los impuestos."
          valor={pesos.format(u.uvt)}
          norma={ley?.fuentes.uvt}
          bloqueado
        />
      </Seccion>

      <Seccion
        titulo="Horario, recargos y horas extra"
        nota={`Ejemplos con el salario mínimo: una hora normal vale ${pesos.format(
          Math.round(horaMinimo),
        )} (${pesos.format(u.smmlv)} ÷ ${u.horasMes} horas del mes).`}
      >
        <Fila
          concepto="Jornada máxima"
          termino="jornadaMaxima"
          explicacion="Horas a la semana sin pagar extras. Lo que pase de aquí es hora extra."
          valor={`${u.jornadaSemanal} horas`}
          norma="Ley 2101 de 2021"
          bloqueado
        />
        <Fila
          concepto="Horario nocturno"
          explicacion="Toda hora trabajada en esta franja lleva recargo nocturno."
          valor={`${hora(u.nocturnoDesdeHora)} a ${hora(u.nocturnoHastaHora)}`}
          norma="Ley 2466 de 2025"
          bloqueado
        />
        <FilaRecargo
          concepto="Recargo nocturno"
          termino="recargoNocturno"
          factor={u.recargos.recargoNocturno}
          ejemplo={`Se suman ${pesos.format(Math.round(horaMinimo * u.recargos.recargoNocturno))} a cada hora de noche`}
          norma="CST art. 168"
        />
        <FilaRecargo
          concepto="Domingo o festivo"
          termino="dominicales"
          factor={u.recargos.dominical}
          ejemplo={`Se suman ${pesos.format(Math.round(horaMinimo * u.recargos.dominical))} a cada hora`}
          norma="Ley 2466 de 2025, art. 14"
        />
        <FilaRecargo
          concepto="Noche de domingo o festivo"
          factor={u.recargos.nocturnoDominical}
          ejemplo={`Se suman ${pesos.format(Math.round(horaMinimo * u.recargos.nocturnoDominical))} a cada hora`}
          norma="Nocturno + dominical"
        />
        <FilaRecargo
          concepto="Hora extra de día"
          termino="horasExtra"
          factor={u.recargos.extraDiurna}
          ejemplo={`Cada hora extra vale ${pesos.format(Math.round(horaMinimo * (1 + u.recargos.extraDiurna)))}`}
          norma="CST art. 168"
        />
        <FilaRecargo
          concepto="Hora extra de noche"
          factor={u.recargos.extraNocturna}
          ejemplo={`Cada hora extra vale ${pesos.format(Math.round(horaMinimo * (1 + u.recargos.extraNocturna)))}`}
          norma="CST art. 168"
        />
        <FilaRecargo
          concepto="Hora extra de día en domingo o festivo"
          factor={u.recargos.extraDiurnaDominical}
          ejemplo={`Cada hora extra vale ${pesos.format(Math.round(horaMinimo * (1 + u.recargos.extraDiurnaDominical)))}`}
          norma="Extra + dominical"
        />
        <FilaRecargo
          concepto="Hora extra de noche en domingo o festivo"
          factor={u.recargos.extraNocturnaDominical}
          ejemplo={`Cada hora extra vale ${pesos.format(Math.round(horaMinimo * (1 + u.recargos.extraNocturnaDominical)))}`}
          norma="Extra + dominical"
        />
      </Seccion>

      {datos.programados.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium">Lo que ya cambia por ley</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground">
            {datos.programados.map((p) => (
              <li key={p.concepto}>
                <span className="text-foreground">{fecha(p.desde)}:</span>{" "}
                {p.concepto} pasa a{" "}
                <span className="font-medium text-foreground">{p.valor}</span> (
                {p.fuente}). BookiPos lo aplica solo desde ese día.
              </li>
            ))}
          </ul>
        </div>
      )}

      <Seccion titulo="Aportes a seguridad social">
        <Fila
          concepto="Salud"
          termino="eps"
          explicacion={
            exonerada
              ? "El trabajador pone su parte. La empresa no paga la suya porque está exonerada."
              : "El trabajador pone una parte y la empresa otra."
          }
          valor={`${pct(u.saludEmpleado)} trabajador · ${exonerada ? "0 %" : pct(u.saludEmpleador)} empresa`}
          norma="Ley 100 de 1993"
          bloqueado
        />
        <Fila
          concepto="Pensión"
          termino="afp"
          explicacion="Ahorro para la pensión del trabajador."
          valor={`${pct(u.pensionEmpleado)} trabajador · ${pct(u.pensionEmpleador)} empresa`}
          norma="Ley 100 de 1993"
          bloqueado
        />
        <Fila
          concepto="Caja de compensación"
          termino="cajaCompensacion"
          explicacion="Lo paga la empresa."
          valor={pct(u.ccf)}
          norma="Ley 21 de 1982"
          bloqueado
        />
        <Fila
          concepto="SENA e ICBF"
          termino="parafiscales"
          explicacion={
            exonerada
              ? "No se pagan: la empresa está exonerada."
              : "Los paga la empresa."
          }
          valor={exonerada ? "0 %" : `${pct(u.sena)} y ${pct(u.icbf)}`}
          norma="Art. 114-1 ET"
          bloqueado
        />
        <Fila
          concepto="ARL"
          termino="nivelRiesgo"
          explicacion="Seguro de accidentes de trabajo. Lo paga la empresa según el riesgo del cargo."
          valor={(["I", "II", "III", "IV", "V"] as const)
            .map((n) => `${n}: ${pct(u.arlRates[n])}`)
            .join(" · ")}
          norma="Decreto 1772 de 1994"
          bloqueado
        />
      </Seccion>

      <Seccion titulo="Prestaciones (lo que se va guardando cada mes)">
        <Fila
          concepto="Prima de servicios"
          termino="prima"
          explicacion="Un mes de sueldo al año, en dos pagos: junio y diciembre."
          valor={pct(u.prima)}
          norma="CST art. 306"
          bloqueado
        />
        <Fila
          concepto="Cesantías"
          termino="cesantias"
          explicacion="Un mes de sueldo por año, que se consigna en el fondo antes del 14 de febrero."
          valor={pct(u.cesantias)}
          norma="CST art. 249"
          bloqueado
        />
        <Fila
          concepto="Intereses de cesantías"
          termino="interesesCesantias"
          explicacion="Se le pagan al trabajador antes del 31 de enero."
          valor={`${pct(u.interesesCesantias)} al año`}
          norma="Ley 52 de 1975"
          bloqueado
        />
        <Fila
          concepto="Vacaciones"
          termino="vacaciones"
          explicacion="15 días hábiles pagados por cada año trabajado."
          valor={pct(u.vacaciones)}
          norma="CST art. 186"
          bloqueado
        />
      </Seccion>

      <TuEmpresa
        datos={datos}
        onCambio={(s) => {
          onSettings?.(s)
          void cargar()
        }}
      />

      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-foreground"
          aria-expanded={verRetencion}
          onClick={() => setVerRetencion((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-150",
              verRetencion && "rotate-180",
            )}
            aria-hidden
          />
          Tabla de retención en la fuente (art. 383 del Estatuto Tributario)
        </button>
        {verRetencion && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[520px] text-[13px] tabular-nums">
              <thead>
                <tr className="h-9 border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 font-medium">
                    Si el pago del mes, ya depurado, está entre
                  </th>
                  <th className="px-3 text-right font-medium">Tarifa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {u.tabla383.map((t) => (
                  <tr key={t.desdeUvt} className="h-10">
                    <td className="px-4">
                      {pesos.format(t.desdeUvt * u.uvt)} y{" "}
                      {t.hastaUvt === null
                        ? "en adelante"
                        : pesos.format(t.hastaUvt * u.uvt)}
                      <span className="text-muted-foreground">
                        {" "}
                        ({t.desdeUvt}–{t.hastaUvt ?? "∞"} UVT)
                      </span>
                    </td>
                    <td className="px-3 text-right">
                      {t.rate === 0 ? "No se retiene" : pct(t.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <EditarValores
          abierto
          datos={datos}
          onCerrar={() => setEditando(false)}
          onGuardado={(d) => {
            setDatos(d)
            setEditando(false)
          }}
        />
      )}
    </div>
  )
}

function Estado({ datos }: { datos: ValoresLey }) {
  if (!datos.ley) {
    return (
      <p className="mt-1 flex items-center gap-2 text-sm text-warning-ink">
        <span className="size-2 rounded-full bg-warning" />
        BookiPos aún no tiene los valores de ley de {datos.year}. Revisa el
        decreto del salario mínimo de este año y cámbialos aquí.
      </p>
    )
  }
  const n = datos.distintosDeLey.length
  if (n === 0) {
    return (
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-success" />
        Coinciden con la ley colombiana de {datos.year}. No tienes que cambiar
        nada.
      </p>
    )
  }
  return (
    <p className="mt-1 flex items-center gap-2 text-sm text-warning-ink">
      <span className="size-2 rounded-full bg-warning" />
      {n === 1 ? "Un valor no coincide" : `${n} valores no coinciden`} con la
      ley de {datos.year}. Revísalos abajo.
    </p>
  )
}

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-semibold">{titulo}</h3>
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </div>
    </section>
  )
}

function Fila({
  concepto,
  termino,
  explicacion,
  valor,
  norma,
  distinto,
  bloqueado,
}: {
  concepto: string
  termino?: React.ComponentProps<typeof Termino>["term"]
  explicacion: string
  valor: string
  norma?: string
  /** Valor de ley cuando el que está en uso es otro. */
  distinto?: string
  /** Fijado por ley: no se cambia desde esta pantalla. */
  bloqueado?: boolean
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {termino ? <Termino term={termino}>{concepto}</Termino> : concepto}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {explicacion}
        </p>
      </div>
      <div className="flex flex-col sm:items-end">
        <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          {bloqueado && (
            <Lock
              className="size-3 text-muted-foreground/70"
              aria-label="Fijado por ley"
            />
          )}
          {valor}
        </p>
        {distinto ? (
          <p className="text-xs text-warning-ink">La ley dice {distinto}</p>
        ) : norma ? (
          <p className="text-xs text-muted-foreground">{norma}</p>
        ) : null}
      </div>
    </div>
  )
}

function FilaRecargo({
  concepto,
  termino,
  factor,
  ejemplo,
  norma,
}: {
  concepto: string
  termino?: React.ComponentProps<typeof Termino>["term"]
  factor: number
  ejemplo: string
  norma: string
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {termino ? <Termino term={termino}>{concepto}</Termino> : concepto}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{ejemplo}</p>
      </div>
      <div className="flex flex-col sm:items-end">
        <p className="text-sm font-semibold tabular-nums">{pct(factor)} más</p>
        <p className="text-xs text-muted-foreground">{norma}</p>
      </div>
    </div>
  )
}

/** Opciones que decide la empresa (no la ley): exoneración y días laborables. */
function TuEmpresa({
  datos,
  onCambio,
}: {
  datos: ValoresLey
  onCambio: (s: PayrollSettings) => void
}) {
  const confirm = useConfirm()
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const u = datos.enUso

  async function cambiarExoneracion(v: "si" | "no") {
    const exonerada = v === "si"
    if (exonerada === u.empresaExoneradaAportes) return
    const ok = await confirm({
      title: exonerada
        ? "¿La empresa está exonerada de aportes?"
        : "¿La empresa paga todos los aportes?",
      description: exonerada
        ? "Desde la próxima nómina no se pagará salud de la empresa, SENA ni ICBF por quienes ganen menos de 10 salarios mínimos. Confírmalo con tu contador: si no aplica, la UGPP puede cobrarlos con intereses."
        : "Desde la próxima nómina se pagarán salud de la empresa (8,5 %), SENA (2 %) e ICBF (3 %) por todos los trabajadores.",
      confirmLabel: "Sí, cambiar",
    })
    if (!ok) return
    await guardar(() => updatePayrollSettings(respuestaExoneracion(exonerada)))
  }

  async function cambiarDias(v: "6" | "5") {
    if (Number(v) === u.diasLaborablesSemana) return
    const ok = await confirm({
      title: `¿Se trabaja ${v === "6" ? "de lunes a sábado" : "de lunes a viernes"}?`,
      description:
        "Decide cuándo se gana el domingo pagado: quien trabaja todos los días laborables de la semana tiene derecho a él (CST art. 173).",
      confirmLabel: "Sí, cambiar",
    })
    if (!ok) return
    await guardar(() =>
      updatePayrollSettings({ diasLaborablesSemana: Number(v) }),
    )
  }

  async function guardar(fn: () => Promise<PayrollSettings>) {
    setGuardando(true)
    setError(null)
    try {
      onCambio(await fn())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-[15px] font-semibold">Tu empresa</h3>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              <Termino term="exoneracionAportes">
                ¿Exonerada de aportes?
              </Termino>
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Aplica a sociedades que declaran renta y a personas naturales con
              dos o más trabajadores.
            </p>
          </div>
          <Segmented
            size="sm"
            ariaLabel="Exoneración de aportes"
            value={u.empresaExoneradaAportes ? "si" : "no"}
            onValueChange={(v) => void cambiarExoneracion(v)}
            options={[
              { value: "si", label: "Sí", disabled: guardando },
              { value: "no", label: "No", disabled: guardando },
            ]}
          />
        </div>
        <div className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Días que se trabaja a la semana
            </p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Define quién se gana el domingo pagado.
            </p>
          </div>
          <Segmented
            size="sm"
            ariaLabel="Días laborables de la semana"
            value={String(u.diasLaborablesSemana) as "6" | "5"}
            onValueChange={(v) => void cambiarDias(v)}
            options={[
              { value: "6", label: "Lunes a sábado", disabled: guardando },
              { value: "5", label: "Lunes a viernes", disabled: guardando },
            ]}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  )
}

/** Primer día del mes en curso (YYYY-MM-DD), hora de Colombia. */
function primeroDelMes(): string {
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  })
  return `${hoy.slice(0, 7)}-01`
}

const aPct = (f: number) => String(Math.round(f * 1000) / 10)

function EditarValores({
  abierto,
  datos,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  datos: ValoresLey
  onCerrar: () => void
  onGuardado: (d: ValoresLey) => void
}) {
  const u = datos.enUso
  const confirm = useConfirm()
  const [smmlv, setSmmlv] = React.useState<number | null>(u.smmlv)
  const [aux, setAux] = React.useState<number | null>(u.auxilioTransporte)
  const [noct, setNoct] = React.useState(aPct(u.recargos.recargoNocturno))
  const [dom, setDom] = React.useState(aPct(u.recargos.dominical))
  const [exD, setExD] = React.useState(aPct(u.recargos.extraDiurna))
  const [exN, setExN] = React.useState(aPct(u.recargos.extraNocturna))
  const [desde, setDesde] = React.useState(primeroDelMes)
  const [motivo, setMotivo] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Lo que cambió respecto de lo que está en uso: solo eso se manda.
  const cambios: {
    nombre: string
    antes: string
    despues: string
    campo: Partial<CambioValoresLey>
  }[] = []
  if (smmlv !== null && smmlv !== u.smmlv)
    cambios.push({
      nombre: "Salario mínimo",
      antes: pesos.format(u.smmlv),
      despues: pesos.format(smmlv),
      campo: { smmlv },
    })
  if (aux !== null && aux !== u.auxilioTransporte)
    cambios.push({
      nombre: "Auxilio de transporte",
      antes: pesos.format(u.auxilioTransporte),
      despues: pesos.format(aux),
      campo: { auxilioTransporte: aux },
    })
  const recargo = (
    nombre: string,
    texto: string,
    actual: number,
    clave:
      "recargoNocturno" | "recargoDominical" | "extraDiurna" | "extraNocturna",
  ) => {
    const n = Number(texto.replace(",", "."))
    if (texto.trim() !== "" && Number.isFinite(n) && n !== Number(aPct(actual)))
      cambios.push({
        nombre,
        antes: `${aPct(actual)} %`,
        despues: `${n} %`,
        campo: { [clave]: n },
      })
  }
  recargo(
    "Recargo nocturno",
    noct,
    u.recargos.recargoNocturno,
    "recargoNocturno",
  )
  recargo(
    "Recargo dominical y festivo",
    dom,
    u.recargos.dominical,
    "recargoDominical",
  )
  recargo("Hora extra de día", exD, u.recargos.extraDiurna, "extraDiurna")
  recargo("Hora extra de noche", exN, u.recargos.extraNocturna, "extraNocturna")

  async function guardar() {
    if (cambios.length === 0) return
    const ok = await confirm({
      title: "¿Guardar estos cambios?",
      description: (
        <span className="flex flex-col gap-2">
          <span>
            Desde el {fecha(desde)}, todas las nóminas se calcularán con:
          </span>
          <span className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2 text-foreground">
            {cambios.map((c) => (
              <span
                key={c.nombre}
                className="flex justify-between gap-4 tabular-nums"
              >
                <span>{c.nombre}</span>
                <span>
                  {c.antes} → <strong>{c.despues}</strong>
                </span>
              </span>
            ))}
          </span>
          <span>
            Las nóminas de meses anteriores no cambian. Si ya calculaste la de
            este mes y sigue en borrador, recalcúlala.
          </span>
        </span>
      ),
      confirmLabel: "Sí, guardar",
    })
    if (!ok) return
    setGuardando(true)
    setError(null)
    try {
      const payload: CambioValoresLey = Object.assign(
        { vigenteDesde: desde, motivo: motivo.trim() || undefined },
        ...cambios.map((c) => c.campo),
      )
      onGuardado(await actualizarValoresLey(payload))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  const minimo = (f: number) => `Mínimo de ley: ${aPct(f)} %`
  return (
    <FormDialog
      open={abierto}
      onOpenChange={(v) => {
        if (!v) onCerrar()
      }}
      size="xl"
      title="Cambiar valores de ley"
      description="Lo que guardes rige desde la fecha que elijas. Lo anterior queda para los meses ya pagados."
      footer={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={guardando || cambios.length === 0}
            onClick={() => void guardar()}
          >
            {guardando && <Loader2 className="animate-spin" />}
            {cambios.length === 0
              ? "Sin cambios"
              : `Revisar ${cambios.length} cambio${cambios.length > 1 ? "s" : ""}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-2.5 rounded-md border border-warning/30 bg-warning/[0.07] px-3 py-2.5 text-sm text-warning-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Cambiar estas cifras cambia el pago de todos tus trabajadores. Los
            recargos no pueden quedar por debajo de la ley; solo se pueden
            pactar por encima.
          </p>
        </div>
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor
            label="Salario mínimo mensual"
            ayuda={
              datos.ley
                ? `De ley ${datos.year}: ${pesos.format(datos.ley.smmlv)}`
                : undefined
            }
          >
            <MoneyInput id="vl-smmlv" value={smmlv} onValueChange={setSmmlv} />
          </CampoValor>
          <CampoValor
            label="Auxilio de transporte"
            ayuda={
              datos.ley
                ? `De ley ${datos.year}: ${pesos.format(datos.ley.auxilioTransporte)}`
                : undefined
            }
          >
            <MoneyInput id="vl-aux" value={aux} onValueChange={setAux} />
          </CampoValor>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoValor
            label="Recargo nocturno"
            ayuda={minimo(u.recargosMinimos.recargoNocturno)}
          >
            <Porcentaje id="vl-noct" value={noct} onChange={setNoct} />
          </CampoValor>
          <CampoValor
            label="Recargo dominical y festivo"
            ayuda={minimo(u.recargoDominicalLegal)}
          >
            <Porcentaje id="vl-dom" value={dom} onChange={setDom} />
          </CampoValor>
          <CampoValor
            label="Hora extra de día"
            ayuda={minimo(u.recargosMinimos.extraDiurna)}
          >
            <Porcentaje id="vl-exd" value={exD} onChange={setExD} />
          </CampoValor>
          <CampoValor
            label="Hora extra de noche"
            ayuda={minimo(u.recargosMinimos.extraNocturna)}
          >
            <Porcentaje id="vl-exn" value={exN} onChange={setExN} />
          </CampoValor>
        </div>

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <CampoValor
            label="Rige desde"
            ayuda="Normalmente el 1 del mes en que empieza el cambio."
          >
            <Input
              id="vl-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </CampoValor>
          <CampoValor
            label="Motivo"
            ayuda="Ej.: Decreto del salario mínimo, pacto con los trabajadores."
          >
            <Input
              id="vl-motivo"
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </CampoValor>
        </div>
      </div>
    </FormDialog>
  )
}

function CampoValor({
  label,
  ayuda,
  children,
}: {
  label: string
  ayuda?: string
  children: React.ReactElement<{ id?: string }>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={children.props.id}>{label}</Label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  )
}

function Porcentaje({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className="pr-8 tabular-nums"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        %
      </span>
    </div>
  )
}
