import { describe, expect, it } from "vitest"
import {
  conceptosDisponibles,
  diasDelPeriodo,
  errorClienteDevolucion,
  errorNotaSinReferencia,
  errorPeriodo,
  errorRebaja,
  errorSaldoFavor,
  esErrorVentanaSemanal,
  estaPendiente,
  huellaDevolucion,
  limitadoPorSede,
  llaveDelIntento,
  mensajeCompletar,
  resumenNota,
  type BorradorRebaja,
} from "./notas"

describe("llave de idempotencia", () => {
  const huella = huellaDevolucion({
    saleId: "s1",
    lines: [
      { productId: "b", qty: 1 },
      { productId: "a", qty: 2 },
    ],
    reason: "otro",
    restock: "inventory",
    refundMethod: "cash",
  })

  it("repite la llave mientras se reintenta lo mismo", () => {
    let n = 0
    const gen = () => `k${++n}`
    const a = llaveDelIntento(null, huella, gen)
    const b = llaveDelIntento(a, huella, gen)
    expect(b.llave).toBe(a.llave)
    expect(n).toBe(1)
  })

  it("estrena llave si cambia lo que se manda", () => {
    let n = 0
    const gen = () => `k${++n}`
    const a = llaveDelIntento(null, huella, gen)
    const otra = huellaDevolucion({
      saleId: "s1",
      lines: [{ productId: "a", qty: 1 }],
      reason: "otro",
      restock: "inventory",
      refundMethod: "cash",
    })
    expect(llaveDelIntento(a, otra, gen).llave).toBe("k2")
  })

  it("la huella no depende del orden de las líneas", () => {
    const invertida = huellaDevolucion({
      saleId: "s1",
      lines: [
        { productId: "a", qty: 2 },
        { productId: "b", qty: 1 },
      ],
      reason: "otro",
      restock: "inventory",
      refundMethod: "cash",
    })
    expect(invertida).toBe(huella)
  })
})

describe("devolución", () => {
  it("pide cliente registrado solo si queda a favor o es cambio", () => {
    expect(errorClienteDevolucion("cash", {})).toBeNull()
    expect(errorClienteDevolucion("transfer", {})).toBeNull()
    expect(errorClienteDevolucion("credit_note", {})).toMatch(/cliente registrado/)
    expect(errorClienteDevolucion("none", {})).toMatch(/cliente registrado/)
    expect(errorClienteDevolucion("none", { customerId: "c1" })).toBeNull()
  })

  it("reconoce el 400 de la ventana semanal del POS", () => {
    const msg =
      "El documento POS de esta venta es de una semana anterior: ya no se puede anular. Registra una devolución por lo que vuelve."
    expect(esErrorVentanaSemanal(new Error(msg))).toBe(true)
    expect(esErrorVentanaSemanal(new Error("La venta tiene devoluciones"))).toBe(false)
    expect(esErrorVentanaSemanal("x")).toBe(false)
  })

  it("distingue las devoluciones a medias", () => {
    expect(estaPendiente({ estado: "en_curso" })).toBe(true)
    expect(estaPendiente({ estado: "pendiente_caja" })).toBe(true)
    expect(estaPendiente({ estado: "completa" })).toBe(false)
    expect(estaPendiente({})).toBe(false)
  })

  it("traduce el 409 sin caja abierta", () => {
    expect(mensajeCompletar(new Error("No hay caja abierta para anotar la salida"))).toMatch(/Abre el turno/)
    expect(mensajeCompletar(new Error("se está procesando"))).toBe("se está procesando")
  })
})

describe("resumen de la nota", () => {
  it("dice qué nota salió y sobre qué", () => {
    expect(
      resumenNota({ estado: "emitida", fullNumber: "NC12", referenceType: "invoice", referenceNumber: "FE5" }),
    ).toBe("Nota crédito NC12 sobre FE5")
    expect(resumenNota({ estado: "emitida", fullNumber: "NA1", referenceType: "pos" })).toBe("Nota de ajuste NA1")
  })
  it("explica por qué no hay nota", () => {
    expect(resumenNota({ estado: "sin_nota", motivo: "Sin documento" })).toBe("Sin documento")
    expect(resumenNota(undefined)).toBeNull()
  })
})

