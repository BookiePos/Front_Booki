/**
 * restaurante.spec.ts — mesa, comanda y propina (ítem 5.5).
 *
 * El mesero abre una mesa, anota lo pedido del menú y la manda a caja, donde
 * la cuenta queda abierta y se cobra con la propina sugerida del 10 %. La mesa
 * se crea en cada corrida para que la prueba no dependa de cuántas quedaron
 * libres de la anterior.
 */
import { test, expect } from "@playwright/test"
import { api, cerrarNovedades, loginApi, ponerSesion, sedes } from "./helpers/sesion"

test("mesa: comanda del menú enviada a caja y cobrada con propina", async ({ page, request }) => {
  const sesion = await loginApi(request)
  const [centro] = await sedes(request, sesion)
  const mesa = `E2E ${Date.now() % 100000}`
  await api(request, sesion, "POST", "/restaurant/tables", {
    sedeId: centro._id,
    name: mesa,
    zone: "Pruebas",
    seats: 2,
  })
  const actual = await api<{ session: unknown }>(request, sesion, "GET", `/caja/current?sedeId=${centro._id}`)
  if (!actual.session) {
    await api(request, sesion, "POST", "/caja/open", { sedeId: centro._id, openingAmount: 100_000 })
  }

  await ponerSesion(page, sesion, centro._id)
  await cerrarNovedades(page)
  await page.goto("/panel/restaurante")
  await page.getByRole("main").getByRole("button", { name: new RegExp(`^${mesa}`) }).click()

  const comanda = page.getByRole("dialog").filter({ hasText: new RegExp(`^${mesa} · CMD-`) })
  await expect(comanda.getByText("Lo pedido")).toBeVisible()

  // Solo se cobra en caja lo que está en el catálogo: el ítem se elige del menú
  // y toma su precio.
  await comanda.locator("#cmd-item").fill("Hamburguesa clásica")
  await comanda.locator("#cmd-qty").fill("2")
  await comanda.getByRole("button", { name: "Agregar ítem" }).click()
  await expect(comanda.getByText("2× Hamburguesa clásica")).toBeVisible()
  // La propina sugerida es el 10 % del consumo (2 × 18.000).
  await expect(comanda.getByText("$ 3.600")).toBeVisible()

  await comanda.getByRole("button", { name: "Enviar a caja" }).click()
  await expect(comanda).toBeHidden({ timeout: 15_000 })

  // En caja la cuenta de la mesa aparece abierta y se cobra con la propina.
  await page.goto("/pos")
  await page.getByRole("button", { name: new RegExp(centro.name) }).click()
  await page.getByRole("button", { name: /^Cuentas abiertas/ }).click()
  await page.getByRole("button", { name: new RegExp(mesa) }).first().click()
  await page.getByRole("button", { name: "10% · $ 3.600" }).click()
  await page.getByRole("button", { name: /^Cobrar \$/ }).click()

  const cobro = page.getByRole("dialog", { name: "Cobrar" })
  await cobro.getByRole("radio", { name: "Efectivo" }).check()
  await cobro.getByRole("button", { name: "Exacto" }).click()
  await cobro.getByRole("button", { name: /^Confirmar/ }).click()
  await expect(cobro.getByText("Venta registrada")).toBeVisible({ timeout: 15_000 })
  const factura = (await cobro.getByText(/^FV-\d+$/).first().textContent())?.trim()

  const ventas = await api<{ rows: { saleNumber: string; total: number; tip?: number }[] }>(
    request,
    sesion,
    "GET",
    `/sales?sedeId=${centro._id}`,
  )
  const venta = ventas.rows.find((v) => v.saleNumber === factura)
  expect(venta, `la venta ${factura} existe`).toBeTruthy()
  expect(venta!.total).toBe(36_000)
  expect(venta!.tip).toBe(3_600)
})
