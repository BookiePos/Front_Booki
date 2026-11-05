import QRCode from "qrcode"
import { PAYMENT_METHOD_LABELS, type Sale } from "@/lib/pos/api-sales"
import type { Sede } from "@/lib/pos/api-inventory"
import { dateTime, money, qty } from "@/lib/pos/format"
import { LEYENDA_CONTINGENCIA } from "@/lib/offline/cola"
import {
  DENOMINACION_POS,
  LEYENDA_CONTINGENCIA_DIAN,
  lineaFabricante,
  lineasResolucion,
  type TiqueteFiscal,
} from "@/lib/pos/documento-fiscal"
import {
  EscposBuilder,
  type AnchoPapel,
  type PaginaCodigos,
} from "@/lib/impresion/escpos"

export interface OpcionesRecibo {
  ancho: AnchoPapel
  paginaCodigos?: PaginaCodigos
  /** Pulso de cajón antes del corte (ventas en efectivo). */
  abrirCajon?: boolean
  /** Documento fiscal de la venta (Fase 7): número, CUDE, QR y resolución. */
  fiscal?: TiqueteFiscal | null
}

type SedeRecibo = Pick<
  Sede,
  "businessName" | "name" | "nit" | "address" | "phone" | "legalNote"
>

/** Puntos imprimibles por ancho de papel a 203 ppp (8 puntos por mm). */
const PUNTOS_IMPRIMIBLES: Record<AnchoPapel, number> = { 58: 384, 80: 576 }
/** 2 cm a 8 puntos por mm: el mínimo del QR (§14.3 del anexo). */
const PUNTOS_QR_MINIMO = 160
/**
 * Por debajo de 3 puntos por módulo la térmica empasta y el celular no lo lee,
 * aunque el QR mida 2 cm: con el bloque del §14.3 (≈ 81 módulos) eso pasa.
 */
const MODULO_LEGIBLE = 3

/**
 * Tamaño del módulo del QR para que mida al menos 2 cm y quepa en el papel.
 * Si el contenido es tan largo que ni con módulo 1 alcanza los 2 cm, gana caber.
 */
export function moduloQr(datos: string, ancho: AnchoPapel): number {
  let lado: number
  try {
    lado = QRCode.create(datos, { errorCorrectionLevel: "M" }).modules.size
  } catch {
    return MODULO_LEGIBLE
  }
  const maximo = Math.max(1, Math.floor(PUNTOS_IMPRIMIBLES[ancho] / lado))
  const minimo = Math.max(MODULO_LEGIBLE, Math.ceil(PUNTOS_QR_MINIMO / lado))
  return Math.min(minimo, maximo, 16)
}

/**
 * Comprobante POS en ESC/POS. Espeja el contenido de `components/pos/receipt.tsx`
 * (mismos campos, mismo orden, mismo `money()`); si cambias uno, cambia el otro.
 */
