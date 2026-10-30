import { describe, expect, it } from "vitest"

import {
  descuentoComoFila,
  detalleBolsa,
  etiquetaTributo,
  filasDeTotales,
  totalAPagar,
} from "./factura-electronica-vista"

const base = { taxableBase: 0, ivaTotal: 0, discountTotal: 0, total: 0 }

describe("factura electrónica · etiqueta de tributo por línea", () => {
  it("documento nuevo: IVA, INC, exento y sin impuesto", () => {
    expect(etiquetaTributo({ ivaRate: 19, taxScheme: "01", taxRate: 19 }, true)).toBe("IVA 19%")
    expect(etiquetaTributo({ ivaRate: 0, taxScheme: "04", taxRate: 8 }, true)).toBe("INC 8%")
    expect(etiquetaTributo({ ivaRate: 0, taxScheme: "01", taxRate: 0 }, true)).toBe("Exento")
    expect(etiquetaTributo({ ivaRate: 0 }, true)).toBe("Sin impuesto")
  })
  it("documento viejo: como antes, IVA con ivaRate", () => {
    expect(etiquetaTributo({ ivaRate: 19 }, false)).toBe("IVA 19%")
    expect(etiquetaTributo({ ivaRate: 0 }, false)).toBe("IVA 0%")
  })
  it("bolsa: unidades × valor por unidad", () => {
    const m = (n: number) => `$${n}`
    expect(
      detalleBolsa({ ivaRate: 0, perUnitTax: { unidades: 2, valorUnitario: 73, valor: 146 } }, m),
    ).toBe("INC bolsas 2 × $73 = $146")
    expect(detalleBolsa({ ivaRate: 0 }, m)).toBeUndefined()
  })
})

describe("factura electrónica · totales", () => {
  it("las filas de un documento nuevo suman el TOTAL (INC, bolsas, propina)", () => {
    // Venta: comida 100.000 + INC 8 % = 108.000; domicilio 5.000 (4.630 + 370);
    // 2 bolsas a 73; propina 10.000.
    const doc = {
      ...base,
      taxableBase: 104_630,
      incTotal: 8_370,
      bagTaxTotal: 146,
      charges: [{ chargeIndicator: true, reason: "Propina voluntaria", amount: 10_000 }],
      chargeTotal: 10_000,
      payableAmount: 123_146,
      total: 123_146,
    }
    const filas = filasDeTotales(doc)
    expect(filas.map((f) => f.clave)).toEqual(["base", "iva", "inc", "bolsas", "propina"])
    expect(filas.reduce((a, f) => a + f.value, 0)).toBe(totalAPagar(doc))
  })
  it("la fila de cargos usa chargeTotal tal cual", () => {
    const doc = { ...base, charges: [], chargeTotal: 7_000, payableAmount: 7_000, total: 7_000 }
    expect(filasDeTotales(doc).find((f) => f.clave === "propina")?.value).toBe(7_000)
  })
  it("IVA y exentos: sin filas vacías, suma exacta", () => {
    const doc = { ...base, taxableBase: 20_000, ivaTotal: 1_900, payableAmount: 21_900, total: 21_900 }
    const filas = filasDeTotales(doc)
    expect(filas.map((f) => f.clave)).toEqual(["base", "iva"])
    expect(filas.reduce((a, f) => a + f.value, 0)).toBe(21_900)
  })
  it("documento viejo: base e IVA y el total de siempre", () => {
    const doc = { ...base, taxableBase: 10_000, ivaTotal: 1_900, discountTotal: 500, total: 11_900 }
    expect(filasDeTotales(doc).map((f) => f.clave)).toEqual(["base", "iva"])
    expect(totalAPagar(doc)).toBe(11_900)
    expect(descuentoComoFila(doc)).toBe(true)
  })
  it("el descuento de un documento nuevo es informativo, no una fila", () => {
    const doc = { ...base, discountTotal: 500, payableAmount: 1_000, total: 1_000 }
    expect(descuentoComoFila(doc)).toBe(false)
  })
})
