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
