/**
 * Cliente HTTP de Nómina (motor de cálculo Colombia) para el admin.
 * Reutiliza authFetch de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export interface ArlRates {
  I: number
  II: number
  III: number
  IV: number
  V: number
}
export interface RecargoFactores {
  recargoNocturno: number
  dominical: number
  nocturnoDominical: number
  extraDiurna: number
  extraNocturna: number
  extraDiurnaDominical: number
  extraNocturnaDominical: number
}

export interface PayrollSettings {
  _id: string
  year: number
  smmlv: number
  auxilioTransporte: number
  uvt: number
  saludEmpleado: number
  saludEmpleador: number
  pensionEmpleado: number
  pensionEmpleador: number
  ccf: number
  sena: number
  icbf: number
  arlRates: ArlRates
  ibcMinSmmlv: number
  ibcMaxSmmlv: number
  integralSmmlv: number
  integralIbcFactor: number
  exoneracionSmmlv: number
  auxTransporteMaxSmmlv: number
  cesantias: number
  interesesCesantias: number
  prima: number
  vacaciones: number
  fspTramos: { hastaSmmlv: number | null; rate: number }[]
  tabla383: {
    desdeUvt: number
    hastaUvt: number | null
    rate: number
    uvtBase: number
  }[]
  recargos: RecargoFactores
  empresaExoneradaAportes: boolean
}

export interface RecargoLinea {
  key: string
  label: string
  horas: number
  factor: number
  valor: number
}

export interface PayrollBreakdown {
  diasTrabajados: number
  horaOrdinaria: number
  devengados: {
    salario: number
    auxilioTransporte: number
    recargos: number
    horasExtra: number
    recargoDetalle: RecargoLinea[]
    bonificacionSalarial: number
    bonificacionNoSalarial: number
    comisiones: number
    total: number
  }
  ibc: number
  deducciones: {
    salud: number
    pension: number
    fsp: number
    retencionFuente: number
    otras: number
    total: number
  }
  aportesEmpleador: {
    salud: number
    pension: number
    arl: number
    ccf: number
    sena: number
    icbf: number
    total: number
  }
  provisiones: {
    cesantias: number
    interesesCesantias: number
    prima: number
    vacaciones: number
    total: number
  }
  netoPagar: number
  costoEmpleador: number
  baseRetencionUvt: number
}

export interface NovedadHoras {
  recargoNocturno?: number
  dominical?: number
  nocturnoDominical?: number
  extraDiurna?: number
  extraNocturna?: number
  extraDiurnaDominical?: number
  extraNocturnaDominical?: number
}
export interface PayrollNovedades {
  horas?: NovedadHoras
  bonificacionSalarial?: number
  bonificacionNoSalarial?: number
  comisiones?: number
  otrasDeducciones?: number
  dependientes?: boolean
  deduccionVivienda?: number
  deduccionPrepagada?: number
}

export interface PreviewInput {
  employeeId?: string
  salarioBase?: number
  salaryType?: string
  diasTrabajados?: number
  arlRiskLevel?: string
  novedades?: PayrollNovedades
}

export interface PreviewResult {
  input: {
    employeeId?: string
    employeeName?: string
    salarioBase: number
    salaryType: string
    diasTrabajados: number
    arlRiskLevel?: string
  }
  breakdown: PayrollBreakdown
}

export interface PayrollSlip {
  employeeId: string
  employeeName: string
  docNumber?: string
  positionName?: string
  sedeId?: string
  salarioBase: number
  salaryType: string
  arlRiskLevel?: string
  diasTrabajados: number
  breakdown: PayrollBreakdown
  otrasDeduccionesDetalle?: { concept: string; amount: number }[]
  totalDevengado: number
  totalDeducciones: number
  netoPagar: number
  costoEmpleador: number
}

export interface PayrollTotals {
  devengado: number
  deducciones: number
  neto: number
  aportes: number
  provisiones: number
  costo: number
}

export interface PayrollRun {
  _id: string
  period: string
  label?: string
  sedeId?: string
  coverage: string
  status: string
  slips: PayrollSlip[]
  totals: PayrollTotals
  createdByEmail?: string
  createdAt: string
}

export interface LiquidacionBreakdown {
  diasLiquidados: number
  salarioBase: number
  auxilioTransporte: number
  basePrestacional: number
  cesantias: number
  interesesCesantias: number
  prima: number
  vacaciones: number
  indemnizacion: number
  detalleIndemnizacion?: string
  salariosPendientes: number
  total: number
}

export interface LiquidacionResult {
  input: {
    employeeId?: string
    employeeName?: string
    salarioBase: number
    salaryType: string
    contractType?: string
    fechaInicio: string
    fechaFin: string
    motivo: string
  }
  breakdown: LiquidacionBreakdown
}

export async function computeLiquidacion(payload: {
  employeeId?: string
  salarioBase?: number
  salaryType?: string
  fechaInicio?: string
  fechaFin: string
  contractType?: string
  motivo: string
  salariosPendientes?: number
  diasFaltantesContrato?: number
}): Promise<LiquidacionResult> {
  const res = await authFetch("/payroll/liquidacion", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<LiquidacionResult>(res)
}

export interface NovedadesTurnos {
  diasTrabajados: number
  totalHoras: number
  horas: {
    recargoNocturno: number
    dominical: number
    nocturnoDominical: number
    extraDiurna: number
    extraNocturna: number
    extraDiurnaDominical: number
    extraNocturnaDominical: number
  }
}

export async function novedadesTurnos(
  employeeId: string,
  from: string,
  to: string,
): Promise<NovedadesTurnos> {
  const qs = `employeeId=${encodeURIComponent(employeeId)}&from=${from}&to=${to}`
  const res = await authFetch(`/payroll/novedades-turnos?${qs}`)
  return parseResponse<NovedadesTurnos>(res)
}

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const res = await authFetch("/payroll/settings")
  return parseResponse<PayrollSettings>(res)
}

export async function updatePayrollSettings(
  payload: Partial<PayrollSettings>,
): Promise<PayrollSettings> {
  const res = await authFetch("/payroll/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return parseResponse<PayrollSettings>(res)
}

export async function previewPayroll(
  input: PreviewInput,
): Promise<PreviewResult> {
  const res = await authFetch("/payroll/preview", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return parseResponse<PreviewResult>(res)
}

export async function createPayrollRun(payload: {
  period: string
  coverage?: string
  sedeId?: string
  label?: string
}): Promise<PayrollRun> {
  const res = await authFetch("/payroll/runs", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<PayrollRun>(res)
}

export async function listPayrollRuns(): Promise<PayrollRun[]> {
  const res = await authFetch("/payroll/runs")
  return parseResponse<PayrollRun[]>(res)
}

export async function getPayrollRun(id: string): Promise<PayrollRun> {
  const res = await authFetch(`/payroll/runs/${id}`)
  return parseResponse<PayrollRun>(res)
}

export async function deletePayrollRun(id: string): Promise<void> {
  const res = await authFetch(`/payroll/runs/${id}`, { method: "DELETE" })
  await parseResponse<{ ok: boolean }>(res)
}

export interface SendSlipResult {
  sent: boolean
  simulated?: boolean
  email?: string
  error?: string
  id?: string
}

/** Genera el comprobante (PDF) y lo envía al correo del empleado. */
export async function sendPayrollSlip(
  runId: string,
  employeeId: string,
): Promise<SendSlipResult> {
  const res = await authFetch(
    `/payroll/runs/${runId}/slips/${employeeId}/send`,
    { method: "POST" },
  )
  return parseResponse<SendSlipResult>(res)
}

