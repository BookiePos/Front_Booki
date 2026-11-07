/**
 * Notas fiscales de devoluciones, anulaciones y rebajas (Fase 6D).
 *
 * Lógica pura, sin red ni React, para poder probarla: la llave de idempotencia
 * de cada intento, las validaciones que el servidor repite (aquí se hacen para
 * no ofrecer lo que se sabe que se va a rechazar) y los textos con que se
 * cuenta qué nota quedó.
 */

// ─── Nota fiscal de la operación ─────────────────────────────────────────────

/** Concepto de corrección de la nota (DiscrepancyResponse). */
export type ConceptoNota = "1" | "2" | "3" | "4" | "5" | "6"

export const CONCEPTO_NOTA_LABELS: Record<ConceptoNota, string> = {
  "1": "Devolución de mercancía",
  "2": "Anulación de la venta",
  "3": "Rebaja o descuento",
  "4": "Ajuste de precio",
  "5": "Descuento por pronto pago",
  "6": "Descuento por volumen de ventas",
}

/**
 * Lo que quedó del documento fiscal de una devolución, rebaja o anulación.
 * `emitida`: la nota existe con su número y CUDE. `sin_nota`: la venta no
 * tiene documento válido ante la DIAN y la operación no lleva nota.
 */
export interface NotaFiscalOperacion {
  estado: "emitida" | "sin_nota"
  documentoId?: string
  fullNumber?: string
  cude?: string
  /** `pos` → nota de ajuste; `invoice` → nota crédito de la factura. */
  referenceType?: "pos" | "invoice"
  referenceNumber?: string
  concepto?: ConceptoNota
  dianStatus?: string
  /** Por qué no lleva nota, en lenguaje de la caja. */
  motivo?: string
}

/** «Nota de ajuste» (POS) o «Nota crédito» (factura electrónica). */
export function nombreDeNota(nota: Pick<NotaFiscalOperacion, "referenceType">): string {
  return nota.referenceType === "pos" ? "Nota de ajuste" : "Nota crédito"
}

/** Una frase para el aviso de éxito: qué nota salió o por qué no salió. */
export function resumenNota(nota: NotaFiscalOperacion | undefined | null): string | null {
  if (!nota) return null
  if (nota.estado === "emitida") {
    const refiere = nota.referenceNumber ? ` sobre ${nota.referenceNumber}` : ""
    return `${nombreDeNota(nota)} ${nota.fullNumber ?? ""}${refiere}`.replace(/\s+/g, " ").trim()
  }
  return nota.motivo ?? "La operación no lleva nota ante la DIAN."
}

// ─── Llave de idempotencia ───────────────────────────────────────────────────

/** Llave de un intento y la huella de lo que se mandó con ella. */
export interface LlaveIntento {
  huella: string
  llave: string
}

