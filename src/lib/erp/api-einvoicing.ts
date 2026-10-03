/**
 * Cliente HTTP de facturación electrónica (documentos DIAN) para el admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type DocType = "invoice" | "credit_note"
/**
 * Estado ante la DIAN. `draft` son documentos viejos, de antes de conectar con
 * la DIAN. `failed` es un problema de configuración (certificado vencido,
 * conexión sin configurar): se reenvía al arreglarlo.
 */
export type DianStatus = "draft" | "pending" | "accepted" | "rejected" | "failed"

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
  address?: string
}

export interface DocLine {
  code?: string
  description: string
  qty: number
  unitCode: string
  unitPrice: number
  discountAmount: number
  base: number
  taxKind?: "iva" | "inc" | "none"
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
  /** Propina voluntaria: va aparte, sin impuesto. */
  tip?: number
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
  /** Mensaje del último intento, listo para mostrar. */
  dianMessage?: string
  /** Reglas que incumplió (rechazo) o notificaciones de la DIAN. */
  dianErrors?: string[]
  validatedAt?: string
  /** Lo emitido en habilitación no vale fiscalmente. */
  environment?: "habilitacion" | "produccion"
  technicalProvider?: string
  pdfFile?: string
  xmlUrl?: string
  attempts?: number
  /** Próximo reintento automático (si la DIAN no respondió). */
  nextAttemptAt?: string
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

/** Reenvía un documento pendiente, rechazado o fallido, con su mismo número. */
export async function retryDocument(id: string): Promise<ElectronicDocument> {
  const res = await authFetch(`/einvoicing/${id}/retry`, { method: "POST" })
  return parseResponse<ElectronicDocument>(res)
}

/**
 * PDF o XML de un documento aceptado. Va por la API (con el token de sesión),
 * no por enlace directo: el facturador está en una red privada.
 */
export async function downloadDocumentFile(
  id: string,
  kind: "pdf" | "xml",
): Promise<Blob> {
  const res = await authFetch(`/einvoicing/${id}/file/${kind}`)
  if (!res.ok) {
    // Reutiliza el manejo de errores del cliente (mensaje del backend).
    await parseResponse<never>(res)
  }
  return res.blob()
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

// ─── Conexión con la DIAN (habilitación por NIT) ─────────────────────────────

/** Paso en que va la habilitación de un NIT, en orden. */
export type ConnectionStep =
  | "empresa"
  | "certificado"
  | "software"
  | "set_pruebas"
  | "produccion"

/** Conexión de un NIT con el facturador. Nunca trae el token ni el certificado. */
export interface EinvoicingConnection {
  nit: string
  dv?: string
  sedes: { id: string; code: string; name: string }[]
  step: ConnectionStep
  environment: "habilitacion" | "produccion"
  softwareId?: string
  hasTestSet: boolean
  certificateExpiresAt?: string
  /** Por qué falló el último paso, para mostrarlo. */
  lastError?: string
  connected: boolean
}

/** Rango que la DIAN asoció al software (trae la clave técnica). */
export interface NumberingRange {
  resolutionNumber: string
  resolutionDate?: string
  prefix: string
  from: number
  to: number
  dateFrom?: string
  dateTo?: string
  technicalKey?: string
}

export async function listConnections(): Promise<EinvoicingConnection[]> {
  return parseResponse(await authFetch("/einvoicing/connection"))
}

/** Paso 1: crea la empresa en el facturador con los datos fiscales de la sede. */
export async function registerCompany(
  sedeId: string,
): Promise<EinvoicingConnection[]> {
  return parseResponse(
    await authFetch("/einvoicing/connection/company", {
      method: "POST",
      body: JSON.stringify({ sedeId }),
    }),
  )
}

/**
 * Paso 2: certificado digital (.p12/.pfx) en base64 y su clave. Pasa directo
 * al facturador; BookiPos no lo guarda.
 */
export async function uploadCertificate(
  nit: string,
  certificate: string,
  password: string,
): Promise<EinvoicingConnection[]> {
  return parseResponse(
    await authFetch(`/einvoicing/connection/${nit}/certificate`, {
      method: "PUT",
      body: JSON.stringify({ certificate, password }),
    }),
  )
}

/** Paso 3: software propio registrado en el portal de la DIAN. */
export async function configureSoftware(
  nit: string,
  payload: { softwareId: string; pin: string; testSetId?: string },
): Promise<EinvoicingConnection[]> {
  return parseResponse(
    await authFetch(`/einvoicing/connection/${nit}/software`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  )
}

/** Registra en el facturador la resolución de la sede y la de notas crédito. */
export async function syncResolutions(
  sedeId: string,
): Promise<EinvoicingConnection[]> {
  return parseResponse(
    await authFetch(`/einvoicing/connection/resolutions/${sedeId}`, {
      method: "POST",
    }),
  )
}

export async function getNumberingRanges(nit: string): Promise<NumberingRange[]> {
  return parseResponse(
    await authFetch(`/einvoicing/connection/${nit}/numbering-ranges`),
  )
}

export async function setEnvironment(
  nit: string,
  environment: "habilitacion" | "produccion",
): Promise<EinvoicingConnection[]> {
  return parseResponse(
    await authFetch(`/einvoicing/connection/${nit}/environment`, {
      method: "PUT",
      body: JSON.stringify({ environment }),
    }),
  )
}
