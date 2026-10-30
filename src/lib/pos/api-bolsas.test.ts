import { afterEach, describe, expect, it, vi } from "vitest"

const authFetch = vi.fn()
vi.mock("@/lib/api-admin", () => ({
  authFetch: (...a: unknown[]) => authFetch(...a),
  parseResponse: async (r: Response) => {
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  },
}))

import { leerTarifaBolsa, tarifaDeRespuesta } from "./api-bolsas"

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => authFetch.mockReset())

describe("leerTarifaBolsa", () => {
  it("activo: la tarifa; llama al endpoint con la fecha de Colombia", async () => {
    authFetch.mockResolvedValue(ok({ activo: true, tarifa: 73, vigenteDesde: "2026-01-01" }))
    expect(await leerTarifaBolsa()).toBe(73)
    expect(authFetch.mock.calls[0][0]).toMatch(/^\/taxes\/inc-bolsas\/vigente\?fecha=\d{4}-\d{2}-\d{2}$/)
  })
  it("inactivo: 0 (no bloquea)", async () => {
    authFetch.mockResolvedValue(ok({ activo: false, tarifa: 0, vigenteDesde: null }))
    expect(await leerTarifaBolsa()).toBe(0)
  })
  it("4xx, 5xx o error de red: null (bloquea)", async () => {
    authFetch.mockResolvedValue(ok({}, 403))
    expect(await leerTarifaBolsa()).toBeNull()
    authFetch.mockResolvedValue(ok({}, 500))
    expect(await leerTarifaBolsa()).toBeNull()
    authFetch.mockRejectedValue(new Error("red"))
    expect(await leerTarifaBolsa()).toBeNull()
  })
  it("tarifaDeRespuesta ignora la tarifa si no está activo", () => {
    expect(tarifaDeRespuesta({ activo: false, tarifa: 73, vigenteDesde: null })).toBe(0)
  })
})
