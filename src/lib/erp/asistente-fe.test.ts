import { describe, expect, it } from "vitest"
import type { EmisorVista, EstadoEmisor, ResolutionRow } from "./api-einvoicing"
import {
  armarPayloadFactura,
  estadoCertificado,
  pasosAsistente,
  resumenPasos,
  validarCertificado,
} from "./asistente-fe"

const UUID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b"
const UUID2 = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"

const emisorBase: EmisorVista = {
  id: "e1",
  nit: "900123456",
  tipoAmbiente: "2",
  habilitado: false,
  certificadoVigente: false,
  certAviso: null,
  tieneFacturaPin: false,
  tieneFacturaTestSetId: false,
  tieneCertificado: false,
}
const estadoOk: EstadoEmisor = { faltaParaTransmitir: [], datosFiscalesFaltantes: [], tieneTestSetId: false }
const resolucion = (puedeEmitir: boolean, estado = "ok", alertas: string[] = []) =>
  ({ status: { estado, puedeEmitir, alertas } }) as unknown as ResolutionRow
const paso = (ps: ReturnType<typeof pasosAsistente>, id: string) => ps.find((p) => p.id === id)!

describe("pasosAsistente", () => {
  it("sin emisor: datos pendientes y nada más hecho", () => {
    const ps = pasosAsistente(null, null, null)
    expect(ps).toHaveLength(7)
    expect(paso(ps, "datos")).toMatchObject({ estado: "pendiente", destino: "sede" })
    expect(resumenPasos(ps).hechos).toBe(0)
  })

  it("lista lo que falta de los datos fiscales", () => {
    const ps = pasosAsistente(emisorBase, { ...estadoOk, datosFiscalesFaltantes: ["nitDv", "direccion"] }, null)
    expect(paso(ps, "datos").detalle).toBe("Falta: nitDv, direccion.")
  })

  it("el certificado vencido no cuenta y lo dice", () => {
    const ps = pasosAsistente({ ...emisorBase, tieneCertificado: true }, estadoOk, null)
    expect(paso(ps, "certificado")).toMatchObject({ estado: "pendiente", destino: "certificado" })
    expect(paso(ps, "certificado").detalle).toMatch(/vencido/)
  })

  it("por vencer sigue hecho pero avisa", () => {
    const ps = pasosAsistente(
      { ...emisorBase, tieneCertificado: true, certificadoVigente: true, certAviso: "por-vencer" },
      estadoOk,
      null,
    )
    expect(paso(ps, "certificado")).toMatchObject({ estado: "hecho" })
    expect(paso(ps, "certificado").detalle).toMatch(/vence pronto/)
  })

  it("credenciales: pide SoftwareID y PIN por separado", () => {
    expect(paso(pasosAsistente(emisorBase, estadoOk, null), "credenciales").detalle).toBe("Falta: SoftwareID, PIN.")
    const conSw = { ...emisorBase, facturaSoftwareId: UUID }
    expect(paso(pasosAsistente(conSw, estadoOk, null), "credenciales").detalle).toBe("Falta: PIN.")
    const completo = { ...conSw, tieneFacturaPin: true }
    expect(paso(pasosAsistente(completo, estadoOk, null), "credenciales")).toMatchObject({ estado: "hecho" })
  })

  it("resolución: sin lectura es sin_dato, sin registrar o vencida es pendiente, vigente es hecho", () => {
    expect(paso(pasosAsistente(emisorBase, estadoOk, undefined), "resolucion").estado).toBe("sin_dato")
    expect(paso(pasosAsistente(emisorBase, estadoOk, resolucion(false, "sin_configurar")), "resolucion").estado).toBe("pendiente")
    const venc = paso(pasosAsistente(emisorBase, estadoOk, resolucion(false, "vencida", ["Vencida el 1/1"])), "resolucion")
    expect(venc).toMatchObject({ estado: "pendiente", detalle: "Vencida el 1/1", destino: "resoluciones" })
    expect(paso(pasosAsistente(emisorBase, estadoOk, resolucion(true)), "resolucion").estado).toBe("hecho")
  })

  it("mientras carga la resolución no dice que no se pudo leer", () => {
    const r = paso(pasosAsistente(emisorBase, estadoOk, undefined, true), "resolucion")
    expect(r.estado).toBe("cargando")
    expect(r.detalle).not.toMatch(/No se pudo/)
  })

  it("pruebas y producción dependen de habilitado y del ambiente", () => {
    let ps = pasosAsistente({ ...emisorBase, tieneFacturaTestSetId: true }, estadoOk, null)
    expect(paso(ps, "pruebas")).toMatchObject({ estado: "pendiente", destino: "dian" })
    expect(paso(ps, "produccion").estado).toBe("pendiente")
    ps = pasosAsistente({ ...emisorBase, habilitado: true }, estadoOk, null)
    expect(paso(ps, "pruebas").estado).toBe("hecho")
    expect(paso(ps, "produccion").detalle).toMatch(/producción/)
    ps = pasosAsistente({ ...emisorBase, habilitado: true, tipoAmbiente: "1" }, estadoOk, null)
    expect(paso(ps, "produccion").estado).toBe("hecho")
  })

  it("resumenPasos marca el siguiente pendiente", () => {
    const ps = pasosAsistente({ ...emisorBase, facturaSoftwareId: UUID }, estadoOk, null)
    const r = resumenPasos(ps)
    expect(r.hechos).toBe(2)
    expect(r.siguiente?.id).toBe("certificado")
  })
})

