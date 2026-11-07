import { describe, expect, it } from "vitest"
import {
  FORM_TRANSCRIPCION_VACIO,
  corteTalonarioPorDefecto,
  errorCorteTalonario,
  estadoPlazo,
  fallaDe,
  horaColombia,
  hoyColombia,
  plazoVisible,
  validarTranscripcion,
  type ContingenciaDoc,
} from "./contingencia-fe"

const ahora = new Date("2026-11-05T15:00:00Z") // 10:00 en Colombia
const cont = (o: Partial<ContingenciaDoc> = {}): ContingenciaDoc => ({
  tipo: "07",
  declaradaAt: "2026-11-05T14:00:00Z",
  superadaAt: "2026-11-05T14:00:00Z",
  ...o,
})

describe("plazo de contingencia", () => {
  it("03/07 corre desde superadaAt: en plazo, por vencer y vencido", () => {
    expect(estadoPlazo(cont(), ahora).fase).toBe("en_plazo")
    expect(estadoPlazo(cont({ superadaAt: "2026-11-03T20:00:00Z" }), ahora).fase).toBe("por_vencer")
    const v = estadoPlazo(cont({ superadaAt: "2026-11-01T00:00:00Z" }), ahora)
    expect(v.fase).toBe("vencido")
    expect(v.horasRestantes).toBeLessThan(0)
  })
  it("04/08 no corre hasta que la DIAN responde", () => {
    const c = cont({ tipo: "08", superadaAt: null })
    expect(fallaDe("08")).toBe("dian")
    expect(estadoPlazo(c, ahora).fase).toBe("sin_correr")
    expect(estadoPlazo({ ...c, restablecidoAt: "2026-11-05T14:00:00Z" }, ahora).fase).toBe("en_plazo")
  })
  it("plazoVisible: nada sin contingencia, cerrada, no aplicó y vencido", () => {
    expect(plazoVisible({ dianStatus: "accepted" }, ahora)).toBeNull()
    expect(plazoVisible({ dianStatus: "contingency", contingencia: cont({ noAplico: true }) }, ahora)?.fase).toBe("no_aplico")
    const v = plazoVisible({ dianStatus: "contingency", contingencia: cont({ superadaAt: "2026-11-01T00:00:00Z" }) }, ahora)
    expect(v?.tono).toBe("error")
  })
})

describe("validarTranscripcion", () => {
  it("sin papel ni fecha: payload vacío", () => {
    const r = validarTranscripcion(FORM_TRANSCRIPCION_VACIO, { ahora })
    expect(r.payload).toEqual({})
  })
  it("con papel exige número y fecha, y arma el talonario", () => {
    const mal = validarTranscripcion({ ...FORM_TRANSCRIPCION_VACIO, conPapel: true }, { ahora })
    expect(mal.errores.numero).toBeTruthy()
    expect(mal.errores.fecha).toBeTruthy()
    const ok = validarTranscripcion(
      { ...FORM_TRANSCRIPCION_VACIO, conPapel: true, numero: "7", fecha: "2026-11-04", hora: "09:30" },
      { ahora },
    )
    expect(ok.payload?.talonario).toEqual({ numero: 7, fecha: "2026-11-04", hora: "09:30" })
  })
  it("rechaza fecha de papel futura, hora mala y número decimal", () => {
    const r = validarTranscripcion(
      { ...FORM_TRANSCRIPCION_VACIO, conPapel: true, numero: "1.5", fecha: "2026-11-06", hora: "25:00" },
      { ahora },
    )
    expect(Object.keys(r.errores).sort()).toEqual(["fecha", "hora", "numero"])
  })
  it("superadaEn: futura, anterior a la venta y anterior al papel", () => {
    const f = { ...FORM_TRANSCRIPCION_VACIO, superadaEn: "2026-11-05T11:00" }
    expect(validarTranscripcion(f, { ahora }).errores.superadaEn).toMatch(/futura/)
    const g = { ...FORM_TRANSCRIPCION_VACIO, superadaEn: "2026-11-05T08:00" }
    expect(validarTranscripcion(g, { ahora, momentoVenta: new Date("2026-11-05T14:00:00Z") }).errores.superadaEn).toMatch(/venta/)
    const h = { ...FORM_TRANSCRIPCION_VACIO, conPapel: true, numero: "3", fecha: "2026-11-05", hora: "09:00", superadaEn: "2026-11-05T08:00" }
    expect(validarTranscripcion(h, { ahora }).errores.superadaEn).toMatch(/papel/)
  })
  it("superadaEn válida viaja en UTC desde hora de Colombia", () => {
    const r = validarTranscripcion({ ...FORM_TRANSCRIPCION_VACIO, superadaEn: "2026-11-05T08:00" }, { ahora })
    expect(r.payload?.superadaAt).toBe("2026-11-05T13:00:00.000Z")
  })
  it("hoyColombia usa UTC-5", () => {
    expect(hoyColombia(new Date("2026-11-06T03:00:00Z"))).toBe("2026-11-05")
  })
})

