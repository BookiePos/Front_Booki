/**
 * Sesión y navegación compartidas por los e2e de flujos (ítem 5.5).
 *
 * El login por la UI ya lo prueba `login.spec.ts`; los demás flujos entran por
 * el API (más rápido y sin depender del formulario) y dejan la sesión donde la
 * deja la app: el access token en `localStorage["sistemapos.auth"]`.
 */
import { expect, type APIRequestContext, type Page } from "@playwright/test"
import { BACKEND_URL, DEMO_EMAIL, DEMO_PASSWORD } from "./auth"
import { GUIDES } from "../../src/lib/onboarding/guides"
import { CLAVE_NOVEDADES_SESION, NOVEDADES } from "../../src/lib/novedades"

export interface SesionApi {
  accessToken: string
  user: { id: string; role: string; sedeIds: string[]; permissions: string[] }
}

export async function loginApi(
  request: APIRequestContext,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
): Promise<SesionApi> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, { data: { email, password } })
  expect(res.ok(), `login de ${email}: ${res.status()} ${await res.text()}`).toBeTruthy()
  const body = (await res.json()) as { tokens: { accessToken: string }; user: SesionApi["user"] }
  return { accessToken: body.tokens.accessToken, user: body.user }
}

/** Llamada autenticada al API; falla la prueba si no responde 2xx. */
export async function api<T = unknown>(
  request: APIRequestContext,
  sesion: SesionApi,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  ruta: string,
  data?: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${ruta}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${sesion.accessToken}` },
  })
  expect(res.ok(), `${method} ${ruta}: ${res.status()} ${await res.text()}`).toBeTruthy()
  const texto = await res.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}

/**
 * Deja la página con la sesión puesta y, si se pide, la sede del POS elegida,
 * antes de que cargue cualquier script de la app.
 */
export async function ponerSesion(page: Page, sesion: SesionApi, sedeId?: string) {
  // Bienvenida, tours y novedades ya vistos: son para la persona, no para la
  // prueba, y taparían lo que se quiere tocar.
  const onboarding = {
    welcomeSeen: true,
    tourSeen: true,
    checklistHidden: true,
    completedSteps: [],
    seenGuides: GUIDES.map((g) => g.id),
  }
  await page.addInitScript(
    ([s, sede, ob, claveNovedades, version]) => {
      window.localStorage.setItem(
        "sistemapos.auth",
        JSON.stringify({ tokens: { accessToken: s.accessToken }, user: s.user }),
      )
      window.localStorage.setItem(`bookipos.onboarding.${s.user.id}`, JSON.stringify(ob))
      window.sessionStorage.setItem(claveNovedades, version)
      if (sede) window.localStorage.setItem("pos.sedeId", sede)
    },
    [sesion, sedeId ?? "", onboarding, CLAVE_NOVEDADES_SESION, NOVEDADES.version] as const,
  )
}

/**
 * Las superposiciones de primera vez ya se marcan como vistas en `ponerSesion`.
 * Esto queda solo para las pruebas que entran por la UI de login, donde la
 * sesión nace en la página: cierra la tarjeta de novedades si aparece.
 */
export async function cerrarNovedades(page: Page) {
  const dialogo = page.getByRole("dialog", { name: /^Novedades de la versión/ })
  await page.addLocatorHandler(dialogo, async (d) => {
    // "Cerrar novedades" es el fondo del modal (lo tapa el panel): se usa la X.
    await d.getByRole("button", { name: "Cerrar", exact: true }).click()
  })
}

export interface Sede {
  _id: string
  name: string
}

export async function sedes(request: APIRequestContext, sesion: SesionApi): Promise<Sede[]> {
  return api<Sede[]>(request, sesion, "GET", "/sedes")
}

/** Cierra la caja de la sede si quedó abierta de otra prueba (cuadrada). */
export async function cerrarCajaSiAbierta(
  request: APIRequestContext,
  sesion: SesionApi,
  sedeId: string,
) {
  const actual = await api<{ session: unknown; totals: { expectedCash: number } | null }>(
    request,
    sesion,
    "GET",
    `/caja/current?sedeId=${sedeId}`,
  )
  if (actual.session && actual.totals) {
    await api(request, sesion, "POST", "/caja/close", {
      sedeId,
      countedAmount: actual.totals.expectedCash,
      note: "Cierre de limpieza de la prueba e2e",
    })
  }
}
