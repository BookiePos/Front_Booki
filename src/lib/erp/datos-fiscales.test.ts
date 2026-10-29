import { describe, expect, it } from "vitest"

import {
  DATOS_FISCALES_VACIOS,
  calcularDvNit,
  esErrorDv,
  municipioDaneValido,
  payloadDatosFiscales,
} from "./datos-fiscales"

describe("calcularDvNit", () => {
  it("coincide con los DV conocidos de la DIAN", () => {
    expect(calcularDvNit("900123456")).toBe(8)
    expect(calcularDvNit("860002964")).toBe(4)
    expect(calcularDvNit("800197268")).toBe(4)
  })
  it("devuelve undefined si no son dígitos", () => {
    expect(calcularDvNit("90A123")).toBeUndefined()
    expect(calcularDvNit("")).toBeUndefined()
  })
})

describe("municipioDaneValido", () => {
  it("acepta vacío y 5 dígitos", () => {
    expect(municipioDaneValido("")).toBe(true)
    expect(municipioDaneValido("05001")).toBe(true)
    expect(municipioDaneValido("5001")).toBe(false)
    expect(municipioDaneValido("0500a")).toBe(false)
  })
})

describe("esErrorDv", () => {
  it("reconoce los mensajes del backend sobre el DV", () => {
    expect(esErrorDv("El DV del NIT 900 no cuadra: debería ser 8")).toBe(true)
    expect(esErrorDv("Falta el dígito de verificación (DV) del NIT")).toBe(true)
    expect(esErrorDv("El correo no es válido")).toBe(false)
  })
})

describe("payloadDatosFiscales", () => {
  it("al crear omite lo vacío", () => {
    const p = payloadDatosFiscales(DATOS_FISCALES_VACIOS, true)
    expect(Object.values(p).every((v) => v === undefined)).toBe(true)
  })
  it("al editar manda cadena vacía y [] para borrar", () => {
    const p = payloadDatosFiscales(DATOS_FISCALES_VACIOS, false)
    expect(p.dianDocType).toBe("")
    expect(p.nitDv).toBe("")
    expect(p.regimen).toBe("")
    expect(p.address).toBe("")
    expect(p.responsabilidadesFiscales).toEqual([])
  })
  it("el DV solo viaja con tipo 31", () => {
    const base = { ...DATOS_FISCALES_VACIOS, nitDv: "8" }
    expect(payloadDatosFiscales({ ...base, dianDocType: "13" }, true).nitDv).toBeUndefined()
    expect(payloadDatosFiscales({ ...base, dianDocType: "31" }, true).nitDv).toBe("8")
    expect(payloadDatosFiscales({ ...base, dianDocType: "13" }, false).nitDv).toBe("")
  })
})
