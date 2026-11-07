import { describe, expect, it } from "vitest"
import { exoneracionSiCambio, netoLiquidacion, respuestaExoneracion, tieneRetencion } from "./api-payroll"

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

describe("neto de la liquidación de retiro", () => {
  it("con retención, el neto es el que trae el backend", () => {
    const b = { total: 10_000_000, retencionFuente: 500_000, netoPagar: 9_500_000 }
    expect(tieneRetencion(b)).toBe(true)
    expect(netoLiquidacion(b)).toBe(9_500_000)
  })

  it("una retención de 0 se muestra (es dato, no ausencia)", () => {
    expect(tieneRetencion({ retencionFuente: 0 })).toBe(true)
  })

  it("liquidaciones viejas sin los campos conservan el total y no muestran retención", () => {
    const b: { total: number; retencionFuente?: number } = { total: 4_000_000 }
    expect(tieneRetencion(b)).toBe(false)
    expect(netoLiquidacion(b)).toBe(4_000_000)
  })
})
