import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authFetch = vi.fn()
vi.mock("@/lib/api-admin", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-admin")>()),
  authFetch: (...args: unknown[]) => authFetch(...args),
}))

import { ConflictoOffline, type SyncDto } from "@/lib/offline/cola"
import { borrarTodo } from "@/lib/offline/idb"
import {
  conRespaldo,
  enviarVentaOffline,
  sondearRed,
  ventaOfflineComoSale,
} from "@/lib/pos/api-offline"
import type { VentaOffline } from "@/lib/offline/cola"

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

describe("comprobante offline", () => {
  it("sin tarifas en la copia local va como contingencia con impuestos incluidos", () => {
    const v = {
      offlineId: "x",
      sedeId: "s1",
      reservationId: "r",
      saleNumber: "FVC-000001",
      soldAt: "2026-10-22T15:00:00.000Z",
      expectedGrandTotal: 23_800,
      sale: { sedeId: "s1", lines: [], payment: { method: "cash", received: 30_000 } },
      lineas: [{ productId: "p1", name: "Arepa", sku: "A", unit: "und", qty: 2, unitPrice: 11_900 }],
      cashierEmail: "c@x",
      estado: "pendiente",
      intentos: 0,
    } as unknown as VentaOffline
    const s = ventaOfflineComoSale(v, undefined)
    expect(s.contingencia).toBe(true)
    expect(s.taxTotal).toBe(0)
    expect(s.total).toBe(23_800)
    expect(s.payment.change).toBe(6_200)
  })
})

describe("sondeo de la red", () => {
  it("cualquier respuesta del servidor prueba que volvió; un TypeError no", async () => {
    const ok = vi.fn(async () => new Response("", { status: 401 }))
    expect(await sondearRed(ok as unknown as typeof fetch)).toBe(true)
    const caida = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    expect(await sondearRed(caida as unknown as typeof fetch)).toBe(false)
  })
})
