import { describe, expect, it } from "vitest"
import {
  diferenciaConciliacion,
  estadoConciliacion,
  validarImagenQr,
} from "./conciliacion-pagos"

describe("diferenciaConciliacion", () => {
  it("cobrado menos lo consignado, la comisión, su IVA y las retenciones", () => {
    expect(
      diferenciaConciliacion(1_000_000, {
        statementAmount: 970_000,
        commission: 20_000,
        commissionIva: 3_800,
        retefuente: 3_000,
        reteIca: 2_000,
        reteIva: 1_200,
      }),
    ).toBe(0)
  })

  it("lo que el extracto no explica queda como diferencia, positiva si falta plata", () => {
    expect(diferenciaConciliacion(500_000, { statementAmount: 480_000 })).toBe(20_000)
    expect(diferenciaConciliacion(500_000, { statementAmount: 505_000 })).toBe(-5_000)
  })

  it("redondea a pesos enteros", () => {
    expect(diferenciaConciliacion(100, { statementAmount: 50.4, commission: 49.6 })).toBe(0)
  })
})

describe("estadoConciliacion", () => {
  it("distingue pendiente, conciliado y con diferencia", () => {
    expect(estadoConciliacion(null)).toBe("pendiente")
    expect(estadoConciliacion({ status: "reconciled" })).toBe("conciliado")
    expect(estadoConciliacion({ status: "difference" })).toBe("diferencia")
  })
})

describe("validarImagenQr", () => {
  it("acepta PNG, JPG y WEBP chicos", () => {
    expect(validarImagenQr("image/png", 50_000)).toBeNull()
    expect(validarImagenQr("image/jpeg", 50_000)).toBeNull()
    expect(validarImagenQr("image/webp", 50_000)).toBeNull()
  })

  it("rechaza SVG: puede llevar scripts", () => {
    expect(validarImagenQr("image/svg+xml", 1_000)).toMatch(/PNG, JPG o WEBP/)
  })

  it("rechaza lo que pasa del tope del servidor", () => {
    expect(validarImagenQr("image/png", 300_000)).toMatch(/pesa mucho/)
  })
})
