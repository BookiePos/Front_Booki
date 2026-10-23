import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ hasPermission: () => false }),
}))
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => async () => true,
}))

import { EstadoOffline } from "@/components/pos/estado-offline"
import type { ModoOffline } from "@/hooks/use-modo-offline"

const modo = {
  online: false,
  pendientes: [{ offlineId: "a" }, { offlineId: "b" }],
  conflictos: [],
  ultimaSync: null,
  numerosLibres: 3,
  disponible: true,
  marcarSinRed: () => {},
  vender: async () => ({}),
  sincronizarYa: async () => {},
  reintentar: async () => {},
} as unknown as ModoOffline

describe("EstadoOffline · accesibilidad", () => {
  it("el nombre del botón es el texto visible y el estado se anuncia", () => {
    render(<EstadoOffline modo={modo} sedeId="s1" />)
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
