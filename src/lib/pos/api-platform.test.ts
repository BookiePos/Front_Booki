import { describe, expect, it } from "vitest"
import { settlementProblem } from "./api-platform"

describe("settlementProblem", () => {
  it("cuadra cuando consignado + comisión + IVA = lo que debía la plataforma", () => {
    expect(settlementProblem(200_000, 160_000, 35_000, 5_000)).toBeNull()
  })
  it("dice cuánto falta o sobra", () => {
    expect(settlementProblem(200_000, 150_000, 35_000, 5_000)).toMatch(/Faltan \$10\.000/)
    expect(settlementProblem(200_000, 170_000, 35_000, 5_000)).toMatch(/Sobran \$10\.000/)
  })
  it("retenciones y diferencia de precio entran en la ecuación", () => {
    // 200.000 + 8.000 = 150.000 + 40.000 + 5.000 + 13.000
    expect(settlementProblem(200_000, 150_000, 40_000, 5_000, 13_000, 8_000)).toBeNull()
    expect(settlementProblem(200_000, 150_000, 40_000, 5_000, 13_000, -8_000)).toMatch(/Sobran/)
  })
  it("sin pedidos elegidos no hay nada que liquidar", () => {
    expect(settlementProblem(0, 0, 0, 0)).toMatch(/al menos un pedido/)
  })
})