// ─── Deducciones / consumos de empleado ──────────────────────────────────────

export type DeductionStatus =
  | "pending"
  | "approved"
  | "applied"
  | "rejected"
  | "cancelled"

export const DEDUCTION_STATUS_LABELS: Record<DeductionStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  applied: "Aplicada",
  rejected: "Rechazada",
  cancelled: "Anulada",
}

export interface PayrollDeduction {
  _id: string
  employeeId: string
  employeeName: string
  docNumber?: string
  concept: string
  amount: number
  date: string
  status: DeductionStatus
  source: "sale" | "manual"
  sourceId?: string
  note?: string
  createdByEmail?: string
  approvedByEmail?: string
  appliedPeriod?: string
  createdAt: string
}

export async function listDeductions(query: {
  employeeId?: string
  status?: DeductionStatus
} = {}): Promise<PayrollDeduction[]> {
  const qs = new URLSearchParams()
  if (query.employeeId) qs.set("employeeId", query.employeeId)
  if (query.status) qs.set("status", query.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/payroll/deductions${suffix}`)
  return parseResponse<PayrollDeduction[]>(res)
}

export async function createDeduction(payload: {
  employeeId: string
  concept: string
  amount: number
  date?: string
  note?: string
}): Promise<PayrollDeduction> {
  const res = await authFetch("/payroll/deductions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<PayrollDeduction>(res)
}

export async function approveDeduction(id: string): Promise<PayrollDeduction> {
  const res = await authFetch(`/payroll/deductions/${id}/approve`, {
    method: "POST",
  })
  return parseResponse<PayrollDeduction>(res)
}

export async function rejectDeduction(id: string): Promise<PayrollDeduction> {
  const res = await authFetch(`/payroll/deductions/${id}/reject`, {
    method: "POST",
  })
  return parseResponse<PayrollDeduction>(res)
}
