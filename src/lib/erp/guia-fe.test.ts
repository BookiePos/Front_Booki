import { describe, expect, it } from "vitest"
import type { EmisorVista, EstadoEmisor } from "./api-einvoicing"
import { pasosAsistente, type PasoAsistente } from "./asistente-fe"
import { guiaPaso, tipoCertificado } from "./guia-fe"

const UUID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b"

const emisorBase: EmisorVista = {
  id: "e1",
  nit: "900123456",
  nitDv: "7",
  tipoAmbiente: "2",
  habilitado: false,
  certificadoVigente: false,
  certAviso: null,
  tieneFacturaPin: false,
  tieneFacturaTestSetId: false,
  tieneCertificado: false,
}
const estadoOk: EstadoEmisor = { faltaParaTransmitir: [], datosFiscalesFaltantes: [], tieneTestSetId: false }

/** La guía del paso `id` tal como la vería la pantalla con ese emisor. */
function guia(id: PasoAsistente["id"], emisor: EmisorVista | null) {
  const paso = pasosAsistente(emisor, emisor ? estadoOk : null, null).find((p) => p.id === id)!
  return guiaPaso(paso, emisor)
}
const texto = (g: ReturnType<typeof guiaPaso>) => [g?.titulo, ...(g?.pasos ?? []), g?.bookipos, g?.nota].join(" ")

describe("guiaPaso: certificado", () => {
  it("sin certificado explica la compra: ECD de ONAC, archivo .p12 y no token, contraseña y renovación", () => {
    const g = guia("certificado", emisorBase)
    expect(g?.titulo).toBe("Cómo conseguir el certificado")
    const t = texto(g)
    expect(t).toMatch(/ONAC/)
    expect(t).toMatch(/Certicámara, GSE, Andes SCD/)
    expect(t).toMatch(/archivo \.p12/)
    expect(t).toMatch(/no en token/)
    expect(t).toMatch(/contraseña/)
    expect(t).toMatch(/cada año/)
  })

  it("nombra el NIT de la sede con su DV; sin emisor lo dice genérico", () => {
    expect(texto(guia("certificado", emisorBase))).toMatch(/el NIT 900123456-7/)
    expect(texto(guia("certificado", null))).toMatch(/el NIT de la sede/)
  })

  it("el tipo de certificado depende de si es persona natural o jurídica", () => {
    expect(tipoCertificado("juridica")).toMatch(/«persona jurídica».*a nombre de la empresa/)
    expect(tipoCertificado("natural")).toMatch(/persona natural, a tu nombre/)
    expect(tipoCertificado(undefined)).toMatch(/persona jurídica.*persona natural/)
    expect(texto(guia("certificado", { ...emisorBase, tipoPersona: "natural" }))).not.toMatch(/a nombre de la empresa/)
  })

  it("vencido o por vencer: guía de renovación; vigente: sin guía", () => {
    const vencido = guia("certificado", { ...emisorBase, tieneCertificado: true })
    expect(vencido?.titulo).toBe("Cómo renovar el certificado")
    expect(vencido?.nota).toMatch(/deja de firmar/)
    const porVencer = guia("certificado", {
      ...emisorBase,
      tieneCertificado: true,
      certificadoVigente: true,
      certAviso: "por-vencer",
    })
    expect(porVencer?.titulo).toBe("Cómo renovar el certificado")
    expect(guia("certificado", { ...emisorBase, tieneCertificado: true, certificadoVigente: true })).toBeNull()
  })
})

describe("guiaPaso: registro y credenciales", () => {
  it("registro pendiente: software propio, nombre BookiPos, PIN, los tres datos y nómina aparte", () => {
    const t = texto(guia("registro", emisorBase))
    expect(t).toMatch(/portal de habilitación/)
    expect(t).toMatch(/«software propio»/)
    expect(t).toMatch(/nombre BookiPos/)
    expect(t).toMatch(/SoftwareID, PIN y TestSetId/)
    expect(t).toMatch(/nómina electrónica/)
    expect(t).toMatch(/documento equivalente POS/)
  })

  it("no da URL ni menús del portal: eso no está confirmado", () => {
    const todos = (["registro", "certificado", "credenciales", "resolucion", "pruebas"] as const)
      .map((id) => texto(guia(id, emisorBase)))
      .join(" ")
    expect(todos).not.toMatch(/https?:|www\.|\.gov\.co/)
  })

  it("registro hecho: sin guía", () => {
    expect(guia("registro", { ...emisorBase, facturaSoftwareId: UUID })).toBeNull()
  })

  it("credenciales: hay guía mientras falte algo, incluido solo el TestSetId", () => {
    expect(guia("credenciales", emisorBase)?.titulo).toBe("Dónde salen estos datos")
    const sinTestSet = { ...emisorBase, facturaSoftwareId: UUID, tieneFacturaPin: true }
    expect(guia("credenciales", sinTestSet)).not.toBeNull()
    expect(guia("credenciales", { ...sinTestSet, tieneFacturaTestSetId: true })).toBeNull()
  })
})

describe("guiaPaso: resolución, pruebas y producción", () => {
  it("resolución pendiente explica asociar prefijos; sin dato o cargando no opina", () => {
    expect(texto(guia("resolucion", emisorBase))).toMatch(/asocia cada prefijo/)
    const sinDato = pasosAsistente(emisorBase, estadoOk, undefined).find((p) => p.id === "resolucion")!
    expect(guiaPaso(sinDato, emisorBase)).toBeNull()
    const cargando = pasosAsistente(emisorBase, estadoOk, undefined, true).find((p) => p.id === "resolucion")!
    expect(guiaPaso(cargando, emisorBase)).toBeNull()
  })

  it("pruebas: dice qué hace BookiPos y desaparece al habilitarse", () => {
    const g = guia("pruebas", emisorBase)
    expect(g?.bookipos).toMatch(/BookiPos envía esos documentos/)
    expect(g?.bookipos).toMatch(/«Hecho»/)
    expect(guia("pruebas", { ...emisorBase, habilitado: true })).toBeNull()
  })

  it("producción: solo guía cuando ya está habilitada y falta el ambiente", () => {
    expect(guia("produccion", emisorBase)).toBeNull()
    expect(guia("produccion", { ...emisorBase, habilitado: true })?.titulo).toBe("Cómo pasar a producción")
    expect(guia("produccion", { ...emisorBase, habilitado: true, tipoAmbiente: "1" })).toBeNull()
  })

  it("los datos fiscales se resuelven dentro de BookiPos: sin guía", () => {
    expect(guia("datos", null)).toBeNull()
  })
})
