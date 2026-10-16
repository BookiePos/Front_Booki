/**
 * compras.spec.ts — orden de compra con IVA (ítem 5.5).
 *
 * Una orden con un renglón al 19 % debe quedar con el IVA aparte del costo:
 * el IVA descontable no es costo del inventario (art. 485 ET), así que si se
 * mezclara, cada unidad vendida saldría más cara de lo que costó.
 */
import { test, expect } from "@playwright/test"
import { api, cerrarNovedades, loginApi, ponerSesion, sedes } from "./helpers/sesion"

interface OrdenCompra {
  number: string
  subtotal: number
  taxAmount?: number
  total: number
  note?: string
}

test("orden de compra con IVA del 19 % separado del costo", async ({ page, request }) => {
  const sesion = await loginApi(request)
  const [centro] = await sedes(request, sesion)
  const nota = `e2e-${Date.now()}`

  await ponerSesion(page, sesion)
  await cerrarNovedades(page)
  await page.goto("/panel/compras")
  await page.getByRole("button", { name: "Nueva orden" }).click()

  const orden = page.getByRole("dialog").filter({ hasText: "Nueva orden de compra" })
  await orden.locator("#oc-sede").selectOption({ label: centro.name })
  await orden.locator("#oc-supplier").selectOption({ index: 1 })
  await orden.locator("#oc-prod-0").selectOption({ label: "Gaseosa 400ml (und)" })
  await orden.locator("#oc-qty-0").fill("10")
  await orden.locator("#oc-cost-0").fill("2000")
  await orden.locator("#oc-tax-0").selectOption("IVA_19")
  await orden.locator("#oc-note").fill(nota)
  await orden.getByRole("button", { name: "Crear orden" }).click()
  await expect(orden).toBeHidden({ timeout: 15_000 })

  const ordenes = await api<OrdenCompra[] | { rows: OrdenCompra[] }>(
    request,
    sesion,
    "GET",
    "/purchasing/orders",
  )
  const lista = Array.isArray(ordenes) ? ordenes : ordenes.rows
  const creada = lista.find((o) => o.note === nota)
  expect(creada, "la orden creada aparece en el API").toBeTruthy()
  // 10 × 2.000 = 20.000 de costo; 3.800 de IVA aparte; 23.800 a pagar.
  expect(creada!.subtotal).toBe(20_000)
  expect(creada!.taxAmount).toBe(3_800)
  expect(creada!.total).toBe(23_800)
  await expect(page.getByRole("cell", { name: creada!.number })).toBeVisible()
})
