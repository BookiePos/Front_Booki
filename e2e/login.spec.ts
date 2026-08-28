/**
 * login.spec.ts — Tests E2E del flujo de autenticación
 *
 * Cubre:
 *   - Login exitoso con credenciales demo → pantalla de elección de zona
 *   - Verificación de cookie refresh_token tras login exitoso
 *   - Login fallido (credenciales incorrectas) → mensaje de error, URL sigue en /login
 *
 * PRECONDICIONES:
 *   - Stack completo levantado (ver e2e/README.md)
 *   - Seeder ejecutado: cd backend && npm run seed:demo
 *   - Credenciales demo: demo@sistemapos.local / Demo123!
 */

import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./helpers/auth";

test.describe("Login — BookiPos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    // La página de login debe cargarse antes de interactuar
    await expect(page.getByRole("heading", { name: /iniciar sesión/i })).toBeVisible();
  });

  // ── Caso positivo ──────────────────────────────────────────────────────────

  test("login exitoso → pantalla de selección de zona", async ({ page }) => {
    // Rellena el formulario usando los labels reales del HTML
    await page.getByLabel(/correo o usuario/i).fill(DEMO_EMAIL);
    await page.getByLabel(/contraseña/i).fill(DEMO_PASSWORD);

    await page.getByRole("button", { name: /entrar/i }).click();

    // Tras el login exitoso la página muestra "Hola, <nombre>"
    // (componente done=true en LoginPage)
    await expect(
      page.getByRole("heading", { name: /hola/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Las opciones de zona deben existir para el rol Dueño
    await expect(
      page.getByRole("link", { name: /punto de venta/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /panel de operación/i }),
    ).toBeVisible();

    // La URL no debe haber cambiado aún (el usuario elige la zona)
    expect(page.url()).toContain("/login");
  });

  // ── Verificación de cookie ─────────────────────────────────────────────────

  test("login exitoso → cookie refresh_token presente", async ({
    page,
    context,
  }) => {
    await page.getByLabel(/correo o usuario/i).fill(DEMO_EMAIL);
    await page.getByLabel(/contraseña/i).fill(DEMO_PASSWORD);

    await page.getByRole("button", { name: /entrar/i }).click();

    // Esperamos a que la sesión esté establecida
    await expect(
      page.getByRole("heading", { name: /hola/i }),
    ).toBeVisible({ timeout: 15_000 });

    // El backend (NestJS) envía el refresh_token como HttpOnly cookie.
    // context.cookies() incluye todas las cookies del contexto del browser.
    const cookies = await context.cookies("http://localhost:3000");
    const refreshToken = cookies.find((c) => c.name === "refresh_token");

    expect(
      refreshToken,
      "La cookie refresh_token debe existir tras el login exitoso",
    ).toBeDefined();

    // La cookie debe tener un valor no vacío
    expect(refreshToken?.value.length).toBeGreaterThan(10);
  });

  // ── Caso negativo ──────────────────────────────────────────────────────────

  test("credenciales incorrectas → mensaje de error, sigue en /login", async ({
    page,
  }) => {
    await page.getByLabel(/correo o usuario/i).fill("usuario@invalido.com");
    await page.getByLabel(/contraseña/i).fill("ContraseñaWrong999!");

    await page.getByRole("button", { name: /entrar/i }).click();

    // El error se muestra en el <p role="alert"> dentro del aria-live="polite"
    const errorMsg = page.getByRole("alert");
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });

    // El texto del error debe incluir algo reconocible (el backend devuelve
    // un mensaje de error; si no hay conexión, sale el mensaje de red)
    const errorText = await errorMsg.textContent();
    expect(errorText?.length).toBeGreaterThan(5);

    // Debe seguir en la página de login
    expect(page.url()).toContain("/login");

    // El formulario sigue visible (no se reemplazó por la zona de selección)
    await expect(
      page.getByRole("heading", { name: /iniciar sesión/i }),
    ).toBeVisible();
  });

  // ── Caso negativo: campo vacío ─────────────────────────────────────────────

  test("enviar formulario vacío → no navega, validación HTML nativa", async ({
    page,
  }) => {
    // El formulario tiene required en ambos campos; el browser bloquea el submit
    // sin necesidad de código de app. Solo verificamos que seguimos en /login.
    await page.getByRole("button", { name: /entrar/i }).click();

    // Sin datos no debe aparecer el encabezado "Hola"
    await expect(
      page.getByRole("heading", { name: /hola/i }),
    ).not.toBeVisible();

    expect(page.url()).toContain("/login");
  });
});