describe("armarPayloadFactura", () => {
  it("valida UUID y exige PIN", () => {
    expect(armarPayloadFactura({ softwareId: "x", pin: "1", testSetId: "" }, false)).toMatchObject({ ok: false })
    expect(armarPayloadFactura({ softwareId: UUID, pin: "  ", testSetId: "" }, false)).toMatchObject({ ok: false })
    expect(armarPayloadFactura({ softwareId: UUID, pin: "1", testSetId: "no" }, false)).toMatchObject({ ok: false })
  })

  it("recorta, omite el TestSetId vacío y lo manda null al quitarlo", () => {
    expect(armarPayloadFactura({ softwareId: ` ${UUID} `, pin: " 12 ", testSetId: "" }, false)).toEqual({
      ok: true,
      payload: { softwareId: UUID, pin: "12" },
    })
    expect(armarPayloadFactura({ softwareId: UUID, pin: "1", testSetId: UUID2 }, false)).toMatchObject({
      payload: { testSetId: UUID2 },
    })
    expect(armarPayloadFactura({ softwareId: UUID, pin: "1", testSetId: "basura" }, true)).toMatchObject({
      ok: true,
      payload: { testSetId: null },
    })
  })
})

describe("validarCertificado", () => {
  const f = (name: string, size = 100) => ({ name, size })
  it("exige archivo .p12/.pfx, tamaño razonable y contraseña", () => {
    expect(validarCertificado({ archivo: null, password: "x" })).toMatch(/Elige/)
    expect(validarCertificado({ archivo: f("a.pdf"), password: "x" })).toMatch(/\.p12/)
    expect(validarCertificado({ archivo: f("a.p12", 0), password: "x" })).toMatch(/vacío/)
    expect(validarCertificado({ archivo: f("a.p12", 60_000), password: "x" })).toMatch(/pesa/)
    expect(validarCertificado({ archivo: f("a.p12"), password: "" })).toMatch(/contraseña/)
    expect(validarCertificado({ archivo: f("FIRMA.PFX"), password: "x" })).toBeNull()
  })
})

describe("estadoCertificado", () => {
  const ahora = new Date("2026-11-05T12:00:00Z")
  const en = (dias: number) => new Date(ahora.getTime() + dias * 86_400_000).toISOString()
  it("sin certificado", () => {
    expect(estadoCertificado({ tieneCertificado: false }, ahora).tono).toBe("vacio")
  })
  it("vencido", () => {
    expect(estadoCertificado({ tieneCertificado: true, certVenceAt: en(-1) }, ahora).tono).toBe("error")
  })
  it("menos de 30 días avisa; 30 o más está bien", () => {
    const a = estadoCertificado({ tieneCertificado: true, certVenceAt: en(10) }, ahora)
    expect(a).toMatchObject({ tono: "aviso", diasRestantes: 10 })
    expect(estadoCertificado({ tieneCertificado: true, certVenceAt: en(29.5) }, ahora).tono).toBe("aviso")
    expect(estadoCertificado({ tieneCertificado: true, certVenceAt: en(30) }, ahora).tono).toBe("ok")
  })
  it("sin fecha conocida pide volver a subirlo", () => {
    expect(estadoCertificado({ tieneCertificado: true }, ahora).tono).toBe("error")
  })
})
