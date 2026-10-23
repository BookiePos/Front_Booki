/**
 * Medios digitales del cobro (ítem 6.4): datáfono, Nequi, Daviplata y QR /
 * llave Bre-B. El medio de siempre no cambia (datáfono = tarjeta; billeteras y
 * QR = transferencia): el canal solo detalla por dónde entró la plata para
 * poder conciliarla contra el extracto. Mismas reglas que el servidor
 * (`sale-payments.ts`): aquí sirven para avisar antes de cobrar.
 */
import {
  PAYMENT_METHOD_LABELS,
  type CardFranchise,
  type CardType,
  type PaymentChannel,
  type PaymentMethod,
} from "@/lib/pos/api-sales"

export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  datafono: "Datáfono",
  nequi: "Nequi",
  daviplata: "Daviplata",
  qr: "QR / Bre-B",
}

/** Canales de la transferencia, en el orden en que se ofrecen. */
export const TRANSFER_CHANNELS = ["nequi", "daviplata", "qr"] as const

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  debit: "Débito",
  credit: "Crédito",
}

export const FRANCHISE_LABELS: Record<CardFranchise, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  diners: "Diners",
  otra: "Otra",
}

/** Misma regla del servidor para la referencia (aprobación, últimos 4, celular). */
const REFERENCE_PATTERN = /^[\p{L}\p{N} .\-/#*]{1,40}$/u

/** Lo que el cajero llena para un medio digital. Todo en texto, como los inputs. */
export interface DigitalDetail {
  /** Solo para transferencia: "" = transferencia bancaria de siempre. */
  channel: "" | Exclude<PaymentChannel, "datafono">
  cardType: "" | CardType
  franchise: "" | CardFranchise
  reference: string
}

export function detalleVacio(): DigitalDetail {
  return { channel: "", cardType: "", franchise: "", reference: "" }
}

/** Por qué falta algo del detalle, o `null` si está bien (o no aplica). */
export function detalleDigitalError(
  method: PaymentMethod,
  d: DigitalDetail,
): string | null {
  if (method !== "card" && method !== "transfer") return null
  if (method === "card") {
    if (!d.cardType) return "Elige si el datáfono cobró débito o crédito."
    if (!d.franchise) return "Elige la franquicia de la tarjeta."
  }
  const ref = d.reference.trim()
  if (ref && !REFERENCE_PATTERN.test(ref)) {
    return "La referencia solo admite letras, números, espacios y . - / # *"
  }
  return null
}

/** Campos que viajan al servidor para este medio; `{}` si no hay detalle. */
export function detalleParaEnviar(
  method: PaymentMethod,
  d: DigitalDetail,
): {
  channel?: PaymentChannel
  cardType?: CardType
  franchise?: CardFranchise
  reference?: string
} {
  if (method !== "card" && method !== "transfer") return {}
  const out: ReturnType<typeof detalleParaEnviar> = {}
  if (method === "card") {
    out.channel = "datafono"
    if (d.cardType) out.cardType = d.cardType
    if (d.franchise) out.franchise = d.franchise
  } else if (d.channel) {
    out.channel = d.channel
  }
  const ref = d.reference.trim()
  if (ref) out.reference = ref
  return out
}

/** «Nequi» en vez de «Transferencia» cuando se sabe el canal. */
export function etiquetaMedio(
  method: PaymentMethod,
  channel: PaymentChannel | undefined,
): string {
  if (channel) return CHANNEL_LABELS[channel]
  return PAYMENT_METHOD_LABELS[method]
}
