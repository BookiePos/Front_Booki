import { describe, expect, it } from "vitest"
import {
  imprimirBytes,
  transporteGuardado,
  TransporteUsb,
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

describe("imprimirBytes: robustez", () => {
  it("si abrir() falla, igual cierra", async () => {
    const log: string[] = []
    const t: TransporteImpresora = {
      tipo: "usb",
      async abrir() {
        log.push("abrir")
        throw new Error("ocupada")
      },
      async escribir() {},
      async cerrar() {
        log.push("cerrar")
      },
    }
    await expect(imprimirBytes(t, new Uint8Array([1]))).rejects.toThrow("ocupada")
    expect(log).toEqual(["abrir", "cerrar"])
  })

  it("vence el tiempo si la impresora no responde, y cierra", async () => {
    const log: string[] = []
    const t: TransporteImpresora = {
      tipo: "serial",
      async abrir() {},
      escribir: () => new Promise<void>(() => {}),
      async cerrar() {
        log.push("cerrar")
      },
    }
    await expect(
      imprimirBytes(t, new Uint8Array([1]), { timeoutMs: 20 }),
    ).rejects.toThrow(/no respondi/i)
    expect(log).toEqual(["cerrar"])
  })
})

describe("TransporteUsb.abrir", () => {
  it("cierra el dispositivo si falla después de open()", async () => {
    const log: string[] = []
    const d = {
      vendorId: 1,
      productId: 2,
      opened: false,
      configuration: {
        interfaces: [
          {
            interfaceNumber: 0,
            alternate: { interfaceClass: 7, endpoints: [{ endpointNumber: 1, direction: "out", type: "bulk" }] },
          },
        ],
      },
      async open() {
        d.opened = true
        log.push("open")
      },
      async close() {
        log.push("close")
      },
      async selectConfiguration() {},
      async claimInterface() {
        throw new Error("ocupado por el driver")
      },
      async releaseInterface() {},
      async transferOut() {},
    }
    const t = new TransporteUsb(d as never)
    await expect(t.abrir()).rejects.toThrow("ocupado")
    expect(log).toEqual(["open", "close"])
  })
})

describe("transporteGuardado", () => {
  const puerto = (v?: number, p?: number) => ({
    getInfo: () => ({ usbVendorId: v, usbProductId: p }),
    open: async () => {},
    close: async () => {},
    writable: null,
  })
  function conPuertos(lista: unknown[]) {
    Object.defineProperty(navigator, "serial", {
      value: { getPorts: async () => lista },
      configurable: true,
    })
  }
  const base = { transporte: "serial" as const, baudios: 9600 }

  it("sin vendorId guardado pide re-vincular", async () => {
    conPuertos([puerto(1, 2)])
    expect(await transporteGuardado(base)).toBeNull()
  })

  it("con un único puerto que coincide lo devuelve", async () => {
    conPuertos([puerto(1, 2), puerto(3, 4)])
    expect(
      await transporteGuardado({ ...base, vendorId: 1, productId: 2 }),
    ).not.toBeNull()
  })

  it("si hay más de un candidato idéntico pide re-vincular", async () => {
    conPuertos([puerto(1, 2), puerto(1, 2)])
    expect(
      await transporteGuardado({ ...base, vendorId: 1, productId: 2 }),
    ).toBeNull()
  })
})
