/**
 * notas.spec.ts — devolución con nota fiscal y devoluciones a medias (Fase 6D).
 *
 * PRECONDICIONES: igual que sale.spec.ts (stack completo con la semilla demo).
 * La empresa demo no tiene documento POS electrónico, así que la devolución
 * sale SIN nota: el aviso tiene que decir por qué (o cuál nota quedó, si el
 * stack sí emite). No se corre contra producción.
 */
import { test, expect, type Page } from "@playwright/test"
import { api, cerrarNovedades, loginApi, ponerSesion, sedes } from "./helpers/sesion"

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
  // Sin cliente elegido no se ofrece el saldo a favor.
  await expect(cobro.getByRole("radio", { name: "Saldo a favor" })).toHaveCount(0)
  await cobro.getByRole("button", { name: "Exacto" }).click()
  await cobro.getByRole("button", { name: /^Confirmar/ }).click()
  await expect(cobro.getByText("Venta registrada")).toBeVisible({ timeout: 15_000 })
  const numero = (await cobro.getByText(/^FV-\d+$/).first().textContent())?.trim() ?? ""
  expect(numero).toMatch(/^FV-\d+$/)
  await cobro.getByRole("button", { name: "Cerrar" }).first().click()
  return numero
}

test.describe("POS — devolución con nota", () => {
  test.beforeEach(async ({ page, request }) => {
    const sesion = await loginApi(request)
    const [centro] = await sedes(request, sesion)
    const actual = await api<{ session: unknown }>(request, sesion, "GET", `/caja/current?sedeId=${centro._id}`)
    if (!actual.session) {
      await api(request, sesion, "POST", "/caja/open", { sedeId: centro._id, openingAmount: 100_000 })
    }
    await ponerSesion(page, sesion, centro._id)
    await cerrarNovedades(page)
    await page.goto("/pos")
    await page.getByRole("button", { name: new RegExp(centro.name) }).click()
  })

  test("la devolución en efectivo dice qué nota quedó y avisa lo que no se devuelve", async ({ page }) => {
    const numero = await venderPrimerProducto(page, 2)
    await page.getByRole("link", { name: "Ventas" }).click()
    await page.getByRole("button", { name: new RegExp(`^${numero} `) }).click()
    const detalle = page.getByRole("dialog").filter({ hasText: "Detalle de la venta y comprobante." })
    await detalle.getByRole("button", { name: "Devolución" }).click()

    const devolucion = page.getByRole("dialog").filter({ hasText: `Devolución de ${numero}` })
    await expect(devolucion.getByText(/no devuelve el INC de las bolsas/)).toBeVisible()
    await devolucion.getByRole("textbox", { name: /^Cantidad devuelta de/ }).fill("1")

    // Sin cliente registrado, dejarlo a favor se bloquea antes de enviar.
    await devolucion.getByLabel("Cómo le devuelves la plata").selectOption("credit_note")
    await expect(devolucion.getByText(/no tiene cliente registrado/)).toBeVisible()
    await expect(devolucion.getByRole("button", { name: /^Devolver \$/ })).toBeDisabled()
    await devolucion.getByLabel("Cómo le devuelves la plata").selectOption("cash")

    await devolucion.getByRole("button", { name: /^Devolver \$/ }).click()
    const exito = devolucion.getByText("Devolución registrada por")
    await expect(exito).toBeVisible({ timeout: 15_000 })
    // Con documento: «Quedó la Nota …»; sin documento: «Sin nota: …».
    await expect(devolucion.getByText(/Quedó la Nota|Sin nota:/)).toBeVisible()
  })
})
