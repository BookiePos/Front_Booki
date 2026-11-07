import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const transcribir = vi.fn()
vi.mock("@/lib/pos/api-sales", async (orig) => ({
  ...(await orig<typeof import("@/lib/pos/api-sales")>()),
  transcribirContingencia: (...a: unknown[]) => transcribir(...a),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { TranscribirContingenciaDialog } from "@/components/pos/transcribir-contingencia-dialog"
import type { Sale } from "@/lib/pos/api-sales"

const venta = {
  _id: "v1",
  saleNumber: "V-000001",
  soldAt: "2026-11-05T20:00:00Z",
} as unknown as Sale

// jsdom no trae PointerEvent y el checkbox de Base UI lo construye al hacer clic.
if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
}

afterEach(() => {
  cleanup()
  transcribir.mockReset()
})

function montar() {
  const onDone = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <TranscribirContingenciaDialog sale={venta} open onOpenChange={onOpenChange} onDone={onDone} />,
  )
  return { onDone, onOpenChange }
}

describe("TranscribirContingenciaDialog", () => {
  it("sin talonario transcribe sin cuerpo y avisa al terminar", async () => {
    transcribir.mockResolvedValue({ pendientes: 0, documento: { fullNumber: "SETP1" } })
    const { onDone } = montar()
    await userEvent.click(screen.getByRole("button", { name: "Transcribir" }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(transcribir).toHaveBeenCalledWith("v1", {})
  })

  it("con papel pide número y fecha, y no envía si faltan", async () => {
    montar()
    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.click(screen.getByRole("button", { name: "Transcribir" }))
    expect(await screen.findByText(/número impreso en el papel/i)).toBeTruthy()
    expect(transcribir).not.toHaveBeenCalled()
  })

  it("con papel válido envía el talonario", async () => {
    transcribir.mockResolvedValue({ pendientes: 0, documento: {} })
    const { onDone } = montar()
    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.type(screen.getByLabelText(/Número del papel/i), "7")
    await userEvent.type(screen.getByLabelText(/Fecha del papel/i), "2026-11-04")
    await userEvent.click(screen.getByRole("button", { name: "Transcribir" }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(transcribir).toHaveBeenCalledWith("v1", { talonario: { numero: 7, fecha: "2026-11-04" } })
  })

  it("muestra el error del backend dentro de la ficha", async () => {
    transcribir.mockRejectedValue(new Error("El número 7 no está en la serie"))
    const { onDone } = montar()
    await userEvent.click(screen.getByRole("button", { name: "Transcribir" }))
    expect(await screen.findByText(/no está en la serie/)).toBeTruthy()
    expect(onDone).not.toHaveBeenCalled()
  })
})
