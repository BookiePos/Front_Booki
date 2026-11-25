import { describe, expect, it } from "vitest"
import type { PosProduct } from "@/lib/pos/api-sales"
import {
  VIGENCIA_VENTA_MS,
  interpretarVenta,
  restaurarCarrito,
  serializarVenta,
} from "./venta-en-curso"

const prod = (id: string, salePrice: number, stock: number) =>
  ({ _id: id, sku: id, name: id, unit: "und", salePrice, stock, categoryId: null, categoryName: null }) as PosProduct

describe("venta en curso", () => {
  const ahora = 1_800_000_000_000

  it("guarda solo id, cantidad y descuento, y vuelve con el precio de hoy", () => {
    const g = serializarVenta([{ product: prod("ham", 18000, 10), qty: 2, discountId: "d1" }], ahora)
    expect(g.lineas).toEqual([{ id: "ham", qty: 2, discountId: "d1" }])
    const leida = interpretarVenta(JSON.stringify(g), ahora + 1000)
    const carrito = restaurarCarrito(leida, [prod("ham", 19000, 10)])
    expect(carrito).toHaveLength(1)
    expect(carrito[0].product.salePrice).toBe(19000)
    expect(carrito[0].qty).toBe(2)
    expect(carrito[0].discountId).toBe("d1")
  })

  it("no recupera lo que ya no existe, lo agotado ni más de lo que hay", () => {
    const g = serializarVenta(
      [
        { product: prod("ham", 1, 9), qty: 5 },
        { product: prod("borrado", 1, 9), qty: 1 },
        { product: prod("agotado", 1, 9), qty: 1 },
      ],
      ahora,
    )
    const carrito = restaurarCarrito(g, [prod("ham", 1, 3), prod("agotado", 1, 0)])
    expect(carrito.map((i) => [i.product._id, i.qty])).toEqual([["ham", 3]])
  })

  it("la venta de ayer o un texto dañado no vuelven", () => {
    const g = serializarVenta([{ product: prod("ham", 1, 9), qty: 1 }], ahora)
    expect(interpretarVenta(JSON.stringify(g), ahora + VIGENCIA_VENTA_MS + 1)).toBeNull()
    expect(interpretarVenta("{no es json", ahora)).toBeNull()
    expect(interpretarVenta(JSON.stringify({ v: 2, guardada: ahora, lineas: [] }), ahora)).toBeNull()
    expect(interpretarVenta(null, ahora)).toBeNull()
  })
})
