import { describe, expect, it } from "vitest"
import { clamp, contar, formatCOP, formatNumber, quien } from "./utils"

describe("quien", () => {
  it("el nombre si existe; si no, el correo sin dominio", () => {
    expect(quien("Camila", "demo@x.co")).toBe("Camila")
    expect(quien(undefined, "caja2@x.co")).toBe("caja2")
    expect(quien(" ", null)).toBe("—")
  })
})

describe("contar", () => {
  it("singular con 1 y plural con lo demás, sin paréntesis", () => {
    expect(contar(1, "producto")).toBe("1 producto")
    expect(contar(0, "producto")).toBe("0 productos")
    expect(contar(1200, "unidad", "unidades")).toBe("1.200 unidades")
  })
})
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
