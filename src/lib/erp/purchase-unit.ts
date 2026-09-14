/**
 * Unidad de compra distinta a la unidad de consumo.
 *
 * El insumo se costea en la unidad en que se CONSUME —la harina en gramos,
 * porque así la piden las recetas— pero se compra como lo despacha el
 * proveedor: bultos de 25 kg. El producto guarda esa presentación en
 * `purchaseUnit` + `purchaseFactor` ("bulto", 25000) y de ahí salen los
 * precios que se digitan, las entradas de mercancía y lo que se muestra.
 *
 * Antes de que existiera, esta pantalla ADIVINABA la presentación: si la
 * unidad era `g` asumía que se compraba por `kg`. Servía para la harina y para
 * nada más: no sabía qué es un bulto, ni una caja de 12 gaseosas, ni una
 * garrafa, y para `und` no hacía nada. Aquí ya no se adivina — se lee del
 * producto, y quien no tenga presentación se compra por su propia unidad.
 */

import type { InvProduct } from "./api-inventory"

/** Factores hacia una unidad base por dimensión (masa en g, volumen en ml). */
export const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  // 500 g, la libra de la plaza, no los 453,592 g de la libra internacional.
  // Es decisión del dueño y es la que cuadra con el resto del sistema: aquí una
  // arroba son 25 libras y 12,5 kg, cuenta que solo sale con la libra de 500.
  // Con los 453,592 de antes, comprar "una libra de mantequilla" registraba un
  // 9 % menos de lo que de verdad entró a la bodega.
  lb: { base: "g", factor: 500 },
  // La arroba castellana que se usa en Colombia: 12,5 kg exactos. Es medida,
  // no empaque —a diferencia del bulto, que trae lo que traiga— así que sí
  // puede ser la unidad en que se lleva un insumo. Ver `lib/erp/unidades.ts`.
  arroba: { base: "g", factor: 12_500 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  und: { base: "und", factor: 1 },
}

/** Convierte entre unidades compatibles; null si no hay conversión posible. */
export function convertUnits(value: number, from: string, to: string): number | null {
  if (from === to) return value
  const f = UNIT_FACTORS[from]
  const t = UNIT_FACTORS[to]
  if (!f || !t || f.base !== t.base) return null
  return (value * f.factor) / t.factor
}

/** Cómo se compra un insumo, ya resuelto: con presentación propia o sin ella. */
export interface Presentacion {
  /** Lo que se lee en pantalla: "bulto", o la propia unidad si no hay. */
  unidad: string
  /** Cuántas unidades de consumo trae. 1 cuando se compra como se consume. */
  factor: number
  /** false = el insumo no tiene presentación y se compra por su unidad. */
  definida: boolean
  /** Lo que trae, legible: "25 kg". null cuando no hay presentación. */
  contenido: string | null
}

const nfCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 })

/**
 * Traduce un factor a la unidad en que se lee cómodo: 25000 g → "25 kg".
 * Sin equivalencia mayor (und, paquete…) se muestra tal cual: "12 und".
 */
export function describirContenido(factor: number, unit: string): string {
  const mayor = unit === "g" ? "kg" : unit === "ml" ? "l" : null
  if (mayor) {
    const enMayor = convertUnits(factor, unit, mayor)
    // Bajo mil no compensa: "0,5 kg" se lee peor que "500 g".
    if (enMayor != null && enMayor >= 1) return `${nfCantidad.format(enMayor)} ${mayor}`
  }
  return `${nfCantidad.format(factor)} ${unit}`
}

/** Resuelve la presentación de compra de un insumo. */
export function presentacionDeCompra(
  p: Pick<InvProduct, "unit" | "purchaseUnit" | "purchaseFactor">,
): Presentacion {
  const factor = p.purchaseFactor
  if (p.purchaseUnit && factor && factor > 0) {
    return {
      unidad: p.purchaseUnit,
      factor,
      definida: true,
      contenido: describirContenido(factor, p.unit),
    }
  }
  return { unidad: p.unit, factor: 1, definida: false, contenido: null }
}

/** Precio de una presentación a partir del costo por unidad de consumo. */
export function precioDePresentacion(cost: number, factor: number): number {
  return cost * (factor > 0 ? factor : 1)
}

/** El camino inverso: del precio del bulto al costo por gramo. */
export function costoPorUnidad(precio: number, factor: number): number {
  return precio / (factor > 0 ? factor : 1)
}

/**
 * Presentación que se le sugiere a un insumo que todavía no tiene ninguna.
 *
 * Solo para las unidades pequeñas del sistema métrico, donde la presentación
 * casi siempre es la unidad mayor: quien mide en gramos compra por kilos. Es
 * exactamente la suposición que hacía el parche, pero aquí no decide nada por
 * su cuenta: solo rellena el formulario para que la persona confirme.
 */
export function sugerirPresentacion(
  unit: string,
): { unidad: string; factor: number } | null {
  if (unit === "g") return { unidad: "kg", factor: 1000 }
  if (unit === "ml") return { unidad: "l", factor: 1000 }
  return null
}
