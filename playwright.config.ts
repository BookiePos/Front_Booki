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
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",

  /** Timeout por test (ms). 30 s es suficiente para flujos con login + navegación. */
  timeout: 30_000,

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
    baseURL: "http://localhost:3000",
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
