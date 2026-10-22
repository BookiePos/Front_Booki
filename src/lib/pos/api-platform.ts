/**
 * Pedidos de plataformas de domicilio (Rappi, DiDi Food, Uber Eats): registro,
 * importación del CSV del portal, saldo por cobrar y liquidación.
 *
 * No hay integración por API (las plataformas exigen convenio de partner): los
 * pedidos se registran en el POS y la plataforma queda como cuenta por cobrar
 * hasta que consigna.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { Sale } from "@/lib/pos/api-sales"

export type PlatformCode = "rappi" | "didi" | "uber_eats" | "otra"

export const PLATFORM_CODES: PlatformCode[] = ["rappi", "didi", "uber_eats", "otra"]

export const PLATFORM_LABELS: Record<PlatformCode, string> = {
  rappi: "Rappi",
  didi: "DiDi Food",
  uber_eats: "Uber Eats",
  otra: "Otra plataforma",
}

/** Registro manual: es una venta normal con el medio `platform` y el dato `platform`. */
export interface PlatformOrderInput {
  sedeId: string
  platform: PlatformCode
  externalId: string
  lines: { productId: string; qty: number }[]
  /** Comisión estimada del portal (la real se anota al liquidar). */
  commissionEstimate?: number
}

export async function createPlatformOrder(input: PlatformOrderInput): Promise<Sale> {
  const res = await authFetch("/sales", {
    method: "POST",
    body: JSON.stringify({
      sedeId: input.sedeId,
      lines: input.lines,
      payment: { method: "platform" },
      orderType: "llevar",
      platform: {
        code: input.platform,
        externalId: input.externalId.trim(),
        ...(input.commissionEstimate ? { commissionEstimate: input.commissionEstimate } : {}),
      },
    }),
  })
  return parseResponse<Sale>(res)
}

// ─── Importación ─────────────────────────────────────────────────────────────

export type PreviewStatus = "ok" | "duplicado" | "error"

export interface PreviewLine {
  line: number
  name?: string
  sku?: string
  qty: number
  productName?: string
  unitPrice?: number
  error?: string
}

export interface PreviewOrder {
  externalId: string
  orderedAt?: string
  status: PreviewStatus
  saleNumber?: string
  total: number
  reportedTotal?: number
  commissionEstimate?: number
  lines: PreviewLine[]
  errors: string[]
  warnings: string[]
}

export interface PreviewResult {
  platform: PlatformCode
  orders: PreviewOrder[]
  fileErrors: { line: number; message: string }[]
  summary: { ok: number; duplicado: number; error: number }
}

export interface ImportResult {
  platform: PlatformCode
  fileErrors: { line: number; message: string }[]
  results: {
    externalId: string
    status: "creado" | "duplicado" | "error"
    saleNumber?: string
    message?: string
  }[]
  summary: { creado: number; duplicado: number; error: number }
}

async function postCsv<T>(path: string, sedeId: string, platform: PlatformCode, csv: string) {
  const res = await authFetch(path, {
    method: "POST",
    body: JSON.stringify({ sedeId, platform, csv }),
  })
  return parseResponse<T>(res)
}

export const previewPlatformImport = (sedeId: string, platform: PlatformCode, csv: string) =>
  postCsv<PreviewResult>("/platform-orders/import/preview", sedeId, platform, csv)

export const importPlatformOrders = (sedeId: string, platform: PlatformCode, csv: string) =>
  postCsv<ImportResult>("/platform-orders/import", sedeId, platform, csv)

// ─── Saldo, pedidos y liquidación ────────────────────────────────────────────

export interface PlatformSummaryRow {
  platform: PlatformCode
  label: string
  orders: number
  sales: number
  commissionEstimate: number
  pendingOrders: number
  /** Lo que la plataforma le debe hoy al negocio. */
  pendingAmount: number
  settlements: number
  received: number
  commission: number
  commissionIva: number
}

export interface PlatformSummary {
  rows: PlatformSummaryRow[]
  totals: { sales: number; pendingAmount: number; commission: number }
}

export async function getPlatformSummary(params: {
  sedeId: string
  from?: string
  to?: string
}): Promise<PlatformSummary> {
  const qs = new URLSearchParams({ sedeId: params.sedeId })
  if (params.from) qs.set("from", params.from)
  if (params.to) qs.set("to", params.to)
  const res = await authFetch(`/platform-orders/summary?${qs.toString()}`)
  return parseResponse<PlatformSummary>(res)
}

export interface PlatformOrderRow {
  id: string
  saleNumber: string
  platform: PlatformCode
  externalId: string
  orderedAt?: string
  commissionEstimate: number
  amount: number
  settled: boolean
}

export async function listPlatformOrders(params: {
  sedeId: string
  platform?: PlatformCode
  pending?: boolean
}): Promise<PlatformOrderRow[]> {
  const qs = new URLSearchParams({ sedeId: params.sedeId })
  if (params.platform) qs.set("platform", params.platform)
  if (params.pending) qs.set("pending", "true")
  const res = await authFetch(`/platform-orders?${qs.toString()}`)
  return parseResponse<PlatformOrderRow[]>(res)
}

export interface PlatformSettlement {
  _id: string
  platform: PlatformCode
  gross: number
  received: number
  commission: number
  commissionIva: number
  date: string
  note?: string
  status: "active" | "void"
  saleIds: string[]
}

export async function listPlatformSettlements(params: {
  sedeId: string
  platform?: PlatformCode
}): Promise<PlatformSettlement[]> {
  const qs = new URLSearchParams({ sedeId: params.sedeId })
  if (params.platform) qs.set("platform", params.platform)
  const res = await authFetch(`/platform-orders/settlements?${qs.toString()}`)
  return parseResponse<PlatformSettlement[]>(res)
}

export interface SettlementInput {
  sedeId: string
  platform: PlatformCode
  saleIds: string[]
  received: number
  commission: number
  commissionIva?: number
  date?: string
  note?: string
}

export async function createPlatformSettlement(input: SettlementInput): Promise<PlatformSettlement> {
  const res = await authFetch("/platform-orders/settlements", {
    method: "POST",
    body: JSON.stringify(input),
  })
  return parseResponse<PlatformSettlement>(res)
}

export async function voidPlatformSettlement(id: string): Promise<PlatformSettlement> {
  const res = await authFetch(`/platform-orders/settlements/${id}/void`, { method: "POST" })
  return parseResponse<PlatformSettlement>(res)
}

/**
 * La liquidación tiene que cuadrar: lo consignado + comisión + IVA de la
 * comisión = lo que la plataforma debía. Devuelve el mensaje si no cuadra.
 */
export function settlementProblem(
  gross: number,
  received: number,
  commission: number,
  commissionIva: number,
): string | null {
  if (gross <= 0) return "Elige al menos un pedido"
  const diff = gross - (received + commission + commissionIva)
  if (diff === 0) return null
  return diff > 0
    ? `Faltan $${diff.toLocaleString("es-CO")} para cuadrar con lo que la plataforma debía`
    : `Sobran $${(-diff).toLocaleString("es-CO")} frente a lo que la plataforma debía`
}
