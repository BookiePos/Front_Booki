import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api"
import type { DocumentoNomina, ResultadoEmisionPeriodo } from "@/lib/erp/api-einvoicing"
import {
  emitirEnBucle,
  esMesValido,
  estadoPrevuelo,
  mensajeErrorNominaPeriodo,
  mesAnterior,
  puedeAjustar,
  puedeConsultar,
  puedeReintentar,
  resumenPrevuelo,
  tonoDian,
  tonoEmision,
} from "@/lib/erp/nomina-electronica-periodo"

const lote = (ids: string[], siguienteCursor?: string, pendientes = 0): ResultadoEmisionPeriodo => ({
  periodo: "2026-10",
  resultados: ids.map((id) => ({ empleadoId: id, nombre: id, estado: "emitido" as const, mensajes: [] })),
  siguienteCursor,
  pendientes,
})

const doc = (o: Partial<DocumentoNomina>): DocumentoNomina => ({
  id: "d1",
  fullNumber: "NE-1",
  tipoXml: "102",
  periodo: "2026-10",
  empleado: { documento: "***1" },
  dianStatus: "accepted",
  vigente: true,
  superado: false,
  issueDate: "2026-11-01",
  ...o,
})

describe("emitirEnBucle", () => {
  it("repite con el cursor hasta que no hay siguienteCursor", async () => {
    const emitir = vi
      .fn()
      .mockResolvedValueOnce(lote(["a", "b", "c"], "c", 2))
      .mockResolvedValueOnce(lote(["d", "e"], undefined, 0))
    const progreso = vi.fn()
    const r = await emitirEnBucle({ emitir, onProgreso: progreso })
    expect(emitir.mock.calls.map((c) => c[0])).toEqual([undefined, "c"])
    expect(r.completo).toBe(true)
    expect(r.resultados.map((x) => x.empleadoId)).toEqual(["a", "b", "c", "d", "e"])
    expect(progreso).toHaveBeenLastCalledWith({ llamadas: 2, procesados: 5, pendientes: 0 })
  })

  it("cancela antes de la siguiente llamada y conserva lo emitido", async () => {
    const signal = { aborted: false }
    const emitir = vi.fn(async () => {
      signal.aborted = true
      return lote(["a"], "a", 4)
    })
    const r = await emitirEnBucle({ emitir, signal })
    expect(emitir).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ cancelado: true, completo: false })
    expect(r.resultados).toHaveLength(1)
  })

  it("no llama si ya estaba cancelado", async () => {
    const emitir = vi.fn()
    const r = await emitirEnBucle({ emitir, signal: { aborted: true } })
    expect(emitir).not.toHaveBeenCalled()
    expect(r.cancelado).toBe(true)
  })

  it("un error corta el bucle, conserva lo previo y muestra el 409 tal cual", async () => {
    const emitir = vi
      .fn()
      .mockResolvedValueOnce(lote(["a"], "a", 1))
      .mockRejectedValueOnce(new ApiError(409, "Falta configurar: dirección."))
    const r = await emitirEnBucle({ emitir })
    expect(r.completo).toBe(false)
    expect(r.error).toBe("Falta configurar: dirección.")
    expect(r.resultados).toHaveLength(1)
  })

  it("se protege de un cursor repetido y del tope de llamadas", async () => {
    const repetido = vi.fn(async () => lote(["a"], "x", 9))
    const r1 = await emitirEnBucle({ emitir: repetido })
    expect(repetido).toHaveBeenCalledTimes(2)
    expect(r1.error).toMatch(/mismo cursor/)

    let n = 0
    const infinito = vi.fn(async () => lote(["a"], `c${n++}`, 9))
    const r2 = await emitirEnBucle({ emitir: infinito, maxLlamadas: 3 })
    expect(infinito).toHaveBeenCalledTimes(3)
    expect(r2.completo).toBe(false)
    expect(r2.error).toMatch(/máximo/)
  })
})

describe("mapeo de estados", () => {
  it("clasifica el pre-vuelo en listo, bloqueado y ya emitido", () => {
    const base = { empleadoId: "1", nombre: "A", bloqueos: [], advertencias: [] }
    const ts = [
      { ...base, ok: true },
      { ...base, ok: false, bloqueos: ["falta"] },
      { ...base, ok: true, documentoExistente: { id: "d", fullNumber: "NE-1", dianStatus: "accepted" } },
      { ...base, ok: true, documentoExistente: { id: "d", fullNumber: "NE-2", dianStatus: "sent" } },
    ]
    expect(ts.map(estadoPrevuelo)).toEqual(["listo", "bloqueado", "ya_emitido", "listo"])
    expect(resumenPrevuelo(ts)).toEqual({ listo: 2, bloqueado: 1, ya_emitido: 1 })
  })

  it("asigna tono a estados DIAN y a resultados de emisión", () => {
    expect(tonoDian("accepted")).toBe("ok")
    expect(tonoDian("rejected")).toBe("error")
    expect(tonoDian("sent")).toBe("aviso")
    expect(tonoDian("draft")).toBe("neutro")
    expect(tonoEmision("existente")).toBe("ok")
    expect(tonoEmision("en_curso")).toBe("aviso")
    expect(tonoEmision("bloqueado")).toBe("error")
  })

  it("habilita acciones solo donde corresponde", () => {
    expect(puedeAjustar(doc({}))).toBe(true)
    expect(puedeAjustar(doc({ superado: true }))).toBe(false)
    expect(puedeAjustar(doc({ vigente: false }))).toBe(false)
    expect(puedeAjustar(doc({ dianStatus: "rejected" }))).toBe(false)
    expect(puedeReintentar(doc({ dianStatus: "sent" }))).toBe(true)
    expect(puedeReintentar(doc({ dianStatus: "rejected" }))).toBe(true)
    expect(puedeReintentar(doc({ dianStatus: "accepted" }))).toBe(false)
    expect(puedeConsultar(doc({ dianStatus: "sent" }))).toBe(true)
    expect(puedeConsultar(doc({ dianStatus: "accepted" }))).toBe(false)
  })
})

describe("mes y errores", () => {
  it("valida YYYY-MM y calcula el mes anterior", () => {
    expect(esMesValido("2026-10")).toBe(true)
    expect(esMesValido("2026-13")).toBe(false)
    expect(esMesValido("26-10")).toBe(false)
    expect(mesAnterior(new Date(2026, 0, 15))).toBe("2025-12")
    expect(mesAnterior(new Date(2026, 10, 5))).toBe("2026-10")
  })

  it("muestra el mensaje del backend y traduce solo el 403", () => {
    expect(mensajeErrorNominaPeriodo(new ApiError(409, "Cambió la identidad del trabajador"))).toBe(
      "Cambió la identidad del trabajador",
    )
    expect(mensajeErrorNominaPeriodo(new ApiError(403, "Forbidden"))).toMatch(/permiso/)
    expect(mensajeErrorNominaPeriodo("x")).toBe("Error desconocido")
  })
})
