import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const listar = vi.fn()
const completar = vi.fn()
vi.mock("@/lib/pos/api-sales", async (orig) => ({
  ...(await orig<typeof import("@/lib/pos/api-sales")>()),
  listDevolucionesPendientes: (...a: unknown[]) => listar(...a),
  completarDevolucion: (...a: unknown[]) => completar(...a),
}))

import { DevolucionesPendientes } from "@/components/pos/devoluciones-pendientes"

function fila(n: number, extra: Record<string, unknown> = {}) {
  return {
    _id: `r${n}`,
    saleId: `v${n}`,
    saleNumber: `FV-00000${n}`,
    lines: [],
    refundMethod: "cash",
    refundTotal: 1000 * n,
    estado: "pendiente_caja",
    userEmail: "caja@demo.co",
    createdAt: "2026-11-05T15:00:00Z",
    ...extra,
  }
}

afterEach(() => {
  cleanup()
  listar.mockReset()
  completar.mockReset()
})

describe("DevolucionesPendientes", () => {
  it("sin pendientes no pinta nada y pide solo la sede del terminal", async () => {
    listar.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
    const { container } = render(<DevolucionesPendientes sedeId="s1" />)
    await waitFor(() => expect(listar).toHaveBeenCalledWith({ sedeId: "s1", page: 1, limit: 20 }))
    expect(container.textContent).toBe("")
  })

  it("lista las pendientes con su venta, estado y botón Completar", async () => {
    listar.mockResolvedValue({
      items: [fila(1), fila(2, { estado: "en_curso", kind: "rebaja", concepto: "3" })],
      total: 2,
      page: 1,
      limit: 20,
    })
    render(<DevolucionesPendientes sedeId="s1" />)
    expect(await screen.findByText(/Devolución de FV-000001/)).toBeTruthy()
    expect(screen.getByText(/Rebaja · Rebaja o descuento de FV-000002/)).toBeTruthy()
    expect(screen.getByText("Falta la salida de caja")).toBeTruthy()
    expect(screen.getByText("En curso")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^Completar/ })).toHaveLength(2)
  })

  it("completar relee la bandeja y avisa a la página", async () => {
    listar
      .mockResolvedValueOnce({ items: [fila(1)], total: 1, page: 1, limit: 20 })
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })
    completar.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<DevolucionesPendientes sedeId="s1" onChanged={onChanged} />)
    await userEvent.click(
      await screen.findByRole("button", { name: /^Completar la devolución de FV-000001/ }),
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(completar).toHaveBeenCalledWith("r1")
    await waitFor(() => expect(screen.queryByText(/Devoluciones a medias/)).toBeNull())
  })

  it("sin caja abierta, el 409 se explica y la fila sigue ahí", async () => {
    listar.mockResolvedValue({ items: [fila(1)], total: 1, page: 1, limit: 20 })
    completar.mockRejectedValue(new Error("No hay una caja abierta en la sede"))
    render(<DevolucionesPendientes sedeId="s1" />)
    await userEvent.click(await screen.findByRole("button", { name: /^Completar/ }))
    expect(await screen.findByText(/Abre el turno de caja/)).toBeTruthy()
    expect(screen.getByText(/Devolución de FV-000001/)).toBeTruthy()
  })

  it("«Ver más» trae la página siguiente sin repetir filas", async () => {
    const primera = Array.from({ length: 20 }, (_, i) => fila(i + 1, { _id: `a${i}` }))
    listar
      .mockResolvedValueOnce({ items: primera, total: 21, page: 1, limit: 20 })
      .mockResolvedValueOnce({
        items: [fila(9, { _id: "z1", saleNumber: "FV-ULTIMA" })],
        total: 21,
        page: 2,
        limit: 20,
      })
    render(<DevolucionesPendientes sedeId="s1" />)
    await userEvent.click(await screen.findByRole("button", { name: "Ver más (1)" }))
    expect(await screen.findByText(/Devolución de FV-ULTIMA/)).toBeTruthy()
    expect(listar).toHaveBeenLastCalledWith({ sedeId: "s1", page: 2, limit: 20 })
    expect(screen.queryByRole("button", { name: /Ver más/ })).toBeNull()
  })

  it("si la consulta falla, lo dice y deja reintentar", async () => {
    listar
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue({ items: [fila(1)], total: 1, page: 1, limit: 20 })
    render(<DevolucionesPendientes sedeId="s1" />)
    expect(await screen.findByText(/No se pudo consultar/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByText(/Devolución de FV-000001/)).toBeTruthy()
  })
})
