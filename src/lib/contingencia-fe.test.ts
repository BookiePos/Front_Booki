import { describe, expect, it } from "vitest"
import {
  FORM_TRANSCRIPCION_VACIO,
  corteTalonarioPorDefecto,
  errorCorteTalonario,
  estadoPlazo,
  fallaDe,
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
    expect(plazoVisible({ dianStatus: "accepted", contingencia: cont() }, ahora)?.fase).toBe("cerrada")
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
