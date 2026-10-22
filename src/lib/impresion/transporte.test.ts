import { describe, expect, it } from "vitest"
import {
  imprimirBytes,
  type TransporteImpresora,
} from "@/lib/impresion/transporte"

function falso(falla = false) {
  const log: string[] = []
  const enviados: number[][] = []
  const t: TransporteImpresora = {
    tipo: "serial",
    async abrir() {
      log.push("abrir")
    },
    async escribir(b) {
      if (falla) throw new Error("sin papel")
      enviados.push(Array.from(b))
      log.push("escribir")
    },
    async cerrar() {
      log.push("cerrar")
    },
  }
  return { t, log, enviados }
}

describe("imprimirBytes", () => {
  it("abre, escribe y cierra", async () => {
    const f = falso()
    await imprimirBytes(f.t, new Uint8Array([1, 2, 3]))
    expect(f.log).toEqual(["abrir", "escribir", "cerrar"])
    expect(f.enviados).toEqual([[1, 2, 3]])
  })

  it("cierra aunque la escritura falle y propaga el error", async () => {
    const f = falso(true)
    await expect(imprimirBytes(f.t, new Uint8Array([1]))).rejects.toThrow("sin papel")
    expect(f.log).toEqual(["abrir", "cerrar"])
  })
})
