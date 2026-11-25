import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { AYUDA_MODULOS, ayudaParaRuta } from "./modulos"
import { GUIDES, guideForPath } from "@/lib/onboarding/guides"
import { dashboardItem, navSections } from "@/lib/erp/navigation"
import { navItems as navPos } from "@/lib/pos/navigation"
import { GLOSARIO } from "@/lib/glosario"

/** Todos los .tsx de src, para buscar los `data-tour` que de verdad existen. */
function archivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return archivosTsx(p)
    return p.endsWith(".tsx") ? [p] : []
  })
}

describe("ayuda de cada módulo", () => {
  it("toda opción del menú tiene ayuda escrita o, al menos, su recorrido", () => {
    const rutas = [dashboardItem, ...navSections.flatMap((s) => s.items), ...navPos].map((i) => i.href)
    const sinNada = rutas.filter((r) => !ayudaParaRuta(r) && !guideForPath(r))
    expect(sinNada).toEqual([])
  })

  it("cada tarea tiene entre 2 y 5 pasos y cada palabra existe en el glosario", () => {
    for (const m of AYUDA_MODULOS) {
      expect(m.tareas.length, m.titulo).toBeGreaterThan(0)
      for (const t of m.tareas) {
        expect(t.pasos.length, `${m.titulo} → ${t.titulo}`).toBeGreaterThanOrEqual(2)
        expect(t.pasos.length, `${m.titulo} → ${t.titulo}`).toBeLessThanOrEqual(5)
      }
      for (const k of m.terminos) expect(GLOSARIO[k], `${m.titulo}: ${k}`).toBeDefined()
    }
  })

  it("las rutas más específicas ganan a su padre", () => {
    expect(ayudaParaRuta("/panel/compras/facturas/abc")?.titulo).toBe("Facturas por foto")
    expect(ayudaParaRuta("/panel/clientes/directorio")?.titulo).toBe("Clientes")
    expect(ayudaParaRuta("/panel/clientes")?.titulo).toBe("Fiado por cobrar")
    expect(ayudaParaRuta("/pos/caja")?.titulo).toBe("Caja del turno")
    expect(ayudaParaRuta("/pos")?.titulo).toBe("Vender")
    expect(ayudaParaRuta("/panel")?.titulo).toBe("Inicio")
  })
})

describe("recorridos guiados", () => {
  it("ningún paso apunta a algo que ya no existe en la pantalla", () => {
    // Tras el rediseño, siete pasos apuntaban a botones borrados y el
    // recorrido se quedaba hablando de algo invisible. El motor ahora los
    // salta, pero un paso que se salta es un texto que nadie lee: se arregla.
    const codigo = archivosTsx(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n")
    const objetivos = GUIDES.flatMap((g) => g.build().map((p) => p.target)).filter((t): t is string => Boolean(t))
    const faltan = [...new Set(objetivos)].filter((t) => !codigo.includes(`"${t}"`))
    expect(faltan).toEqual([])
  })
})
