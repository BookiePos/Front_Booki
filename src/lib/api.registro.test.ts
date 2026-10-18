import { afterEach, describe, expect, it, vi } from "vitest"

import { apiConfirmRegister, apiResendRegister } from "./api"

/**
 * Ítem 4.11, revisión 2: el token de confirmación viaja en el body, no en la
 * ruta, y el reenvío usa su propio endpoint.
 */
function respuesta(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) } as Response
}

describe("registro · confirmar y reenviar", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("apiConfirmRegister manda el token en el body y no lo pone en la URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ plan: "negocio" }))
    vi.stubGlobal("fetch", fetchMock)

    await apiConfirmRegister("tok/ABC 123")

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/auth\/register\/confirm$/)
    expect(String(url)).not.toContain("tok")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("include")
    expect(JSON.parse(init.body)).toEqual({ token: "tok/ABC 123" })
  })

  it("apiResendRegister pega a /auth/register/resend con el correo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({ ok: true, message: "x" }))
    vi.stubGlobal("fetch", fetchMock)

    await apiResendRegister("dueña@ejemplo.com")

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/auth\/register\/resend$/)
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ email: "dueña@ejemplo.com" })
  })
})
