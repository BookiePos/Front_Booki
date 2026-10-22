import { describe, expect, it } from "vitest"
import { CONFIG_POR_DEFECTO } from "@/lib/impresion/config"
import {
  abrirCajonTermico,
  imprimirVentaTermica,
  ImpresoraNoVinculada,
} from "@/lib/impresion/servicio"
import type { TransporteImpresora } from "@/lib/impresion/transporte"
import { pulsoCajon } from "@/lib/impresion/escpos"
import type { Sale } from "@/lib/pos/api-sales"

const cfg = { ...CONFIG_POR_DEFECTO, modo: "termica" as const, ancho: 58 as const }

function falso() {
  const enviados: number[][] = []
  const t: TransporteImpresora = {
    tipo: "usb",
    async abrir() {},
    async escribir(b) {
      enviados.push(Array.from(b))
    },
    async cerrar() {},
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

  it("una venta en efectivo abre el cajón; con tarjeta no", async () => {
    const a = falso()
    await imprimirVentaTermica(venta("cash"), undefined, cfg, async () => a.t)
    expect(tienePulso(a.enviados[0])).toBe(true)
    const b = falso()
    await imprimirVentaTermica(venta("card"), undefined, cfg, async () => b.t)
    expect(tienePulso(b.enviados[0])).toBe(false)
  })

  it("respeta cajonAlCobrar = false", async () => {
    const f = falso()
    await imprimirVentaTermica(
      venta("cash"),
      undefined,
      { ...cfg, cajonAlCobrar: false },
      async () => f.t,
    )
    expect(tienePulso(f.enviados[0])).toBe(false)
  })

  it("sin impresora vinculada lanza ImpresoraNoVinculada", async () => {
    await expect(abrirCajonTermico(cfg, async () => null)).rejects.toBeInstanceOf(
      ImpresoraNoVinculada,
    )
  })
})
