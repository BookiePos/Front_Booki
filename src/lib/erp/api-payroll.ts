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
  /** La empresa ya respondió si está exonerada (ítem 1.15). */
  exoneracionConfirmada?: boolean
  /** Semana de 5 o 6 días laborables: decide el domingo remunerado (ítem 1.19). */
  diasLaborablesSemana?: number
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
    /** Vacaciones disfrutadas, incapacidades y licencias remuneradas del mes. */
    ausencias?: number
    ausenciaDetalle?: AusenciaLinea[]
    total: number
  }
  ibc: number
  deducciones: {
    salud: number
    pension: number
    fsp: number
    retencionFuente: number
    /** 4 % de pensión de la licencia no remunerada, a cargo del trabajador. */
    pensionLicenciaNR?: number
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
  otrasDeduccionesDetalle?: { concept: string; amount: number; source?: "arrastre" }[]
  /** Avisos para revisar, p. ej. tope de horas extra (ítem 1.19). */
  alertas?: string[]
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
  /** Fecha de cierre (si status === "cerrada"). */
  closedAt?: string
  /** Medio (código DIAN) y fecha real del pago; sin ellos no sale la nómina electrónica del mes. */
  pago?: PagoNomina
}

/** Medios con que se paga una nómina (tabla 5.3.3.2 de la DIAN). */
export const MEDIOS_PAGO_NOMINA = [
  { value: "10", label: "Efectivo" },
  { value: "47", label: "Transferencia" },
  { value: "42", label: "Consignación" },
  { value: "20", label: "Cheque" },
] as const

export interface PagoNomina {
  medio: string
  /** YYYY-MM-DD */
  fecha: string
  declaradoPor?: string
  declaradoEn?: string
}

export interface LiquidacionBreakdown {
  diasLiquidados: number
  diasPrima?: number
  /** Cesantías e intereses: solo desde max(ingreso, 1-ene del año del retiro), o lo que se indique. */
  inicioCesantias?: string
  diasCesantias?: number
  /** Días hábiles de vacaciones: causados, ya disfrutados y pendientes (los que se pagan). */
  diasVacacionesCausados?: number
  vacacionesDisfrutadasDias?: number
  diasVacacionesPendientes?: number
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
  /** Ingreso mensual promedio con que se midió la exención y la retención. Ausente en liquidaciones viejas. */
  ingresoMensualPromedio?: number
  /** Parte exenta de cesantías e intereses (0 a 1, ET 206-4). */
  porcentajeExentoCesantias?: number
  /** Retención en la fuente de la indemnización (ET 401-3). Ausente en liquidaciones guardadas antes de calcularla. */
  retencionFuente?: number
  detalleRetencion?: string
  /** Lo que se le paga: `total` menos la retención. */
  netoPagar?: number
}

/** Neto a pagar de una liquidación; en las viejas (sin el campo) es el total. */
export function netoLiquidacion(b: Pick<LiquidacionBreakdown, "total" | "netoPagar">): number {
  return b.netoPagar ?? b.total
}

/** True si la liquidación trae la retención calculada (las viejas no). */
export function tieneRetencion(b: Pick<LiquidacionBreakdown, "retencionFuente">): boolean {
  return b.retencionFuente !== undefined
}

/** Liquidación de retiro guardada (decisión 4 del dueño): la aprobada es la que reporta la nómina electrónica. */
export interface PayrollLiquidacion {
  _id: string
  employeeId: string
  employeeName?: string
  fechaInicio: string
  fechaRetiro: string
  motivo: string
  breakdown: LiquidacionBreakdown
  estado: "borrador" | "aprobada" | "anulada"
  pago?: { medio: string; fecha: string }
  aprobadaPor?: string
  createdAt: string
}

type LiquidacionPayload = Parameters<typeof computeLiquidacion>[0]

/** Calcula y guarda la liquidación como borrador (sin salarios pendientes: el último sueldo va en la nómina del mes). */
export async function guardarLiquidacion(payload: LiquidacionPayload): Promise<PayrollLiquidacion> {
  const res = await authFetch("/payroll/liquidaciones", { method: "POST", body: JSON.stringify(payload) })
  return parseResponse<PayrollLiquidacion>(res)
}

export async function listarLiquidaciones(employeeId?: string): Promise<PayrollLiquidacion[]> {
  const q = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""
  const res = await authFetch(`/payroll/liquidaciones${q}`)
  return parseResponse<PayrollLiquidacion[]>(res)
}

export async function aprobarLiquidacion(
  id: string,
  pago: { medioPago: string; fechaPago: string },
): Promise<PayrollLiquidacion & { advertencias: string[] }> {
  const res = await authFetch(`/payroll/liquidaciones/${id}/aprobar`, { method: "POST", body: JSON.stringify(pago) })
  return parseResponse<PayrollLiquidacion & { advertencias: string[] }>(res)
}

/** Anula; no deshace el retiro del expediente (la respuesta lo avisa). */
export async function anularLiquidacion(id: string): Promise<PayrollLiquidacion & { advertencias: string[] }> {
  const res = await authFetch(`/payroll/liquidaciones/${id}/anular`, { method: "POST" })
  return parseResponse<PayrollLiquidacion & { advertencias: string[] }>(res)
}

