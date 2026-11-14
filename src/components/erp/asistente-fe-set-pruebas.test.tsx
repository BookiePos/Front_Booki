import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import type { EmisorConEstado, EmisorVista, HabilitacionFacturaVista } from "@/lib/erp/api-einvoicing"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"

const api = vi.hoisted(() => ({
  enviarSetPruebasFactura: vi.fn(),
  getSetPruebasFactura: vi.fn(),
  getEmisorConEstado: vi.fn(),
}))
vi.mock("@/lib/erp/api-einvoicing", () => api)

import { SetPruebasFe } from "./asistente-fe-set-pruebas"

const emisor: EmisorVista = {
  id: "e1",
  nit: "900123456",
  tipoAmbiente: "2",
  habilitado: false,
  facturaSoftwareId: "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  certificadoVigente: true,
  certAviso: null,
  tieneFacturaPin: true,
  tieneFacturaTestSetId: true,
  tieneCertificado: true,
}
const datos = (e: Partial<EmisorVista> = {}): EmisorConEstado => ({ emisor: { ...emisor, ...e }, estado: null })

const vista = (extra: Partial<HabilitacionFacturaVista> = {}): HabilitacionFacturaVista => ({
  clase: "fe",
  estado: "sin_iniciar",
  aprobada: false,
  listoParaProduccion: false,
  mensaje: "",
  documentos: [],
  ...extra,
})
const enRevision = vista({
  estado: "en_curso",
  mensaje: "Set de pruebas de la factura electrónica en curso: 0 de 10 documentos aceptados.",
  documentos: [
    { tipo: "fv", etiqueta: "Factura de venta", numero: "SETP990000001", estado: "enviado", mensaje: null, intentos: 1 },
  ],
})
const rechazado = vista({
  estado: "en_curso",
  documentos: [
    {
      tipo: "fv",
      etiqueta: "Factura de venta",
      numero: "SETP990000001",
      estado: "rechazado",
      mensaje: "Regla FAD06",
      intentos: 1,
    },
  ],
})

function montar(d: EmisorConEstado, permitido = true, onCambio = vi.fn()) {
  render(
    <ConfirmProvider>
      <SetPruebasFe sedeId="s1" datos={d} permitido={permitido} onCambio={onCambio} />
    </ConfirmProvider>,
  )
  return onCambio
}

/** Pulsa el botón y acepta el diálogo de confirmación (su último botón). */
async function confirmar(nombre: string) {
  await userEvent.click(screen.getByRole("button", { name: nombre }))
  const dialogo = await screen.findByRole("dialog")
  await userEvent.click(Array.from(dialogo.querySelectorAll("button")).pop()!)
}

describe("SetPruebasFe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getSetPruebasFactura.mockResolvedValue(vista())
  })

  it("sin precondiciones: botón deshabilitado, dice qué falta y no consulta", () => {
    montar(datos({ certificadoVigente: false, tieneFacturaTestSetId: false }))
    expect(screen.getByRole("button", { name: "Enviar set de pruebas" })).toHaveProperty("disabled", true)
    expect(screen.getByText(/Para enviarlo falta:.*certificado.*TestSetId/)).toBeTruthy()
    expect(api.getSetPruebasFactura).not.toHaveBeenCalled()
  })

  it("sin el permiso del certificado no ofrece enviar ni consulta", () => {
    montar(datos(), false)
    expect(screen.queryByRole("button", { name: "Enviar set de pruebas" })).toBeNull()
    expect(screen.getByText(/Solo el Dueño/)).toBeTruthy()
    expect(api.getSetPruebasFactura).not.toHaveBeenCalled()
  })

  it("envía solo tras confirmar y muestra el estado en revisión con «Actualizar estado»", async () => {
    api.enviarSetPruebasFactura.mockResolvedValue(enRevision)
    montar(datos())
    await userEvent.click(screen.getByRole("button", { name: "Enviar set de pruebas" }))
    const dialogo = await screen.findByRole("dialog")
    expect(api.enviarSetPruebasFactura).not.toHaveBeenCalled()
    await userEvent.click(Array.from(dialogo.querySelectorAll("button")).pop()!)
    await waitFor(() => expect(api.enviarSetPruebasFactura).toHaveBeenCalledWith("s1"))
    expect(await screen.findByText("En curso")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeTruthy()
    // Todo está en vuelo: no se ofrece reenviar.
    expect(screen.queryByRole("button", { name: /Enviar set|Continuar|Reintentar/ })).toBeNull()
  })

  it("cancelar la confirmación no envía nada", async () => {
    montar(datos())
    await userEvent.click(screen.getByRole("button", { name: "Enviar set de pruebas" }))
    const dialogo = await screen.findByRole("dialog")
    await userEvent.click(dialogo.querySelector("button")!)
    expect(api.enviarSetPruebasFactura).not.toHaveBeenCalled()
  })

  it("al abrir trae el estado guardado; rechazado muestra los motivos y permite reintentar", async () => {
    api.getSetPruebasFactura.mockResolvedValue(rechazado)
    api.enviarSetPruebasFactura.mockResolvedValue(enRevision)
    montar(datos())
    expect(await screen.findByText("Con rechazos")).toBeTruthy()
    expect(screen.getByText("Factura de venta SETP990000001: Regla FAD06")).toBeTruthy()
    await confirmar("Reintentar rechazados")
    await waitFor(() => expect(api.enviarSetPruebasFactura).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("En curso")).toBeTruthy()
  })

  it("«Actualizar estado» reconsulta y, al quedar aceptado, relee el emisor", async () => {
    api.getSetPruebasFactura.mockResolvedValueOnce(enRevision).mockResolvedValueOnce(
      vista({ estado: "aprobada", aprobada: true, listoParaProduccion: true, documentos: enRevision.documentos }),
    )
    const nuevo = datos({ habilitado: true })
    api.getEmisorConEstado.mockResolvedValue(nuevo)
    const onCambio = montar(datos())
    await userEvent.click(await screen.findByRole("button", { name: "Actualizar estado" }))
    expect(await screen.findByText("Aceptado")).toBeTruthy()
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(nuevo))
    expect(screen.queryByRole("button", { name: /Enviar|Actualizar|Reintentar/ })).toBeNull()
  })

  it("muestra tal cual el 409 del servidor", async () => {
    api.enviarSetPruebasFactura.mockRejectedValue(
      new ApiError(409, "Ya hay una corrida de la habilitación en curso: espera un minuto y consulta el avance."),
    )
    montar(datos())
    await confirmar("Enviar set de pruebas")
    expect(await screen.findByText(/Ya hay una corrida/)).toBeTruthy()
  })

  it("emisor ya habilitado: aceptado y sin botón de envío", () => {
    api.getSetPruebasFactura.mockRejectedValue(new ApiError(409, "x"))
    montar(datos({ habilitado: true }))
    expect(screen.getByText("Aceptado")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Enviar set de pruebas" })).toBeNull()
  })
})
