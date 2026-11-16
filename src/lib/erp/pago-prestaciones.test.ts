import { describe, expect, it } from "vitest"
import {
  faltaEnFormulario,
  payloadDeFormulario,
  periodoSugerido,
  pesosEnteros,
  type FormularioPrestacion,
} from "./pago-prestaciones"

const form = (o: Partial<FormularioPrestacion> = {}): FormularioPrestacion => ({
  employeeId: "e1",
  tipo: "prima",
  desde: "2026-07-01",
  hasta: "2026-12-31",
  monto: "750000",
  retencion: "",
  medioPago: "47",
  fechaPago: "2026-12-15",
  destino: "fondo",
  fondo: "",
  observacion: "",
  ...o,
})

describe("periodoSugerido", () => {
  it("prima: el semestre en curso; en enero y julio, el que acaba de cerrar", () => {
    expect(periodoSugerido("prima", "2026-06-20")).toEqual({ desde: "2026-01-01", hasta: "2026-06-30" })
    expect(periodoSugerido("prima", "2026-07-03")).toEqual({ desde: "2026-01-01", hasta: "2026-06-30" })
    expect(periodoSugerido("prima", "2026-12-15")).toEqual({ desde: "2026-07-01", hasta: "2026-12-31" })
    expect(periodoSugerido("prima", "2027-01-05")).toEqual({ desde: "2026-07-01", hasta: "2026-12-31" })
  })
  it("cesantías e intereses: el año anterior", () => {
    expect(periodoSugerido("cesantias", "2027-02-10")).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" })
    expect(periodoSugerido("intereses_cesantias", "2027-01-30")).toEqual({ desde: "2026-01-01", hasta: "2026-12-31" })
  })
})

describe("pesosEnteros", () => {
  it("solo enteros no negativos; nada de decimales, puntos ni signos", () => {
    expect(pesosEnteros("750000")).toBe(750000)
    expect(pesosEnteros(" 0 ")).toBe(0)
    for (const malo of ["", "750.000", "750000.5", "-1", "1e5", "abc"]) expect(pesosEnteros(malo)).toBeNull()
  })
})

describe("faltaEnFormulario", () => {
  it("listo cuando está completo", () => {
    expect(faltaEnFormulario(form())).toBeNull()
    expect(faltaEnFormulario(form({ retencion: "10000" }))).toBeNull()
  })
  it("dice qué falta", () => {
    expect(faltaEnFormulario(form({ employeeId: "" }))).toMatch(/empleado/)
    expect(faltaEnFormulario(form({ hasta: "" }))).toMatch(/periodo/)
    expect(faltaEnFormulario(form({ desde: "2027-01-01" }))).toMatch(/termina antes/)
    expect(faltaEnFormulario(form({ monto: "0" }))).toMatch(/monto/)
    expect(faltaEnFormulario(form({ monto: "750.000" }))).toMatch(/monto/)
    expect(faltaEnFormulario(form({ retencion: "750000" }))).toMatch(/retención/)
    expect(faltaEnFormulario(form({ retencion: "1,5" }))).toMatch(/retención/)
    expect(faltaEnFormulario(form({ fechaPago: "" }))).toMatch(/fecha real/)
  })
})

describe("payloadDeFormulario", () => {
  it("la prima no manda destino; la retención solo si es mayor que cero", () => {
    expect(payloadDeFormulario(form())).toEqual({
      employeeId: "e1",
      tipo: "prima",
      monto: 750000,
      periodoDesde: "2026-07-01",
      periodoHasta: "2026-12-31",
      medioPago: "47",
      fechaPago: "2026-12-15",
    })
    expect(payloadDeFormulario(form({ retencion: "10000" })).retencionFuente).toBe(10000)
    expect(payloadDeFormulario(form({ retencion: "0" }))).not.toHaveProperty("retencionFuente")
  })
  it("las cesantías mandan destino y fondo, y nunca retención", () => {
    const p = payloadDeFormulario(form({ tipo: "cesantias", retencion: "5000", fondo: " Porvenir ", observacion: " ok " }))
    expect(p).toMatchObject({ tipo: "cesantias", destino: "fondo", fondo: "Porvenir", observacion: "ok" })
    expect(p).not.toHaveProperty("retencionFuente")
  })
  it("los intereses no mandan destino ni fondo", () => {
    const p = payloadDeFormulario(form({ tipo: "intereses_cesantias", fondo: "Porvenir" }))
    expect(p).not.toHaveProperty("destino")
    expect(p).not.toHaveProperty("fondo")
  })
})