export function reciboEscpos(
  sale: Sale,
  sede: SedeRecibo | undefined,
  opciones: OpcionesRecibo,
): Uint8Array {
  const b = new EscposBuilder(opciones).inicializar()
  const fiscal = opciones.fiscal ?? null
  const cajero = sale.cashierName || sale.cashierEmail
  const titulo = sede?.businessName || sede?.name || "Punto de venta"
  const subtitulo = sede?.businessName ? sede.name : undefined
  const c = sale.customer
  const hayCliente = !!c && !!(c.name || c.idNumber || c.phone || c.email)
  const propina = sale.tip ?? 0

  b.alinear("centro").negrita(true).texto(titulo).negrita(false)
  if (subtitulo) b.texto(subtitulo)
  if (sede?.nit) b.texto(`NIT ${sede.nit}`)
  if (sede?.address) b.texto(sede.address)
  if (sede?.phone) b.texto(`Tel ${sede.phone}`)
  b.texto(dateTime(sale.createdAt))
  b.alinear("izquierda").separador()

  b.alinear("centro").negrita(true)
  if (fiscal?.tipo === "pos") b.texto(DENOMINACION_POS)
  else if (fiscal?.tipo === "invoice") b.texto("FACTURA ELECTRÓNICA DE VENTA")
  else b.texto("FACTURA DE VENTA")
  b.negrita(false)
  if (fiscal) {
    b.negrita(true).texto(`No. ${fiscal.fullNumber}`).negrita(false)
    for (const l of lineasResolucion(fiscal.resolucion)) b.texto(l)
    if (fiscal.fecha) {
      b.texto(`Generado ${fiscal.fecha} ${(fiscal.hora ?? "").slice(0, 8)}`.trim())
    }
  }
  b.alinear("izquierda")
  b.fila("Comprobante", sale.saleNumber)
  b.fila("Cajero", cajero)
  if (sale.seller?.name) b.fila("Vendedor", sale.seller.name)

  if (hayCliente) {
    b.separador().texto("Cliente")
    if (c!.name) b.texto(c!.name)
    if (c!.idNumber) b.fila("Identificación", c!.idNumber)
    if (c!.phone) b.fila("Teléfono", c!.phone)
  }

  b.separador()
  for (const l of sale.lines) {
    const desc = l.discountAmount ?? 0
    b.fila(l.name, money(l.lineTotal - desc))
    b.texto(`  ${qty(l.qty)} ${l.unit} x ${money(l.unitPrice)}`)
    if (desc > 0) b.texto(`  Desc. ${l.discountName ?? ""} -${money(desc)}`)
  }

  b.separador()
  if (sale.discountTotal > 0 || sale.taxTotal > 0) {
    b.fila("Subtotal", money(sale.subtotal))
  }
  if (sale.discountTotal > 0) {
    b.fila(
      sale.discount?.type === "percent"
        ? `Descuento (${sale.discount.value}%)`
        : "Descuento",
      `-${money(sale.discountTotal)}`,
    )
  }
  if (sale.contingencia) b.fila("Impuestos", "Incluidos")
  else if (sale.taxTotal > 0) b.fila("Impuestos", money(sale.taxTotal))
  b.negrita(true).fila("TOTAL", money(sale.total)).negrita(false)
  if (propina > 0) {
    b.fila("Propina", money(propina))
    b.negrita(true)
      .fila("TOTAL A PAGAR", money(sale.total + propina))
      .negrita(false)
  }

  b.separador()
  const { payment } = sale
  if (sale.payments && sale.payments.length > 1) {
    for (const p of sale.payments) {
      b.fila(`Pago ${PAYMENT_METHOD_LABELS[p.method].toLowerCase()}`, money(p.amount))
    }
  } else {
    b.fila("Pago", PAYMENT_METHOD_LABELS[payment.method])
  }
  if (payment.received !== undefined) b.fila("Recibido", money(payment.received))
  if (payment.change !== undefined && payment.change > 0) {
    b.fila("Devuelta", money(payment.change))
  }

  if (fiscal) {
    b.separador().alinear("centro")
    if (fiscal.cude) {
      b.negrita(true).texto(fiscal.tipo === "pos" ? "CUDE" : "CUFE").negrita(false)
      b.texto(fiscal.cude)
    }
    if (fiscal.qr) b.qr(fiscal.qr, moduloQr(fiscal.qr, opciones.ancho))
    if (fiscal.contingencia) b.texto(LEYENDA_CONTINGENCIA_DIAN)
    const fab = lineaFabricante(fiscal.fabricante)
    if (fab) b.texto(fab)
    b.alinear("izquierda")
  }

  b.separador().alinear("centro")
  if (sale.contingencia) b.texto(LEYENDA_CONTINGENCIA)
  if (sede?.legalNote) b.texto(sede.legalNote)
  b.texto("¡Gracias por su compra!")
  b.alinear("izquierda").avanzar(3)
  if (opciones.abrirCajon) b.abrirCajon()
  return b.cortar().build()
}

/** Tirilla de prueba: comprueba ancho, acentos y corte sin gastar una venta. */
export function pruebaEscpos(opciones: OpcionesRecibo): Uint8Array {
  const b = new EscposBuilder(opciones).inicializar()
  b.alinear("centro").negrita(true).texto("PRUEBA DE IMPRESIÓN").negrita(false)
  b.alinear("izquierda").separador()
  b.texto("áéíóú ÁÉÍÓÚ ñ Ñ ü ¿? ¡!")
  b.fila("Total de prueba", money(12500))
  b.separador().avanzar(3)
  return b.cortar().build()
}
