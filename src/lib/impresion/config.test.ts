import { beforeEach, describe, expect, it } from "vitest"
import {
  CONFIG_POR_DEFECTO,
  leerConfig,
  guardarConfig,
} from "@/lib/impresion/config"

beforeEach(() => window.localStorage.clear())

describe("config de impresión", () => {
  it("por defecto imprime con el navegador", () => {
    expect(leerConfig()).toEqual(CONFIG_POR_DEFECTO)
    expect(CONFIG_POR_DEFECTO.modo).toBe("navegador")
  })

  it("guarda y recupera", () => {
    guardarConfig({ ...CONFIG_POR_DEFECTO, modo: "termica", ancho: 80 })
    expect(leerConfig().modo).toBe("termica")
    expect(leerConfig().ancho).toBe(80)
  })

  it("ignora basura guardada", () => {
    window.localStorage.setItem("bookipos.impresion", "{no json")
    expect(leerConfig()).toEqual(CONFIG_POR_DEFECTO)
    window.localStorage.setItem("bookipos.impresion", JSON.stringify({ modo: "x", ancho: 99 }))
    expect(leerConfig()).toEqual(CONFIG_POR_DEFECTO)
  })
})
