/**
 * sale.spec.ts — Flujo feliz de venta en el POS
 *
 * PRECONDICIONES (el test hace skip con mensaje claro si no se cumplen):
 *   1. Stack completo levantado (Mongo + backend + frontend).
 *   2. Seeder ejecutado: cd backend && npm run seed:demo
 *      → crea usuario demo@sistemapos.local con rol Dueño y al menos 1 sede.
 *   3. La sede demo debe tener al menos 1 producto vendible
 *      (status=active, salePrice > 0, stock > 0).
 *   4. No es necesario que la caja esté abierta: si está cerrada,
 *      el test la abre con base $0 (billetes = null, monedas = null no es
 *      válido; el test ingresa 0 en billetes para poder abrir).
 *
 * El test usa login vía UI para que la cookie de sesión quede en el contexto
 * del browser, tal como lo haría un usuario real.
 *
 * Estrategia de tolerancia:
 *   - Si no hay productos vendibles → skip con mensaje.
 *   - Si la apertura de caja falla → skip con mensaje.
 *   - El flujo de cobro usa efectivo con monto exacto (sin cambio) para
 *     minimizar interacciones y maximizar robustez.
 */

import { test, expect, type Page } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./helpers/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Realiza el login completo por UI y navega al POS.
 * Devuelve la página ya en /pos.
 */
async function loginAndGoToPos(page: Page): Promise<void> {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /iniciar sesión/i }),
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel(/correo o usuario/i).fill(DEMO_EMAIL);
  await page.getByLabel(/contraseña/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();

  // Espera la pantalla de selección de zona
  await expect(
    page.getByRole("heading", { name: /hola/i }),
  ).toBeVisible({ timeout: 15_000 });

  // Click en "Punto de venta" para navegar a /pos
  await page.getByRole("link", { name: /punto de venta/i }).click();

  // Espera a que la URL sea /pos (con un pequeño margen)
  await page.waitForURL("**/pos**", { timeout: 10_000 });
}

/**
 * Si la caja está cerrada (se muestra el gate "Caja cerrada"), la abre con
 * base 0 (billetes = 0, monedas = 0).
 *
 * Devuelve true si se abrió o ya estaba abierta; false si hubo un error
 * irrecuperable que impide vender.
 */
