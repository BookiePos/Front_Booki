import { describe, expect, it } from "vitest"
import {
  COLUMNAS,
  CMD,
  EscposBuilder,
  codificarTexto,
  pulsoCajon,
} from "@/lib/impresion/escpos"

const bytes = (...n: number[]) => Array.from(n)
const arr = (u: Uint8Array) => Array.from(u)

describe("codificarTexto (CP858)", () => {
  it("codifica acentos y ñ en las posiciones de CP850/CP858", () => {
    expect(arr(codificarTexto("áéíóú"))).toEqual(bytes(0xa0, 0x82, 0xa1, 0xa2, 0xa3))
    expect(arr(codificarTexto("ÁÉÍÓÚ"))).toEqual(bytes(0xb5, 0x90, 0xd6, 0xe0, 0xe9))
    expect(arr(codificarTexto("ñÑüÜ¿¡"))).toEqual(
      bytes(0xa4, 0xa5, 0x81, 0x9a, 0xa8, 0xad),
    )
  })

  it("deja el ASCII tal cual", () => {
    expect(arr(codificarTexto("Total 12.000"))).toEqual(
      Array.from("Total 12.000").map((c) => c.charCodeAt(0)),
    )
  })

  it("normaliza espacios duros del formateo de moneda y el signo menos", () => {
    expect(arr(codificarTexto("$ 12.000"))).toEqual(
      Array.from("$ 12.000").map((c) => c.charCodeAt(0)),
    )
    expect(arr(codificarTexto("−10"))).toEqual(bytes(0x2d, 0x31, 0x30))
  })

  it("el euro solo existe en CP858; en CP850 cae a texto", () => {
    expect(arr(codificarTexto("€", "cp858"))).toEqual(bytes(0xd5))
    expect(arr(codificarTexto("€", "cp850"))).toEqual(bytes(0x45))
  })

  it("lo que no existe en la página sale como ? y las tildes sueltas se descomponen", () => {
    expect(arr(codificarTexto("漢"))).toEqual(bytes(0x3f))
    expect(arr(codificarTexto("ã"))).toEqual(bytes(0x61))
  })
})

describe("EscposBuilder", () => {
  it("arranca con ESC @ y selecciona la página de códigos (ESC t 19 / 2)", () => {
    expect(arr(new EscposBuilder({ ancho: 80 }).inicializar().build())).toEqual(
      bytes(0x1b, 0x40, 0x1b, 0x74, 19),
    )
    expect(
      arr(new EscposBuilder({ ancho: 58, paginaCodigos: "cp850" }).inicializar().build()),
    ).toEqual(bytes(0x1b, 0x40, 0x1b, 0x74, 2))
  })

  it("corta con avance de papel: GS V 66 3", () => {
    expect(arr(new EscposBuilder({ ancho: 80 }).cortar().build())).toEqual(
      bytes(0x1d, 0x56, 0x42, 0x03),
    )
    expect(CMD.cortar).toEqual(bytes(0x1d, 0x56, 0x42, 0x03))
  })

  it("el pulso del cajón es ESC p 0 25 250", () => {
    expect(arr(pulsoCajon())).toEqual(bytes(0x1b, 0x70, 0x00, 0x19, 0xfa))
    expect(arr(new EscposBuilder({ ancho: 80 }).abrirCajon().build())).toEqual(
      bytes(0x1b, 0x70, 0x00, 0x19, 0xfa),
    )
    expect(arr(pulsoCajon(1))).toEqual(bytes(0x1b, 0x70, 0x01, 0x19, 0xfa))
  })

  it("58 mm son 32 columnas y 80 mm son 48", () => {
    expect(COLUMNAS[58]).toBe(32)
    expect(COLUMNAS[80]).toBe(48)
    expect(new EscposBuilder({ ancho: 58 }).columnas).toBe(32)
    expect(new EscposBuilder({ ancho: 80 }).columnas).toBe(48)
  })

  it("el separador ocupa exactamente el ancho de la línea", () => {
    const b = new EscposBuilder({ ancho: 58 }).separador().build()
    expect(arr(b)).toEqual([...Array(32).fill(0x2d), 0x0a])
  })

  it("alinea el valor a la derecha: izquierda + espacios + derecha = ancho", () => {
    const b = new EscposBuilder({ ancho: 58 }).fila("TOTAL", "$ 12.000").build()
    const texto = String.fromCharCode(...b)
    expect(texto).toBe(`TOTAL${" ".repeat(32 - 5 - 8)}$ 12.000\n`)
    expect(texto.length - 1).toBe(32)
  })

  it("el total de 80 mm queda alineado en la columna 48", () => {
    const b = new EscposBuilder({ ancho: 80 }).fila("TOTAL", "$ 1.250.000").build()
    expect(b.length - 1).toBe(48)
    expect(b[b.length - 2]).toBe("0".charCodeAt(0))
  })

  it("una etiqueta larga se recorta para dejar siempre un espacio y el valor completo", () => {
    const b = new EscposBuilder({ ancho: 58 })
      .fila("Hamburguesa doble con queso y tocineta", "$ 25.000")
      .build()
    const lineas = String.fromCharCode(...b).split("\n").filter(Boolean)
    for (const l of lineas) expect(l.length).toBeLessThanOrEqual(32)
    expect(lineas[0].endsWith("$ 25.000")).toBe(true)
  })

  it("parte el texto largo por palabras sin pasarse del ancho", () => {
    const b = new EscposBuilder({ ancho: 58 })
      .texto("Gracias por su compra, vuelva pronto a nuestra tienda de barrio")
      .build()
    const lineas = String.fromCharCode(...b).split("\n").filter(Boolean)
    expect(lineas.length).toBeGreaterThan(1)
    for (const l of lineas) expect(l.length).toBeLessThanOrEqual(32)
  })

  it("centra con ESC a 1 y vuelve a la izquierda", () => {
    const b = arr(new EscposBuilder({ ancho: 58 }).alinear("centro").alinear("izquierda").build())
    expect(b).toEqual(bytes(0x1b, 0x61, 1, 0x1b, 0x61, 0))
  })

  it("negrita con ESC E", () => {
    expect(arr(new EscposBuilder({ ancho: 58 }).negrita(true).negrita(false).build())).toEqual(
      bytes(0x1b, 0x45, 1, 0x1b, 0x45, 0),
    )
  })
})
