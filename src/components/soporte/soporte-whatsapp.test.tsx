import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { SoporteWhatsapp } from "./soporte-whatsapp"
import { enlaceWhatsapp, normalizarNumero } from "@/lib/soporte"

describe("SoporteWhatsapp", () => {
  it("no se muestra sin número", () => {
    const { container } = render(<SoporteWhatsapp numero={undefined} />)
    expect(container.innerHTML).toBe("")
  })

  it("enlace bien formado, seguro y accesible", () => {
    render(
      <SoporteWhatsapp
        numero="573001234567"
        horario="Lunes a sábado"
        tiempoRespuesta="Menos de 2 horas"
      />,
    )
    const a = screen.getByRole("link", { name: /Soporte por WhatsApp/ })
    const url = new URL(a.getAttribute("href")!)
    expect(url.origin + url.pathname).toBe("https://wa.me/573001234567")
    expect(url.searchParams.get("text")).toMatch(/BookiPos/)
    expect(a.getAttribute("rel")).toBe("noopener noreferrer")
    expect(a.getAttribute("target")).toBe("_blank")
    expect(a.getAttribute("aria-label")).toContain("Lunes a sábado")
  })
})

describe("lib/soporte", () => {
  it("normaliza el número y descarta los inválidos", () => {
    expect(normalizarNumero("+57 300 123 4567")).toBe("573001234567")
    expect(normalizarNumero("")).toBeUndefined()
    expect(normalizarNumero("123")).toBeUndefined()
    expect(enlaceWhatsapp("hola mundo", "abc")).toBeNull()
    expect(enlaceWhatsapp("hola mundo", "573001234567")).toBe(
      "https://wa.me/573001234567?text=hola%20mundo",
    )
  })
})