describe("rebaja posterior", () => {
  const base: BorradorRebaja = {
    concepto: "3",
    montos: { p1: 5000 },
    saldos: { p1: 8000 },
    refundMethod: "cash",
    reason: "Se demoró el pedido",
    esFev: false,
    tieneCliente: false,
  }
  it("acepta una rebaja válida", () => {
    expect(errorRebaja(base)).toBeNull()
  })
  it("5 y 6 solo con factura electrónica", () => {
    expect(conceptosDisponibles(false)).toEqual(["3", "4"])
    expect(conceptosDisponibles(true)).toEqual(["3", "4", "5", "6"])
    expect(errorRebaja({ ...base, concepto: "6" })).toMatch(/factura electrónica/)
    expect(errorRebaja({ ...base, concepto: "6", esFev: true })).toBeNull()
  })
  it("rechaza decimales, exceso y vacío", () => {
    expect(errorRebaja({ ...base, montos: { p1: 10.5 } })).toMatch(/enteros/)
    expect(errorRebaja({ ...base, montos: { p1: 9000 } })).toMatch(/conserva/)
    expect(errorRebaja({ ...base, montos: { p1: null } })).toMatch(/al menos un producto/)
  })
  it("motivo y cliente para dejarlo a favor", () => {
    expect(errorRebaja({ ...base, reason: "ab" })).toMatch(/motivo/)
    expect(errorRebaja({ ...base, refundMethod: "credit_note" })).toMatch(/cliente registrado/)
    expect(errorRebaja({ ...base, refundMethod: "credit_note", tieneCliente: true })).toBeNull()
  })
})

describe("nota sin referencia", () => {
  it("cuenta los días con los dos extremos", () => {
    expect(diasDelPeriodo("2026-10-01", "2026-10-30")).toBe(30)
    expect(diasDelPeriodo("x", "2026-10-30")).toBeNull()
  })
  it("máximo 30 días dentro de un mismo mes", () => {
    expect(errorPeriodo("2026-10-01", "2026-10-30")).toBeNull()
    expect(errorPeriodo("2026-10-01", "2026-10-31")).toMatch(/30 días/)
    expect(errorPeriodo("2026-10-20", "2026-11-05")).toMatch(/mismo mes/)
    expect(errorPeriodo("2026-10-20", "2026-10-10")).toMatch(/anterior/)
    expect(errorPeriodo("", "")).toMatch(/fechas/)
  })
  it("valida el borrador completo", () => {
    const ok = {
      customerId: "c1",
      concepto: "6" as const,
      desde: "2026-10-01",
      hasta: "2026-10-15",
      amount: 20000,
      refundMethod: "credit_note" as const,
      reason: "Rapel de octubre",
    }
    expect(errorNotaSinReferencia(ok)).toBeNull()
    expect(errorNotaSinReferencia({ ...ok, customerId: "" })).toMatch(/cliente/)
    expect(errorNotaSinReferencia({ ...ok, amount: 0 })).toMatch(/monto/)
    expect(errorNotaSinReferencia({ ...ok, amount: 10.5 })).toMatch(/monto/)
    expect(errorNotaSinReferencia({ ...ok, reason: "x" })).toMatch(/motivo/)
  })
})

describe("saldo a favor", () => {
  it("exige cliente y saldo suficiente", () => {
    expect(errorSaldoFavor({ customerId: "", saldo: null, aPagar: 100 })).toMatch(/cliente/)
    expect(errorSaldoFavor({ customerId: "c", saldo: null, aPagar: 100 })).toMatch(/Consultando/)
    expect(errorSaldoFavor({ customerId: "c", saldo: 50, aPagar: 100 })).toMatch(/saldo a favor/)
    expect(errorSaldoFavor({ customerId: "c", saldo: 100, aPagar: 100 })).toBeNull()
    expect(errorSaldoFavor({ customerId: "", saldo: null, aPagar: 0 })).toBeNull()
  })
  it("el reporte se oculta a quien está limitado por sede", () => {
    expect(limitadoPorSede({ role: "owner", permissions: [] })).toBe(false)
    expect(limitadoPorSede({ role: "admin", permissions: ["sede.view_all"] })).toBe(false)
    expect(limitadoPorSede({ role: "admin", permissions: ["finance.view"] })).toBe(true)
    expect(limitadoPorSede(null)).toBe(true)
  })
})
