/**
 * sale.spec.ts — venta, devolución parcial y anulación en el POS (ítem 5.5).
 *
 * PRECONDICIONES: stack completo con la semilla demo (`pnpm seed:demo` en el
 * Backend), que deja la Sede Centro con productos vendibles. La prueba abre la
 * caja por el API si hace falta y la deja abierta para la siguiente.
 *
 * El pago mixto todavía no existe en el POS (ítem 6.9): cuando llegue, va aquí.
 *
 * `pnpm e2e:prod` corre SOLO este archivo contra otro stack (ver
 * playwright.config.ts): úsalo siempre con una empresa demo dedicada.
 */
import { test, expect, type Page } from "@playwright/test"
import { api, cerrarNovedades, loginApi, ponerSesion, sedes } from "./helpers/sesion"

/** Vende el primer producto de la grilla en efectivo exacto; devuelve el número. */
async function venderPrimerProducto(page: Page, veces = 1): Promise<string> {
  const producto = page
    .getByRole("main")
    .getByRole("button", { name: /\$ [\d.]+$/ })
    .first()
  await expect(producto).toBeVisible({ timeout: 15_000 })
  for (let i = 0; i < veces; i++) await producto.click()

  await page.getByRole("button", { name: "Cobrar" }).click()
  const cobro = page.getByRole("dialog", { name: "Cobrar" })
  await cobro.getByRole("radio", { name: "Efectivo" }).check()
  await cobro.getByRole("button", { name: "Exacto" }).click()
  await cobro.getByRole("button", { name: /^Confirmar/ }).click()
  await expect(cobro.getByText("Venta registrada")).toBeVisible({ timeout: 15_000 })
  const numero = (await cobro.getByText(/^FV-\d+$/).first().textContent())?.trim() ?? ""
  expect(numero).toMatch(/^FV-\d+$/)
  await cobro.getByRole("button", { name: "Cerrar" }).first().click()
  await expect(cobro).toBeHidden()
  return numero
}

async function abrirVenta(page: Page, numero: string) {
  await page.getByRole("link", { name: "Ventas" }).click()
  await page.getByRole("button", { name: new RegExp(`^${numero} `) }).click()
  return page.getByRole("dialog").filter({ hasText: "Detalle de la venta y comprobante." })
}

test.describe("POS — venta, devolución y anulación", () => {
  test.beforeEach(async ({ page, request }) => {
    const sesion = await loginApi(request)
    const [centro] = await sedes(request, sesion)
    const actual = await api<{ session: unknown }>(
      request,
      sesion,
      "GET",
      `/caja/current?sedeId=${centro._id}`,
    )
    if (!actual.session) {
      await api(request, sesion, "POST", "/caja/open", { sedeId: centro._id, openingAmount: 100_000 })
    }
    await ponerSesion(page, sesion, centro._id)
    await cerrarNovedades(page)
    await page.goto("/pos")
    await page.getByRole("button", { name: new RegExp(centro.name) }).click()
  })

  test("venta en efectivo y devolución parcial que vuelve al inventario", async ({ page }) => {
    const numero = await venderPrimerProducto(page, 2)
    const detalle = await abrirVenta(page, numero)

    await detalle.getByRole("button", { name: "Devolución" }).click()
    const devolucion = page.getByRole("dialog").filter({ hasText: `Devolución de ${numero}` })
    await devolucion.getByRole("textbox", { name: /^Cantidad devuelta de/ }).fill("1")
    // Con cantidad, el botón dice cuánto se devuelve: "Devolver $ 4.000".
    await devolucion.getByRole("button", { name: /^Devolver \$/ }).click()
    await expect(devolucion.getByText("Devolución registrada por")).toBeVisible({ timeout: 15_000 })
  })

  test("anular una venta la deja como anulada", async ({ page }) => {
    const numero = await venderPrimerProducto(page)
    const detalle = await abrirVenta(page, numero)

    await detalle.getByRole("button", { name: "Anular venta" }).click()
    const confirmar = page.getByRole("dialog").filter({ hasText: `¿Anular la venta ${numero}?` })
    await confirmar.getByRole("button", { name: "Confirmar" }).click()
    await expect(confirmar).toBeHidden({ timeout: 15_000 })
    await expect(detalle.getByRole("button", { name: "Anular venta" })).toBeHidden({ timeout: 15_000 })

    // Dos botones "Cerrar": la X del encabezado y el del pie; el del pie es el último.
    await detalle.getByRole("button", { name: "Cerrar" }).last().click()
    await expect(detalle).toBeHidden()
    await page.getByRole("button", { name: "Anuladas" }).click()
    await expect(page.getByRole("button", { name: new RegExp(`^${numero} `) })).toBeVisible()
  })
})
