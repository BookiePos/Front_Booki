import { describe, expect, it } from "vitest"
import {
  addSplitRow,
  applyMethodShortcut,
  fillRemaining,
  initialSplitRows,
  paymentLabel,
  splitSummary,
  toPaymentsPayload,
  withMethod,
  type SplitRow,
} from "./split-payment"

const fila = (method: SplitRow["method"], amount: number | null, id: string = method): SplitRow => ({
  id,
  method,
  amount,
  // El datáfono pide tipo y franquicia (ítem 6.4): las pruebas de la cuenta
  // las dan por llenadas para no mezclar reglas.
  ...(method === "card"
    ? { detail: { channel: "" as const, cardType: "debit" as const, franchise: "visa" as const, reference: "" } }
    : {}),
})

// Cobro de $59.000 (total $50.000 + propina $5.000 + domicilio $4.000):
// se pueden fiar hasta $54.000.
const DUE = 59_000
const CAP = 54_000

describe("splitSummary", () => {
  it("muestra el restante mientras no alcanza", () => {
    const r = splitSummary([fila("cash", 20_000), fila("card", 10_000)], DUE, CAP)
    expect(r.remaining).toBe(29_000)
    expect(r.change).toBe(0)
    expect(r.error).toMatch(/Faltan/)
  })

  it("cubierto exacto: sin error ni devuelta", () => {
    const r = splitSummary([fila("cash", 20_000), fila("card", 39_000)], DUE, CAP)
    expect(r).toMatchObject({ remaining: 0, change: 0, error: null })
  })

  it("la devuelta sale del efectivo", () => {
    const r = splitSummary([fila("card", 39_000), fila("cash", 50_000)], DUE, CAP)
    expect(r.change).toBe(30_000)
    expect(r.error).toBeNull()
  })

  it("no deja dar devuelta con tarjeta", () => {
    const r = splitSummary([fila("card", 60_000), fila("cash", 0)], DUE, CAP)
    expect(r.error).toMatch(/solo sale del efectivo/)
  })

  it("una sola parte fiada, y sin la propina", () => {
    expect(
      splitSummary(
        [fila("credit", 10_000, "a"), fila("credit", 10_000, "b"), fila("cash", 39_000)],
        DUE,
        CAP,
      ).error,
    ).toMatch(/una parte/)
    expect(
      splitSummary([fila("credit", 55_000), fila("cash", 4_000)], DUE, CAP).error,
    ).toMatch(/propina no se fía/)
  })

  it("todo en blanco pide los montos", () => {
    expect(splitSummary(initialSplitRows("cash"), DUE, CAP).error).toMatch(/Escribe/)
  })
})

describe("filas", () => {
  it("arranca con el medio elegido y otro", () => {
    expect(initialSplitRows("cash").map((r) => r.method)).toEqual(["cash", "card"])
    expect(initialSplitRows("card").map((r) => r.method)).toEqual(["card", "cash"])
  })

  it("«Lo que falta» llena la fila con el restante", () => {
    const rows = fillRemaining([fila("cash", 20_000), fila("card", null)], "card", DUE)
    expect(rows[1]!.amount).toBe(39_000)
  })

  it("agregar medio usa uno que no esté y lo que falta", () => {
    const rows = addSplitRow([fila("cash", 20_000), fila("card", 9_000)], DUE)
    expect(rows.at(-1)).toMatchObject({ method: "transfer", amount: 30_000 })
  })
})

describe("atajos F6..F9 con el pago dividido", () => {
  it("con algo pendiente agregan una fila con ese medio y lo que falta", () => {
    const rows = applyMethodShortcut([fila("cash", 20_000)], "card", DUE)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ method: "card", amount: 39_000 })
  })

  it("si la última fila está en blanco, le cambian el medio", () => {
    const rows = applyMethodShortcut([fila("cash", 20_000), fila("card", null)], "transfer", DUE)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ method: "transfer", amount: 39_000 })
  })

  it("ya cubierto, cambian el medio de la última fila", () => {
    const rows = applyMethodShortcut([fila("cash", 20_000), fila("card", 39_000)], "transfer", DUE)
    expect(rows.map((r) => r.method)).toEqual(["cash", "transfer"])
    expect(rows[1]!.amount).toBe(39_000)
  })
})

