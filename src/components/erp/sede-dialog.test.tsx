import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Sede } from "@/lib/erp/api-inventory"

vi.mock("@/lib/erp/api-inventory", () => ({
  createSede: vi.fn(),
  updateSede: vi.fn(),
}))

import { SedeDialog } from "./sede-dialog"

const sede = (extra: Partial<Sede> = {}): Sede =>
  ({
    _id: "s1",
    code: "CM1",
    name: "Crunchy Centro",
    active: true,
    nit: "900123456",
    resolucionFe: { numero: "18760000001", prefijo: "SETP" },
    ...extra,
  }) as Sede

const props = { mode: "edit" as const, onOpenChange: vi.fn(), onSuccess: vi.fn() }

describe("SedeDialog", () => {
  it("no borra lo escrito cuando la página recarga la sede (volver a la pestaña)", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SedeDialog {...props} open sede={sede()} />)
    const desde = await screen.findByLabelText(/rango desde/i, { selector: "input" })
    await user.type(desde, "990000000")

    // La página de la sede recarga en silencio al volver a la pestaña y
    // entrega un objeto nuevo con los mismos datos guardados.
    rerender(<SedeDialog {...props} open sede={sede()} />)
    await user.type(screen.getByLabelText(/rango hasta/i, { selector: "input" }), "995000000")

    await waitFor(() => expect((screen.getByLabelText(/rango desde/i, { selector: "input" }) as HTMLInputElement).value).toBe("990000000"))
    expect((screen.getByLabelText(/rango hasta/i, { selector: "input" }) as HTMLInputElement).value).toBe("995000000")
  })

  it("al cerrar y volver a abrir carga lo guardado", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<SedeDialog {...props} open sede={sede()} />)
    await user.type(await screen.findByLabelText(/rango desde/i, { selector: "input" }), "123")

    rerender(<SedeDialog {...props} open={false} sede={sede()} />)
    rerender(
      <SedeDialog
        {...props}
        open
        sede={sede({ resolucionFe: { numero: "18760000001", prefijo: "SETP", rangoDesde: 990000000 } })}
      />,
    )
    await waitFor(() => expect((screen.getByLabelText(/rango desde/i, { selector: "input" }) as HTMLInputElement).value).toBe("990000000"))
  })
})
