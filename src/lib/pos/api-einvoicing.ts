/**
 * Cliente HTTP de facturación electrónica (documentos DIAN).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type DocType =
  | "invoice"
  | "pos"
  | "credit_note"
  | "debit_note"
  | "payroll"
  | "payroll_adjustment"
export type DianStatus =
  | "draft"
  | "signed"
  | "sent"
  | "accepted"
  | "rejected"
  | "contingency"

/** Etiqueta en español de cada estado ante la DIAN. */
export const DIAN_STATUS_LABELS: Record<DianStatus, string> = {
  draft: "Borrador",
  signed: "Firmado",
  sent: "Enviado a la DIAN",
  accepted: "Aceptado",
  rejected: "Rechazado",
  contingency: "Contingencia",
}

/** Texto corto para el sello del documento: lo no aceptado dice en qué va. */
export function dianStatusSello(status: DianStatus): string {
  if (status === "accepted") return "Validada DIAN"
  if (status === "draft") return "Sin validar DIAN"
  return `${DIAN_STATUS_LABELS[status]} · sin validar`
}

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
  /** Tributo de la línea: 01 IVA, 04 INC. Ausente: sin tributo (o documento anterior a la Fase 2). */
  taxScheme?: "01" | "04"
  /** Tarifa en %. 01 al 0 % es exento. */
  taxRate?: number
  taxAmount?: number
  /** INC de bolsas (tributo 22), por unidad. */
  perUnitTax?: DocPerUnitTax
  total: number
}

export interface DocPerUnitTax {
  codigo: "22"
  unidades: number
  valorUnitario: number
  valor: number
}

/** Cargo de documento no gravado (la propina). */
export interface DocCharge {
  chargeIndicator: boolean
  reason: string
  amount: number
}

export interface DocResolucion {
  numero?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
}

/** Caja del POS (`InformacionCajaVenta`), congelada al emitir. */
export interface DocCajaVenta {
  placa?: string
  ubicacion?: string
  tipo?: string
  cajero?: string
  codigoVenta?: string
}

/** Fabricante del software (art. 19 num. 9), congelado al emitir. */
export interface DocFabricante {
  nombreApellido?: string
  razonSocial?: string
  nit?: string
  nombreSoftware?: string
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
  /** Campos de la Fase 2: ausentes en documentos anteriores. */
  incTotal?: number
  icaTotal?: number
  bagTaxTotal?: number
  charges?: DocCharge[]
  chargeTotal?: number
  /** Lo que paga el cliente (incluye bolsas, domicilio y propina). */
  payableAmount?: number
  /** Algo que revisar sin bloquear la emisión. */
  aviso?: string
  total: number
  formaPago: string
  medioPago?: string
  resolution?: DocResolucion
  /** Documento equivalente POS (Fase 7). Ausentes en los demás tipos. */
  cajaVenta?: DocCajaVenta
  fabricante?: DocFabricante
  /** '1' producción, '2' habilitación. */
  tipoAmbiente?: string
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

/** Fila de `GET /einvoicing/resolutions`: solo lo que usa la caja. */
interface ResolucionSedeFila {
  sedeId: string
  /** Estado de la resolución de FACTURA (la fila principal). */
  status?: { puedeEmitir?: boolean }
  otras?: {
    tipoDocumento: string
    status?: { puedeEmitir?: boolean }
  }[]
}

/**
 * ¿La sede puede emitir el documento equivalente POS ahora mismo?
 * `null` = no se pudo saber (red, 5xx, permiso): quien llama conserva lo
 * último que supo en vez de apagar el selector a mitad de un cobro.
 *
 * Es la bandera que enciende el selector de las tres salidas en el cobro: un
 * negocio sin resolución POS vigente cobra como siempre (sin `documentoFiscal`)
 * en vez de ver en cada venta un error de la DIAN. Usa el mismo endpoint de
 * /panel/resoluciones (permiso `einvoicing.issue`, que el Cajero ya tiene); si
 * falla por cualquier motivo, se responde `false`: nunca bloquea el cobro.
 *
 * Ojo: no sabe si el emisor tiene el PIN del software (ese endpoint pide
 * `einvoicing.configure`). Sin PIN, el cobro responde `estado: "error"` y la
 * caja lo muestra como aviso del documento, no del cobro.
 */
export async function sedeEmitePos(
  sedeId: string,
): Promise<{ pos: boolean; fev: boolean } | null> {
  try {
    const res = await authFetch("/einvoicing/resolutions")
    const filas = await parseResponse<ResolucionSedeFila[]>(res)
    const fila = filas.find((f) => f.sedeId === sedeId)
    return {
      pos: !!fila?.otras?.some(
        (o) => o.tipoDocumento === "pos" && o.status?.puedeEmitir === true,
      ),
      // Sin resolución de factura vigente, «Quiero factura» fallaría después
      // de cobrar: la caja la ofrece deshabilitada.
      fev: fila?.status?.puedeEmitir === true,
    }
  } catch {
    return null
  }
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
