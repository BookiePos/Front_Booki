import { describe, expect, it } from "vitest"
import {
  DIAN_STATUS_LABELS,
  TIPOS_RESOLUCION,
  dianStatusSello,
  resolucionDeTipo,
  tipoExigePrefijo,
  type ResolutionRow,
  type ResolutionStatus,
} from "./api-einvoicing"

const status = (estado: ResolutionStatus["estado"]): ResolutionStatus => ({
  estado,
  alertas: [],
  puedeEmitir: estado === "ok",
  claveTecnicaOk: true,
  consecutivo: { usados: 0 },
  vigencia: { vencida: false, aunNoVigente: false },
})

const row: ResolutionRow = {
  sedeId: "s1",
  sedeCode: "S1",
  sedeName: "Sede 1",
  tipoDocumento: "invoice",
  resolucion: { prefijo: "FE" },
  status: status("ok"),
  otras: [
    { tipoDocumento: "pos", resolucion: { prefijo: "POS" }, status: status("vencida") },
  ],
}

describe("resoluciones por tipo", () => {
  it("solo la factura puede ir sin prefijo", () => {
    expect(TIPOS_RESOLUCION.filter((t) => !tipoExigePrefijo(t))).toEqual(["invoice"])
  })

  it("resuelve la factura en la fila y los demas tipos en otras[]", () => {
    expect(resolucionDeTipo(row, "invoice")?.resolucion?.prefijo).toBe("FE")
    expect(resolucionDeTipo(row, "pos")?.status.estado).toBe("vencida")
    expect(resolucionDeTipo(row, "credit_note")).toBeUndefined()
  })
})

describe("estados DIAN", () => {
  it("tiene etiqueta en espanol para cada estado", () => {
    expect(DIAN_STATUS_LABELS).toEqual({
      draft: "Borrador",
      signed: "Firmado",
      sent: "Enviado a la DIAN",
      accepted: "Aceptado",
      rejected: "Rechazado",
      contingency: "Contingencia",
    })
  })

  it("solo accepted cuenta como validado", () => {
    expect(dianStatusSello("accepted")).toBe("Validada DIAN")
    expect(dianStatusSello("draft")).toBe("Sin validar DIAN")
    expect(dianStatusSello("sent")).toBe("Enviado a la DIAN · sin validar")
  })
})
