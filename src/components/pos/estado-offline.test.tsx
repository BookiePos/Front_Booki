import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

let autoriza = false
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ hasPermission: () => autoriza }),
}))
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => async () => true,
}))
const regularizar = vi.fn<(id: string) => Promise<{ estimado: number; real: number }>>(
  async () => ({ estimado: 4_000, real: 4_500 }),
)
vi.mock("@/lib/pos/api-offline", async (orig) => ({
  ...(await orig<typeof import("@/lib/pos/api-offline")>()),
  listarConflictosServidor: vi.fn(async () => []),
  listarFaltantes: vi.fn(async () => [
    {
      saleId: "v1",
      saleNumber: "FVC-000009",
      faltantes: [{ productId: "p1", qty: 1, unitCost: 4_000, cost: 4_000 }],
    },
  ]),
  regularizarFaltantes: (id: string) => regularizar(id),
}))

import { EstadoOffline } from "@/components/pos/estado-offline"
import type { ModoOffline } from "@/hooks/use-modo-offline"

function modo(over: Partial<ModoOffline> = {}): ModoOffline {
  return {
    online: false,
    pendientes: [{ offlineId: "a" }, { offlineId: "b" }],
    conflictos: [],
    ultimaSync: null,
    numerosLibres: 3,
    disponible: true,
    reemplazadas: [],
    marcarSinRed: () => {},
    vender: async () => ({}),
    sincronizarYa: async () => {},
    reintentar: async () => {},
    ...over,
  } as unknown as ModoOffline
}

beforeEach(() => {
  autoriza = false
  regularizar.mockClear()
})

describe("EstadoOffline · accesibilidad", () => {
  it("el nombre del botón es el texto visible y el estado se anuncia", () => {
    render(<EstadoOffline modo={modo()} sedeId="s1" />)
    const boton = screen.getByRole("button", { name: /Sin conexión · 2 ventas pendientes/ })
    expect(boton.getAttribute("aria-label")).toBeNull()
    const estado = screen.getByRole("status")
    expect(estado.getAttribute("aria-live")).toBe("polite")
    expect(estado.contains(boton)).toBe(true)
    for (const svg of boton.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true")
    }
  })
})

describe("EstadoOffline · bandeja", () => {
  it("muestra el número real de una venta que ya estaba registrada", async () => {
    render(
      <EstadoOffline
        modo={modo({
          online: true,
          pendientes: [],
          reemplazadas: [{ offlineId: "x", offline: "FVC-000003", real: "FV-000123" }],
        })}
        sedeId="s1"
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /En línea/ }))
    expect(await screen.findByText(/FV-000123/)).toBeTruthy()
    expect(screen.getByText(/FVC-000003/)).toBeTruthy()
  })

  it("quien autoriza ve los faltantes de stock y los regulariza", async () => {
    autoriza = true
    render(<EstadoOffline modo={modo({ online: true, pendientes: [] })} sedeId="s1" />)
    await userEvent.click(screen.getByRole("button", { name: /En línea/ }))
    expect(await screen.findByText(/FVC-000009/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /Regularizar/ }))
    expect(regularizar).toHaveBeenCalledWith("v1")
  })
})
