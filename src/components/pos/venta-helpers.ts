import * as React from "react"
import { Banknote, CreditCard, ArrowLeftRight, HandCoins, Smartphone } from "lucide-react"
import {
  type PosProduct,
  type PaymentMethod,
  type Order,
  type Customer,
} from "@/lib/pos/api-sales"
import { type VariantGroup } from "@/components/pos/variant-picker"

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

export interface CartItem {
  product: PosProduct
  qty: number
  /** Descuento predefinido aplicado a esta línea (id del descuento de la sede). */
  discountId?: string
}

export const ALL = "__all__"
export const UNCAT = "__uncat__"
/** Umbral para avisar "pocas unidades": solo se muestra el stock si es menor. */
export const LOW_STOCK = 10

/** Cantidades de una cuenta dividida: pueden salir fraccionarias al repartir. */
export const nfCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 })

export const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  credit: HandCoins,
  platform: Smartphone,
}

export type SaveState = "idle" | "saving" | "saved" | "error"

/**
 * Una casilla de la rejilla: o un producto suelto, o un grupo de variantes
 * (las tallas de una misma camisa) que se abre en el selector.
 */
export type GridEntry =
  | { kind: "single"; product: PosProduct }
  | { kind: "group"; group: VariantGroup }

/**
 * Agrupa el catálogo para la rejilla: las variantes de un mismo producto (las
 * tallas de una camisa) se juntan en una sola entrada y el resto pasa tal cual.
 *
 * Sin esto, una tienda de ropa con diez modelos en cinco tallas veía cincuenta
 * tarjetas que solo se distinguen por la última letra del nombre.
 *
 * Va suelta y sin `useMemo`: el compilador de React memoriza la llamada solo, y
 * un memo escrito a mano que él no pueda preservar apagaría la optimización de
 * toda la pantalla.
 */
export function buildGridEntries(filtered: PosProduct[]): GridEntry[] {
  const puestos = new Set<string>()
  return filtered.flatMap<GridEntry>((p) => {
    const groupId = p.variantGroupId
    if (!groupId) return [{ kind: "single", product: p }]
    // El grupo ocupa la posición de su primera variante; las demás ya están
    // dentro de esa tarjeta.
    if (puestos.has(groupId)) return []
    puestos.add(groupId)
    const variants = filtered.filter((v) => v.variantGroupId === groupId)
    // Un "grupo" de una sola variante no es un grupo: pedir talla cuando solo
    // hay una es un toque de más.
    return [
      variants.length === 1
        ? { kind: "single", product: variants[0] }
        : {
            kind: "group",
            group: {
              groupId,
              name: p.variantGroupName ?? p.name,
              variants,
            },
          },
    ]
  })
}


/** Convierte las líneas de una cuenta en ítems del carrito (usa el stock real
 * cuando el producto sigue vendible; si no, sintetiza uno mínimo). */
export function orderToCart(order: Order, products: PosProduct[]): CartItem[] {
  return order.lines.map((l) => {
    const p = products.find((pp) => pp._id === l.productId)
    if (p) {
      return { product: { ...p, stock: Math.max(p.stock, l.qty) }, qty: l.qty }
    }
    return {
      product: {
        _id: l.productId,
        sku: l.sku,
        name: l.name,
        unit: l.unit,
        salePrice: l.unitPrice,
        stock: l.qty,
        categoryId: null,
        categoryName: null,
      },
      qty: l.qty,
    }
  })
}

/** Montos de efectivo sugeridos, mayores al total (para cobrar rápido). */
export function cashSuggestions(total: number): number[] {
  if (total <= 0) return []
  const set = new Set<number>()
  for (const step of [1000, 5000, 10000, 20000, 50000]) {
    const up = Math.ceil(total / step) * step
    if (up > total) set.add(up)
  }
  for (const bill of [2000, 5000, 10000, 20000, 50000, 100000]) {
    if (bill > total) set.add(bill)
  }
  return [...set].sort((a, b) => a - b).slice(0, 4)
}

/**
 * "Consumidor final" es como la DIAN llama a quien compra sin dar sus datos, y
 * 222222222222 el documento que se usa para él. Con esto una venta de mostrador
 * puede salir con factura electrónica sin inventarse una cédula.
 */
export const CONSUMIDOR_FINAL: Customer = {
  name: "Consumidor final",
  idNumber: "222222222222",
}

/** Valor del selector de vendedor cuando vende el mismo que cobra. */
export const QUIEN_COBRA = "__quien_cobra__"
