import { describe, expect, it } from "vitest"

import {
  DATOS_FISCALES_VACIOS,
  calcularDvNit,
  esErrorDv,
  fiscalDeCliente,
  municipioDaneValido,
  payloadDatosFiscales,
} from "./datos-fiscales"

describe("calcularDvNit", () => {
  it("coincide con los DV conocidos de la DIAN", () => {
    expect(calcularDvNit("900123456")).toBe(8)
    expect(calcularDvNit("860002964")).toBe(4)
    expect(calcularDvNit("800197268")).toBe(4)
    expect(calcularDvNit("899999068")).toBe(1)
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
  // Mensajes literales del backend (customers/domain/datos-fiscales.ts y DTO).
  it("contrato: reconoce los mensajes literales del backend", () => {
    expect(
      esErrorDv("Falta el dígito de verificación (DV) del NIT: complétalo en el campo «DV»."),
    ).toBe(true)
    expect(
      esErrorDv(
        "El DV del NIT 900123456 no cuadra: debería ser 8, no 5. Corrige el campo «DV» (o el «Número de documento» si el NIT está mal).",
      ),
    ).toBe(true)
    expect(esErrorDv("El DV debe ser un solo dígito")).toBe(true)
    expect(
      esErrorDv("El municipio debe ser el código DANE de 5 dígitos"),
    ).toBe(false)
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
  it("al editar no manda tipo ni DV si no cambiaron (cliente viejo con DV malo)", () => {
    const viejo = fiscalDeCliente({ dianDocType: "31", nitDv: "5", address: "Calle 1" })
    const p = payloadDatosFiscales({ ...viejo, address: "Calle 2" }, false, viejo)
    expect(p.dianDocType).toBeUndefined()
    expect(p.nitDv).toBeUndefined()
    expect(p.address).toBe("Calle 2")
    expect(p.responsabilidadesFiscales).toBeUndefined()
  })
  it("al editar manda el DV si cambió y '' si se vació un campo", () => {
    const viejo = fiscalDeCliente({ dianDocType: "31", nitDv: "5", regimen: "responsable_iva" })
    const p = payloadDatosFiscales({ ...viejo, nitDv: "8", regimen: "" }, false, viejo)
    expect(p.nitDv).toBe("8")
    expect(p.dianDocType).toBeUndefined()
    expect(p.regimen).toBe("")
  })
})
