import { describe, expect, it } from "vitest"
import { clamp, formatCOP, formatNumber } from "./utils"
import { numOr } from "./erp/finance-format"

/** El dinero en pantalla: pesos sin decimales y con punto de miles. */
describe("formato de dinero", () => {
  it("COP sin decimales y con punto de miles", () => {
    expect(formatCOP(1_234_567).replace(/\s/g, " ")).toBe("$ 1.234.567")
    expect(formatCOP(999.6).replace(/\s/g, " ")).toBe("$ 1.000")
    expect(formatNumber(150_000)).toBe("150.000")
  })

  it("numOr no deja pasar texto que no es número", () => {
    expect(numOr("4500")).toBe(4500)
    expect(numOr("", 7)).toBe(7)
    expect(numOr("abc", 3)).toBe(3)
  })

  it("clamp acota", () => {
    expect(clamp(2)).toBe(1)
    expect(clamp(-1)).toBe(0)
  })
})
