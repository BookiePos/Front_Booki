/**
 * permisos.spec.ts — qué ve y qué no cada rol (ítem 5.5).
 *
 * La matriz completa vive en el backend (`docs/MATRIZ-PERMISOS.md`, con su
 * prueba). Aquí se comprueba de punta a punta con usuarios reales: la pantalla
 * no muestra lo que el rol no tiene, y el API lo rechaza aunque se pida directo.
 */
import { test, expect, type APIRequestContext } from "@playwright/test"
import { BACKEND_URL } from "./helpers/auth"
import { api, cerrarNovedades, loginApi, ponerSesion, sedes, type SesionApi } from "./helpers/sesion"

const CLAVE = "Rol-e2e-2026!"

/** Crea un usuario del rol pedido en la Sede Centro y entra con él. */
async function usuarioDelRol(request: APIRequestContext, rol: string): Promise<SesionApi> {
  const duena = await loginApi(request)
  const [centro] = await sedes(request, duena)
  const email = `${rol}.${Date.now()}@sistemapos.local`
  await api(request, duena, "POST", "/users", {
    email,
    password: CLAVE,
    name: `Prueba ${rol}`,
    role: rol,
    sedeIds: [centro._id],
  })
  return loginApi(request, email, CLAVE)
}

async function estado(request: APIRequestContext, s: SesionApi, method: "GET" | "POST", ruta: string) {
  const res = await request.fetch(`${BACKEND_URL}${ruta}`, {
    method,
    data: method === "POST" ? {} : undefined,
    headers: { Authorization: `Bearer ${s.accessToken}` },
  })
  return res.status()
}

test("el cajero vende pero no entra al panel ni al API administrativo", async ({ page, request }) => {
  const cajero = await usuarioDelRol(request, "cashier")

  for (const ruta of ["/payroll/runs", "/users", "/ledger/entries", "/billing/status", "/finance/expenses"]) {
    expect(await estado(request, cajero, "GET", ruta), ruta).toBe(403)
  }
  expect(await estado(request, cajero, "GET", "/customers")).toBe(200)

  await ponerSesion(page, cajero)
  await cerrarNovedades(page)
  await page.goto("/panel/nomina")
  // Sin permisos de operación, el panel lo manda a su zona: el POS.
  await page.waitForURL("**/pos**")
  await expect(page.getByRole("link", { name: "Ventas" })).toBeVisible()
  expect(new URL(page.url()).pathname.startsWith("/panel")).toBe(false)
})

test("el gerente opera la sede pero no toca usuarios, roles ni la suscripción", async ({ request }) => {
  const gerente = await usuarioDelRol(request, "manager")

  expect(await estado(request, gerente, "GET", "/employees")).toBe(200)
  for (const ruta of ["/users", "/roles", "/billing/status", "/payroll/runs"]) {
    expect(await estado(request, gerente, "GET", ruta), ruta).toBe(403)
  }
  expect(await estado(request, gerente, "POST", "/billing/cancel")).toBe(403)
})
