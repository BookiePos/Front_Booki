import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  listSedes: vi.fn(),
  copiarDatosFiscales: vi.fn(),
}))
vi.mock("@/lib/erp/api-inventory", () => api)
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

import { CopiarDatosASedes } from "./asistente-fe-copiar"

const sede = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  code: id,
  name,
  active: true,
  ...extra,
})

describe("CopiarDatosASedes", () => {
  beforeEach(() => {
    api.listSedes.mockReset().mockResolvedValue([
      sede("a", "Rionegro", { nit: "900123456", emisorId: "e1" }),
      sede("b", "Marinilla", { nit: "900123456" }),
      sede("c", "San Antonio", { nit: "900123456", emisorId: "e1" }),
      sede("d", "Cerrada", { active: false }),
    ])
    api.copiarDatosFiscales.mockReset().mockResolvedValue([
      { sedeId: "b", nombre: "Marinilla", ok: true, mensaje: "Datos copiados." },
    ])
  })

  it("ofrece las sedes que aún no comparten el emisor y copia las marcadas", async () => {
    const user = userEvent.setup()
    render(<CopiarDatosASedes sedeId="a" emisorId="e1" />)
    expect(await screen.findByText("¿Usar estos datos en otras sedes?")).toBeTruthy()
    // San Antonio ya comparte: no se ofrece; la inactiva tampoco.
    expect(screen.getByText("San Antonio")).toBeTruthy()
    expect(screen.queryByLabelText(/San Antonio/)).toBeNull()
    expect(screen.queryByText("Cerrada")).toBeNull()

    await user.click(screen.getByText("Marinilla"))
    await user.click(screen.getByRole("button", { name: /copiar a la sede/i }))
    await waitFor(() => expect(api.copiarDatosFiscales).toHaveBeenCalledWith("a", ["b"]))
    expect(await screen.findByText(/Datos copiados\./)).toBeTruthy()
  })

  it("sin otras sedes no se muestra", async () => {
    api.listSedes.mockResolvedValue([sede("a", "Única", { emisorId: "e1" })])
    const { container } = render(<CopiarDatosASedes sedeId="a" emisorId="e1" />)
    await waitFor(() => expect(api.listSedes).toHaveBeenCalled())
    expect(container.textContent).toBe("")
  })
})

describe("CopiarDatosASedes sin emisor (sedes del mismo NIT que no coinciden)", () => {
  it("ofrece todas las demás sedes y explica que así se crea el emisor", async () => {
    api.listSedes.mockReset().mockResolvedValue([
      sede("a", "Rionegro", { nit: "900123456" }),
      sede("b", "Marinilla", { nit: "900123456" }),
    ])
    render(<CopiarDatosASedes sedeId="a" emisorId={null} />)
    expect(await screen.findByText(/se crea el emisor fiscal/)).toBeTruthy()
    expect(screen.getByText("Marinilla")).toBeTruthy()
    expect(screen.queryByText(/Ya comparten/)).toBeNull()
  })
})
