import type { Sale } from "@/lib/pos/api-sales"
import type { Sede } from "@/lib/pos/api-inventory"
import type { ConfigImpresion } from "@/lib/impresion/config"
import { pulsoCajon, EscposBuilder } from "@/lib/impresion/escpos"
import { pruebaEscpos, reciboEscpos } from "@/lib/impresion/recibo-escpos"
import {
  imprimirBytes,
  transporteGuardado,
  type TransporteImpresora,
} from "@/lib/impresion/transporte"

/** Cómo se obtiene el transporte; los tests inyectan uno falso. */
export type ResolverTransporte = (
  c: ConfigImpresion,
) => Promise<TransporteImpresora | null>

export class ImpresoraNoVinculada extends Error {
  constructor() {
    super(
      "No hay una impresora térmica vinculada en este navegador. Vincúlala desde «Impresora».",
    )
    this.name = "ImpresoraNoVinculada"
  }
}

// Cola a nivel de módulo: dos envíos a la vez pelearían por el mismo
// dispositivo (un USB no se puede reclamar dos veces).
let cola: Promise<unknown> = Promise.resolve()

function enviar(
  c: ConfigImpresion,
  bytes: Uint8Array,
  resolver: ResolverTransporte,
): Promise<void> {
  const trabajo = cola.then(async () => {
    const t = await resolver(c)
    if (!t) throw new ImpresoraNoVinculada()
    await imprimirBytes(t, bytes)
  })
  // Un fallo no debe envenenar la cola de los siguientes.
  cola = trabajo.catch(() => {})
  return trabajo
}

/** ¿La venta entró dinero en efectivo (solo o en cobro mixto)? */
export function ventaConEfectivo(sale: Sale): boolean {
  return (
    sale.payment.method === "cash" ||
    !!sale.payments?.some((p) => p.method === "cash")
  )
}

/**
 * Imprime el comprobante. El cajón se abre solo si quien llama lo pide
 * (`abrirCajon`): la reimpresión de una venta vieja jamás debe abrirlo.
 */
export function imprimirVentaTermica(
  sale: Sale,
  sede: Pick<
    Sede,
    "businessName" | "name" | "nit" | "address" | "phone" | "legalNote"
  > | undefined,
  c: ConfigImpresion,
  { abrirCajon }: { abrirCajon: boolean },
  resolver: ResolverTransporte = transporteGuardado,
) {
  const bytes = reciboEscpos(sale, sede, {
    ancho: c.ancho,
    paginaCodigos: c.paginaCodigos,
    abrirCajon,
  })
  return enviar(c, bytes, resolver)
}

/** Solo el pulso de cajón, sin imprimir nada. */
export function abrirCajonTermico(
  c: ConfigImpresion,
  resolver: ResolverTransporte = transporteGuardado,
) {
  const bytes = new EscposBuilder({ ancho: c.ancho })
    .inicializar()
    .abrirCajon()
    .build()
  return enviar(c, bytes, resolver)
}

export function imprimirPruebaTermica(
  c: ConfigImpresion,
  resolver: ResolverTransporte = transporteGuardado,
) {
  return enviar(
    c,
    pruebaEscpos({ ancho: c.ancho, paginaCodigos: c.paginaCodigos }),
    resolver,
  )
}

export { pulsoCajon }
