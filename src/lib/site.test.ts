import { describe, expect, it } from "vitest"
import {
  ADD_ONS,
  DOLORES,
  EFECTOS_DEL_COBRO,
  FAQS,
  MEDIOS_DE_PAGO,
  PLANS,
  TIRILLA,
} from "./site"

// Todo el texto que la portada muestra desde este archivo.
const textoVisible = JSON.stringify({
  ADD_ONS,
  DOLORES,
  EFECTOS_DEL_COBRO,
  FAQS,
  MEDIOS_DE_PAGO,
  PLANS,
  TIRILLA,
})

describe("contenido de la portada", () => {
  it("no lleva raya larga ni media en el texto", () => {
    expect(textoVisible).not.toMatch(/[—–]/)
  })

  it("no nombra a Crunchy Munch: el ejemplo es un restaurante cualquiera", () => {
    expect(textoVisible).not.toMatch(/crunchy|munch/i)
  })

  it("no menciona precios de terceros", () => {
    // Nombrarlos está bien ("migración desde Siigo"); ponerles precio, no.
    for (const texto of [...ADD_ONS.map((a) => `${a.name} ${a.note}`), ...FAQS.map((f) => f.a)]) {
      if (/siigo|alegra|loggro/i.test(texto)) expect(texto).not.toMatch(/\$\s?\d/)
    }
  })

  it("no promete fechas para la factura electrónica", () => {
    const dian = FAQS.find((f) => /DIAN/.test(f.q))
    expect(dian?.a).toMatch(/^Todavía no/)
    expect(dian?.a).not.toMatch(/en camino|pronto|próximamente|este año/i)
  })

  it("dice que sin internet solo se cobra en efectivo", () => {
    const offline = FAQS.find((f) => /internet/i.test(f.q))
    expect(offline?.a).toMatch(/efectivo/)
    const hito = DOLORES.find((d) => d.id === "sin-internet")
    expect(hito?.content).toMatch(/efectivo/)
  })

  it("la factura cuadra: la nota de caja dice el efectivo que de verdad entró", () => {
    const total = TIRILLA.lineas.reduce((s, l) => s + l.qty * l.unit, 0)
    const efectivo = new Intl.NumberFormat("es-CO").format(total - TIRILLA.nequi)
    const caja = EFECTOS_DEL_COBRO.find((e) => e.fila === "efectivo")
    expect(TIRILLA.nequi).toBeLessThan(total)
    expect(caja?.texto).toContain(`$${efectivo}`)
  })

  it("cada dolor cabe en un renglón, para que el tachado sea una sola raya", () => {
    for (const d of DOLORES) expect(d.label.length).toBeLessThanOrEqual(36)
  })

  it("el anual vale diez mensualidades, como dice el selector", () => {
    for (const plan of PLANS) {
      expect(plan.priceAnnual).toBe((plan.price ?? 0) * 10)
    }
  })
})
