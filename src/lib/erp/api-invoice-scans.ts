/**
 * Cliente HTTP de las facturas de compra cargadas por foto.
 *
 * El flujo tiene tres momentos y por eso hay tres llamadas: subir la imagen,
 * leerla con el modelo y —tras revisarla— aplicarla. Están separadas a
 * propósito: leer puede fallar y se reintenta sin volver a subir, y aplicar
 * solo ocurre cuando una persona lo aprueba.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type InvoiceScanStatus =
  | "uploaded"
  | "extracted"
  | "applied"
  | "discarded"
  | "failed"

export const SCAN_STATUS_LABELS: Record<InvoiceScanStatus, string> = {
  uploaded: "Sin leer",
  extracted: "Por revisar",
  applied: "Aplicada",
  discarded: "Descartada",
  failed: "Falló la lectura",
}

/** Destino de un renglón de la factura. */
export type LineTarget = "inventory" | "expense" | "ignore"

export const LINE_TARGET_LABELS: Record<LineTarget, string> = {
  inventory: "A inventario",
  expense: "A gasto",
  ignore: "Omitir",
}

export interface ScanPage {
  imageUrl: string
  imagePathname: string
  model?: string
  extractedAt?: string
}

export interface ExtractedLine {
  description: string
  qty?: number
  unit?: string
  unitCost?: number
  discount?: number
  ivaRate?: number
  lineTotal?: number
  code?: string
  barcode?: string
}

export interface ExtractedInvoice {
  supplier: {
    name?: string
    docNumber?: string
    docType?: "NIT" | "CC" | "CE"
    phone?: string
    address?: string
    city?: string
  }
  invoice: {
    number?: string
    issueDate?: string
    dueDate?: string
    paymentTerms?: "contado" | "credito"
  }
  lines: ExtractedLine[]
  totals: {
    subtotal?: number
    iva?: number
    retentions?: number
    total?: number
  }
}

/**
 * Ficha del producto que hay que crear porque el inventario no lo tiene.
 *
 * Lo que la factura sabe viene prellenado; lo que no —precio de venta,
 * categoría— se pide en la revisión. El SKU es obligatorio: antes se generaba
 * uno automático que quedaba para siempre en el catálogo.
 */
export interface NewProductDraft {
  sku?: string
  name?: string
  unit?: string
  categoryId?: string | null
  cost?: number
  /** Sin precio de venta el producto entra al inventario pero no al POS. */
  salePrice?: number
  barcode?: string
  minStock?: number
}

export interface LineDecision {
  lineIndex: number
  target: LineTarget
  productId?: string | null
  createProduct?: boolean
  categoryId?: string | null
  /** Datos del producto a crear (solo si `createProduct`). */
  newProduct?: NewProductDraft
  /** Cómo se emparejó: alias | barcode | sku | name | manual | none. */
  matchedBy?: string
}

export interface ScanHistoryEntry {
  at: string
  userEmail?: string
  action: string
  detail?: string
}

export interface InvoiceScan {
  _id: string
  pages: ScanPage[]
  status: InvoiceScanStatus
  draft?: ExtractedInvoice
  supplierDocNumber?: string
  invoiceNumber?: string
  supplierId?: string | null
  supplierMatch: string
  sedeId?: string | null
  lineDecisions: LineDecision[]
  appliedTo: {
    supplierId?: string
    purchaseOrderId?: string
    expenseIds: string[]
    createdProductIds: string[]
  }
  history: ScanHistoryEntry[]
  error?: string
  createdByEmail: string
  createdAt: string
}

export interface UpdateInvoiceScanPayload {
  draft?: ExtractedInvoice
  supplierId?: string | null
  sedeId?: string | null
  lineDecisions?: LineDecision[]
}

export async function listInvoiceScans(
  status?: InvoiceScanStatus,
): Promise<InvoiceScan[]> {
  const res = await authFetch(
    `/invoice-scans${status ? `?status=${status}` : ""}`,
  )
  return parseResponse<InvoiceScan[]>(res)
}

export async function getInvoiceScan(id: string): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}`)
  return parseResponse<InvoiceScan>(res)
}

/**
 * Sube UNA foto. Varias imágenes son varias llamadas: el cuerpo máximo de una
 * función de Vercel es 4.5 MB, así que mandarlas juntas sería pedirle al
 * servidor que las rechace.
 *
 * No se fija `Content-Type`: con FormData lo pone el navegador con su boundary
 * (ver `applyContentType` en api-admin).
 */
export async function uploadInvoiceScan(
  file: File | Blob,
  /**
   * Texto del PDF, si la página lo traía. Su presencia hace que el backend lea
   * la factura SIN OCR: más exacto en los precios, más barato y más rápido.
   */
  text?: string,
): Promise<InvoiceScan> {
  const body = new FormData()
  body.append("file", file)
  if (text) body.append("text", text)
  const res = await authFetch("/invoice-scans", { method: "POST", body })
  return parseResponse<InvoiceScan>(res)
}

/** Lee la factura con el modelo. Puede tardar; se reintenta si falla. */
export async function extractInvoiceScan(id: string): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}/extract`, { method: "POST" })
  return parseResponse<InvoiceScan>(res)
}

export async function updateInvoiceScan(
  id: string,
  payload: UpdateInvoiceScanPayload,
): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<InvoiceScan>(res)
}

/** Une otra factura a esta como página adicional. */
export async function mergeInvoiceScans(
  id: string,
  sourceId: string,
): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}/merge`, {
    method: "POST",
    body: JSON.stringify({ sourceId }),
  })
  return parseResponse<InvoiceScan>(res)
}

/** Separa una página en una factura aparte. */
export async function splitInvoiceScan(
  id: string,
  pageIndex: number,
): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}/split`, {
    method: "POST",
    body: JSON.stringify({ pageIndex }),
  })
  return parseResponse<InvoiceScan>(res)
}

/** Aplica la factura: inventario, gastos, cuenta por pagar y proveedor. */
export async function applyInvoiceScan(id: string): Promise<InvoiceScan> {
  const res = await authFetch(`/invoice-scans/${id}/apply`, { method: "POST" })
  return parseResponse<InvoiceScan>(res)
}

export async function discardInvoiceScan(
  id: string,
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/invoice-scans/${id}`, { method: "DELETE" })
  return parseResponse<{ ok: boolean }>(res)
}
