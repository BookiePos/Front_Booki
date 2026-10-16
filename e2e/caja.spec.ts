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

  // Apertura con 100.000 en billetes.
  await expect(page.getByText("Caja cerrada")).toBeVisible()
  await page.getByRole("textbox", { name: "Billetes" }).fill("100000")
  await page.getByRole("button", { name: "Abrir caja" }).click()
  await expect(page.getByText("Caja abierta")).toBeVisible()

  // Salida de 5.000: el esperado baja a 95.000.
  await page.getByRole("button", { name: "Salida", exact: true }).click()
  await page.getByRole("textbox", { name: "Monto" }).fill("5000")
  await page.getByRole("button", { name: "Agregar" }).click()
  await expect(page.getByText("$ 95.000").first()).toBeVisible()

  // Cierre contando exactamente lo esperado.
  await page.getByRole("button", { name: "Cerrar caja" }).click()
  const dialogo = page.getByRole("dialog", { name: "Cerrar caja" })
  await expect(dialogo.getByText("$ 95.000")).toBeVisible()
  await dialogo.getByRole("textbox", { name: "Billetes" }).fill("95000")
  await dialogo.getByRole("button", { name: "Cerrar turno" }).click()

  await expect(page.getByText("Caja cerrada")).toBeVisible()
  await expect(page.getByText("Cuadró").first()).toBeVisible()
})
