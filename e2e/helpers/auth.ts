/**
 * Helpers de autenticación para los tests E2E.
 *
 * login() hace un POST directo al backend en lugar de navegar por la UI,
 * lo que es mucho más rápido para preparar el estado de sesión en tests que
 * no prueban el login en sí (p. ej. sale.spec.ts).
 *
 * La función devuelve el storageState listo para pasarlo a browser.newContext().
 */

import { type APIRequestContext, type BrowserContext } from "@playwright/test";

/**
 * URLs y credenciales salen del entorno para poder apuntar los e2e a otro stack
 * (p. ej. producción con una empresa demo, ver `pnpm e2e:prod` en
 * playwright.config.ts). Sin variables, se usan el stack local y el seeder demo.
 *
 *   E2E_API_URL   backend NestJS   (por defecto http://localhost:3001)
 *   E2E_BASE_URL  frontend Next    (por defecto http://localhost:3000)
 *   E2E_EMAIL     usuario demo     (por defecto demo@sistemapos.local)
 *   E2E_PASSWORD  clave del demo   (por defecto la del seeder local)
 */
function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

export const DEMO_EMAIL = process.env.E2E_EMAIL || "demo@sistemapos.local";
export const DEMO_PASSWORD = process.env.E2E_PASSWORD || "Demo123!";
export const BACKEND_URL = sinBarraFinal(process.env.E2E_API_URL || "http://localhost:3001");
export const FRONTEND_URL = sinBarraFinal(process.env.E2E_BASE_URL || "http://localhost:3000");

/**
 * Realiza el login vía API directa al backend NestJS.
 * El backend responde con access_token en el body y el refresh_token en cookie.
 * Devuelve el access_token para las llamadas API subsecuentes.
 */
export async function apiLogin(
  request: APIRequestContext,
): Promise<{ accessToken: string }> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });

  if (!res.ok()) {
    throw new Error(
      `Login API falló: ${res.status()} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as { access_token?: string };
  const accessToken = body.access_token ?? "";
  return { accessToken };
}

/**
 * Realiza el login navegando por la UI de /login.
 * Útil para tests que validan el flujo de autenticación mismo.
 * Devuelve cuando la pantalla de elección de zona es visible.
 */
export async function uiLogin(
  context: BrowserContext,
  email: string = DEMO_EMAIL,
  password: string = DEMO_PASSWORD,
): Promise<void> {
  const page = await context.newPage();
  await page.goto("/login");

  await page
    .getByLabel(/correo o usuario/i)
    .fill(email);

  await page
    .getByLabel(/contraseña/i)
    .fill(password);

  await page.getByRole("button", { name: /entrar/i }).click();

  // Espera a que aparezca la pantalla post-login: el encabezado "Hola, …"
  await page.getByRole("heading", { name: /hola/i }).waitFor({ timeout: 15_000 });
  await page.close();
}
