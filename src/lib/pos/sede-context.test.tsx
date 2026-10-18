import { act, render, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SedeProvider, useSede } from "./sede-context"

let mockUser: { id: string; sedeIds: string[] } | null = null
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: mockUser }) }))

const listSedes = vi.fn()
vi.mock("@/lib/pos/api-inventory", () => ({
  listSedes: () => listSedes(),
}))

const sede = (id: string) => ({ _id: id, name: id, active: true })

const box: { ctx: ReturnType<typeof useSede> } = { ctx: null as never }
function Probe() {
  const value = useSede()
  useEffect(() => {
    box.ctx = value
  })
  return null
}
const ui = () => (
  <SedeProvider>
    <Probe />
  </SedeProvider>
)

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  mockUser = { id: "u1", sedeIds: ["a", "b"] }
  listSedes.mockReset()
  listSedes.mockResolvedValue([sede("a"), sede("b")])
})

describe("SedeProvider chosen", () => {
  it("no se resetea al re-ejecutar con un arreglo nuevo de los mismos ids", async () => {
    const { rerender } = render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    expect(box.ctx.chosen).toBe(false)
    act(() => box.ctx.chooseSede("b"))
    expect(box.ctx.chosen).toBe(true)

    mockUser = { id: "u1", sedeIds: ["a", "b"] }
    rerender(ui())
    await waitFor(() => expect(listSedes).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(box.ctx.chosen).toBe(true)
    expect(box.ctx.sedeId).toBe("b")
  })

  it("se resetea si la sede elegida ya no es válida", async () => {
    const { rerender } = render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    act(() => box.ctx.chooseSede("b"))

    mockUser = { id: "u1", sedeIds: ["a", "c"] }
    listSedes.mockResolvedValue([sede("a"), sede("c")])
    rerender(ui())
    await waitFor(() => expect(listSedes).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(box.ctx.sedes.map((s) => s._id)).toEqual(["a", "c"]))
    expect(box.ctx.chosen).toBe(false)
    expect(window.sessionStorage.getItem("pos.sedeElegida")).toBeNull()
  })

  it("la marca persiste en la pestaña y se limpia al cambiar de sede", async () => {
    const first = render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    act(() => box.ctx.chooseSede("b"))
    expect(window.sessionStorage.getItem("pos.sedeElegida")).toBe(
      JSON.stringify({ userId: "u1", sedeId: "b" }),
    )
    first.unmount()

    render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    expect(box.ctx.chosen).toBe(true)
    expect(box.ctx.sedeId).toBe("b")

    act(() => box.ctx.changeSede())
    expect(box.ctx.chosen).toBe(false)
    expect(window.sessionStorage.getItem("pos.sedeElegida")).toBeNull()
  })

  it("una carga con user=null al inicio no borra la marca", async () => {
    window.sessionStorage.setItem(
      "pos.sedeElegida",
      JSON.stringify({ userId: "u1", sedeId: "b" }),
    )
    mockUser = null
    const { rerender } = render(ui())
    await act(async () => {})
    mockUser = { id: "u1", sedeIds: ["a", "b"] }
    rerender(ui())
    await waitFor(() => expect(box.ctx.chosen).toBe(true))
    expect(box.ctx.sedeId).toBe("b")
  })

  it("el cierre de sesión borra la marca", async () => {
    const { rerender } = render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    act(() => box.ctx.chooseSede("b"))
    expect(window.sessionStorage.getItem("pos.sedeElegida")).not.toBeNull()
    mockUser = null
    rerender(ui())
    await act(async () => {})
    expect(window.sessionStorage.getItem("pos.sedeElegida")).toBeNull()
  })

  it("otro usuario no hereda la elección", async () => {
    const { rerender } = render(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    act(() => box.ctx.chooseSede("b"))
    mockUser = { id: "u2", sedeIds: ["a", "b"] }
    rerender(ui())
    await waitFor(() => expect(box.ctx.loading).toBe(true))
    await waitFor(() => expect(box.ctx.loading).toBe(false))
    expect(box.ctx.chosen).toBe(false)
    expect(window.sessionStorage.getItem("pos.sedeElegida")).toBeNull()
  })
})
