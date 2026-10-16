import { describe, expect, it } from "vitest"
import { exoneracionSiCambio, respuestaExoneracion } from "./api-payroll"

describe("exoneración de aportes (ítem 1.15)", () => {
  it("responder la pregunta manda la confirmación explícita", () => {
    expect(respuestaExoneracion(true)).toEqual({
      empresaExoneradaAportes: true,
      confirmarExoneracion: true,
    })
    expect(respuestaExoneracion(false)).toEqual({
      empresaExoneradaAportes: false,
      confirmarExoneracion: true,
    })
  })

  it("el formulario de Ajustes no manda la exoneración si no cambió", () => {
    expect(exoneracionSiCambio(false, false)).toEqual({})
    expect(exoneracionSiCambio(true, true)).toEqual({})
  })

  it("el formulario de Ajustes manda el cambio, pero nunca la confirmación", () => {
    const cambio = exoneracionSiCambio(false, true)
    expect(cambio).toEqual({ empresaExoneradaAportes: true })
    expect(cambio).not.toHaveProperty("confirmarExoneracion")
  })
})
