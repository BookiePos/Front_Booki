import { describe, expect, it } from "vitest"
import { cobroEnPuerta } from "./api-delivery"

/** Lo que cobra el repartidor en la puerta (ítem 6.9). */
describe("cobroEnPuerta", () => {
  it("domicilio mixto: solo la parte en efectivo, lo demás ya pagado", () => {
    expect(
      cobroEnPuerta({ grandTotal: 59_000, paymentMethod: "card", cashAmount: 20_000 }),
    ).toEqual({ cobra: 20_000, yaPagado: 39_000 })
  })

  it("mixto con el efectivo como parte mayor: no cobra todo otra vez", () => {
    expect(
      cobroEnPuerta({ grandTotal: 59_000, paymentMethod: "cash", cashAmount: 40_000 }),
    ).toEqual({ cobra: 40_000, yaPagado: 19_000 })
  })

  it("todo con tarjeta: no cobra nada", () => {
    expect(
      cobroEnPuerta({ grandTotal: 59_000, paymentMethod: "card", cashAmount: 0 }),
    ).toEqual({ cobra: 0, yaPagado: 59_000 })
  })

  it("backend anterior al 6.9 (sin cashAmount): manda el medio de pago", () => {
    expect(cobroEnPuerta({ grandTotal: 59_000, paymentMethod: "cash" })).toEqual({
      cobra: 59_000,
      yaPagado: 0,
    })
    expect(cobroEnPuerta({ grandTotal: 59_000, paymentMethod: "transfer" })).toEqual({
      cobra: 0,
      yaPagado: 59_000,
    })
  })
})
