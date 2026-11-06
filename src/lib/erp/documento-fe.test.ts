import { describe, expect, it } from "vitest"
import {
  correoValido,
  cufeCorto,
  etiquetaReintento,
  mensajeRangosFallidos,
  motivoSinCorreo,
  payloadDeRango,
  motivoRangoNoRegistrable,
  formularioDesdeRango,
  exigeClaveManual,
  rangoVencido,
  coincideConRango,
  claveRango,
  textoVigencia,
  textoEntrega,
  textoRango,
  tonoEstadoDian,
} from "./documento-fe"
import type { DetalleDocumentoFe } from "./api-einvoicing"

const base: DetalleDocumentoFe = {
  id: "d1",
  tipo: "invoice",
  sedeId: "s1",
  numero: "FE125",
  fecha: "2026-11-01",
  dianStatus: "accepted",
  estadoResumen: "Aceptado por la DIAN",
  total: 1000,
  emisor: {},
  adquiriente: {},
  motivos: [],
  intentos: 1,
  puedeReintentar: false,
  descargas: { xml: true, pdf: true, zip: true },
  correo: { envios: 0, restantes: 5, puedeEnviar: true },
}

describe("estado DIAN", () => {
  it("el tono sigue al estado", () => {
    expect(tonoEstadoDian("accepted")).toBe("ok")
    expect(tonoEstadoDian("rejected")).toBe("error")
    expect(tonoEstadoDian("sent")).toBe("aviso")
    expect(tonoEstadoDian("draft")).toBe("neutro")
  })
  it("el botón de reintento dice lo que hace", () => {
    expect(etiquetaReintento("sent")).toMatch(/Consultar/)
    expect(etiquetaReintento("rejected")).toMatch(/Reenviar/)
    expect(etiquetaReintento("signed")).toMatch(/Enviar/)
  })
})

describe("correo", () => {
  it("valida el formato", () => {
    expect(correoValido("a@b.co")).toBe(true)
    expect(correoValido(" cliente@ejemplo.com ")).toBe(true)
    expect(correoValido("sin-arroba")).toBe(false)
    expect(correoValido("a@b")).toBe(false)
    expect(correoValido("a b@c.co")).toBe(false)
  })
  it("solo se envía un aceptado, de tipo factura y bajo el tope", () => {
    expect(motivoSinCorreo(base)).toBeNull()
    expect(motivoSinCorreo({ ...base, dianStatus: "rejected" })).toMatch(/aceptado/)
    expect(motivoSinCorreo({ ...base, tipo: "credit_note" })).toMatch(/factura/)
    expect(
      motivoSinCorreo({
        ...base,
        correo: { envios: 5, restantes: 0, puedeEnviar: false },
      }),
    ).toMatch(/máximo/)
  })
})

describe("entrega", () => {
  it("no habla de entrega si no está aceptado", () => {
    expect(textoEntrega({ ...base, dianStatus: "sent" })).toBeNull()
  })
  it("describe cada estado de la entrega", () => {
    expect(textoEntrega(base)).toMatch(/aún no se genera/)
    expect(textoEntrega({ ...base, entrega: { estado: "completa" } })).toMatch(/lista/)
    expect(textoEntrega({ ...base, entrega: { estado: "incompleta" } })).toMatch(/Solo el PDF/)
    expect(textoEntrega({ ...base, entrega: { estado: "fallida" } })).toMatch(/Falló/)
  })
})

