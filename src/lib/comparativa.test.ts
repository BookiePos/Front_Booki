import { describe, expect, it } from "vitest"
import { COMPARATIVA, COMPETIDORES } from "./comparativa"

describe("comparativa pública", () => {
  it("cada fila trae un valor por competidor", () => {
    for (const fila of COMPARATIVA.filas) {
      expect(fila.otros).toHaveLength(COMPETIDORES.length)
    }
  })

  it("no menciona facturación electrónica ni precios de terceros", () => {
    const texto = JSON.stringify(COMPARATIVA).toLowerCase()
    expect(texto).not.toMatch(/dian|factura electr|\$\s?\d/)
  })

  it("lleva fecha de revisión y descargo", () => {
    expect(COMPARATIVA.fecha).toBeTruthy()
    expect(COMPARATIVA.descargo).toMatch(/confirma con cada proveedor/)
  })
})
