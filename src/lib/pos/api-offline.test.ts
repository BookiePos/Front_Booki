import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authFetch = vi.fn()
vi.mock("@/lib/api-admin", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-admin")>()),
  authFetch: (...args: unknown[]) => authFetch(...args),
}))

import { ConflictoOffline, type SyncDto } from "@/lib/offline/cola"
import { borrarTodo } from "@/lib/offline/idb"
import { conRespaldo, enviarVentaOffline } from "@/lib/pos/api-offline"

const dto = { offlineId: "x" } as SyncDto

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function sesion(biz: string, sub: string) {
  const p = btoa(JSON.stringify({ sub, biz }))
  window.localStorage.setItem(
    "sistemapos.auth",
    JSON.stringify({ tokens: { accessToken: `h.${p}.f` }, user: {} }),
  )
}

beforeEach(() => authFetch.mockReset())
afterEach(async () => {
  await borrarTodo()
  window.localStorage.clear()
})

describe("enviarVentaOffline", () => {
  it("201 y duplicada pasan", async () => {
    authFetch.mockResolvedValueOnce(json(201, { status: "creada" }))
    authFetch.mockResolvedValueOnce(json(201, { status: "duplicada" }))
    expect(await enviarVentaOffline(dto)).toEqual({ status: "creada" })
    expect(await enviarVentaOffline(dto)).toEqual({ status: "duplicada" })
  })

  it("409 OFFLINE_CONFLICT trae el motivo para la bandeja", async () => {
    authFetch.mockResolvedValueOnce(
      json(409, { code: "OFFLINE_CONFLICT", reason: "SIN_STOCK", message: "Stock insuficiente" }),
    )
    const err = await enviarVentaOffline(dto).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConflictoOffline)
    expect(err).toMatchObject({ reason: "SIN_STOCK", message: "Stock insuficiente" })
  })

  it("un 5xx no es conflicto: la venta sigue pendiente", async () => {
    authFetch.mockResolvedValueOnce(json(503, { message: "caído" }))
    const err = await enviarVentaOffline(dto).catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ConflictoOffline)
  })
})

describe("conRespaldo", () => {
  it("sin red devuelve la copia de la MISMA empresa y usuario", async () => {
    sesion("biz-a", "u-1")
    const r1 = await conRespaldo("catalogo", "s1", async () => ["arepa"])
    expect(r1.origen).toBe("red")
    const sinRed = async (): Promise<string[]> => {
      throw new TypeError("Failed to fetch")
    }
    const r2 = await conRespaldo("catalogo", "s1", sinRed)
    expect(r2).toMatchObject({ origen: "copia", data: ["arepa"] })

    // Otra empresa en el mismo navegador no ve esa copia.
    sesion("biz-b", "u-1")
    await expect(conRespaldo("catalogo", "s1", sinRed)).rejects.toBeInstanceOf(TypeError)
  })

  it("un error del servidor no cae a la copia", async () => {
    sesion("biz-a", "u-1")
    await conRespaldo("catalogo", "s1", async () => ["arepa"])
    const { ApiError } = await import("@/lib/api")
    await expect(
      conRespaldo("catalogo", "s1", async () => {
        throw new ApiError(403, "sin permiso")
      }),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
