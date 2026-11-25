import { describe, expect, it } from "vitest"
import { nombreDeRuta, tituloPestana } from "./titulo-pestana"

const rutas = [
  { href: "/panel", title: "Inicio" },
  { href: "/panel/nomina", title: "Nómina" },
  { href: "/panel/nomina/electronica", title: "Nómina electrónica" },
  { href: "/panel/clientes", title: "Fiado por cobrar" },
  { href: "/panel/clientes/directorio", title: "Clientes" },
]

describe("nombre de la pestaña", () => {
  it("toma la opción del menú más específica", () => {
    expect(nombreDeRuta("/panel/nomina/electronica", rutas)).toBe("Nómina electrónica")
    expect(nombreDeRuta("/panel/nomina/deducciones", rutas)).toBe("Nómina")
    expect(nombreDeRuta("/panel/clientes/directorio", rutas)).toBe("Clientes")
    expect(nombreDeRuta("/panel", rutas)).toBe("Inicio")
  })

  it("no confunde un prefijo de texto con una sección", () => {
    expect(nombreDeRuta("/panelx", rutas)).toBeNull()
    expect(nombreDeRuta("/panel/nominas", rutas)).toBe("Inicio")
  })

  it("lleva la marca al final", () => {
    expect(tituloPestana("Caja")).toBe("Caja · BookiPos")
    expect(tituloPestana(null)).toBe("BookiPos")
  })
})
