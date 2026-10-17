import { describe, expect, it } from "vitest"

import { sinTokensEnRuta } from "./sentry-opciones"

/** Ítem 4.11: los tokens que van en la ruta no llegan a Sentry. */
describe("sinTokensEnRuta", () => {
  it("cambia por :token el secreto de las páginas con enlace de un solo uso", () => {
    expect(sinTokensEnRuta("https://w.test/recuperar/abc")).toBe("https://w.test/recuperar/:token")
    expect(sinTokensEnRuta("https://w.test/invitacion/64b0.def")).toBe(
      "https://w.test/invitacion/:token",
    )
    expect(sinTokensEnRuta("https://w.test/registro/confirmar/fff")).toBe(
      "https://w.test/registro/confirmar/:token",
    )
  })

  it("deja igual las demás rutas", () => {
    expect(sinTokensEnRuta("https://w.test/recuperar")).toBe("https://w.test/recuperar")
    expect(sinTokensEnRuta("https://w.test/panel/ventas")).toBe("https://w.test/panel/ventas")
  })
})
