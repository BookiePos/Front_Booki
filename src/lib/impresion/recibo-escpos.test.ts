import { describe, expect, it } from "vitest"
import QRCode from "qrcode"
import { moduloQr, reciboEscpos } from "@/lib/impresion/recibo-escpos"
import type { TiqueteFiscal } from "@/lib/pos/documento-fiscal"
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

describe("reciboEscpos con documento POS electrónico (Fase 7)", () => {
  const cude = "b".repeat(96)
  const qr = `NumFac=SETP1\nCUDE=${cude}\nQRCode=https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cude}`
  const fiscal: TiqueteFiscal = {
    tipo: "pos",
    fullNumber: "SETP990000001",
    cude,
    qr,
    resolucion: { numero: "18760000001", prefijo: "SETP", rangoDesde: 1, rangoHasta: 5000 },
    fabricante: { razonSocial: "BookiPos SAS", nit: "901234567", nombreSoftware: "BookiPos" },
    contingencia: false,
  }

  it.each([58, 80] as const)("en %i mm lleva denominación, número, resolución, CUDE y fabricante", (ancho) => {
    const t = latin(reciboEscpos(sale, undefined, { ancho, fiscal }))
    expect(t).toMatch(/Documento equivalente/)
    expect(t).toMatch(/P\.O\.S\./)
    expect(t).toContain("No. SETP990000001")
    expect(t).toContain("Resolución DIAN 18760000001".replace("ó", "\xa2"))
    expect(t).toContain("CUDE")
    // El CUDE se parte por el ancho del papel pero va completo.
    expect(t.replace(/\n/g, "")).toContain(cude)
    expect(t.replace(/\n/g, " ")).toContain("BookiPos SAS NIT 901234567")
    expect(t).not.toContain("FACTURA DE VENTA")
  })

  it("imprime el QR nativo (GS ( k) con módulo de al menos 3 puntos", () => {
    const b = reciboEscpos(sale, undefined, { ancho: 58, fiscal })
    // Modelo 2 y la orden de imprimir el símbolo.
    expect(contiene(b, [0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])).toBe(true)
    expect(contiene(b, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])).toBe(true)
    const m = moduloQr(qr, 58)
    expect(m).toBeGreaterThanOrEqual(3)
    expect(contiene(b, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, m])).toBe(true)
  })

  it("el QR mide ≥ 2 cm y cabe en 58 y 80 mm", () => {
    for (const ancho of [58, 80] as const) {
      const m = moduloQr(qr, ancho)
      const lado = QRCode.create(qr, { errorCorrectionLevel: "M" }).modules.size
      expect(lado * m).toBeGreaterThanOrEqual(160) // 2 cm a 8 puntos/mm
      expect(lado * m).toBeLessThanOrEqual(ancho === 58 ? 384 : 576)
    }
  })

  it("en contingencia 08 lleva la leyenda de sin validación previa", () => {
    const t = latin(reciboEscpos(sale, undefined, { ancho: 58, fiscal: { ...fiscal, contingencia: true } }))
    expect(t.replace(/\n/g, " ")).toMatch(/sin validaci\xa2n previa/)
  })

  it("sin documento fiscal la tirilla es la de siempre", () => {
    const t = latin(reciboEscpos(sale, undefined, { ancho: 58 }))
    expect(t).toContain("FACTURA DE VENTA")
    expect(t).not.toContain("CUDE")
  })
})