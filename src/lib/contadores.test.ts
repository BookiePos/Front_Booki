import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import sitemap from "@/app/sitemap"
import { CONTADORES, PERMISOS_CONTADOR } from "./contadores"

describe("programa para contadores (ítem 7.8)", () => {
  it("el contador solo tiene permisos de lectura contable", () => {
    expect([...PERMISOS_CONTADOR]).toEqual(["finance.view", "reports.view", "payroll.view"])
    for (const p of PERMISOS_CONTADOR) expect(p).toMatch(/\.view$/)
  })

  it("no promete factura electrónica, precios ni plazos inventados", () => {
    const texto = JSON.stringify(CONTADORES).toLowerCase()
    expect(texto).not.toMatch(/dian|factura electr|\$\s?\d|gratis|comisi/)
  })

  it("explica qué ve, qué no, cómo lo invitan y cómo pedir la demo", () => {
    expect(CONTADORES.ve.length).toBeGreaterThan(3)
    expect(CONTADORES.noHace.length).toBeGreaterThan(3)
    expect(CONTADORES.pasos.length).toBe(3)
    expect(CONTADORES.demo.asunto).toBeTruthy()
  })

  it("/contadores está en el sitemap y enlazada desde el pie", () => {
    expect(sitemap().some((r) => r.url.endsWith("/contadores"))).toBe(true)
    const pie = readFileSync(
      path.join(process.cwd(), "src/components/marketing/site-footer.tsx"),
      "utf8",
    )
    expect(pie).toContain('href: "/contadores"')
  })
})
