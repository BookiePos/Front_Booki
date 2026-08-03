"use client"

import * as React from "react"
import type { PayrollBreakdown } from "@/lib/erp/api-payroll"

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
}: {
  breakdown: PayrollBreakdown
  header?: React.ReactNode
  /** Detalle de "otras deducciones" (consumos de empleado, etc.). */
  otrasDetalle?: { concept: string; amount: number }[]
}) {
  const d = b.devengados
  const de = b.deducciones
  const ap = b.aportesEmpleador
  const pr = b.provisiones
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-foreground">
      {header}

      <SectionTitle>Devengados</SectionTitle>
      <Row label={`Salario (${b.diasTrabajados} días)`} value={d.salario} />
      <Row label="Auxilio de transporte" value={d.auxilioTransporte} hideZero />
      {d.recargoDetalle.map((r) => (
        <Row key={r.key} label={`${r.label} (${r.horas}h)`} value={r.valor} muted />
      ))}
      <Row label="Bonificación salarial" value={d.bonificacionSalarial} hideZero />
      <Row label="Bonificación no salarial" value={d.bonificacionNoSalarial} hideZero />
      <Row label="Comisiones" value={d.comisiones} hideZero />
      <div className="border-t border-border">
        <Row label="Total devengado" value={d.total} strong />
      </div>

      <SectionTitle>Deducciones</SectionTitle>
      <Row label="Salud (4%)" value={de.salud} sign="-" />
      <Row label="Pensión (4%)" value={de.pension} sign="-" />
      <Row label="Fondo de solidaridad pensional" value={de.fsp} hideZero sign="-" />
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
        <Row label="Total deducciones" value={de.total} strong sign="-" />
      </div>

      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-primary/10 px-3 py-2">
        <span className="font-semibold">Neto a pagar</span>
        <span className="font-display text-lg tabular-nums text-primary">
          {money.format(b.netoPagar)}
        </span>
      </div>

      <SectionTitle>Aportes del empleador (no se descuentan)</SectionTitle>
      <Row label="Salud (8,5%)" value={ap.salud} muted />
      <Row label="Pensión (12%)" value={ap.pension} muted />
      <Row label="ARL" value={ap.arl} muted />
      <Row label="Caja de compensación (4%)" value={ap.ccf} muted />
      <Row label="SENA (2%)" value={ap.sena} muted hideZero />
      <Row label="ICBF (3%)" value={ap.icbf} muted hideZero />
      <div className="border-t border-border">
        <Row label="Total aportes" value={ap.total} strong muted />
      </div>

      <SectionTitle>Provisiones prestacionales</SectionTitle>
      <Row label="Cesantías (8,33%)" value={pr.cesantias} muted />
      <Row label="Intereses cesantías (12%)" value={pr.interesesCesantias} muted />
      <Row label="Prima de servicios (8,33%)" value={pr.prima} muted />
      <Row label="Vacaciones (4,17%)" value={pr.vacaciones} muted />
      <div className="border-t border-border">
        <Row label="Total provisiones" value={pr.total} strong muted />
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-sm font-semibold">Costo total empleador</span>
        <span className="font-semibold tabular-nums">
          {money.format(b.costoEmpleador)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        IBC: {money.format(b.ibc)} · Hora ordinaria: {money.format(b.horaOrdinaria)}
      </p>
    </div>
  )
}
