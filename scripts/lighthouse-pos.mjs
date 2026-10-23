/**
 * lighthouse-pos.mjs — mide Lighthouse en /pos (ítem 6.11: 90 o más).
 *
 * /pos exige sesión, así que Lighthouse suelto vería el login. Este script abre
 * Chromium con Playwright, inicia sesión con la cuenta demo y le pasa ese mismo
 * navegador a Lighthouse (--port, sin borrar el almacenamiento).
 *
 * Uso contra el preview de Vercel del PR (no contra producción ni en local):
 *
 *   E2E_BASE_URL=https://<preview>.vercel.app \
 *   E2E_EMAIL=demo@bookipos.com E2E_PASSWORD=<clave> \
 *   node scripts/lighthouse-pos.mjs
 *
 * Móvil por defecto; con LH_PRESET=desktop mide escritorio. Imprime las
 * categorías y sale con 1 si el rendimiento es menor que LH_MIN (90).
 */
import { spawnSync } from "node:child_process"
import { chromium } from "@playwright/test"

const base = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "")
if (!base) {
  console.error("Falta E2E_BASE_URL (el preview de Vercel del PR).")
  process.exit(2)
}
const email = process.env.E2E_EMAIL || ""
const password = process.env.E2E_PASSWORD || ""
const min = Number(process.env.LH_MIN || 90)
const port = 9333

// Chrome de verdad (channel) y no el headless-shell de Playwright: Lighthouse
// no puede navegar en este último ("Target closed").
const browser = await chromium.launch({
  channel: process.env.LH_CHANNEL || "chrome",
  args: [`--remote-debugging-port=${port}`],
})
try {
  const page = await browser.newPage()
  await page.goto(`${base}/login`)
  await page.getByLabel(/correo o usuario/i).fill(email)
  await page.getByLabel(/contraseña/i).fill(password)
  await page.getByRole("button", { name: /entrar/i }).click()
  await page.getByText(/sesión iniciada/i).waitFor({ timeout: 30_000 })

  const args = [
    "--yes",
    "lighthouse@12",
    `${base}/pos`,
    `--port=${port}`,
    "--disable-storage-reset",
    "--output=json",
    "--output=html",
    "--output-path=./lighthouse-pos",
    "--quiet",
  ]
  if (process.env.LH_PRESET === "desktop") args.push("--preset=desktop")
  const r = spawnSync("npx", args, { stdio: "inherit", shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)

  const { readFileSync } = await import("node:fs")
  const lhr = JSON.parse(readFileSync("./lighthouse-pos.report.json", "utf8"))
  let ok = true
  for (const c of Object.values(lhr.categories)) {
    console.log(`${c.title}: ${Math.round(c.score * 100)}`)
  }
  ok = Math.round(lhr.categories.performance.score * 100) >= min
  if (lhr.finalDisplayedUrl && !lhr.finalDisplayedUrl.includes("/pos")) {
    console.error(`Lighthouse terminó en ${lhr.finalDisplayedUrl}: la sesión no se conservó.`)
    ok = false
  }
  process.exit(ok ? 0 : 1)
} finally {
  await browser.close()
}
