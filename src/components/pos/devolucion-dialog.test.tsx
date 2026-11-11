import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const crear = vi.fn()
const previas = vi.fn()
const clientes = vi.fn()
vi.mock("@/lib/pos/api-sales", async (orig) => ({
  ...(await orig<typeof import("@/lib/pos/api-sales")>()),
  createSaleReturn: (...a: unknown[]) => crear(...a),
  listSaleReturns: (...a: unknown[]) => previas(...a),
}))
vi.mock("@/lib/pos/api-customers", () => ({
  listCustomers: (...a: unknown[]) => clientes(...a),
}))

import { DevolucionDialog } from "@/components/pos/devolucion-dialog"
import type { Sale } from "@/lib/pos/api-sales"

function venta(extra: Partial<Sale> = {}): Sale {
  return {
    _id: "v1",
    saleNumber: "FV-000001",
    lines: [
      { productId: "p1", sku: "SKU-1", name: "Galleta", qty: 2, unitPrice: 5000, lineTotal: 10000 },
    ],
    ...extra,
  } as unknown as Sale
}

const ROSA = { _id: "c9", name: "Doña Rosa", docType: "CC", docNumber: "123", active: true }

afterEach(() => {
  cleanup()
  crear.mockReset()
  previas.mockReset()
  clientes.mockReset()
})

async function montar(sale: Sale) {
  previas.mockResolvedValue([])
  const onDone = vi.fn()
  render(<DevolucionDialog sale={sale} open onOpenChange={vi.fn()} onDone={onDone} />)
  const cantidad = await screen.findByLabelText("Cantidad devuelta de Galleta")
  await userEvent.type(cantidad, "1")
  return { onDone }
}

const boton = () =>
  screen.getByRole("button", { name: /^Devolver \$|Registrar devolución/ }) as HTMLButtonElement

const medio = () => screen.getByLabelText(/Cómo le devuelves la plata/)

describe("DevolucionDialog — cliente del saldo a favor", () => {
  it("en efectivo no pide cliente ni consulta el catálogo", async () => {
    crear.mockResolvedValue({ _id: "r1", refundTotal: 5000, refundMethod: "cash" })
    const { onDone } = await montar(venta())
    expect(screen.queryByLabelText(/A quién le queda el saldo/)).toBeNull()
    await userEvent.click(boton())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(clientes).not.toHaveBeenCalled()
    expect(crear.mock.calls[0]?.[1].customerId).toBeUndefined()
  })

  it("venta sin cliente: «Le queda a favor» pide elegirlo y lo envía", async () => {
    clientes.mockResolvedValue([ROSA])
    crear.mockResolvedValue({
      _id: "r1",
      refundTotal: 5000,
      refundMethod: "credit_note",
      aSaldoFavor: 5000,
      customerId: "c9",
    })
    const { onDone } = await montar(venta())
    await userEvent.selectOptions(medio(), "credit_note")

    const selector = await screen.findByLabelText(/A quién le queda el saldo/)
    await screen.findByRole("option", { name: /Doña Rosa/ })
    expect(boton().disabled).toBe(true)

    await userEvent.selectOptions(selector, "c9")
    expect(boton().disabled).toBe(false)
    await userEvent.click(boton())

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(crear).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ refundMethod: "credit_note", customerId: "c9" }),
    )
    expect(await screen.findByText(/a favor a Doña Rosa/)).toBeTruthy()
  })

  it("venta con cliente: no se ofrece elegir otro ni se manda customerId", async () => {
    crear.mockResolvedValue({ _id: "r1", refundTotal: 5000, refundMethod: "credit_note" })
    const { onDone } = await montar(venta({ customerId: "c1" }))
    await userEvent.selectOptions(medio(), "credit_note")
    expect(screen.queryByLabelText(/A quién le queda el saldo/)).toBeNull()
    await userEvent.click(boton())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(clientes).not.toHaveBeenCalled()
    expect(crear.mock.calls[0]?.[1].customerId).toBeUndefined()
  })

  it("el cliente elegido no viaja si al final se devuelve en efectivo", async () => {
    clientes.mockResolvedValue([ROSA])
    crear.mockResolvedValue({ _id: "r1", refundTotal: 5000, refundMethod: "cash" })
    const { onDone } = await montar(venta())
    await userEvent.selectOptions(medio(), "credit_note")
    await screen.findByRole("option", { name: /Doña Rosa/ })
    await userEvent.selectOptions(screen.getByLabelText(/A quién le queda el saldo/), "c9")
    await userEvent.selectOptions(medio(), "cash")
    await userEvent.click(boton())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(crear.mock.calls[0]?.[1].customerId).toBeUndefined()
  })

  it("si los clientes no cargan, deja reintentar", async () => {
    clientes.mockRejectedValueOnce(new Error("sin red")).mockResolvedValue([ROSA])
    await montar(venta())
    await userEvent.selectOptions(medio(), "credit_note")
    expect(await screen.findByText(/No se pudieron cargar los clientes/)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(await screen.findByRole("option", { name: /Doña Rosa/ })).toBeTruthy()
  })

  it("el 400 del servidor (otro cliente en la venta) se muestra en la ficha", async () => {
    clientes.mockResolvedValue([ROSA])
    crear.mockRejectedValue(new Error("La venta ya tiene otro cliente"))
    await montar(venta())
    await userEvent.selectOptions(medio(), "credit_note")
    await screen.findByRole("option", { name: /Doña Rosa/ })
    await userEvent.selectOptions(screen.getByLabelText(/A quién le queda el saldo/), "c9")
    await userEvent.click(boton())
    expect(await screen.findByText(/ya tiene otro cliente/)).toBeTruthy()
  })
})
