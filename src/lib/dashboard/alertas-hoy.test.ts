import { describe, expect, it } from "vitest"

import { buildAlertasHoy } from "./alertas-hoy"
import type { DashboardData } from "./types"
import type { CajaOverview, CajaOverviewRow } from "@/lib/erp/api-caja"

const VACIO: DashboardData = {
  overview: null,
  sales: null,
  caja: null,
  poCount: null,
  pendingScans: null,
  openTables: null,
  lowStock: null,
  expiring: null,
  plMonthly: null,
}

const fila = (p: Partial<CajaOverviewRow>): CajaOverviewRow => ({
  sedeId: "s",
  sedeName: "Sede",
  status: "open",
  salesCount: 0,
  salesTotal: 0,
  cashSalesTotal: 0,
  movementsIn: 0,
  movementsOut: 0,
  ...p,
})

const caja = (rows: CajaOverviewRow[]): CajaOverview => ({
  date: "2026-10-17",
  rows,
  totals: {
    sedes: rows.length,
    openCount: 0,
    closedCount: 0,
    noneCount: 0,
    openingTotal: 0,
    salesCount: 0,
    salesTotal: 0,
    cashSalesTotal: 0,
    expectedCashTotal: 0,
  },
})

describe("buildAlertasHoy", () => {
  it("no inventa alertas cuando faltan datos (sin permiso o con error)", () => {
    expect(buildAlertasHoy(VACIO)).toEqual([])
  })

  it("marca como crítica la caja cerrada con diferencia", () => {
    const a = buildAlertasHoy({
      ...VACIO,
      caja: caja([
        fila({ status: "closed", difference: -5000 }),
        fila({ status: "closed", difference: 0 }),
      ]),
    })
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ id: "caja-descuadre", nivel: "critica" })
    expect(a[0].texto).toContain("1 caja cerró")
  })

  it("avisa de sedes sin abrir y de stock, con plurales correctos", () => {
    const a = buildAlertasHoy({
      ...VACIO,
      caja: caja([fila({ status: "none" }), fila({ status: "none" })]),
      lowStock: 3,
      expiring: 1,
    })
    expect(a.map((x) => x.id)).toEqual(["caja-sin-abrir", "stock-bajo", "por-vencer"])
    expect(a[0].texto).toContain("2 sedes sin abrir caja")
    expect(a[2].texto).toBe("1 lote por vencer")
  })
})
