import { describe, expect, it } from "vitest"
import { precioAlCambiarNombre, precioDeItem } from "./restaurante-precio"

describe("precioDeItem", () => {
  it("usa el precio del menú si el campo está vacío", () => {
    expect(precioDeItem("", 18000)).toBe(18000)
  })
  it("respeta un 0 explícito", () => {
    expect(precioDeItem("0", 18000)).toBe(0)
  })
  it("usa el precio escrito", () => {
    expect(precioDeItem("12000", 18000)).toBe(12000)
  })
  it("texto libre sin precio es 0", () => {
    expect(precioDeItem("")).toBe(0)
  })
})

describe("precioAlCambiarNombre", () => {
  it("trae el precio del plato elegido", () => {
    expect(precioAlCambiarNombre("", { salePrice: 18000 }, false)).toBe("18000")
  })
  it("limpia el precio heredado al pasar a texto libre", () => {
    expect(precioAlCambiarNombre("18000", undefined, true)).toBe("")
  })
  it("conserva lo escrito si ya era texto libre", () => {
    expect(precioAlCambiarNombre("5000", undefined, false)).toBe("5000")
  })
})
