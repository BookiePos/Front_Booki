import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EmisorConEstado, EmisorVista } from "@/lib/erp/api-einvoicing"

const api = vi.hoisted(() => ({
  getMunicipiosDane: vi.fn(),
  configurarDomicilioEmisor: vi.fn(),
}))
vi.mock("@/lib/erp/api-einvoicing", () => api)
vi.mock("next/link", () => ({ default: (p: { href: string; children?: unknown }) => <a href={p.href}>{p.children as never}</a> }))

import { BloqueoEmisorAviso, DomicilioFiscal } from "./asistente-fe-domicilio"

const emisor: EmisorVista = {
  id: "e1",
  nit: "900123456",
  tipoAmbiente: "2",
  habilitado: false,
  certificadoVigente: false,
  certAviso: null,
  tieneFacturaPin: false,
  tieneFacturaTestSetId: false,
  tieneCertificado: false,
}
const datos: EmisorConEstado = { emisor, estado: null }
const MUNICIPIOS = [
  { codigo: "05440", municipio: "MARINILLA", departamento: "ANTIOQUIA" },
  { codigo: "05615", municipio: "RIONEGRO", departamento: "ANTIOQUIA" },
]

describe("BloqueoEmisorAviso", () => {
  it("muestra el motivo y un enlace a cada sede a corregir", () => {
    render(
      <BloqueoEmisorAviso
        sedeActual="a"
        bloqueo={{
          motivo: "sedes_no_coinciden",
          mensaje: "Las sedes A y B tienen el mismo NIT pero distinta razón social.",
          sedes: [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }],
          campos: ["razón social"],
        }}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain("distinta razón social")
    expect(screen.getByText("Abrir B").closest("a")?.getAttribute("href")).toBe("/panel/sedes/b")
    expect(screen.getByText("Esta sede (A)")).toBeTruthy()
  })
})

describe("DomicilioFiscal", () => {
  beforeEach(() => {
    api.getMunicipiosDane.mockReset().mockResolvedValue(MUNICIPIOS)
    api.configurarDomicilioEmisor.mockReset().mockResolvedValue(datos)
  })

  it("manda el código DANE del municipio elegido de la lista", async () => {
    const user = userEvent.setup()
    render(<DomicilioFiscal sedeId="s1" datos={datos} permitido onCambio={vi.fn()} />)
    const municipio = await screen.findByLabelText(/municipio/i, { selector: "input" })
    await waitFor(() => expect((municipio as HTMLInputElement).disabled).toBe(false))
    await user.type(screen.getByLabelText(/dirección/i, { selector: "input" }), "Cra 30 # 10-20")
    await user.type(municipio, "RIONEGRO — ANTIOQUIA (05615)")
    await user.type(screen.getByLabelText(/correo/i, { selector: "input" }), "fe@x.co")
    await user.click(screen.getByRole("button", { name: /guardar domicilio/i }))
    await waitFor(() =>
      expect(api.configurarDomicilioEmisor).toHaveBeenCalledWith("s1", {
        direccion: "Cra 30 # 10-20",
        municipioDane: "05615",
        emailFacturacion: "fe@x.co",
      }),
    )
  })

  it("un municipio escrito que no está en la lista no se envía", async () => {
    const user = userEvent.setup()
    render(<DomicilioFiscal sedeId="s1" datos={datos} permitido onCambio={vi.fn()} />)
    const municipio = await screen.findByLabelText(/municipio/i, { selector: "input" })
    await waitFor(() => expect((municipio as HTMLInputElement).disabled).toBe(false))
    await user.type(screen.getByLabelText(/dirección/i, { selector: "input" }), "Calle 1")
    await user.type(municipio, "Rionegro")
    await user.click(screen.getByRole("button", { name: /guardar domicilio/i }))
    expect(await screen.findByText(/elige el municipio de la lista/i)).toBeTruthy()
    expect(api.configurarDomicilioEmisor).not.toHaveBeenCalled()
  })

  it("sin emisor no se muestra", () => {
    const { container } = render(<DomicilioFiscal sedeId="s1" datos={{ emisor: null, estado: null }} permitido onCambio={vi.fn()} />)
    expect(container.textContent).toBe("")
  })
})
