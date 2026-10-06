/**
 * Cliente HTTP de facturación electrónica (documentos DIAN).
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
