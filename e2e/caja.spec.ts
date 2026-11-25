/**
 * caja.spec.ts — turno de caja de punta a punta (ítem 5.5).
 *
 * Abre con base, registra una salida, cierra contando exactamente lo esperado
 * y comprueba que el turno queda en el historial como cuadrado.
 */
import { test, expect } from "@playwright/test"
import {
  cerrarCajaSiAbierta,
  cerrarNovedades,
  loginApi,
  ponerSesion,
  sedes,
} from "./helpers/sesion"

test("caja: abrir con base, registrar una salida y cerrar cuadrada", async ({ page, request }) => {
  const sesion = await loginApi(request)
  const [centro] = await sedes(request, sesion)
  await cerrarCajaSiAbierta(request, sesion, centro._id)
  await ponerSesion(page, sesion, centro._id)

  await cerrarNovedades(page)
  await page.goto("/pos/caja")
  await page.getByRole("button", { name: new RegExp(centro.name) }).click()

  // Apertura con un billete de 100.000, contado por denominación.
  await expect(page.getByText("Caja cerrada")).toBeVisible()
  await page.getByRole("textbox", { name: /Cantidad de .*100.000/ }).fill("1")
  await expect(page.getByText("$ 100.000").first()).toBeVisible()
  await page.getByRole("button", { name: "Abrir caja" }).click()
  await expect(page.getByText("Caja abierta")).toBeVisible()

  // Salida de 5.000: el esperado baja a 95.000.
  await page.getByRole("button", { name: "Salida", exact: true }).click()
  await page.getByRole("textbox", { name: "Monto" }).fill("5000")
  await page.getByRole("button", { name: "Agregar" }).click()
  await expect(page.getByText("$ 95.000").first()).toBeVisible()

  // Cierre contando por denominación, igual que la apertura:
  // 1 × 50.000 + 2 × 20.000 + 1 × 5.000 = 95.000, lo esperado.
  await page.getByRole("button", { name: "Cerrar caja" }).click()
  const dialogo = page.getByRole("dialog", { name: "Cerrar caja" })
  await expect(dialogo.getByText("Debe haber $ 95.000")).toBeVisible()
  await dialogo.getByRole("textbox", { name: /Cantidad de .*50.000/ }).fill("1")
  await dialogo.getByRole("textbox", { name: /Cantidad de .*20.000/ }).fill("2")
  await dialogo.getByRole("textbox", { name: /Cantidad de .*5.000$/ }).fill("1")
  // El resultado se ve junto al botón, sin tener que bajar en el diálogo.
  await expect(dialogo.getByText("cuadra", { exact: true })).toBeVisible()
  await dialogo.getByRole("button", { name: "Cerrar turno" }).click()

  await expect(page.getByText("Caja cerrada")).toBeVisible()
  await expect(page.getByText("Cuadró").first()).toBeVisible()
})