describe("corte del talonario", () => {
  it("vacío es válido y por defecto es la mitad", () => {
    expect(errorCorteTalonario("", 1, 100)).toBeNull()
    expect(corteTalonarioPorDefecto(1, 100)).toBe(50)
    expect(corteTalonarioPorDefecto(101, 200)).toBe(150)
  })
  it("debe dejar un número en cada serie", () => {
    expect(errorCorteTalonario("50", 1, 100)).toBeNull()
    expect(errorCorteTalonario("99", 1, 100)).toBeNull()
    expect(errorCorteTalonario("100", 1, 100)).toMatch(/entre 1 y 99/)
    expect(errorCorteTalonario("0", 1, 100)).toBeTruthy()
    expect(errorCorteTalonario("5", 10, 100)).toMatch(/entre 10 y 99/)
    expect(errorCorteTalonario("5.5", 1, 100)).toBeTruthy()
    expect(errorCorteTalonario("5", 1, undefined)).toMatch(/rango/)
  })
})

describe("superadaEn frente a la venta", () => {
  const venta = new Date("2026-11-05T14:00:00Z") // 09:00 Colombia
  it("sin talonario no puede ser anterior a la venta", () => {
    const f = { ...FORM_TRANSCRIPCION_VACIO, superadaEn: "2026-11-05T08:00" }
    expect(validarTranscripcion(f, { ahora, momentoVenta: venta }).errores.superadaEn).toMatch(/venta/)
  })
  it("con talonario solo se compara con el papel, aunque sea anterior a la venta", () => {
    const f = { ...FORM_TRANSCRIPCION_VACIO, conPapel: true, numero: "3", fecha: "2026-11-04", hora: "09:00", superadaEn: "2026-11-05T08:00" }
    const r = validarTranscripcion(f, { ahora, momentoVenta: venta })
    expect(r.errores.superadaEn).toBeUndefined()
    expect(r.payload?.superadaAt).toBe("2026-11-05T13:00:00.000Z")
  })
})

describe("cierre de la contingencia", () => {
  it("aceptado sin cerradaAt = faltan notas; cerrada solo con cerradaAt", () => {
    expect(plazoVisible({ dianStatus: "accepted", contingencia: cont() }, ahora)?.fase).toBe("notas_pendientes")
    expect(plazoVisible({ dianStatus: "accepted", contingencia: cont({ cerradaAt: "2026-11-05T14:30:00Z" }) }, ahora)?.fase).toBe("cerrada")
  })
})

describe("aceptado sin cerrar: notas o cierre", () => {
  const acept = (n?: number) =>
    plazoVisible({ dianStatus: "accepted", contingencia: cont(), notasPendientes: n }, ahora)
  it("con notas pendientes dice que faltan notas por aceptar", () => {
    const p = acept(2)
    expect(p?.fase).toBe("notas_pendientes")
    expect(p?.texto).toMatch(/faltan notas por aceptar/)
  })
  it("sin notas pendientes dice que falta cerrar la contingencia", () => {
    const p = acept(0)
    expect(p?.fase).toBe("por_cerrar")
    expect(p?.texto).toMatch(/falta cerrar la contingencia/)
    expect(p?.texto).not.toMatch(/faltan notas/)
  })
  it("sin el dato conserva el texto genérico y cerradaAt manda", () => {
    expect(acept(undefined)?.fase).toBe("notas_pendientes")
    const c = cont({ cerradaAt: "2026-11-05T14:30:00Z" })
    expect(plazoVisible({ dianStatus: "accepted", contingencia: c, notasPendientes: 0 }, ahora)?.fase).toBe("cerrada")
  })
})

describe("papel sin hora: misma hora que el backend", () => {
  // Venta a las 15:00 en Colombia (20:00Z).
  const venta = new Date("2026-11-05T20:00:00Z")
  const base = { ...FORM_TRANSCRIPCION_VACIO, conPapel: true, numero: "3", fecha: "2026-11-05" }
  it("horaColombia devuelve HH:mm:ss en UTC-5", () => {
    expect(horaColombia(venta)).toBe("15:00:00")
  })
  it("superación anterior a la hora de la venta del día del papel se rechaza", () => {
    const f = { ...base, superadaEn: "2026-11-05T10:00" }
    const r = validarTranscripcion(f, { ahora, momentoVenta: venta })
    expect(r.errores.superadaEn).toMatch(/papel/)
  })
  it("con hora en el papel manda esa hora, no la de la venta", () => {
    const f = { ...base, hora: "09:00", superadaEn: "2026-11-05T10:00" }
    expect(validarTranscripcion(f, { ahora, momentoVenta: venta }).errores.superadaEn).toBeUndefined()
  })
  it("sin momentoVenta no inventa un piso (lo decide el servidor)", () => {
    const f = { ...base, superadaEn: "2026-11-05T01:00" }
    expect(validarTranscripcion(f, { ahora }).errores.superadaEn).toBeUndefined()
  })
})
