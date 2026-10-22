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

async function enviar(
  c: ConfigImpresion,
  bytes: Uint8Array,
  resolver: ResolverTransporte,
) {
  const t = await resolver(c)
  if (!t) throw new ImpresoraNoVinculada()
  await imprimirBytes(t, bytes)
}

/** Imprime el comprobante; abre el cajón si fue en efectivo y así se configuró. */
export function imprimirVentaTermica(
  sale: Sale,
  sede: Pick<
    Sede,
    "businessName" | "name" | "nit" | "address" | "phone" | "legalNote"
  > | undefined,
  c: ConfigImpresion,
  resolver: ResolverTransporte = transporteGuardado,
) {
  const hayEfectivo =
    sale.payment.method === "cash" ||
    !!sale.payments?.some((p) => p.method === "cash")
  const bytes = reciboEscpos(sale, sede, {
    ancho: c.ancho,
    paginaCodigos: c.paginaCodigos,
    abrirCajon: c.cajonAlCobrar && hayEfectivo,
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
