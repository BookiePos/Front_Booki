import { describe, expect, it } from "vitest"

import { serializeCsv } from "./csv"

/**
 * Ítem 4.11: un nombre de producto como `=HYPERLINK(...)` salía tal cual en
 * el CSV y la hoja de cálculo de quien exporta lo evaluaba como fórmula.
 */
describe("serializeCsv · celdas que parecen fórmula", () => {
  const fila = (v: string | number) => serializeCsv(["x"], [[v]]).split("\r\n")[1]

  it("antepone una comilla al texto que empieza por = + - @", () => {
    expect(fila('=HYPERLINK("https://x.test","ver")')).toBe(
      `"'=HYPERLINK(""https://x.test"",""ver"")"`,
    )
    expect(fila("+57 300")).toBe("'+57 300")
    expect(fila("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(fila("-cmd")).toBe("'-cmd")
  })

  it("no toca números negativos ni texto normal", () => {
    expect(fila(-5)).toBe("-5")
    expect(fila("-5")).toBe("-5")
    expect(fila("Gaseosa 350 ml")).toBe("Gaseosa 350 ml")
  })
})
