import { ApiError } from "@/lib/api"
import type {
  DocumentoNomina,
  EstadoDocHabilitacion,
  PrevueloTrabajador,
  ResultadoEmisionPeriodo,
  ResultadoTrabajadorEmision,
} from "@/lib/erp/api-einvoicing"

/** Mes en formato YYYY-MM, como lo exige el backend. */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/
export const esMesValido = (v: string): boolean => MES.test(v)

/** Mes calendario anterior a `hoy` (la nómina se emite vencida), en YYYY-MM. */
export function mesAnterior(hoy: Date = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ── Pre-vuelo ────────────────────────────────────────────────────────────────

export type EstadoPrevuelo = "listo" | "bloqueado" | "ya_emitido"

export const ESTADO_PREVUELO_LABELS: Record<EstadoPrevuelo, string> = {
  listo: "Listo",
  bloqueado: "Bloqueado",
  ya_emitido: "Ya emitido",
}

export function estadoPrevuelo(t: PrevueloTrabajador): EstadoPrevuelo {
  if (t.documentoExistente?.dianStatus === "accepted") return "ya_emitido"
  return t.ok ? "listo" : "bloqueado"
}

export function resumenPrevuelo(ts: PrevueloTrabajador[]): Record<EstadoPrevuelo, number> {
  const r: Record<EstadoPrevuelo, number> = { listo: 0, bloqueado: 0, ya_emitido: 0 }
  for (const t of ts) r[estadoPrevuelo(t)]++
  return r
}

// ── Emisión en bucle con cursor ──────────────────────────────────────────────

/** Tope de seguridad: a 3 por llamada alcanza para ~600 trabajadores. */
export const MAX_LLAMADAS_EMISION = 200

export interface ProgresoEmision {
  llamadas: number
  procesados: number
  pendientes: number | null
}

export interface ResultadoBucle {
  resultados: ResultadoTrabajadorEmision[]
  /** Se detuvo porque el usuario canceló (lo ya emitido se conserva). */
  cancelado: boolean
  /** Se agotó el cursor: no quedan trabajadores. */
  completo: boolean
  error?: string
}

/**
 * Llama a `emitir` repitiendo con `siguienteCursor` hasta que no haya más.
 * Cancelar corta ANTES de la siguiente llamada (la que ya salió a la DIAN no
 * se puede abortar). Un error corta el bucle y conserva lo emitido: reintentar
 * es seguro porque el backend es idempotente.
 */
export async function emitirEnBucle(opciones: {
  emitir: (cursor?: string) => Promise<ResultadoEmisionPeriodo>
  signal?: { aborted: boolean }
  onProgreso?: (p: ProgresoEmision) => void
  maxLlamadas?: number
}): Promise<ResultadoBucle> {
  const { emitir, signal, onProgreso, maxLlamadas = MAX_LLAMADAS_EMISION } = opciones
  const resultados: ResultadoTrabajadorEmision[] = []
  let cursor: string | undefined
  let llamadas = 0
  while (true) {
    if (signal?.aborted) return { resultados, cancelado: true, completo: false }
    if (llamadas >= maxLlamadas) {
      return {
        resultados,
        cancelado: false,
        completo: false,
        error: "Se alcanzó el máximo de llamadas; vuelve a emitir para continuar.",
      }
    }
    let r: ResultadoEmisionPeriodo
    try {
      r = await emitir(cursor)
    } catch (e) {
      return { resultados, cancelado: false, completo: false, error: mensajeErrorNominaPeriodo(e) }
    }
    llamadas++
    resultados.push(...r.resultados)
    onProgreso?.({ llamadas, procesados: resultados.length, pendientes: r.pendientes })
    if (!r.siguienteCursor) return { resultados, cancelado: false, completo: true }
    if (r.siguienteCursor === cursor) {
      return {
        resultados,
        cancelado: false,
        completo: false,
        error: "El servidor devolvió el mismo cursor; se detuvo para no repetir en bucle.",
      }
    }
    cursor = r.siguienteCursor
  }
}

export type TonoResultado = "ok" | "aviso" | "error"

export const ESTADO_EMISION_LABELS: Record<ResultadoTrabajadorEmision["estado"], string> = {
  emitido: "Emitido",
  existente: "Ya estaba aceptado",
  en_curso: "En curso",
  bloqueado: "Bloqueado",
  error: "Error",
}

export function tonoEmision(estado: ResultadoTrabajadorEmision["estado"]): TonoResultado {
  if (estado === "emitido" || estado === "existente") return "ok"
  if (estado === "en_curso") return "aviso"
  return "error"
}

export function resumenEmision(
  rs: ResultadoTrabajadorEmision[],
): Record<ResultadoTrabajadorEmision["estado"], number> {
  const r = { emitido: 0, existente: 0, en_curso: 0, bloqueado: 0, error: 0 }
  for (const x of rs) r[x.estado]++
  return r
}

// ── Documentos del mes ───────────────────────────────────────────────────────

export type TonoDian = "ok" | "aviso" | "error" | "neutro"

export const DIAN_ESTADO_NOMINA_LABELS: Record<string, string> = {
  draft: "Borrador",
  signed: "Firmado, sin enviar",
  sent: "Enviado, en revisión",
  accepted: "Aceptado",
  rejected: "Rechazado",
  contingency: "Pendiente de envío",
}

export const etiquetaDian = (s: string): string => DIAN_ESTADO_NOMINA_LABELS[s] ?? s

export function tonoDian(s: string): TonoDian {
  if (s === "accepted") return "ok"
  if (s === "rejected") return "error"
  if (s === "sent" || s === "signed" || s === "contingency") return "aviso"
  return "neutro"
}

/** Documento vigente (no eliminado ni reemplazado por una nota de ajuste). */
const esVigente = (d: DocumentoNomina) => d.vigente && !d.superado

/** Reintentar envío: lo firmado, en vuelo o rechazado que sigue vigente. */
export function puedeReintentar(d: DocumentoNomina): boolean {
  return esVigente(d) && (d.dianStatus === "signed" || d.dianStatus === "sent" || d.dianStatus === "rejected")
}

/** Consultar estado: tiene sentido mientras la DIAN no resolvió. */
export function puedeConsultar(d: DocumentoNomina): boolean {
  return esVigente(d) && (d.dianStatus === "sent" || d.dianStatus === "signed")
}

/** Corregir o eliminar: solo sobre un aceptado vigente. */
export function puedeAjustar(d: DocumentoNomina): boolean {
  return esVigente(d) && d.dianStatus === "accepted"
}

export function etiquetaTipoDocumento(d: DocumentoNomina): string {
  if (d.tipoXml === "102") return "Nómina individual"
  return d.tipoNota === 2 ? "Ajuste: eliminación" : "Ajuste: reemplazo"
}

// ── Habilitación ─────────────────────────────────────────────────────────────

export const ESTADO_DOC_HABILITACION_LABELS: Record<EstadoDocHabilitacion, string> = {
  pendiente: "Pendiente",
  enviando: "Enviando",
  enviado: "Enviado, en revisión",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
}

// ── Errores ──────────────────────────────────────────────────────────────────

/**
 * El backend explica sus 409/400 en español (identidad cambiada, ambiente,
 * TestSetId faltante…): se muestra tal cual. Solo se traduce el 403.
 */
export function mensajeErrorNominaPeriodo(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "No tienes permiso para esta acción de nómina electrónica."
    return err.message || `Error ${err.status}`
  }
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

// ── Guardas de concurrencia ──────────────────────────────────────────────────

/**
 * Id de petición: solo la última petición lanzada es "vigente". Las respuestas
 * tardías de un mes o sede anteriores se descartan con `esVigente(id)`.
 */
export function crearGuardaPeticion() {
  let actual = 0
  return {
    nueva: (): number => ++actual,
    esVigente: (id: number): boolean => id === actual,
    invalidar: (): void => {
      actual++
    },
  }
}

/** Candado síncrono (sobrevive entre renders, a diferencia de un estado): evita dobles clics. */
export function crearCandado() {
  let tomado = false
  return {
    tomar: (): boolean => {
      if (tomado) return false
      tomado = true
      return true
    },
    soltar: (): void => {
      tomado = false
    },
    get tomado(): boolean {
      return tomado
    },
  }
}

export const claveRevision = (sedeId: string, periodo: string): string => `${sedeId}|${periodo}`
