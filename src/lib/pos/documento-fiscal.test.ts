import { describe, expect, it } from "vitest"
import {
  avisoDocumentoFiscal,
  clienteParaSalida,
  contenidoQr,
  faltaDatoFiscal,
  lineaFabricante,
  lineasResolucion,
  tiqueteFiscalDe,
} from "@/lib/pos/documento-fiscal"
import type { ElectronicDocument } from "@/lib/pos/api-einvoicing"

const CUDE = "a".repeat(96)
const URL = `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${CUDE}`

const doc = {
  _id: "d1",
  type: "pos",
  sedeId: "s1",
  number: 990000001,
  fullNumber: "SETP990000001",
  issueDate: "2026-10-31",
  issueTime: "10:15:30-05:00",
  emisor: { nit: "900123456" },
  adquiriente: { docType: "13", docNumber: "222222222222", name: "Consumidor final" },
  lines: [],
  taxableBase: 10000,
  ivaTotal: 1900,
  incTotal: 0,
  bagTaxTotal: 66,
  discountTotal: 0,
  payableAmount: 11966,
  total: 11966,
  formaPago: "1",
  resolution: {
    numero: "18760000001",
    prefijo: "SETP",
    rangoDesde: 990000000,
    rangoHasta: 995000000,
    vigenciaDesde: "2026-01-19",
    vigenciaHasta: "2028-01-19",
  },
  fabricante: { nombreApellido: "BookiPos", razonSocial: "BookiPos SAS", nit: "901234567", nombreSoftware: "BookiPos" },
  cufe: CUDE,
  qrUrl: URL,
  dianStatus: "draft",
  createdByEmail: "c@x.co",
  createdAt: "2026-10-31T15:15:30.000Z",
} as unknown as ElectronicDocument

describe("faltaDatoFiscal", () => {
  it("el POS anónimo no pide nada", () => {
    expect(faltaDatoFiscal("pos_anonimo", undefined)).toBeNull()
  })

  it("el POS con datos pide nombre, tipo y número", () => {
    expect(faltaDatoFiscal("pos_identificado", {})).toMatch(/nombre/)
    expect(faltaDatoFiscal("pos_identificado", { name: "Ana" })).toMatch(/tipo/)
    expect(faltaDatoFiscal("pos_identificado", { name: "Ana", docType: "13" })).toMatch(/número/)
    expect(
      faltaDatoFiscal("pos_identificado", { name: "Ana", docType: "13", idNumber: "1020304050" }),
    ).toBeNull()
  })

  it("una cédula sin dígitos no pasa", () => {
    expect(
      faltaDatoFiscal("pos_identificado", { name: "Ana", docType: "13", idNumber: "abc" }),
    ).toMatch(/dígitos/)
  })

  it("el NIT exige DV y lo valida con módulo 11", () => {
    const base = { name: "Tienda SAS", docType: "31", idNumber: "900123456" }
    expect(faltaDatoFiscal("pos_identificado", base)).toMatch(/DV/)
    expect(faltaDatoFiscal("pos_identificado", { ...base, nitDv: "3" })).toMatch(/debería ser 8/)
    expect(faltaDatoFiscal("pos_identificado", { ...base, nitDv: "8" })).toBeNull()
  })

  it("la factura pide nombre y número, y el DV solo si dijeron NIT", () => {
    expect(faltaDatoFiscal("fev", { name: "Ana" })).toMatch(/factura/)
    expect(faltaDatoFiscal("fev", { name: "Ana", idNumber: "123" })).toBeNull()
    expect(
      faltaDatoFiscal("fev", { name: "Ana", idNumber: "900123456", docType: "31", nitDv: "1" }),
    ).toMatch(/DV/)
  })
})

describe("clienteParaSalida", () => {
  const c = { name: "Ana", idNumber: "900123456", docType: "31", nitDv: "8" }

  it("sin documento fiscal no manda tipo ni DV (el cobro de siempre)", () => {
    expect(clienteParaSalida(undefined, c)).toEqual({ name: "Ana", idNumber: "900123456" })
    expect(clienteParaSalida("pos_anonimo", c)).toEqual({ name: "Ana", idNumber: "900123456" })
  })

  it("con datos o factura manda el tipo, y el DV solo con NIT", () => {
    expect(clienteParaSalida("pos_identificado", c)).toEqual(c)
    expect(clienteParaSalida("fev", { ...c, docType: "13" })).toEqual({
      name: "Ana",
      idNumber: "900123456",
      docType: "13",
      nitDv: undefined,
    })
  })
})

