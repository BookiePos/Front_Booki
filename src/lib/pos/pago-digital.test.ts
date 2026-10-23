import { describe, expect, it } from "vitest"
import {
  CHANNEL_LABELS,
  detalleDigitalError,
  detalleParaEnviar,
  detalleVacio,
  etiquetaMedio,
} from "./pago-digital"

describe("detalleDigitalError", () => {
  it("el efectivo y el fiado no llevan detalle", () => {
    expect(detalleDigitalError("cash", detalleVacio())).toBeNull()
    expect(detalleDigitalError("credit", detalleVacio())).toBeNull()
  })

  it("el datáfono pide tipo y franquicia", () => {
    expect(detalleDigitalError("card", detalleVacio())).toMatch(/débito o crédito/)
    expect(
      detalleDigitalError("card", { ...detalleVacio(), cardType: "debit" }),
    ).toMatch(/franquicia/)
    expect(
      detalleDigitalError("card", {
        ...detalleVacio(),
        cardType: "debit",
        franchise: "visa",
      }),
    ).toBeNull()
  })

  it("la transferencia sin canal es la de siempre", () => {
    expect(detalleDigitalError("transfer", detalleVacio())).toBeNull()
  })

  it("la referencia solo admite los caracteres que acepta el servidor", () => {
    const d = { ...detalleVacio(), channel: "nequi" as const, reference: "<script>" }
    expect(detalleDigitalError("transfer", d)).toMatch(/referencia/)
    expect(
      detalleDigitalError("transfer", { ...d, reference: "300 123-4567" }),
    ).toBeNull()
  })
})

describe("detalleParaEnviar", () => {
  it("la tarjeta viaja como datáfono con su tipo y franquicia", () => {
    expect(
      detalleParaEnviar("card", {
        channel: "",
        cardType: "credit",
        franchise: "mastercard",
        reference: " 123456 ",
      }),
    ).toEqual({
      channel: "datafono",
      cardType: "credit",
      franchise: "mastercard",
      reference: "123456",
    })
  })

  it("las billeteras no llevan tipo ni franquicia aunque haya quedado algo escrito", () => {
    expect(
      detalleParaEnviar("transfer", {
        channel: "nequi",
        cardType: "credit",
        franchise: "visa",
        reference: "3001234567",
      }),
    ).toEqual({ channel: "nequi", reference: "3001234567" })
  })

  it("transferencia simple: sin canal; efectivo y fiado: nada", () => {
    expect(detalleParaEnviar("transfer", detalleVacio())).toEqual({})
    expect(detalleParaEnviar("cash", { ...detalleVacio(), reference: "x" })).toEqual({})
    expect(detalleParaEnviar("credit", { ...detalleVacio(), channel: "qr" })).toEqual({})
  })
})

describe("etiquetaMedio", () => {
  it("nombra el canal en vez del medio genérico", () => {
    expect(etiquetaMedio("transfer", "nequi")).toBe(CHANNEL_LABELS.nequi)
    expect(etiquetaMedio("card", "datafono")).toBe("Datáfono")
    expect(etiquetaMedio("card", undefined)).toBe("Tarjeta")
    expect(etiquetaMedio("cash", undefined)).toBe("Efectivo")
  })
})
