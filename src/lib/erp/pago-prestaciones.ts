/**
 * Pago de prima, cesantías e intereses sobre cesantías (decisión 2, Fase 8 de
 * nómina electrónica): cliente HTTP y las reglas puras del formulario.
 *
 * La nómina de cada mes solo PROVISIONA estas prestaciones. Este registro es
 * el pago: baja la provisión en la contabilidad y la nómina electrónica lo
 * reporta en el mes en que se pagó. El backend valida todo otra vez; lo de
 * aquí es para proponer fechas y no dejar enviar un formulario incompleto.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export const TIPOS_PRESTACION = [
  { value: "prima", label: "Prima de servicios" },
  { value: "cesantias", label: "Cesantías" },
  { value: "intereses_cesantias", label: "Intereses sobre cesantías" },
] as const
export type TipoPrestacion = (typeof TIPOS_PRESTACION)[number]["value"]

export const DESTINOS_CESANTIAS = [
  { value: "fondo", label: "Consignadas al fondo" },
  { value: "trabajador", label: "Entregadas al trabajador" },
] as const

export interface PagoPrestacion {
  _id: string
  employeeId: string
  employeeName?: string
  tipo: TipoPrestacion
  /** Pesos enteros, antes de la retención. */
  monto: number
  retencionFuente: number
  periodoDesde: string
  periodoHasta: string
  dias: number
  pago: { medio: string; fecha: string }
  destino?: "fondo" | "trabajador"
  fondo?: string
  observacion?: string
  estado: "registrado" | "anulado"
  registradoPor?: string
  anuladoPor?: string
  motivoAnulacion?: string
}

export type PagoPrestacionRespuesta = PagoPrestacion & { advertencias: string[] }

export interface PagoPrestacionPayload {
  employeeId: string
  tipo: TipoPrestacion
  monto: number
  retencionFuente?: number
  periodoDesde: string
  periodoHasta: string
  medioPago: string
  fechaPago: string
  destino?: string
  fondo?: string
  observacion?: string
}

export async function registrarPagoPrestacion(payload: PagoPrestacionPayload): Promise<PagoPrestacionRespuesta> {
  const res = await authFetch("/payroll/prestaciones", { method: "POST", body: JSON.stringify(payload) })
  return parseResponse<PagoPrestacionRespuesta>(res)
}

/** Pagos cuya fecha de pago cae en `anio` (YYYY), con los anulados. */
export async function listarPagosPrestaciones(anio: string): Promise<PagoPrestacion[]> {
  const res = await authFetch(`/payroll/prestaciones?anio=${encodeURIComponent(anio)}&anulados=1`)
  return parseResponse<PagoPrestacion[]>(res)
}

export async function anularPagoPrestacion(id: string, motivo?: string): Promise<PagoPrestacionRespuesta> {
  const res = await authFetch(`/payroll/prestaciones/${id}/anular`, {
    method: "POST",
    body: JSON.stringify(motivo?.trim() ? { motivo: motivo.trim() } : {}),
  })
  return parseResponse<PagoPrestacionRespuesta>(res)
}

// ── Reglas puras del formulario ──────────────────────────────────────────────

/**
 * Tramo que se propone al elegir la prestación, según la fecha de hoy (YYYY-MM-DD):
 * - Prima: el semestre en curso; en enero y en julio, el que acaba de cerrar
 *   (quien registra en esos meses suele estar anotando la prima recién pagada).
 * - Cesantías e intereses: el año anterior (se pagan en enero y febrero).
 */
export function periodoSugerido(tipo: TipoPrestacion, hoy: string): { desde: string; hasta: string } {
  const anio = Number(hoy.slice(0, 4))
  const mes = Number(hoy.slice(5, 7))
  if (tipo !== "prima") return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` }
  if (mes === 1) return { desde: `${anio - 1}-07-01`, hasta: `${anio - 1}-12-31` }
  if (mes <= 6) return { desde: `${anio}-01-01`, hasta: `${anio}-06-30` }
  if (mes === 7) return { desde: `${anio}-01-01`, hasta: `${anio}-06-30` }
  return { desde: `${anio}-07-01`, hasta: `${anio}-12-31` }
}

/** Pesos enteros desde lo tecleado; `null` si no es un entero no negativo. Vacío es `null`. */
export function pesosEnteros(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isSafeInteger(n) ? n : null
}

export interface FormularioPrestacion {
  employeeId: string
  tipo: TipoPrestacion
  desde: string
  hasta: string
  monto: string
  retencion: string
  medioPago: string
  fechaPago: string
  destino: string
  fondo: string
  observacion: string
}

/** Qué le falta al formulario para poder enviarse; `null` si está listo. */
export function faltaEnFormulario(f: FormularioPrestacion): string | null {
  if (!f.employeeId) return "Elige el empleado."
  if (!f.desde || !f.hasta) return "Indica el periodo que cubre el pago."
  if (f.desde > f.hasta) return "El periodo termina antes de empezar."
  const monto = pesosEnteros(f.monto)
  if (monto === null || monto <= 0) return "Escribe el monto pagado en pesos, sin puntos ni decimales."
  if (f.tipo === "prima" && f.retencion.trim() !== "") {
    const ret = pesosEnteros(f.retencion)
    if (ret === null) return "La retención va en pesos, sin puntos ni decimales."
    if (ret >= monto) return "La retención no puede igualar ni superar el monto pagado."
  }
  if (!f.medioPago) return "Elige el medio de pago."
  if (!f.fechaPago) return "Indica la fecha real del pago."
  return null
}

/** El cuerpo que se envía: solo los campos que aplican a la prestación elegida. */
export function payloadDeFormulario(f: FormularioPrestacion): PagoPrestacionPayload {
  const retencion = f.tipo === "prima" ? (pesosEnteros(f.retencion) ?? 0) : 0
  return {
    employeeId: f.employeeId,
    tipo: f.tipo,
    monto: pesosEnteros(f.monto) ?? 0,
    ...(retencion > 0 ? { retencionFuente: retencion } : {}),
    periodoDesde: f.desde,
    periodoHasta: f.hasta,
    medioPago: f.medioPago,
    fechaPago: f.fechaPago,
    ...(f.tipo === "cesantias" ? { destino: f.destino || "fondo" } : {}),
    ...(f.tipo === "cesantias" && f.fondo.trim() ? { fondo: f.fondo.trim() } : {}),
    ...(f.observacion.trim() ? { observacion: f.observacion.trim() } : {}),
  }
}
