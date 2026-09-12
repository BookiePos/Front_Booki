/**
 * Cómo se resuelve el precio con una lista — copia fiel de
 * `catalog/domain/price-list.ts` del backend.
 *
 * Está duplicada a propósito y conviene saber por qué: el precio que se COBRA
 * lo calcula el servidor y nunca viaja desde el navegador, que es la regla que
 * protege la caja. Pero el terminal tiene que MOSTRAR el mismo número mientras
 * se arma el carrito, y pedirle al servidor una cotización por cada tecla
 * volvería lento justo lo que más se usa.
 *
 * Así que esto es para pintar, no para cobrar. Si las dos alguna vez no
 * coinciden, la que manda es la del backend y esta está mal: cualquier cambio
 * en las reglas se hace allá primero y se refleja aquí.
 */

import type { PriceList, PriceListItem } from "./api-catalog"

/**
 * Elige el escalón que aplica a esta cantidad.
 *
 * Con varios precios para el mismo producto gana el de mayor `minQty` entre
 * los que la cantidad alcanza: comprando 60 gaseosas se paga el precio de 50,
 * no el de 12. Empatados, gana el más barato.
 */
export function pickTier(
  items: readonly PriceListItem[],
  catalogProductId: string,
  qty: number,
): PriceListItem | undefined {
  let elegido: PriceListItem | undefined
  for (const item of items) {
    if (item.catalogProductId !== catalogProductId) continue
    const min = item.minQty ?? 0
    if (qty < min) continue
    if (!elegido) {
      elegido = item
      continue
    }
    const minElegido = elegido.minQty ?? 0
    if (min > minElegido || (min === minElegido && item.price < elegido.price)) {
      elegido = item
    }
  }
  return elegido
}

/**
 * Precio unitario que se va a cobrar, de lo más específico a lo más general:
 *
 *   1. Sin lista, el precio de mostrador.
 *   2. Un precio pactado para ESE producto cuya cantidad mínima se alcanza.
 *   3. El porcentaje general de la lista.
 *   4. Si nada aplica, el precio de mostrador.
 *
 * Devuelve pesos enteros, redondeando el precio UNITARIO y no el total, para
 * que lo que el cliente lee en la tirilla multiplicado por la cantidad dé
 * exactamente lo que se le cobró.
 */
export function resolveUnitPrice(opts: {
  basePrice: number
  qty: number
  catalogProductId: string
  list?: Pick<PriceList, "discountPercent" | "items"> | null
}): number {
  const { basePrice, qty, catalogProductId, list } = opts
  if (!list) return Math.round(basePrice)

  const tier = pickTier(list.items ?? [], catalogProductId, qty)
  if (tier) return Math.max(0, Math.round(tier.price))

  const pct = list.discountPercent ?? 0
  if (pct > 0) {
    const limitado = Math.min(pct, 100)
    return Math.max(0, Math.round(basePrice * (1 - limitado / 100)))
  }

  return Math.round(basePrice)
}
