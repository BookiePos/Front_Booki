import { describe, expect, it } from "vitest"

import {
  bagTaxUnitPorProducto,
  bolsaSinTarifa,
  causaIncBolsas,
  chargeForQty,
  conservarTarifa,
  incBolsasTotal,
  tarifaBolsaVigente,
  tarifaParaVenta,
} from "./inc-bolsas"

/**
 * Casos copiados de las specs del backend: `sale-amounts.spec.ts` (chargeForQty),
 * `offline-sales.service.sync.spec.ts` (bandeja con 2 bolsas a $73) y la regla
 * de `causaIncBolsas` de core-tax.
 */
describe("chargeForQty · igual que el backend", () => {
  it("una línea de $10.001 dividida en tres suma exacto lo consumido", () => {
    const a = chargeForQty(10_001, 0, 0.333)
    const b = chargeForQty(10_001, 0.333, 0.333)
    const c = chargeForQty(10_001, 0.666, 0.334)
    for (const x of [a, b, c]) expect(Number.isInteger(x)).toBe(true)
    expect(a + b + c).toBe(10_001)
  })

  it("sin cobros previos es el precio por la cantidad, en pesos", () => {
    expect(chargeForQty(2_500, 0, 0.75)).toBe(1_875)
    expect(chargeForQty(1_001, 0, 0.5)).toBe(501)
  })
})

describe("INC de bolsas del total", () => {
  it("bandeja: plato de $11.900 + 2 bolsas a $0 con $73 de INC = $12.046", () => {
    const bolsas = incBolsasTotal(
      [
        { productId: "plato", bolsa: false, previo: 0, qty: 1 },
        { productId: "bolsa", bolsa: true, previo: 0, qty: 2 },
      ],
      73,
    )
    expect(bolsas).toBe(146)
    expect(11_900 + bolsas).toBe(12_046)
  })

  it("cuenta dividida: las partes del INC de bolsas suman el de todas", () => {
    const partes = [
      { previo: 0, qty: 0.333 },
      { previo: 0.333, qty: 0.333 },
      { previo: 0.666, qty: 0.334 },
    ].map((p) => incBolsasTotal([{ productId: "b", bolsa: true, ...p }], 73))
    expect(partes.reduce((a, n) => a + n, 0)).toBe(73)
  })

  it("tres bolsas cobradas de a una no pierden pesos", () => {
    const partes = [0, 1, 2].map((previo) =>
      incBolsasTotal([{ productId: "b", bolsa: true, previo, qty: 1 }], 73),
    )
    expect(partes).toEqual([73, 73, 73])
  })

  it("sin tarifa (impuesto inactivo) o sin producto de bolsa no suma nada", () => {
    expect(incBolsasTotal([{ productId: "b", bolsa: true, previo: 0, qty: 2 }], 0)).toBe(0)
    expect(incBolsasTotal([{ productId: "p", bolsa: false, previo: 0, qty: 2 }], 73)).toBe(0)
  })

  it("bagTaxUnit solo viaja para las líneas que lo cobran", () => {
    const m = bagTaxUnitPorProducto(
      [
        { productId: "plato", bolsa: false, previo: 0, qty: 1 },
        { productId: "bolsa", bolsa: true, previo: 0, qty: 2 },
      ],
      73,
    )
    expect([...m]).toEqual([["bolsa", 73]])
    expect(
      bagTaxUnitPorProducto([{ productId: "bolsa", bolsa: true, previo: 0, qty: 2 }], 0).size,
    ).toBe(0)
  })
})

describe("causaIncBolsas · solo responsables de IVA", () => {
  it("el restaurante responsable de INC pero no de IVA no la cobra", () => {
    expect(causaIncBolsas({ responsabilidadFiscal: "no_responsable_iva" })).toBe(false)
    expect(
      causaIncBolsas({ responsableIva: false, responsabilidadFiscal: "responsable_iva" }),
    ).toBe(false)
  })
  it("sin dato, todo salvo no_responsable_iva; el flag manda", () => {
    expect(causaIncBolsas({})).toBe(true)
    expect(causaIncBolsas({ responsabilidadFiscal: "responsable_iva" })).toBe(true)
    expect(
      causaIncBolsas({ responsableIva: true, responsabilidadFiscal: "no_responsable_iva" }),
    ).toBe(true)
    expect(causaIncBolsas(undefined)).toBe(false)
  })
})

describe("tarifaBolsaVigente · tarifa del día", () => {
  const bolsa = (active: boolean) => [
    {
      code: "INC_BOLSA",
      active,
      history: [
        { rate: 70, effectiveFrom: "2025-01-01" },
        { rate: 73, effectiveFrom: "2026-01-01" },
      ],
    },
  ]
  it("la versión vigente a la fecha: 31-dic usa la de su año", () => {
    expect(tarifaBolsaVigente(bolsa(true), "2025-12-31")).toBe(70)
    expect(tarifaBolsaVigente(bolsa(true), "2026-01-01")).toBe(73)
  })
  it("inactivo, sin versión vigente o sin el impuesto: 0", () => {
    expect(tarifaBolsaVigente(bolsa(false), "2026-06-01")).toBe(0)
    expect(tarifaBolsaVigente(bolsa(true), "2024-12-31")).toBe(0)
    expect(tarifaBolsaVigente([], "2026-06-01")).toBe(0)
  })
})

describe("tarifa desconocida (null): nunca se suma 0", () => {
  const conBolsa = [{ productId: "b", bolsa: true, previo: 0, qty: 1 }]
  const sinBolsa = [{ productId: "p", bolsa: false, previo: 0, qty: 1 }]
  it("sede que cobra bolsas y tarifa sin leer: se conserva null y bloquea el cobro con bolsa", () => {
    const t = tarifaParaVenta(true, null)
    expect(t).toBeNull()
    expect(bolsaSinTarifa(t, conBolsa)).toBe(true)
  })
  it("sin bolsa en el carrito no bloquea, aunque la tarifa sea null", () => {
    expect(bolsaSinTarifa(null, sinBolsa)).toBe(false)
  })
  it("sede que no cobra bolsas: tarifa 0 y nunca bloquea; tarifa conocida tampoco", () => {
    expect(tarifaParaVenta(false, null)).toBe(0)
    expect(bolsaSinTarifa(tarifaParaVenta(false, null), conBolsa)).toBe(false)
    expect(bolsaSinTarifa(73, conBolsa)).toBe(false)
  })
})

describe("tarifa conocida y luego fallo de red", () => {
  it("la lectura fallida conserva la tarifa y el cobro offline con bolsa sigue", () => {
    const conBolsa = [{ productId: "b", bolsa: true, previo: 0, qty: 2 }]
    const t = conservarTarifa(conservarTarifa(null, 73), null)
    expect(t).toBe(73)
    expect(bolsaSinTarifa(tarifaParaVenta(true, t), conBolsa)).toBe(false)
    expect(incBolsasTotal(conBolsa, t ?? 0)).toBe(146)
  })
  it("si nunca se pudo leer sigue null y bloquea; una lectura buena la reemplaza", () => {
    expect(conservarTarifa(null, null)).toBeNull()
    expect(conservarTarifa(70, 73)).toBe(73)
    expect(conservarTarifa(73, 0)).toBe(0)
  })
})
