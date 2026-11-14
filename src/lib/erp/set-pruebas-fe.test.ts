import { describe, expect, it } from "vitest"
import type { HabilitacionFacturaVista } from "./api-einvoicing"
import { estadoSetPruebas, faltantesSetPruebas, textoFaseSet } from "./set-pruebas-fe"

const emisorListo = {
  tipoAmbiente: "2",
  certificadoVigente: true,
  facturaSoftwareId: "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  tieneFacturaPin: true,
  tieneFacturaTestSetId: true,
}

type Doc = HabilitacionFacturaVista["documentos"][number]
const doc = (estado: Doc["estado"], n: number, mensaje: string | null = null, tipo: Doc["tipo"] = "fv"): Doc => ({
  tipo,
  etiqueta: tipo === "fv" ? "Factura de venta" : "Nota crédito",
  numero: `SETP${n}`,
  estado,
  mensaje,
  intentos: 1,
})
const vista = (documentos: Doc[], extra: Partial<HabilitacionFacturaVista> = {}): HabilitacionFacturaVista => ({
  clase: "fe",
  estado: "en_curso",
  aprobada: false,
  listoParaProduccion: false,
  mensaje: "",
  documentos,
  resumen: {
    porTipo: {},
    aprobada: false,
    aceptados: documentos.filter((d) => d.estado === "aceptado").length,
    exigidos: 10,
    total: documentos.length,
  },
  ...extra,
})

describe("faltantesSetPruebas", () => {
  it("sin emisor pide los datos fiscales", () => {
    expect(faltantesSetPruebas(null)).toHaveLength(1)
  })

  it("con todo guardado no falta nada (la resolución no es requisito)", () => {
    expect(faltantesSetPruebas(emisorListo)).toEqual([])
  })

  it("nombra cada precondición que falta", () => {
    const f = faltantesSetPruebas({
      tipoAmbiente: "2",
      certificadoVigente: false,
      tieneFacturaPin: false,
      tieneFacturaTestSetId: false,
    })
    expect(f.join(" ")).toMatch(/certificado.*SoftwareID.*PIN.*TestSetId/)
  })

  it("en producción el set no corre, aunque lo demás esté", () => {
    const f = faltantesSetPruebas({ ...emisorListo, tipoAmbiente: "1" })
    expect(f).toHaveLength(1)
    expect(f[0]).toMatch(/producción/)
  })
})

describe("estadoSetPruebas", () => {
  it("sin vista o sin iniciar: se puede enviar y no hay nada que actualizar", () => {
    for (const v of [null, vista([], { estado: "sin_iniciar" })]) {
      expect(estadoSetPruebas(v)).toMatchObject({ fase: "sin_iniciar", accion: "enviar", puedeActualizar: false })
    }
  })

  it("todo en revisión: solo se actualiza, no se reenvía", () => {
    const e = estadoSetPruebas(vista([doc("enviado", 1), doc("enviando", 2)]))
    expect(e).toMatchObject({ fase: "en_curso", accion: null, puedeActualizar: true, enRevision: 2 })
    expect(textoFaseSet(e)).toMatch(/Actualizar estado/)
    expect(textoFaseSet(e)).not.toMatch(/Continuar envío/)
  })

  it("notas pendientes: hay que continuar el envío", () => {
    const e = estadoSetPruebas(vista([doc("aceptado", 1), doc("pendiente", 2, null, "nc")]))
    expect(e).toMatchObject({ fase: "en_curso", accion: "continuar", puedeActualizar: false, porEnviar: 1, aceptados: 1 })
    expect(textoFaseSet(e)).toMatch(/1 de 10 documentos aceptados.*Queda 1 documento por enviar/)
  })

  it("rechazados: trae los motivos de la DIAN y ofrece reintentar", () => {
    const e = estadoSetPruebas(
      vista([doc("rechazado", 1, "Regla FAD06: NIT inválido"), doc("rechazado", 2), doc("enviado", 3)]),
    )
    expect(e).toMatchObject({ fase: "rechazado", accion: "reintentar", puedeActualizar: true })
    expect(e.motivos).toEqual([
      "Factura de venta SETP1: Regla FAD06: NIT inválido",
      "Factura de venta SETP2: Rechazado por la DIAN",
    ])
    expect(textoFaseSet(e)).toMatch(/rechazó 2 documentos/)
  })

  it("«set ya aceptado» en un documento no cuenta como rechazo", () => {
    const e = estadoSetPruebas(
      vista([doc("set_aceptado", 1, "La DIAN dio tu set por aceptado")], {
        aprobada: true,
        estado: "aprobada",
        listoParaProduccion: true,
      }),
    )
    expect(e).toMatchObject({ fase: "aceptado", accion: null, motivos: [] })
  })

  it("documentos aceptados sin veredicto del set: por confirmar, no aceptado", () => {
    const e = estadoSetPruebas(vista([doc("aceptado", 1)], { aprobada: true, estado: "aprobada" }))
    expect(e).toMatchObject({ fase: "por_confirmar", accion: null, puedeActualizar: false })
    expect(textoFaseSet(e)).toMatch(/portal de la DIAN/)
  })

  it("un error de configuración (sin rechazos) no se presenta como rechazo de la DIAN", () => {
    const e = estadoSetPruebas(vista([doc("pendiente", 1)], { error: "No hay certificado para firmar." }))
    expect(e).toMatchObject({ fase: "en_curso", accion: "continuar", motivos: [] })
  })
})
