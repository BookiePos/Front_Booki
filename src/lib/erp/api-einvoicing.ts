/**
 * Cliente HTTP de facturación electrónica (documentos DIAN) para el admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type DocType = "invoice" | "credit_note"
export type DianStatus = "draft" | "pending" | "accepted" | "rejected"

export interface DocEmisor {
  name?: string
  nit?: string
  nitDv?: string
  tipoPersona?: string
  responsabilidadFiscal?: string
  ciiu?: string
  address?: string
  departamento?: string
  ciudad?: string
  phone?: string
  email?: string
}

export interface DocAdquiriente {
  docType?: string
  docNumber?: string
  name?: string
  phone?: string
  email?: string
}

export interface DocLine {
  code?: string
  description: string
  qty: number
  unitCode: string
  unitPrice: number
  discountAmount: number
  base: number
  ivaRate: number
  ivaAmount: number
  total: number
}

export interface DocResolucion {
  numero?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
}

export interface ElectronicDocument {
  _id: string
  type: DocType
  saleId?: string
  sedeId: string
  prefix?: string
  number: number
  fullNumber: string
  issueDate: string
  issueTime: string
  emisor?: DocEmisor
  adquiriente?: DocAdquiriente
  lines: DocLine[]
  taxableBase: number
  ivaTotal: number
  discountTotal: number
  total: number
  formaPago: string
  medioPago?: string
  resolution?: DocResolucion
  reason?: string
  referenceNumber?: string
  referenceCufe?: string
  cufe?: string
  qrUrl?: string
  signature?: string
  dianStatus: DianStatus
  technicalProvider?: string
  xmlUrl?: string
  createdByEmail: string
  createdAt: string
}

export async function listDocuments(
  sedeId: string,
): Promise<ElectronicDocument[]> {
  const res = await authFetch(
    `/einvoicing?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<ElectronicDocument[]>(res)
}

export async function getDocument(id: string): Promise<ElectronicDocument> {
  const res = await authFetch(`/einvoicing/${id}`)
  return parseResponse<ElectronicDocument>(res)
}

export async function createInvoiceFromSale(
  saleId: string,
): Promise<ElectronicDocument> {
  const res = await authFetch("/einvoicing/from-sale", {
    method: "POST",
    body: JSON.stringify({ saleId }),
  })
  return parseResponse<ElectronicDocument>(res)
}

export async function createCreditNote(
  invoiceId: string,
  reason: string,
): Promise<ElectronicDocument> {
  const res = await authFetch(`/einvoicing/${invoiceId}/credit-note`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  return parseResponse<ElectronicDocument>(res)
}

// ─── Resoluciones de numeración ──────────────────────────────────────────────

/** Del más grave al más tranquilo: así se ordenan las sedes en la pantalla. */
export type EstadoResolucion =
  | "sin_configurar"
  | "incompleta"
  | "vencida"
  | "rango_agotado"
  | "aun_no_vigente"
  | "por_vencer"
  | "rango_bajo"
  | "ok"

export const ESTADO_RESOLUCION_LABELS: Record<EstadoResolucion, string> = {
  sin_configurar: "Sin registrar",
  incompleta: "Incompleta",
  vencida: "Vencida",
  rango_agotado: "Rango agotado",
  aun_no_vigente: "Aún no vigente",
  por_vencer: "Por vencer",
  rango_bajo: "Quedan pocos números",
  ok: "Al día",
}

export interface ResolutionStatus {
  estado: EstadoResolucion
  alertas: string[]
  /** ¿Se puede emitir ahora mismo con esta resolución? */
  puedeEmitir: boolean
  claveTecnicaOk: boolean
  consecutivo: {
    siguiente?: number
    usados: number
    restantes?: number
    total?: number
    /** 0 a 1. */
    consumido?: number
  }
  vigencia: {
    diasRestantes?: number
    vencida: boolean
    aunNoVigente: boolean
  }
}

export interface ResolutionRow {
  sedeId: string
  sedeCode: string
  sedeName: string
  resolucion?: {
    numero?: string
    fechaResolucion?: string
    prefijo?: string
    rangoDesde?: number
    rangoHasta?: number
    vigenciaDesde?: string
    vigenciaHasta?: string
  }
  status: ResolutionStatus
}

export interface RegisterResolutionPayload {
  numero?: string
  fechaResolucion?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
  claveTecnica?: string
  /** Número por el que arranca el consecutivo. */
  empezarEn?: number
}

/** Estado de la resolución de cada sede a la que el usuario tiene acceso. */
export async function listResolutions(): Promise<ResolutionRow[]> {
  const res = await authFetch("/einvoicing/resolutions")
  return parseResponse<ResolutionRow[]>(res)
}

/**
 * Registra o renueva la resolución de una sede.
 *
 * Devuelve el estado actualizado de todas las sedes, no solo la tocada: al
 * anclar el consecutivo cambia lo que queda por emitir, y la pantalla se
 * refresca de una vez.
 */
export async function registerResolution(
  sedeId: string,
  payload: RegisterResolutionPayload,
): Promise<ResolutionRow[]> {
  const res = await authFetch(`/einvoicing/resolutions/${sedeId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ResolutionRow[]>(res)
}
