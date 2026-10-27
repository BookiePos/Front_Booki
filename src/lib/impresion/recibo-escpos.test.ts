import { describe, expect, it } from "vitest"
import { reciboEscpos } from "@/lib/impresion/recibo-escpos"
import { pulsoCajon, CMD } from "@/lib/impresion/escpos"
import type { Sale } from "@/lib/pos/api-sales"

const sale = {
  _id: "1",
  saleNumber: "FV-000123",
  sedeId: "s1",
  cashierEmail: "caja@x.co",
  cashierName: "Peña Núñez",
  status: "completed",
  lines: [
    { productId: "p", sku: "A", name: "Café con leche", unit: "und", qty: 2, unitPrice: 4500, lineTotal: 9000 },
    { productId: "q", sku: "B", name: "Pan", unit: "und", qty: 1, unitPrice: 3000, lineTotal: 3000, discountAmount: 500, discountName: "Promo" },
  ],
  subtotal: 12000,
  discountTotal: 0,
  taxTotal: 0,
  total: 11500,
  payment: { method: "cash", received: 20000, change: 8500 },
  createdAt: "2026-10-22T15:04:00.000Z",
} as unknown as Sale

const hex = (u: Uint8Array) => Array.from(u)
function contiene(u: Uint8Array, p: number[]) {
  const a = hex(u)
  for (let i = 0; i + p.length <= a.length; i++) {
    if (p.every((v, j) => a[i + j] === v)) return true
  }
  return false
}
const latin = (u: Uint8Array) => String.fromCharCode(...u)

describe("reciboEscpos", () => {
  const opts = { ancho: 58 as const, abrirCajon: false }

  it("empieza con ESC @ y termina cortando", () => {
    const b = reciboEscpos(sale, undefined, opts)
    expect(hex(b).slice(0, 2)).toEqual([0x1b, 0x40])
    expect(hex(b).slice(-4)).toEqual(CMD.cortar)
  })

  it("trae montos en COP enteros con el formateo existente", () => {
    const t = latin(reciboEscpos(sale, undefined, opts))
    expect(t).toContain("$ 11.500")
    expect(t).toContain("$ 20.000")
    expect(t).toContain("$ 8.500")
    expect(t).not.toMatch(/\d,\d\d\b/)
  })

  it("el TOTAL queda alineado al borde derecho (32 columnas)", () => {
    const t = latin(reciboEscpos(sale, undefined, opts))
    // La línea lleva delante ESC E 1 (negrita): se descarta antes de medir.
    const l = t
      .split("\n")
      .find((x) => x.includes("TOTAL"))!
      .replace("\x1bE\x01", "")
    expect(l.length).toBe(32)
    expect(l.endsWith("$ 11.500")).toBe(true)
  })

  it("en 80 mm usa 48 columnas", () => {
    const t = latin(reciboEscpos(sale, undefined, { ...opts, ancho: 80 }))
    expect(t).toContain("-".repeat(48))
    expect(t).not.toContain("-".repeat(49))
  })

  it("codifica la ñ y las tildes del cajero y del pie", () => {
    const b = reciboEscpos(sale, undefined, opts)
    expect(contiene(b, [0x50, 0x65, 0xa4, 0x61])).toBe(true) // Peña
    expect(contiene(b, [0xad])).toBe(true) // ¡Gracias
  })

  it("abre el cajón solo si se pide", () => {
    const sin = reciboEscpos(sale, undefined, opts)
    const con = reciboEscpos(sale, undefined, { ...opts, abrirCajon: true })
    expect(contiene(sin, hex(pulsoCajon()))).toBe(false)
    expect(contiene(con, hex(pulsoCajon()))).toBe(true)
  })

  it("muestra NIT y sede cuando hay marca", () => {
    const t = latin(
      reciboEscpos(sale, { businessName: "Panadería Doña Rosa", name: "Centro", nit: "900.1" }, opts),
    )
    expect(t).toContain("NIT 900.1")
    expect(t).toContain("Centro")
  })

  it("la venta en contingencia dice impuestos incluidos y lleva la leyenda", () => {
    const t = latin(
      reciboEscpos({ ...sale, saleNumber: "FVC-000001", contingencia: true } as Sale, undefined, opts),
    )
    expect(t).toContain("Impuestos")
    expect(t).toContain("Incluidos")
    expect(t).toMatch(/contingencia/i)
  })
})
