import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const confirmRegister = vi.fn()
const apiResendRegister = vi.fn()

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok-de-la-ruta-0123456789" }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ confirmRegister }) }))
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiResendRegister: (...a: unknown[]) => apiResendRegister(...a),
}))
vi.mock("@/components/auth/brand-aside", () => ({ AuthBrandAside: () => null }))
vi.mock("@/components/marketing/bookipos-logo", () => ({ BookiPosLogo: () => null }))
vi.mock("@/components/marketing/zone-link", () => ({ ZoneLink: () => null }))

import ConfirmarRegistroPage from "./page"
import nextConfig from "../../../../../../next.config"
import { ApiError } from "@/lib/api"

describe("confirmar registro · página", () => {
  beforeEach(() => {
    confirmRegister.mockReset()
    apiResendRegister.mockReset()
  })

  it("no confirma sola al cargar: espera el clic en «Confirmar»", async () => {
    confirmRegister.mockResolvedValue({
      plan: "negocio",
      user: { name: "Ana Pérez", permissions: [] },
    })
    render(<ConfirmarRegistroPage />)
    expect(confirmRegister).not.toHaveBeenCalled()

    const boton = screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement
    // Sin contraseña no se puede confirmar.
    expect(boton.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Clave#2026" },
    })
    fireEvent.click(boton)
    await waitFor(() =>
      expect(confirmRegister).toHaveBeenCalledWith("tok-de-la-ruta-0123456789", "Clave#2026"),
    )
    expect(await screen.findByText(/Listo, Ana/)).toBeTruthy()
  })

  it("si la confirmación falla, ofrece «Reenviar correo» y usa el endpoint de reenvío", async () => {
    confirmRegister.mockRejectedValue(new ApiError(404, "El enlace venció"))
    apiResendRegister.mockResolvedValue({ ok: true, message: "x" })
    render(<ConfirmarRegistroPage />)
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Otra#2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    const campo = await screen.findByPlaceholderText("tu@correo.com")
    fireEvent.change(campo, { target: { value: "duena@ejemplo.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo" }))

    await waitFor(() =>
      expect(apiResendRegister).toHaveBeenCalledWith("duena@ejemplo.com"),
    )
    expect(await screen.findByText(/enlace nuevo/)).toBeTruthy()
  })
})

describe("confirmar registro · contraseña equivocada", () => {
  it("un 400 vuelve a «pendiente» con el error, limpia el campo y deja reintentar con el mismo enlace", async () => {
    confirmRegister.mockReset()
    confirmRegister.mockRejectedValueOnce(
      new ApiError(400, "Los datos de confirmación no son correctos."),
    )
    confirmRegister.mockResolvedValueOnce({
      plan: "negocio",
      user: { name: "Ana Pérez", permissions: [] },
    })
    render(<ConfirmarRegistroPage />)
    const campo = screen.getByLabelText("Contraseña") as HTMLInputElement
    fireEvent.change(campo, { target: { value: "Mala#2026" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))

    const alerta = await screen.findByRole("alert")
    expect(alerta.textContent).toContain("no son correctos")
    const input = screen.getByLabelText("Contraseña") as HTMLInputElement
    expect(input.value).toBe("")
    expect(input.getAttribute("aria-describedby")).toBe(alerta.id)
    // No cayó en la fase de error: no se ofrece reenviar.
    expect(screen.queryByRole("button", { name: "Reenviar correo" })).toBeNull()

    fireEvent.change(input, { target: { value: "Buena#2026" } })
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(confirmRegister).toHaveBeenCalledTimes(2))
    expect(confirmRegister).toHaveBeenLastCalledWith("tok-de-la-ruta-0123456789", "Buena#2026")
    expect(await screen.findByText(/Listo, Ana/)).toBeTruthy()
  })
})

describe("confirmar registro · cabeceras", () => {
  it("la ruta del enlace sale con Referrer-Policy: no-referrer, después de la regla general", async () => {
    const reglas = await nextConfig.headers!()
    const ruta = reglas.findIndex((r) => r.source.startsWith("/registro/confirmar/"))
    const general = reglas.findIndex((r) => r.source === "/:path*")
    expect(ruta).toBeGreaterThan(general)
    expect(reglas[ruta]!.headers).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    })
  })
})