describe("CUFE y rangos", () => {
  it("acorta el CUFE largo y deja el corto", () => {
    expect(cufeCorto(undefined)).toBe("—")
    expect(cufeCorto("abc")).toBe("abc")
    expect(cufeCorto("a".repeat(96))).toBe(`${"a".repeat(12)}…${"a".repeat(8)}`)
  })
  it("arma el texto y el payload del rango", () => {
    const r = { prefijo: "FE", desde: 1, hasta: 5000, resolucion: "1876", registrada: false }
    expect(textoRango(r)).toBe("FE 1 – 5000")
    expect(textoRango({ ...r, prefijo: undefined })).toBe("1 – 5000")
    expect(payloadDeRango(r)).toEqual({
      numero: "1876",
      prefijo: "FE",
      rangoDesde: 1,
      rangoHasta: 5000,
    })
    // La clave técnica nunca viene del rango.
    expect(payloadDeRango(r)).not.toHaveProperty("claveTecnica")
  })
  it("detecta rangos vencidos y arma la vigencia", () => {
    const r = { desde: 1, hasta: 2, vigenciaDesde: "2020-01-01", vigenciaHasta: "2021-01-01", registrada: false }
    expect(rangoVencido(r, new Date(2026, 10, 5))).toBe(true)
    expect(rangoVencido({ ...r, vigenciaHasta: "2026-11-05" }, new Date(2026, 10, 5))).toBe(false)
    expect(rangoVencido({ ...r, vigenciaHasta: undefined })).toBe(false)
    expect(textoVigencia(r)).toBe("Vigente del 2020-01-01 al 2021-01-01")
    expect(textoVigencia({ ...r, vigenciaDesde: undefined, vigenciaHasta: undefined })).toMatch(/Sin fechas/)
  })
  it("compara el formulario con el rango y da clave estable", () => {
    const r = { prefijo: "FE", desde: 1, hasta: 5, resolucion: "9", registrada: false }
    const base = payloadDeRango(r)
    expect(coincideConRango({ ...base, prefijo: "fe" }, base)).toBe(true)
    expect(coincideConRango({ ...base, rangoHasta: 6 }, base)).toBe(false)
    expect(claveRango(r)).toBe("9|FE|1|5")
  })
  it("explica por qué no se pudieron traer los rangos", () => {
    expect(mensajeRangosFallidos({ ok: true, mensajes: [] })).toBeNull()
    expect(mensajeRangosFallidos({ ok: false, codigo: "CONFIG_FALTANTE", mensajes: [] })).toMatch(/Falta configurar/)
    expect(mensajeRangosFallidos({ ok: false, mensajes: ["x"] })).toBe("x")
    expect(mensajeRangosFallidos({ ok: false, mensajes: [] })).toMatch(/no respondió/)
  })
})

describe("registrar desde un rango de la DIAN", () => {
  const rango = {
    numero: "9",
    prefijo: "FE",
    rangoDesde: 1,
    rangoHasta: 5,
    fechaResolucion: "2026-01-01",
    vigenciaDesde: "2026-01-02",
    vigenciaHasta: "2099-01-01",
  }
  it("otra resolución parte en blanco y copia todo, también lo vacío", () => {
    const guardado = {
      numero: "1",
      prefijo: "OLD",
      rangoDesde: 10,
      rangoHasta: 20,
      vigenciaDesde: "2020-01-01",
      vigenciaHasta: "2021-01-01",
      fechaResolucion: "2020-01-01",
      claveTecnica: "vieja",
    }
    const { form, reiniciaConsecutivo } = formularioDesdeRango(guardado, {
      ...rango,
      prefijo: undefined,
      vigenciaDesde: undefined,
    })
    expect(form.prefijo).toBe("")
    expect(form.vigenciaDesde).toBe("")
    expect(form.numero).toBe("9")
    expect(form.rangoHasta).toBe(5)
    expect(form).not.toHaveProperty("claveTecnica")
    expect(reiniciaConsecutivo).toBe(true)
  })
  it("la misma resolución conserva lo guardado y no mueve el consecutivo", () => {
    const { form, reiniciaConsecutivo } = formularioDesdeRango(
      { numero: "9", prefijo: "FE", claveTecnica: "x" },
      rango,
    )
    expect(form.claveTecnica).toBe("x")
    expect(form.vigenciaHasta).toBe("2099-01-01")
    expect(reiniciaConsecutivo).toBe(false)
  })
  it("sin guardado parte en blanco", () => {
    expect(formularioDesdeRango(undefined, rango).form.numero).toBe("9")
  })
  it("sin vigenciaHasta o vencido no se registra", () => {
    const r = { desde: 1, hasta: 2, registrada: false }
    expect(motivoRangoNoRegistrable(r)).toMatch(/no informa/)
    expect(motivoRangoNoRegistrable({ ...r, vigenciaHasta: "2020-01-01" })).toMatch(/Vencido/)
    expect(motivoRangoNoRegistrable({ ...r, vigenciaHasta: "2099-01-01" })).toBeNull()
  })
  it("la clave se exige a mano si el servidor no puede leerla", () => {
    const ok = { desdeRango: true, coincide: true, puedeConfigurar: true, claveTecleada: false }
    expect(exigeClaveManual(ok)).toBe(false)
    expect(exigeClaveManual({ ...ok, coincide: false })).toBe(true)
    expect(exigeClaveManual({ ...ok, puedeConfigurar: false })).toBe(true)
    expect(exigeClaveManual({ ...ok, desdeRango: false })).toBe(true)
    expect(exigeClaveManual({ ...ok, coincide: false, claveTecleada: true })).toBe(false)
  })
})