async function ensureCajaOpen(page: Page): Promise<boolean> {
  // Esperamos un momento para que la verificación de caja cargue
  await page.waitForTimeout(2_000);

  // Detecta si aparece el gate de "Caja cerrada"
  const cajaGate = page.getByText(/caja cerrada/i);
  const isClosed = await cajaGate.isVisible();

  if (!isClosed) {
    // La caja ya está abierta, no hay nada que hacer
    return true;
  }

  // Ingresa 0 en billetes para que el botón se habilite
  // El label es "Billetes" (con ícono Banknote), el input tiene id="opening-bills"
  const billsInput = page.locator("#opening-bills");
  await billsInput.fill("0");

  // Click en "Abrir caja y vender"
  const openBtn = page.getByRole("button", { name: /abrir caja y vender/i });
  const isEnabled = await openBtn.isEnabled();
  if (!isEnabled) {
    return false;
  }

  await openBtn.click();

  // Espera a que desaparezca el gate (puede tardar un poco la API)
  try {
    await cajaGate.waitFor({ state: "hidden", timeout: 10_000 });
    return true;
  } catch {
    // Puede que aparezca un error de la API (p. ej. ya hay una sesión abierta)
    const errText = await page
      .locator(".text-destructive, [class*='destructive']")
      .first()
      .textContent()
      .catch(() => "error desconocido");
    console.log(`[sale.spec] Error al abrir caja: ${errText}`);
    return false;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("POS — Flujo de venta (flujo feliz)", () => {
  test(
    "venta simple: login → POS → agregar producto → cobrar → venta completada",
    async ({ page }) => {
      // 1. Login y navegación al POS
      await loginAndGoToPos(page);

      // 2. Asegurar que la caja esté abierta
      const cajaOk = await ensureCajaOpen(page);
      if (!cajaOk) {
        test.skip(
          true,
          "SKIP: No se pudo abrir la caja (puede haber una sesión activa con otro usuario o un error de la API). Verifica el estado de caja en el backend.",
        );
        return;
      }

      // 3. Verificar que hay productos vendibles en la grilla
      // Los productos son botones con el nombre y precio. Esperamos a que
      // el catálogo cargue (el spinner desaparece y aparecen los botones o el
      // mensaje de "no hay productos").
      const noProductsMsg = page.getByText(
        /no hay productos con precio de venta/i,
      );
      const productGrid = page.locator(
        'button[class*="rounded-xl"][class*="border"]',
      );

      // Esperamos hasta 8 s a que aparezca algo (grilla o mensaje vacío)
      await Promise.race([
        productGrid.first().waitFor({ state: "visible", timeout: 8_000 }),
        noProductsMsg.waitFor({ state: "visible", timeout: 8_000 }),
      ]).catch(() => {
        // Timeout: todavía cargando; continuamos y verificamos abajo
      });

      const hasNoProducts = await noProductsMsg.isVisible();
      if (hasNoProducts) {
        test.skip(
          true,
          "SKIP: No hay productos vendibles en la sede demo. Ejecuta el seeder (npm run seed:demo) y verifica que los productos tengan salePrice > 0 y stock > 0.",
        );
        return;
      }

      // 4. Agrega el primer producto disponible (que no esté agotado)
      // Los botones de producto agotados tienen disabled=true
      const availableProduct = page
        .locator('button[class*="rounded-xl"][class*="border"]:not([disabled])')
        .first();

      const productExists = await availableProduct.isVisible();
      if (!productExists) {
        test.skip(
          true,
          "SKIP: Todos los productos están agotados en esta sede. Agrega stock con el módulo de inventario o corre el seeder.",
        );
        return;
      }

      // Captura el nombre del producto antes de hacer click
      const productNameEl = availableProduct.locator(
        "span.font-medium, span[class*='font-medium']",
      );
      const productName = (await productNameEl.first().textContent()) ?? "Producto";

      await availableProduct.click();

      // 5. Verificar que el producto aparece en el carrito (panel derecho)
      // El carrito muestra el nombre del producto en un <li>
      await expect(
        page.locator("ul li").filter({ hasText: productName.trim() }),
      ).toBeVisible({ timeout: 5_000 });

      // 6. Abrir el modal de cobro
      const cobrarBtn = page.getByRole("button", { name: /cobrar/i });
      await expect(cobrarBtn).toBeEnabled();
      await cobrarBtn.click();

      // El modal de cobro debe aparecer. Buscamos el título o el selector
      // de método de pago (que tiene aria-label o texto "Efectivo" / "Tarjeta")
      await expect(
        page.getByRole("button", { name: /efectivo/i }).first(),
      ).toBeVisible({ timeout: 5_000 });

      // 7. Confirmar el cobro (método por defecto = Efectivo)
      // El botón de confirmar tiene texto "Confirmar venta" o similar
      const confirmarBtn = page.getByRole("button", {
        name: /confirmar venta|confirmar/i,
      });
      await expect(confirmarBtn).toBeVisible();

      // Tomamos screenshot antes de confirmar (artefacto de depuración)
      await page.screenshot({
        path: "test-results/sale-checkout-modal.png",
        fullPage: false,
      });

      await confirmarBtn.click();

      // 8. Verificar que la venta se completó
      // Tras la confirmación aparece el recibo / pantalla de "venta registrada"
      // con opciones de imprimir o nueva venta. Buscamos texto característico.
      await expect(
        page
          .getByText(/venta registrada|recibo|ticket|nueva venta|imprimir/i)
          .first(),
      ).toBeVisible({ timeout: 15_000 });

      // Screenshot final como evidencia
      await page.screenshot({
        path: "test-results/sale-completed.png",
        fullPage: false,
      });
    },
  );

  // ── Test auxiliar: el POS requiere autenticación ──────────────────────────

  test("acceso a /pos sin sesión → redirige a /login", async ({ page }) => {
    // Sin hacer login, navegar a /pos debe redirigir al login
    await page.goto("/pos");

    // El guard RequireAuth debería redirigir
    await page.waitForURL(/login|\/$/i, { timeout: 10_000 });

    const url = page.url();
    const isRedirected =
      url.includes("/login") || url === "http://localhost:3000/";

    expect(
      isRedirected,
      `Se esperaba redirección a /login o /, pero la URL es: ${url}`,
    ).toBe(true);
  });

  // ── Test auxiliar: el panel también requiere autenticación ────────────────

  test("acceso a /panel sin sesión → redirige a /login", async ({ page }) => {
    await page.goto("/panel");

    await page.waitForURL(/login|\/$/i, { timeout: 10_000 });

    const url = page.url();
    const isRedirected =
      url.includes("/login") || url === "http://localhost:3000/";

    expect(
      isRedirected,
      `Se esperaba redirección a /login o /, pero la URL es: ${url}`,
    ).toBe(true);
  });
});
