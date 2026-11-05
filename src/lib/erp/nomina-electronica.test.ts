import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api"
import {
  DIAN_DOC_TYPES,
  DIAN_MEDIOS_PAGO,
  DIAN_SUBTIPOS_TRABAJADOR,
  DIAN_TIPOS_CONTRATO,
  DIAN_TIPOS_TRABAJADOR,
  cuentaParaEnviar,
  errorMunicipioDane,
  nominaDesdeEmpleado,
  nominaEnBlanco,
  payloadNomina,
  textoCuentaRegistrada,
} from "@/lib/erp/nomina-electronica-empleado"
import { armarPayloadNomina, mensajeErrorNomina } from "@/lib/erp/nomina-emisor"

const codigos = (o: readonly { value: string }[]) => o.map((x) => x.value)

describe("catálogos DIAN (espejo del backend)", () => {
  it("usa exactamente los códigos que acepta el backend", () => {
    expect(codigos(DIAN_DOC_TYPES)).toEqual(["11", "12", "13", "21", "22", "31", "41", "42", "47", "50", "91"])
    expect(codigos(DIAN_TIPOS_TRABAJADOR)).toEqual([
      "01", "02", "04", "12", "18", "19", "21", "22", "23", "30", "31", "47", "51", "54", "56", "58",
    ])
    expect(codigos(DIAN_SUBTIPOS_TRABAJADOR)).toEqual(["00", "01"])
    expect(codigos(DIAN_TIPOS_CONTRATO)).toEqual(["1", "2", "3", "4", "5"])
    expect(codigos(DIAN_MEDIOS_PAGO)).toEqual(["1", "10", "20", "42", "47", "48", "49"])
  })
})

describe("mapeo de la ficha del empleado", () => {
  it("rellena el formulario con lo guardado y deja vacío lo ausente", () => {
    expect(nominaDesdeEmpleado({})).toEqual(nominaEnBlanco())
    const f = nominaDesdeEmpleado({ tipoTrabajador: "01", altoRiesgoPension: true, municipioDaneTrabajo: "11001" })
    expect(f.tipoTrabajador).toBe("01")
    expect(f.altoRiesgoPension).toBe(true)
    expect(f.municipioDaneTrabajo).toBe("11001")
  })

  it("envía '' para limpiar un enum y recorta los textos", () => {
    const p = payloadNomina({ ...nominaEnBlanco(), secondLastName: "  Pérez ", medioPago: "" })
    expect(p.secondLastName).toBe("Pérez")
    expect(p.medioPago).toBe("")
    expect(p.tipoContratoDian).toBe("")
  })

  it("valida el municipio DANE de 5 dígitos", () => {
    expect(errorMunicipioDane("")).toBeNull()
    expect(errorMunicipioDane("11001")).toBeNull()
    expect(errorMunicipioDane("1100")).not.toBeNull()
  })
})

describe("cuenta bancaria enmascarada", () => {
  it("no reenvía la cuenta si el usuario no escribió una nueva", () => {
    expect(cuentaParaEnviar("")).toBeUndefined()
    expect(cuentaParaEnviar("   ")).toBeUndefined()
    expect(cuentaParaEnviar("••••1234")).toBeUndefined()
  })

  it("envía la cuenta nueva recortada", () => {
    expect(cuentaParaEnviar(" 123-456 ")).toBe("123-456")
  })

  it("muestra la terminación como ayuda", () => {
    expect(textoCuentaRegistrada({ tieneCuenta: true, accountNumber: "••••1234" })).toContain("terminada en 1234")
    expect(textoCuentaRegistrada({ tieneCuenta: false })).toBeNull()
    expect(textoCuentaRegistrada(null)).toBeNull()
  })
})

describe("nómina del emisor", () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000"

  it("no arma el payload con PIN vacío ni con UUID inválido", () => {
    expect(armarPayloadNomina({ softwareId: uuid, pin: "  ", testSetId: "" }, false).ok).toBe(false)
    expect(armarPayloadNomina({ softwareId: "x", pin: "1234", testSetId: "" }, false).ok).toBe(false)
    expect(armarPayloadNomina({ softwareId: uuid, pin: "1", testSetId: "malo" }, false).ok).toBe(false)
  })

  it("omite testSetId vacío, lo envía si es válido y lo borra con null", () => {
    const sin = armarPayloadNomina({ softwareId: uuid, pin: "1234", testSetId: "" }, false)
    expect(sin.ok && "testSetId" in sin.payload).toBe(false)
    const con = armarPayloadNomina({ softwareId: uuid, pin: "1234", testSetId: uuid }, false)
    expect(con.ok && con.payload.testSetId).toBe(uuid)
    const borrar = armarPayloadNomina({ softwareId: uuid, pin: "1234", testSetId: "" }, true)
    expect(borrar.ok && borrar.payload.testSetId).toBeNull()
  })

  it("traduce el 503 a un mensaje de soporte", () => {
    expect(mensajeErrorNomina(new ApiError(503, "x"))).toBe(
      "Falta la llave de cifrado en el servidor; avisa al soporte.",
    )
    expect(mensajeErrorNomina(new ApiError(400, "malo"))).toBe("malo")
  })
})
