/**
 * Cliente HTTP de las notas del panel (Fase 6D): nota crédito sin referencia
 * y reporte de saldos a favor. Base `/sales`.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type {
  ConceptoRebaja,
  NotaFiscalOperacion,
  RebateMethod,
} from "@/lib/pos/notas"

export interface NotaSinReferencia {
  _id: string
  sedeId: string
  customerId: string
  customerName?: string
  docNumber: string
  concepto: ConceptoRebaja
  desde: string
  hasta: string
  amount: number
  iva: number
  inc: number
  refundMethod: RebateMethod
  reason: string
  estado: "en_curso" | "pendiente_caja" | "completa"
  notaFiscal?: NotaFiscalOperacion
  userEmail: string
  createdAt: string
}

export interface CreateNotaSinReferenciaPayload {
  sedeId: string
  customerId: string
  concepto: ConceptoRebaja
  desde: string
  hasta: string
  amount: number
  refundMethod: RebateMethod
  reason: string
  idempotencyKey: string
}

/** Notas sin referencia de la sede (las 200 más recientes). */
export async function listNotasSinReferencia(sedeId: string): Promise<NotaSinReferencia[]> {
  const res = await authFetch(`/sales/rebajas/sin-referencia?sedeId=${encodeURIComponent(sedeId)}`)
  return parseResponse<NotaSinReferencia[]>(res)
}

/** Emite la nota crédito sin referencia (solo FEV; `pos.void.authorize`). */
export async function createNotaSinReferencia(
  payload: CreateNotaSinReferenciaPayload,
): Promise<NotaSinReferencia> {
  const res = await authFetch(`/sales/rebajas/sin-referencia`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<NotaSinReferencia>(res)
}

export interface FilaSaldoFavor {
  customerId: string
  customerName?: string
  saldo: number
  /** Σ abonos + reversos − consumos del auxiliar. */
  movimientos: number
  /** saldo − movimientos: debe ser 0. */
  descuadre: number
}

export interface ReporteSaldosFavor {
  filas: FilaSaldoFavor[]
  totalClientes: number
  /** Lo que quedó en la 2805 sin cliente. */
  sinTercero: number
  libro2805?: number
  diferenciaLibro?: number
}

/** Saldos a favor de toda la empresa (`finance.view`; 403 si el usuario está limitado por sede). */
export async function getReporteSaldosFavor(): Promise<ReporteSaldosFavor> {
  const res = await authFetch(`/sales/saldos-favor`)
  return parseResponse<ReporteSaldosFavor>(res)
}
