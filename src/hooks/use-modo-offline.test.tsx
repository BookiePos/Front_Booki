import "fake-indexeddb/auto"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sondearRed = vi.fn<() => Promise<boolean>>()
vi.mock("@/lib/pos/api-offline", async (orig) => ({
  ...(await orig<typeof import("@/lib/pos/api-offline")>()),
  sondearRed: () => sondearRed(),
  reservarConsecutivos: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  enviarVentaOffline: vi.fn(),
}))

import { useModoOffline } from "@/hooks/use-modo-offline"

function sesion() {
  const p = btoa(JSON.stringify({ sub: "u-1", biz: "biz-a" }))
  window.localStorage.setItem(
    "sistemapos.auth",
    JSON.stringify({ tokens: { accessToken: `h.${p}.f` }, user: {} }),
  )
}

describe("useModoOffline · sondeo de la red", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sesion()
    sondearRed.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it("marcado sin conexión sin evento online, vuelve a «En línea» cuando el servidor contesta", async () => {
    const { result } = renderHook(() => useModoOffline("sede-1", "turno-1", true))
    act(() => result.current.marcarSinRed())
    expect(result.current.online).toBe(false)

    sondearRed.mockResolvedValue(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(sondearRed).toHaveBeenCalled()
    expect(result.current.online).toBe(false)

    sondearRed.mockResolvedValue(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(result.current.online).toBe(true)
  })
})
