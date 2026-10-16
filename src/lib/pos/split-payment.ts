/**
 * Reparto de un cobro mixto en el POS (ítem 6.9): efectivo + tarjeta, etc., en
 * un solo tiquete y sin dividir la cuenta.
 *
 * Son las mismas reglas que valida el backend (`domain/sale-payments.ts`); aquí
 * solo sirven para que el cajero vea el restante y la devuelta antes de cobrar:
 *   - La suma tiene que cubrir lo que se cobra (total + propina + domicilio).
 *   - La devuelta solo sale del efectivo: lo que no es efectivo no puede pasarse.
 *   - El fiado puede ser una de las partes, una sola, y no cubre la propina.
 */
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Sale,
  type SalePaymentPartInput,
} from "@/lib/pos/api-sales"

export interface SplitRow {
  id: string
  method: PaymentMethod
  /** En pesos. `null` mientras la casilla está vacía. */
  amount: number | null
}

export interface SplitSummary {
  /** Suma de todo lo escrito. */
  paid: number
  /** Lo que falta por cubrir (0 si ya alcanza). */
  remaining: number
  /** Devuelta: lo que sobra, siempre del efectivo. */
  change: number
  /** Por qué no se puede cobrar todavía, o `null` si se puede. */
  error: string | null
}

const fmt = (n: number) => `$${new Intl.NumberFormat("es-CO").format(n)}`

let seq = 0
function nuevaId(): string {
  seq += 1
  return `p${seq}`
}

/** Monto de una fila como número entero de pesos (vacío = 0). */
function pesos(r: SplitRow): number {
  return Math.max(0, Math.round(r.amount ?? 0))
}

/**
 * Filas con las que arranca «dividir pago»: el medio que estaba elegido y uno
 * más (tarjeta si venía de efectivo, efectivo si no), los dos en blanco.
 */
export function initialSplitRows(current: PaymentMethod): SplitRow[] {
  const otro: PaymentMethod = current === "cash" ? "card" : "cash"
  return [
    { id: nuevaId(), method: current, amount: null },
    { id: nuevaId(), method: otro, amount: null },
  ]
}

/**
 * @param due       lo que se cobra: total + propina + domicilio.
 * @param creditCap lo máximo que se puede fiar: total + domicilio.
 */
export function splitSummary(
  rows: readonly SplitRow[],
  due: number,
  creditCap: number,
): SplitSummary {
  const paid = rows.reduce((a, r) => a + pesos(r), 0)
  const cash = rows
    .filter((r) => r.method === "cash")
    .reduce((a, r) => a + pesos(r), 0)
  const nonCash = paid - cash
  const credit = rows.filter((r) => r.method === "credit")
  const creditAmount = credit.reduce((a, r) => a + pesos(r), 0)
  const remaining = Math.max(0, due - paid)
  const change = Math.max(0, paid - due)

  let error: string | null = null
  if (rows.filter((r) => pesos(r) > 0).length === 0) {
    error = "Escribe cuánto paga con cada medio."
  } else if (credit.length > 1) {
    error = "Solo una parte del cobro puede ser fiada."
  } else if (nonCash > due) {
    error = "La devuelta solo sale del efectivo: lo que no es efectivo se pasa del total."
  } else if (creditAmount > creditCap) {
    error = "La propina no se fía: baja la parte fiada."
  } else if (remaining > 0) {
    error = `Faltan ${fmt(remaining)} por cubrir.`
  }
  return { paid, remaining, change, error }
}

/** Escribe en una fila lo que falta por cubrir (botón «Lo que falta»). */
export function fillRemaining(
  rows: readonly SplitRow[],
  id: string,
  due: number,
): SplitRow[] {
  const otros = rows
    .filter((r) => r.id !== id)
    .reduce((a, r) => a + pesos(r), 0)
  const falta = Math.max(0, due - otros)
  return rows.map((r) => (r.id === id ? { ...r, amount: falta } : r))
}

/**
 * F6..F9 con «dividir pago» abierto: agrega una fila con ese medio y lo que
 * falta. Si ya no falta nada, o la última fila sigue en blanco, cambia el
 * medio de la última fila. Así los atajos sirven igual que sin dividir.
 */
export function applyMethodShortcut(
  rows: readonly SplitRow[],
  method: PaymentMethod,
  due: number,
): SplitRow[] {
  const ultima = rows.at(-1)
  const falta = Math.max(0, due - rows.reduce((a, r) => a + pesos(r), 0))
  if (!ultima || (ultima.amount !== null && falta > 0)) {
    return [...rows, { id: nuevaId(), method, amount: falta || null }]
  }
  return rows.map((r) =>
    r.id === ultima.id
      ? { ...r, method, amount: r.amount ?? (falta || null) }
      : r,
  )
}

/**
 * Botón «Agregar medio»: una fila con un medio que todavía no esté (tarjeta,
 * transferencia, efectivo, en ese orden) y lo que falta, si falta algo.
 */
export function addSplitRow(rows: readonly SplitRow[], due: number): SplitRow[] {
  const usados = new Set(rows.map((r) => r.method))
  const method =
    (["card", "transfer", "cash"] as const).find((m) => !usados.has(m)) ?? "card"
  const falta = Math.max(0, due - rows.reduce((a, r) => a + pesos(r), 0))
  return [...rows, { id: nuevaId(), method, amount: falta || null }]
}

/** Lo que viaja al backend: solo las filas con monto, con el deudor en la fiada. */
export function toPaymentsPayload(
  rows: readonly SplitRow[],
  credito: Omit<SalePaymentPartInput, "method" | "amount">,
): SalePaymentPartInput[] {
  return rows
    .filter((r) => pesos(r) > 0)
    .map((r) =>
      r.method === "credit"
        ? { method: r.method, amount: pesos(r), ...credito }
        : { method: r.method, amount: pesos(r) },
    )
}

/** «Efectivo + Tarjeta» en una venta mixta; el medio de siempre si no. */
export function paymentLabel(sale: Pick<Sale, "payment" | "payments">): string {
  if (sale.payments && sale.payments.length > 1) {
    return sale.payments.map((p) => PAYMENT_METHOD_LABELS[p.method]).join(" + ")
  }
  return PAYMENT_METHOD_LABELS[sale.payment.method]
}
