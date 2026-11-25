"use client"

import * as React from "react"
import { PAGADOR_NOVEDAD, TIPOS_NOVEDAD, type PayrollBreakdown } from "@/lib/erp/api-payroll"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function Row({
  label,
  value,
  hideZero,
  strong,
  muted,
  sign,
}: {
  label: string
  value: number
  hideZero?: boolean
  strong?: boolean
  muted?: boolean
  sign?: "+" | "-"
}) {
  if (hideZero && !value) return null
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-0.5 ${
        strong ? "text-sm font-semibold" : "text-sm"
      }`}
    >
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="tabular-nums">
        {sign === "-" ? "−" : ""}
        {money.format(value)}
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

/** Desprendible / comprobante de nómina de un empleado. */
export function PayrollSlipView({
  breakdown: b,
  header,
  otrasDetalle,
  alertas,
  pagadoQuincena = 0,
}: {
  breakdown: PayrollBreakdown
  header?: React.ReactNode
  /** Detalle de "otras deducciones" (consumos de empleado, etc.). */
  otrasDetalle?: { concept: string; amount: number }[]
  /** Avisos para revisar (tope de horas extra, etc.). */
  alertas?: string[]
  /** Lo que ya se le pagó en la primera quincena del mes. */
  pagadoQuincena?: number
}) {
  const d = b.devengados
  const de = b.deducciones
  const ap = b.aportesEmpleador
  const pr = b.provisiones
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-foreground">
      {header}

      {alertas && alertas.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink">
          {alertas.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <SectionTitle>Lo que ganó en el mes</SectionTitle>
      <Row label={`Salario (${b.diasTrabajados} días)`} value={d.salario} />
      <Row label="Auxilio de transporte" value={d.auxilioTransporte} hideZero />
      {d.recargoDetalle.map((r) => (
        <Row key={r.key} label={`${r.label} (${r.horas}h)`} value={r.valor} muted />
      ))}
      <Row label="Bonificación salarial" value={d.bonificacionSalarial} hideZero />
      <Row label="Bonificación no salarial" value={d.bonificacionNoSalarial} hideZero />
      <Row label="Comisiones" value={d.comisiones} hideZero />
      {(d.ausenciaDetalle ?? []).map((a) => (
        <Row
          key={`${a.tipo}-${a.fechaInicio}`}
          label={`${TIPOS_NOVEDAD.find((t) => t.value === a.tipo)?.label ?? a.tipo} (${a.dias} días, ${PAGADOR_NOVEDAD[a.pagador] ?? a.pagador})`}
          value={a.valor}
          muted
        />
      ))}
      <div className="border-t border-border">
        <Row label="Total ganado (devengado)" value={d.total} strong />
      </div>

      <SectionTitle>Lo que se le descuenta</SectionTitle>
      <Row label="Salud (4%)" value={de.salud} sign="-" />
      <Row label="Pensión (4%)" value={de.pension} sign="-" />
      <Row label="Fondo de solidaridad pensional" value={de.fsp} hideZero sign="-" />
      <Row label="Aporte pensión licencia no remunerada" value={de.pensionLicenciaNR ?? 0} hideZero sign="-" />
      <Row
        label={`Retención en la fuente (${b.baseRetencionUvt} UVT)`}
        value={de.retencionFuente}
        hideZero
        sign="-"
      />
      {otrasDetalle && otrasDetalle.length > 0 ? (
        otrasDetalle.map((o, i) => (
          <Row key={i} label={o.concept} value={o.amount} sign="-" muted />
        ))
      ) : (
        <Row label="Otras deducciones" value={de.otras} hideZero sign="-" />
      )}
      <div className="border-t border-border">
        <Row label="Total descuentos" value={de.total} strong sign="-" />
      </div>

      {pagadoQuincena > 0 && (
        <div className="mt-3 border-t border-border">
          <Row label="Neto del mes" value={b.netoPagar} />
          <Row label="Ya pagado en la primera quincena" value={pagadoQuincena} sign="-" />
        </div>
      )}
      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="font-semibold">
          {pagadoQuincena > 0 ? "Por pagar en la segunda quincena" : "Lo que recibe (neto a pagar)"}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {money.format(b.netoPagar - pagadoQuincena)}
        </span>
      </div>

      <SectionTitle>Lo que paga la empresa aparte (no se le descuenta)</SectionTitle>
      <Row label="Salud (8,5%)" value={ap.salud} muted />
      <Row label="Pensión (12%)" value={ap.pension} muted />
      <Row label="ARL" value={ap.arl} muted />
      <Row label="Caja de compensación (4%)" value={ap.ccf} muted />
      <Row label="SENA (2%)" value={ap.sena} muted hideZero />
      <Row label="ICBF (3%)" value={ap.icbf} muted hideZero />
      <div className="border-t border-border">
        <Row label="Total aportes" value={ap.total} strong muted />
      </div>

      <SectionTitle>Lo que se guarda para prima, cesantías y vacaciones</SectionTitle>
      <Row label="Cesantías (8,33%)" value={pr.cesantias} muted />
      <Row label="Intereses cesantías (12%)" value={pr.interesesCesantias} muted />
      <Row label="Prima de servicios (8,33%)" value={pr.prima} muted />
      <Row label="Vacaciones (4,17%)" value={pr.vacaciones} muted />
      <div className="border-t border-border">
        <Row label="Total provisiones" value={pr.total} strong muted />
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-sm font-semibold">Lo que le cuesta a la empresa</span>
        <span className="font-semibold tabular-nums">
          {money.format(b.costoEmpleador)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Base para salud y pensión (IBC): {money.format(b.ibc)} · Valor de la hora: {money.format(b.horaOrdinaria)}
      </p>
    </div>
  )
}