describe("toPaymentsPayload", () => {
  it("manda solo las filas con monto y el deudor en la fiada", () => {
    const payload = toPaymentsPayload(
      [fila("cash", 9_000), fila("card", null), fila("credit", 50_000)],
      { debtorType: "customer", customerId: "c1" },
    )
    expect(payload).toEqual([
      { method: "cash", amount: 9_000 },
      { method: "credit", amount: 50_000, debtorType: "customer", customerId: "c1" },
    ])
  })
})

describe("paymentLabel", () => {
  it("junta los medios de una venta mixta", () => {
    expect(
      paymentLabel({
        payment: { method: "card" },
        payments: [
          { method: "card", amount: 1 },
          { method: "cash", amount: 1 },
        ],
      }),
    ).toBe("Tarjeta + Efectivo")
    expect(paymentLabel({ payment: { method: "transfer" } })).toBe("Transferencia")
  })
})

describe("medios digitales en dividir pago (6.4)", () => {
  const datafono = (over: Partial<SplitRow["detail"] & object> = {}): SplitRow => ({
    id: "d",
    method: "card",
    amount: 39_000,
    detail: { channel: "", cardType: "debit", franchise: "visa", reference: "", ...over },
  })

  it("no deja cobrar un datáfono sin franquicia", () => {
    const r = splitSummary([fila("cash", 20_000), datafono({ franchise: "" })], DUE, CAP)
    expect(r.error).toMatch(/franquicia/)
  })

  it("con el detalle completo se puede cobrar", () => {
    const r = splitSummary([fila("cash", 20_000), datafono()], DUE, CAP)
    expect(r.error).toBeNull()
  })

  it("las filas sin detalle (transferencia o efectivo) siguen sin pedir nada", () => {
    expect(splitSummary([fila("cash", 20_000), fila("transfer", 39_000)], DUE, CAP).error).toBeNull()
  })

  it("el cobro viaja con el canal de cada parte", () => {
    const payload = toPaymentsPayload(
      [
        fila("cash", 20_000),
        datafono({ reference: "A-123" }),
        {
          id: "n",
          method: "transfer",
          amount: 5_000,
          detail: { channel: "nequi", cardType: "", franchise: "", reference: "3001234567" },
        },
      ],
      {},
    )
    expect(payload).toEqual([
      { method: "cash", amount: 20_000 },
      {
        method: "card",
        amount: 39_000,
        channel: "datafono",
        cardType: "debit",
        franchise: "visa",
        reference: "A-123",
      },
      { method: "transfer", amount: 5_000, channel: "nequi", reference: "3001234567" },
    ])
  })

  it("al cambiar una fila de medio se parte de un detalle limpio", () => {
    const cambiada = withMethod([datafono()], "d", "transfer")
    expect(cambiada[0].method).toBe("transfer")
    expect(cambiada[0].detail).toEqual({ channel: "", cardType: "", franchise: "", reference: "" })
  })
})

describe("paymentLabel con canal (6.4)", () => {
  it("nombra Nequi y el datáfono en vez del medio genérico", () => {
    expect(
      paymentLabel({
        payment: { method: "transfer", channel: "nequi" },
        payments: [
          { method: "cash", amount: 1 },
          { method: "transfer", amount: 2, channel: "nequi" },
        ],
      }),
    ).toBe("Efectivo + Nequi")
    expect(paymentLabel({ payment: { method: "card", channel: "datafono" } })).toBe("Datáfono")
    expect(paymentLabel({ payment: { method: "card" } })).toBe("Tarjeta")
  })
})
