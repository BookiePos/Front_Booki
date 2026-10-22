import { describe, expect, it } from "vitest"
import { CONFIG_POR_DEFECTO } from "@/lib/impresion/config"
import {
  abrirCajonTermico,
  imprimirVentaTermica,
  ImpresoraNoVinculada,
  ventaConEfectivo,
} from "@/lib/impresion/servicio"
import type { TransporteImpresora } from "@/lib/impresion/transporte"
import { pulsoCajon } from "@/lib/impresion/escpos"
import type { Sale } from "@/lib/pos/api-sales"

const cfg = { ...CONFIG_POR_DEFECTO, modo: "termica" as const, ancho: 58 as const }

function falso(demoraMs = 0, log: string[] = []) {
  const enviados: number[][] = []
  const t: TransporteImpresora = {
    tipo: "usb",
    async abrir() {
      log.push("abrir")
    },
    async escribir(b) {
      if (demoraMs) await new Promise((r) => setTimeout(r, demoraMs))
      enviados.push(Array.from(b))
    },
    async cerrar() {
      log.push("cerrar")
    },
  }
  return { t, enviados }
}

const venta = (method: "cash" | "card") =>
  ({
    saleNumber: "FV-1",
    cashierEmail: "c@x.co",
    lines: [],
    subtotal: 1000,
    discountTotal: 0,
    taxTotal: 0,
    total: 1000,
    payment: { method },
    createdAt: "2026-10-22T10:00:00.000Z",
  }) as unknown as Sale

const tienePulso = (b: number[]) =>
  b.join(",").includes(Array.from(pulsoCajon()).join(","))

describe("servicio de impresión térmica", () => {
  it("abrirCajonTermico manda solo el pulso", async () => {
    const f = falso()
    await abrirCajonTermico(cfg, async () => f.t)
    expect(f.enviados).toHaveLength(1)
    expect(tienePulso(f.enviados[0])).toBe(true)
  })

  it("el cajón depende SOLO del parámetro explícito", async () => {
    const a = falso()
    await imprimirVentaTermica(venta("cash"), undefined, cfg, { abrirCajon: true }, async () => a.t)
    expect(tienePulso(a.enviados[0])).toBe(true)
    const b = falso()
    await imprimirVentaTermica(venta("cash"), undefined, cfg, { abrirCajon: false }, async () => b.t)
    expect(tienePulso(b.enviados[0])).toBe(false)
  })

  it("ventaConEfectivo distingue efectivo de tarjeta y de pago mixto", () => {
    expect(ventaConEfectivo(venta("cash"))).toBe(true)
    expect(ventaConEfectivo(venta("card"))).toBe(false)
    const mixta = {
      ...venta("card"),
      payments: [
        { method: "card", amount: 500 },
        { method: "cash", amount: 500 },
      ],
    } as unknown as Sale
    expect(ventaConEfectivo(mixta)).toBe(true)
  })

  it("sin impresora vinculada lanza ImpresoraNoVinculada", async () => {
    await expect(abrirCajonTermico(cfg, async () => null)).rejects.toBeInstanceOf(
      ImpresoraNoVinculada,
    )
  })

  it("serializa los envíos: el segundo no empieza hasta que termina el primero", async () => {
    const log: string[] = []
    const f = falso(30, log)
    await Promise.all([
      abrirCajonTermico(cfg, async () => f.t),
      abrirCajonTermico(cfg, async () => f.t),
    ])
    expect(log).toEqual(["abrir", "cerrar", "abrir", "cerrar"])
  })
})
