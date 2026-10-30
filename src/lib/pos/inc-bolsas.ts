/**
 * INC de bolsas plásticas en el POS (art. 512-15 ET, tributo DIAN 22).
 *
 * Es el mismo cálculo del backend (`sales.service.ts`, `sale-amounts.ts` y
 * `causaIncBolsas` de core-tax) para que el total que ve el cajero, el vuelto,
 * el pago dividido y el `expectedGrandTotal` del modo offline coincidan con lo
 * que el servidor guarda. El INC va APARTE del valor de la bolsa, por unidad,
 * y ningún descuento lo toca.
 */

/** Código del impuesto en el catálogo de `/taxes`. */
export const INC_BOLSA_CODE = "INC_BOLSA"

/** Redondea a peso entero (`cop` del backend). */
export function cop(n: number): number {
  return Math.round(n || 0)
}

/**
 * Cuánto vale cobrar `qty` de una línea de la que ya se cobraron `priorQty`.
 * Igual que `chargeForQty` del backend: con el acumulado, los pagos de una
 * cuenta dividida suman exacto `cop(unitPrice × qty total)`.
 */
export function chargeForQty(unitPrice: number, priorQty: number, qty: number): number {
  return cop(unitPrice * (priorQty + qty)) - cop(unitPrice * priorQty)
}

/**
 * Si la sede cobra el INC de bolsas: solo los responsables de IVA (art. 512-15
 * ET). Sin dato, todo salvo `no_responsable_iva`. Igual que `causaIncBolsas`.
 */
export function causaIncBolsas(
  perfil: { responsabilidadFiscal?: string; responsableIva?: boolean } | undefined,
): boolean {
  if (!perfil) return false
  return perfil.responsableIva ?? perfil.responsabilidadFiscal !== "no_responsable_iva"
}

interface ImpuestoVista {
  code: string
  active: boolean
  history: { rate: number; effectiveFrom: string }[]
}

/**
 * Tarifa por bolsa a una fecha (`YYYY-MM-DD`): la versión de `INC_BOLSA` más
 * reciente con vigencia desde esa fecha o antes, y solo si el impuesto está
 * activo. Es lo que hace `bagTaxPerUnit` del backend. Sin impuesto, inactivo o
 * sin versión vigente: 0.
 */
export function tarifaBolsaVigente(impuestos: readonly ImpuestoVista[], fecha: string): number {
  const bolsa = impuestos.find((t) => t.code === INC_BOLSA_CODE)
  if (!bolsa?.active) return 0
  const vigente = bolsa.history
    .filter((v) => v.effectiveFrom <= fecha)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]
  return vigente ? cop(vigente.rate) : 0
}

/** Una línea del cobro: lo ya cobrado de ese producto y lo que se cobra ahora. */
export interface LineaBolsa {
  productId: string
  bolsa: boolean
  previo: number
  qty: number
}

/** INC de bolsas de una línea. */
export function incBolsasDeLinea(l: LineaBolsa, tarifa: number): number {
  return l.bolsa && tarifa > 0 ? chargeForQty(tarifa, l.previo, l.qty) : 0
}

/** `Σ chargeForQty(tarifa, previo, qty)` de las líneas con bolsa, en pesos. */
export function incBolsasTotal(lineas: readonly LineaBolsa[], tarifa: number): number {
  return cop(lineas.reduce((a, l) => a + incBolsasDeLinea(l, tarifa), 0))
}

/** `bagTaxUnit` por producto para `chargedLines` del modo offline. */
export function bagTaxUnitPorProducto(
  lineas: readonly LineaBolsa[],
  tarifa: number,
): Map<string, number> {
  const out = new Map<string, number>()
  if (tarifa <= 0) return out
  for (const l of lineas) {
    if (l.bolsa && incBolsasDeLinea(l, tarifa) > 0) out.set(l.productId, tarifa)
  }
  return out
}
