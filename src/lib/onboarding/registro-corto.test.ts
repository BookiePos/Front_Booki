import { describe, expect, it } from "vitest"

import {
  armarPayloadRegistro,
  datosFiscalesPendientes,
} from "./registro-corto"

/**
 * Registro corto (ítem 6.5): el alta pide nombre, correo, contraseña y giro.
 * Los datos fiscales se piden después, desde la checklist y la sede.
 */
describe("armarPayloadRegistro", () => {
  const base = {
    businessName: "  Café Aurora ",
    plan: "negocio" as const,
    tipoNegocio: "restaurante" as const,
    ownerName: " Ana Ruiz ",
    ownerEmail: " ana@aurora.co ",
    password: "Secreta#2026",
  }

  it("manda solo identidad, plan, giro y cuenta; nada fiscal", () => {
    const payload = armarPayloadRegistro(base)
    expect(Object.keys(payload).sort()).toEqual(
      [
        "businessName",
        "ownerEmail",
        "ownerName",
        "password",
        "plan",
        "tipoNegocio",
      ].sort(),
    )
    expect(payload.businessName).toBe("Café Aurora")
    expect(payload.ownerEmail).toBe("ana@aurora.co")
    expect(payload.ownerName).toBe("Ana Ruiz")
  })

  it("descarta campos fiscales aunque el llamador los cuele", () => {
    const payload = armarPayloadRegistro({
      ...base,
      nit: "900123456",
      responsabilidadFiscal: "responsable_iva",
    } as typeof base)
    expect(payload).not.toHaveProperty("nit")
    expect(payload).not.toHaveProperty("responsabilidadFiscal")
  })
})

describe("datosFiscalesPendientes", () => {
  it("una sede recién registrada debe todo lo fiscal", () => {
    expect(datosFiscalesPendientes({})).toEqual([
      "NIT",
      "Responsabilidad fiscal",
      "Dirección",
      "Ciudad",
    ])
  })

  it("ignora espacios en blanco y quita lo ya diligenciado", () => {
    expect(
      datosFiscalesPendientes({
        nit: "900123456",
        responsabilidadFiscal: "responsable_iva",
        address: "   ",
        ciudad: "Bogotá",
      }),
    ).toEqual(["Dirección"])
  })

  it("sede completa: nada pendiente", () => {
    expect(
      datosFiscalesPendientes({
        nit: "1",
        responsabilidadFiscal: "regimen_simple",
        address: "Calle 1",
        ciudad: "Cali",
      }),
    ).toEqual([])
  })
})
