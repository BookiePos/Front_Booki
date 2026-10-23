import { PAYMENT_METHOD_LABELS, type Sale } from "@/lib/pos/api-sales"
import type { Sede } from "@/lib/pos/api-inventory"
import { dateTime, money, qty } from "@/lib/pos/format"
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
}

type SedeRecibo = Pick<
  Sede,
  "businessName" | "name" | "nit" | "address" | "phone" | "legalNote"
>

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

  b.alinear("centro").negrita(true).texto("FACTURA DE VENTA").negrita(false)
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
  if (sale.taxTotal > 0) b.fila("Impuestos", money(sale.taxTotal))
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

  b.separador().alinear("centro")
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
