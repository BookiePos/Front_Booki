import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import type { GuiaPaso } from "@/lib/erp/guia-fe"
import { GuiaPasoDetalle } from "./asistente-fe-guia"

const guia: GuiaPaso = {
  titulo: "Cómo conseguir el certificado",
  pasos: ["Cómpralo a una entidad.", "Sube aquí el archivo."],
  bookipos: "BookiPos lo valida.",
  nota: "Se renueva cada año.",
}

describe("GuiaPasoDetalle", () => {
  it("cerrada por defecto y abierta si es el siguiente paso", () => {
    const { unmount } = render(<GuiaPasoDetalle guia={guia} />)
    expect(screen.getByRole("group")).not.toHaveProperty("open", true)
    unmount()
    render(<GuiaPasoDetalle guia={guia} abiertaAlInicio />)
    expect(screen.getByRole("group")).toHaveProperty("open", true)
  })

  it("pinta los pasos en orden, lo que hace BookiPos y la nota", () => {
    render(<GuiaPasoDetalle guia={guia} abiertaAlInicio />)
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(guia.pasos)
    expect(screen.getByText("BookiPos lo valida.", { exact: false })).toBeTruthy()
    expect(screen.getByText("Ten en cuenta:", { exact: false })).toBeTruthy()
  })

  it("omite «Después, BookiPos» y la nota si la guía no los trae", () => {
    render(<GuiaPasoDetalle guia={{ titulo: "T", pasos: ["Uno."] }} abiertaAlInicio />)
    expect(screen.queryByText("Después, BookiPos:", { exact: false })).toBeNull()
    expect(screen.queryByText("Ten en cuenta:", { exact: false })).toBeNull()
  })

  it("se abre al pulsar el título", async () => {
    render(<GuiaPasoDetalle guia={guia} />)
    await userEvent.click(screen.getByText(guia.titulo))
    expect(screen.getByRole("group")).toHaveProperty("open", true)
  })
})
