import { describe, expect, it } from "vitest"
import { validarPassword } from "./password-policy"

/** Réplica de la política del backend: si se desalinea, el formulario pasa y el API responde 400. */
describe("validarPassword", () => {
  it("acepta una contraseña con las cuatro clases y 8 caracteres", () => {
    expect(validarPassword("Clave-2026")).toBeNull()
  })

  it("dice exactamente qué falta", () => {
    expect(validarPassword("abc")).toBe(
      "La contraseña necesita al menos 8 caracteres, una mayúscula, un número, un símbolo.",
    )
  })

  it("los símbolos que no cuenta el backend tampoco cuentan aquí", () => {
    expect(validarPassword("Clave2026¡")).toContain("un símbolo")
    expect(validarPassword("Clave2026€")).toContain("un símbolo")
  })
})
