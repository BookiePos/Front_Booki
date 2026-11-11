import { describe, expect, it } from "vitest"
import {
  avisoDocumentoFiscal,
  clienteParaSalida,
  clienteTiquete,
  contenidoQr,
  faltaDatoFiscal,
  faltaEnFicha,
  impuestosDe,
  lineaFabricante,
  lineasResolucion,
  puedeTranscribir,
  separarNitConDv,
  tiqueteFiscalDe,
  tituloTiquete,
  TITULO_SIN_DOCUMENTO,
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

const FICHA_COMPLETA = {
  docNumber: "123",
  dianDocType: "13",
  tipoPersona: "2",
  responsabilidadesFiscales: ["R-99-PN"],
  municipioDane: "11001",
  address: "Cra 1 # 2-3",
  email: "ana@x.co",
}

describe("faltaEnFicha", () => {
  it("POS con datos: la ficha sin tipo DIAN se avisa antes de cobrar", () => {
    const sinTipo = { ...FICHA_COMPLETA, dianDocType: undefined }
    expect(faltaEnFicha("pos_identificado", sinTipo, "123")).toMatch(/tipo de documento DIAN/)
    expect(faltaEnFicha("pos_identificado", FICHA_COMPLETA, "123")).toBeNull()
  })

  it("factura: lista todo lo que le falta a la ficha", () => {
    const m = faltaEnFicha("fev", { docNumber: "123", dianDocType: "13" }, "123")
    expect(m).toMatch(/tipo de persona, responsabilidades fiscales, municipio .*, dirección, correo de facturación/)
    expect(faltaEnFicha("fev", FICHA_COMPLETA, "123")).toBeNull()
  })

  it("NIT de la ficha sin DV o con DV malo se avisa antes de cobrar", () => {
    const nit = { ...FICHA_COMPLETA, docNumber: "900123456", dianDocType: "31" }
    expect(faltaEnFicha("pos_identificado", nit, "900123456")).toMatch(/DV del NIT/)
    expect(faltaEnFicha("fev", { ...nit, nitDv: "3" }, "900123456")).toMatch(/debería ser 8/)
    expect(faltaEnFicha("fev", { ...nit, nitDv: "8" }, "900123456")).toBeNull()
  })

  it("el correo tecleado cuenta como correo de facturación", () => {
    const sinCorreo = { ...FICHA_COMPLETA, email: undefined }
    expect(faltaEnFicha("fev", sinCorreo, "123")).toMatch(/correo/)
    expect(faltaEnFicha("fev", sinCorreo, "123", "ana@x.co")).toBeNull()
  })

  it("factura con un número distinto al de la ficha: el backend la descartaría", () => {
    expect(faltaEnFicha("fev", FICHA_COMPLETA, "123-4")).toMatch(/no es el de la ficha/)
  })
})

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

  it("la factura exige cliente registrado (su ficha trae los datos fiscales)", () => {
    expect(faltaDatoFiscal("fev", { name: "Ana", idNumber: "123" })).toMatch(/cliente registrado/)
    const reg = { ficha: FICHA_COMPLETA }
    expect(faltaDatoFiscal("fev", { name: "Ana" }, reg)).toMatch(/factura/)
    expect(faltaDatoFiscal("fev", { name: "Ana", idNumber: "123" }, reg)).toBeNull()
    expect(
      faltaDatoFiscal(
        "fev",
        { name: "Ana", idNumber: "900123456", docType: "31", nitDv: "1" },
        { ficha: { ...FICHA_COMPLETA, docNumber: "900123456", dianDocType: "31" } },
      ),
    ).toMatch(/DV/)
  })

  it("con cliente registrado el POS con datos no exige el tipo (lo pone la ficha)", () => {
    expect(
      faltaDatoFiscal("pos_identificado", { name: "Ana", idNumber: "123" }, { ficha: FICHA_COMPLETA }),
    ).toBeNull()
  })

  it("el NIT con guion toma la base antes del guion y el DV después", () => {
    const base = { name: "Tienda SAS", docType: "31" }
    expect(faltaDatoFiscal("pos_identificado", { ...base, idNumber: "900123456-8" })).toBeNull()
    expect(faltaDatoFiscal("pos_identificado", { ...base, idNumber: "900.123.456-3" })).toMatch(
      /debería ser 8/,
    )
    expect(separarNitConDv("900.123.456-8")).toEqual({ base: "900123456", dv: "8" })
  })

  it("una cédula de puros ceros no pasa", () => {
    expect(
      faltaDatoFiscal("pos_identificado", { name: "Ana", docType: "13", idNumber: "000" }),
    ).toMatch(/ceros/)
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
    const t = tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "emitido", documentoId: "d1" }, doc)!
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
    expect(
      tiqueteFiscalDe(
        { solicitado: "pos_anonimo", estado: "emitido", documentoId: "d1" },
        { ...doc, dianStatus: "contingency" },
      )?.contingencia,
    ).toBe(true)
  })

  it("descarta un documento de otra venta (lectura tardía de la anterior)", () => {
    const deB = { solicitado: "pos_anonimo", estado: "error" } as const
    expect(tiqueteFiscalDe(deB, doc)).toBeNull()
    const t = tiqueteFiscalDe(
      { solicitado: "pos_anonimo", estado: "emitido", documentoId: "otro", fullNumber: "SETP2", cude: CUDE, qrUrl: URL },
      doc,
    )!
    expect(t.fullNumber).toBe("SETP2")
    expect(t.resolucion).toBeUndefined()
  })

  it("un documento que no se emitió no da tiquete fiscal", () => {
    expect(tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "error" })).toBeNull()
    expect(tiqueteFiscalDe({ solicitado: "pos_anonimo", estado: "en_proceso" })).toBeNull()
  })
})