describe("avisoDocumentoFiscal", () => {
  it("separa el error del documento del cobro", () => {
    const a = avisoDocumentoFiscal({
      solicitado: "pos_anonimo",
      estado: "error",
      error: "La sede no tiene resolución POS.",
    })
    expect(a?.tono).toBe("error")
    expect(a?.titulo).toMatch(/venta quedó cobrada/)
    expect(a?.detalle).toBe("La sede no tiene resolución POS.")
  })

  it("dice el número cuando quedó emitido", () => {
    const a = avisoDocumentoFiscal({
      solicitado: "pos_identificado",
      estado: "emitido",
      fullNumber: "SETP990000001",
    })
    expect(a).toMatchObject({ tono: "ok" })
    expect(a?.titulo).toContain("SETP990000001")
  })

  it("en proceso y contingencia tienen su propio aviso", () => {
    expect(avisoDocumentoFiscal({ solicitado: "fev", estado: "en_proceso" })?.tono).toBe("progreso")
    expect(
      avisoDocumentoFiscal({ solicitado: "pos_anonimo", estado: "pendiente_contingencia_07" })?.tono,
    ).toBe("atencion")
  })

  it("sin documento pedido no hay aviso", () => {
    expect(avisoDocumentoFiscal(undefined)).toBeNull()
  })
})

describe("contenidoQr (§14.3)", () => {
  it("arma el bloque completo con valores de dos decimales", () => {
    const qr = contenidoQr(doc)!
    expect(qr.split("\n")).toEqual([
      "NumFac=SETP990000001",
      "FecFac=2026-10-31",
      "HorFac=10:15:30-05:00",
      "NitFac=900123456",
      "DocAdq=222222222222",
      "ValFac=10000.00",
      "ValIva=1900.00",
      "ValOtroIm=66.00",
      "ValTolFac=11966.00",
      `CUDE=${CUDE}`,
      `QRCode=${URL}`,
    ])
  })

  it("sin CUDE no hay QR", () => {
    expect(contenidoQr({ ...doc, cufe: undefined })).toBeUndefined()
  })
})

describe("tiqueteFiscalDe", () => {
  it("con el documento completo trae resolución, fabricante y el bloque QR", () => {
    const t = tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "emitido" }, doc)!
    expect(t.tipo).toBe("pos")
    expect(t.fullNumber).toBe("SETP990000001")
    expect(t.qr).toMatch(/^NumFac=/)
    expect(t.resolucion?.numero).toBe("18760000001")
    // Consumidor final: no se imprime como adquiriente identificado.
    expect(t.adquiriente).toBeUndefined()
    expect(t.contingencia).toBe(false)
  })

  it("sin el documento usa lo que trajo el cobro (número, CUDE y URL)", () => {
    const t = tiqueteFiscalDe({
      solicitado: "pos_anonimo",
      estado: "emitido",
      tipo: "pos",
      fullNumber: "SETP1",
      cude: CUDE,
      qrUrl: URL,
    })!
    expect(t).toMatchObject({ fullNumber: "SETP1", cude: CUDE, qr: URL })
  })

  it("en contingencia lleva la leyenda", () => {
    expect(tiqueteFiscalDe(undefined, { ...doc, dianStatus: "contingency" })?.contingencia).toBe(true)
  })

  it("un documento que no se emitió no da tiquete fiscal", () => {
    expect(tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "error" })).toBeNull()
    expect(tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "en_proceso" })).toBeNull()
  })
})

describe("textos del tiquete", () => {
  it("resolución con prefijo, rango y vigencia", () => {
    expect(lineasResolucion(doc.resolution)).toEqual([
      "Resolución DIAN 18760000001",
      "Prefijo SETP del 990000000 al 995000000",
      "Vigencia 19/01/2026 a 19/01/2028",
    ])
  })

  it("fabricante con NIT y nombre del software", () => {
    expect(lineaFabricante(doc.fabricante)).toBe(
      "Software BookiPos · Fabricante BookiPos SAS NIT 901234567",
    )
  })
})
