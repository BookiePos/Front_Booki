/**
 * Playwright E2E — BookiPos
 *
 * PRECONDICIONES para correr los tests:
 *   1. MongoDB standalone corriendo (ert)
 *   2. Backend:  cd backend && npm run seed:demo && npm run dev   → http://localhost:3001
 *   3. Frontend: cd frontend/bookipos && pnpm dev                  → http://localhost:3000
 *
 * NO se define webServer aquí porque el stack completo (Mongo + NestJS + Next.js)
 * no se puede orquestar de forma fiable en este contexto.
 * Levanta el stack manualmente antes de ejecutar `pnpm e2e`.
 *
 * ENTORNO (todas opcionales; sin ellas apunta al stack local y al seeder demo):
 *   E2E_BASE_URL  frontend (baseURL)   por defecto http://localhost:3000
 *   E2E_API_URL   backend              por defecto http://localhost:3001
 *   E2E_EMAIL     usuario de la empresa demo
 *   E2E_PASSWORD  su clave
 *
 * `pnpm e2e:prod` corre SOLO sale.spec.ts (flujo feliz de venta) contra otro
 * stack, p. ej. producción. Úsalo SIEMPRE con una empresa demo dedicada: el test
 * abre caja y registra una venta real en esa empresa. Ejemplo (bash):
 *   E2E_BASE_URL=https://<front> E2E_API_URL=https://<api> \
 *   E2E_EMAIL=<demo> E2E_PASSWORD=<clave> pnpm e2e:prod
 * En PowerShell, define cada una con $env:E2E_... = "..." antes del comando.
 * Nunca escribas la clave real en este archivo ni en scripts versionados.
 */

import { defineConfig, devices } from "@playwright/test";
import { FRONTEND_URL } from "./e2e/helpers/auth";

export default defineConfig({
  testDir: "./e2e",

  /**
   * Timeout por test (ms). 30 s basta contra el stack local; contra un stack remoto
   * (e2e:prod) el arranque en frío y la latencia se comen ~25 s solo en el beforeEach
   * y la venta, así que se da 90 s.
   */
  timeout: /^https?:\/\/(localhost|127\.0\.0\.1)/.test(FRONTEND_URL) ? 30_000 : 90_000,

  /** Timeout para cada expect/assertion. */
  expect: {
    timeout: 8_000,
  },

  /** Sin reintentos automáticos: los tests deben ser estables de entrada. */
  retries: 0,

  /** Paralelismo reducido a 1 worker para evitar conflictos de sesión de caja. */
  workers: 1,

  /** Captura trace solo en el primer fallo para no saturar disco en uso normal. */
  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    /** Viewport estándar de escritorio. */
    viewport: { width: 1280, height: 800 },
    /** Cabecera que identifica los requests como E2E en logs del backend. */
    extraHTTPHeaders: {
      "x-e2e-test": "1",
    },
  },

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "test-results/e2e-results.xml" }],
  ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