describe("papel con documento fiscal (§4)", () => {
  const conDoc = { solicitado: "pos_identificado", estado: "emitido", documentoId: "d1" } as const

  it("título: denominación, comprobante sin documento o el de siempre", () => {
    const t = tiqueteFiscalDe(conDoc, doc)
    expect(tituloTiquete({ documentoFiscal: conDoc }, t)[0]).toMatch(/P\.O\.S\./)
    expect(
      tituloTiquete({ documentoFiscal: { solicitado: "pos_anonimo", estado: "error" } }, null),
    ).toEqual(TITULO_SIN_DOCUMENTO)
    expect(tituloTiquete({}, null)).toEqual(["FACTURA DE VENTA"])
  })

  it("impuestos discriminados por tributo y tarifa, más la bolsa", () => {
    const d = {
      ...doc,
      lines: [
        { base: 10000, taxScheme: "01", taxRate: 19, taxAmount: 1900 },
        { base: 5000, taxScheme: "04", taxRate: 8, taxAmount: 400 },
        { base: 2000, taxScheme: "01", taxRate: 19, taxAmount: 380 },
        { base: 1000, taxScheme: "01", taxRate: 0, taxAmount: 0 },
      ],
    } as unknown as ElectronicDocument
    expect(impuestosDe(d)).toEqual([
      { etiqueta: "IVA 19 %", base: 12000, valor: 2280 },
      { etiqueta: "INC 8 %", base: 5000, valor: 400 },
      { etiqueta: "IVA exento", base: 1000, valor: 0 },
      { etiqueta: "INC bolsas", valor: 66 },
    ])
  })

  it("en el POS anónimo no se imprime el nombre tecleado; con datos, el adquiriente del XML", () => {
    const anon = { solicitado: "pos_anonimo", estado: "emitido", documentoId: "d1" } as const
    const sale = { customer: { name: "Pepe", phone: "300" }, documentoFiscal: anon }
    expect(clienteTiquete(sale, tiqueteFiscalDe(anon, doc))).toBeNull()

    const ident = {
      ...doc,
      adquiriente: { docType: "31", docNumber: "900123456", name: "Tienda SAS" },
    } as unknown as ElectronicDocument
    const c = clienteTiquete(
      { customer: { name: "tienda", idNumber: "900123456", nitDv: "8" }, documentoFiscal: conDoc },
      tiqueteFiscalDe(conDoc, ident),
    )
    expect(c).toEqual({ name: "Tienda SAS", identificacion: "NIT 900123456-8" })
  })

  it("la FEV lleva CUFE= en el QR y el rechazado lo marca el tiquete", () => {
    expect(contenidoQr({ ...doc, type: "invoice" } as ElectronicDocument)).toMatch(/\nCUFE=/)
    const t = tiqueteFiscalDe(conDoc, { ...doc, dianStatus: "rejected" } as ElectronicDocument)
    expect(t?.rechazado).toBe(true)
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

describe("puedeTranscribir", () => {
  const base = { solicitado: "pos_anonimo" as const }
  it("pendiente de contingencia 07: sí", () => {
    expect(puedeTranscribir({ ...base, estado: "pendiente_contingencia_07" })).toBe(true)
  })
  it("emitido con notas pendientes: sí; sin ellas o sin el dato: no", () => {
    expect(puedeTranscribir({ ...base, estado: "emitido", notasPendientes: 1 })).toBe(true)
    expect(puedeTranscribir({ ...base, estado: "emitido", notasPendientes: 0 })).toBe(false)
    expect(puedeTranscribir({ ...base, estado: "emitido" })).toBe(false)
  })
  it("otros estados y venta sin documento fiscal: no", () => {
    expect(puedeTranscribir({ ...base, estado: "error", notasPendientes: 3 })).toBe(false)
    expect(puedeTranscribir(undefined)).toBe(false)
  })
})