/** Novedades de ausencia (decisión 3 del dueño). */
export const TIPOS_NOVEDAD = [
  { value: "vacaciones", label: "Vacaciones disfrutadas" },
  { value: "incapacidad_comun", label: "Incapacidad común (EPS)" },
  { value: "incapacidad_laboral", label: "Incapacidad por accidente de trabajo (ARL)" },
  { value: "incapacidad_profesional", label: "Incapacidad por enfermedad profesional (ARL)" },
  { value: "licencia_maternidad", label: "Licencia de maternidad" },
  { value: "licencia_paternidad", label: "Licencia de paternidad" },
  { value: "licencia_remunerada", label: "Licencia remunerada" },
  { value: "licencia_no_remunerada", label: "Licencia no remunerada" },
] as const

export const PAGADOR_NOVEDAD: Record<string, string> = {
  empleador: "empleador",
  eps: "EPS",
  arl: "ARL",
  fondo_pensiones: "fondo de pensiones",
  ninguno: "sin pago",
}

export interface AusenciaLinea {
  tipo: string
  fechaInicio: string
  fechaFin: string
  dias: number
  valor: number
  pagador: string
  diasPorPagador?: Record<string, number>
}

export interface PayrollNovedad {
  _id: string
  employeeId: string
  employeeName?: string
  tipo: string
  fechaInicio: string
  fechaFin: string
  diasPreviosProrroga?: number
  diasHabiles?: number
  salarioPromedio?: number
  observacion?: string
  estado: "activa" | "anulada"
}

/** Respuesta de crear o anular: avisos y corridas en borrador que se recalcularon. */
export type NovedadRespuesta = PayrollNovedad & { advertencias: string[]; corridasRecalculadas: string[] }

export async function crearNovedad(payload: {
  employeeId: string
  tipo: string
  fechaInicio: string
  fechaFin: string
  diasPreviosProrroga?: number
  diasHabiles?: number
  salarioPromedio?: number
  observacion?: string
}): Promise<NovedadRespuesta> {
  const res = await authFetch("/payroll/novedades", { method: "POST", body: JSON.stringify(payload) })
  return parseResponse<NovedadRespuesta>(res)
}

export async function listarNovedades(periodo: string): Promise<PayrollNovedad[]> {
  const res = await authFetch(`/payroll/novedades?periodo=${encodeURIComponent(periodo)}`)
  return parseResponse<PayrollNovedad[]>(res)
}

export async function anularNovedad(id: string): Promise<NovedadRespuesta> {
  const res = await authFetch(`/payroll/novedades/${id}/anular`, { method: "POST" })
  return parseResponse<NovedadRespuesta>(res)
}

export interface LiquidacionResult {
  /** Días de vacaciones disfrutados según las novedades registradas (para precargar). */
  sugerencias?: { vacacionesDisfrutadasDias: number }
  /** Avisos que no bloquean (p. ej. devengos variables, art. 253 CST). */
  advertencias?: string[]
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
  inicioCesantias?: string
  vacacionesDisfrutadasDias?: number
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

/**
 * Lo que se puede mandar a `PUT /payroll/settings`. `confirmarExoneracion` no
 * es un ajuste: es la respuesta explícita a la pregunta de la exoneración de
 * aportes (ítem 1.15), y solo con ella el backend la da por confirmada.
 */
export type PayrollSettingsUpdate = Partial<PayrollSettings> & {
  confirmarExoneracion?: boolean
}

/** Respuesta a la pregunta de la exoneración (`PreguntaExoneracion`). */
export function respuestaExoneracion(exonerada: boolean): PayrollSettingsUpdate {
  return { empresaExoneradaAportes: exonerada, confirmarExoneracion: true }
}

/**
 * El formulario de Ajustes solo manda la exoneración si el usuario la cambió:
 * reenviarla igual en cada guardado la tocaba sin que nadie la respondiera.
 */
export function exoneracionSiCambio(
  original: boolean,
  actual: boolean,
): Pick<PayrollSettingsUpdate, "empresaExoneradaAportes"> {
  return original === actual ? {} : { empresaExoneradaAportes: actual }
}

export async function updatePayrollSettings(
  payload: PayrollSettingsUpdate,
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

/**
 * Recalcula una corrida en borrador: vuelve a jalar los consumos aprobados y
 * actualiza colillas y totales (útil si se aprobó un consumo después de
 * generarla).
 */
export async function recalcPayrollRun(id: string): Promise<PayrollRun> {
  const res = await authFetch(`/payroll/runs/${id}/recalc`, { method: "POST" })
  return parseResponse<PayrollRun>(res)
}

/**
 * Cierra una corrida (borrador → cerrada); queda fija en el historial. El
 * medio y la fecha real del pago van juntos o no van (se pueden declarar
 * después con `declararPagoNomina`).
 */
export async function closePayrollRun(
  id: string,
  pago?: { medioPago: string; fechaPago: string },
): Promise<PayrollRun> {
  const res = await authFetch(`/payroll/runs/${id}/close`, {
    method: "POST",
    body: JSON.stringify(pago ?? {}),
  })
  return parseResponse<PayrollRun>(res)
}

/** Declara (o corrige) el medio y la fecha real del pago de una corrida cerrada. */
export async function declararPagoNomina(
  id: string,
  pago: { medioPago: string; fechaPago: string },
): Promise<PayrollRun> {
  const res = await authFetch(`/payroll/runs/${id}/pago`, {
    method: "PUT",
    body: JSON.stringify(pago),
  })
  return parseResponse<PayrollRun>(res)
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
  /** "arrastre": saldo a cargo de una nómina anterior con neto negativo (lo crea el cierre). */
  source: "sale" | "manual" | "arrastre"
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