/** UUID del navegador; con respaldo para entornos sin `crypto.randomUUID`. */
export function nuevaLlave(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  const azar = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${azar()}-${azar()}`
}

/**
 * La llave del intento en curso. Mientras se reintenta LO MISMO (misma huella)
 * devuelve la misma llave, y el servidor responde con la operación ya
 * registrada en vez de repetirla. Si cambia lo que se manda, el servidor
 * rechazaría la llave vieja con otra carga, así que se emite una nueva.
 */
export function llaveDelIntento(
  actual: LlaveIntento | null,
  huella: string,
  generar: () => string = nuevaLlave,
): LlaveIntento {
  if (actual && actual.huella === huella) return actual
  return { huella, llave: generar() }
}

/** Huella estable de una devolución: no depende del orden de las líneas. */
export function huellaDevolucion(input: {
  saleId: string
  lines: readonly { productId: string; qty: number }[]
  reason: string
  restock: string
  refundMethod: string
  note?: string
}): string {
  const lineas = [...input.lines]
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((l) => `${l.productId}:${l.qty}`)
  return JSON.stringify([
    input.saleId,
    lineas,
    input.reason,
    input.restock,
    input.refundMethod,
    (input.note ?? "").trim(),
  ])
}

/** Huella estable de una rebaja (con o sin referencia). */
export function huellaRebaja(input: Record<string, unknown>): string {
  const ordenado = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenado)
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, ordenado(x)]),
      )
    }
    return v
  }
  return JSON.stringify(ordenado(input))
}

// ─── Devolución ──────────────────────────────────────────────────────────────

/** Medios de devolución que dejan el dinero como saldo a favor del cliente. */
export function dejaSaldoAFavor(refundMethod: string): boolean {
  return refundMethod === "credit_note" || refundMethod === "none"
}

/**
 * «Le queda a favor» y «Cambio por otro producto» necesitan un cliente
 * registrado en la venta: sin él no hay a quién dejarle el saldo. El servidor
 * lo rechaza con un 400; aquí se avisa antes.
 */
export function errorClienteDevolucion(
  refundMethod: string,
  sale: { customerId?: string | null },
): string | null {
  if (!dejaSaldoAFavor(refundMethod)) return null
  if (sale.customerId) return null
  return "Esta venta no tiene cliente registrado, y sin él no hay a quién dejarle el saldo. Devuelve en efectivo o por transferencia."
}

/** Aviso fijo de una devolución parcial: lo que NO vuelve. */
export const AVISO_DEVOLUCION_PARCIAL =
  "Una devolución parcial no devuelve el INC de las bolsas ni el cobro del domicilio: solo los productos y la propina en proporción."

// ─── Anulación ───────────────────────────────────────────────────────────────

/**
 * ¿El 400 es el de la ventana semanal del POS? Pasada la semana de la venta
 * ya no se anula: el camino es una devolución, que emite la nota de ajuste.
 */
export function esErrorVentanaSemanal(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ""
  return /semana anterior/i.test(msg) && /devoluci[oó]n/i.test(msg)
}

// ─── Devoluciones que quedaron a medias ──────────────────────────────────────

export type EstadoDevolucion = "en_curso" | "pendiente_caja" | "completa"

export const ESTADO_DEVOLUCION_LABELS: Record<EstadoDevolucion, string> = {
  en_curso: "En curso",
  pendiente_caja: "Falta la salida de caja",
  completa: "Completa",
}

/** ¿Quedó a medias? Las completas y las viejas (sin estado) no. */
export function estaPendiente(r: { estado?: EstadoDevolucion }): boolean {
  return r.estado === "en_curso" || r.estado === "pendiente_caja"
}

/** Qué le falta, dicho para la caja. */
export function textoPendiente(estado: EstadoDevolucion | undefined): string | null {
  if (estado === "pendiente_caja") {
    return "El stock y el libro ya quedaron; falta anotar la salida de efectivo. Si la completas ahora, la salida queda en la caja que esté abierta en este momento, no en la del día de la devolución."
  }
  if (estado === "en_curso") {
    return "La devolución se registró pero algún paso (stock, caja o libro) no terminó. Al completarla se retoma donde quedó, sin repetir lo que ya se hizo."
  }
  return null
}

/** El 409 de completar: otra petición la está procesando o no hay caja abierta. */
export function mensajeCompletar(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Error inesperado"
  if (/caja/i.test(msg) && /abiert/i.test(msg)) {
    return "No hay una caja abierta. Abre el turno de caja y vuelve a completar la devolución."
  }
  return msg
}

// ─── Rebaja posterior ────────────────────────────────────────────────────────

/** Conceptos de la rebaja: 5 y 6 solo existen en la nota crédito de la factura. */
export type ConceptoRebaja = "3" | "4" | "5" | "6"

export const CONCEPTO_REBAJA_LABELS: Record<ConceptoRebaja, string> = {
  "3": "Rebaja o descuento",
  "4": "Ajuste de precio",
  "5": "Descuento por pronto pago",
  "6": "Descuento por volumen de ventas",
}

export const CONCEPTOS_SOLO_FEV: readonly ConceptoRebaja[] = ["5", "6"]

/** Cómo se le reconoce la rebaja al cliente. */
export type RebateMethod = "cash" | "transfer" | "credit_note"

export const REBATE_METHOD_LABELS: Record<RebateMethod, string> = {
  cash: "Efectivo de la caja",
  transfer: "Transferencia",
  credit_note: "Le queda a favor",
}

/** Conceptos que se pueden elegir según el documento de la venta. */
export function conceptosDisponibles(esFev: boolean): ConceptoRebaja[] {
  return (Object.keys(CONCEPTO_REBAJA_LABELS) as ConceptoRebaja[]).filter(
    (c) => esFev || !CONCEPTOS_SOLO_FEV.includes(c),
  )
}

/** COP entero y positivo (el servidor rechaza decimales con un 400). */
export function esMontoValido(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0
}

export interface BorradorRebaja {
  concepto: ConceptoRebaja
  /** Monto por producto: `productId` → pesos (con impuesto). */
  montos: Record<string, number | null>
  /** Lo que todavía se puede rebajar de cada producto. */
  saldos: Record<string, number>
  refundMethod: RebateMethod
  reason: string
  /** La venta tiene factura electrónica (FEV). */
  esFev: boolean
  /** La venta tiene cliente registrado. */
  tieneCliente: boolean
}

/** Por qué la rebaja no se puede enviar todavía, o `null` si se puede. */
export function errorRebaja(b: BorradorRebaja): string | null {
  if (CONCEPTOS_SOLO_FEV.includes(b.concepto) && !b.esFev) {
    return "El descuento por pronto pago y por volumen solo existe en la factura electrónica: esta venta no la tiene."
  }
  const filas = Object.entries(b.montos).filter(([, m]) => m !== null && m !== 0)
  if (filas.length === 0) return "Escribe cuánto se rebaja de al menos un producto."
  for (const [productId, m] of filas) {
    if (!esMontoValido(m)) return "Los montos son en pesos enteros, sin decimales."
    const saldo = b.saldos[productId] ?? 0
    if (m > saldo) {
      return `No se puede rebajar más de lo que el cliente conserva de ese producto (quedan $${new Intl.NumberFormat("es-CO").format(saldo)}).`
    }
  }
  const motivo = b.reason.trim()
  if (motivo.length < 3) return "Escribe el motivo (mínimo 3 letras)."
  if (motivo.length > 300) return "El motivo admite máximo 300 caracteres."
  if (b.refundMethod === "credit_note" && !b.tieneCliente) {
    return "Para dejarlo a favor la venta necesita un cliente registrado. Reconócelo en efectivo o por transferencia."
  }
  return null
}

/** Lo que viaja: solo los productos con monto. */
export function lineasDeRebaja(
  montos: Record<string, number | null>,
): { productId: string; amount: number }[] {
  return Object.entries(montos)
    .filter(([, m]) => esMontoValido(m))
    .map(([productId, amount]) => ({ productId, amount: amount as number }))
}

// ─── Nota crédito sin referencia ─────────────────────────────────────────────

export interface BorradorNotaSinReferencia {
  customerId: string
  concepto: ConceptoRebaja
  desde: string
  hasta: string
  amount: number | null
  refundMethod: RebateMethod
  reason: string
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Días del periodo, contando los dos extremos; `null` si no son fechas. */
export function diasDelPeriodo(desde: string, hasta: string): number | null {
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return null
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return (b - a) / 86_400_000 + 1
}

/** Periodo válido: inicio antes del fin, máximo 30 días y dentro de un mismo mes. */
export function errorPeriodo(desde: string, hasta: string): string | null {
  const dias = diasDelPeriodo(desde, hasta)
  if (dias === null) return "Elige las dos fechas del periodo."
  if (dias < 1) return "La fecha de inicio tiene que ser anterior o igual a la de fin."
  if (desde.slice(0, 7) !== hasta.slice(0, 7)) {
    return "El periodo tiene que estar dentro de un mismo mes."
  }
  if (dias > 30) return "El periodo es de máximo 30 días."
  return null
}

/** Por qué la nota sin referencia no se puede enviar todavía. */
export function errorNotaSinReferencia(b: BorradorNotaSinReferencia): string | null {
  if (!b.customerId) return "Elige el cliente al que se le facturó."
  const periodo = errorPeriodo(b.desde, b.hasta)
  if (periodo) return periodo
  if (!esMontoValido(b.amount)) return "Escribe el monto en pesos enteros, mayor que cero."
  const motivo = b.reason.trim()
  if (motivo.length < 3) return "Escribe el motivo (mínimo 3 letras)."
  if (motivo.length > 300) return "El motivo admite máximo 300 caracteres."
  return null
}

// ─── Saldo a favor ───────────────────────────────────────────────────────────

const pesosFmt = new Intl.NumberFormat("es-CO")

/**
 * Por qué el pago con saldo a favor no se puede usar, o `null` si se puede.
 * Solo con cliente registrado, y el saldo tiene que cubrir lo que se paga con
 * él (en un cobro mixto, solo esa parte).
 */
export function errorSaldoFavor(input: {
  customerId: string
  saldo: number | null
  aPagar: number
}): string | null {
  if (input.aPagar <= 0) return null
  if (!input.customerId) {
    return "El saldo a favor es de un cliente registrado: elige al cliente primero."
  }
  if (input.saldo === null) return "Consultando el saldo a favor del cliente…"
  if (input.saldo < input.aPagar) {
    return `El cliente tiene $${pesosFmt.format(input.saldo)} de saldo a favor y se quiere pagar $${pesosFmt.format(input.aPagar)} con él.`
  }
  return null
}

/** ¿Quien consulta el reporte está limitado a unas sedes? Entonces no lo ve. */
export function limitadoPorSede(user: { role?: string; permissions: string[] } | null | undefined): boolean {
  if (!user) return true
  return user.role !== "owner" && !user.permissions.includes("sede.view_all")
}
