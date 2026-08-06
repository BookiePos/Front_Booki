"use client"

import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { getOverview } from "@/lib/erp/api-finance"
import { getSalesReport } from "@/lib/erp/api-reports"
import { getCajaOverview } from "@/lib/erp/api-caja"
import { listPurchaseOrders } from "@/lib/erp/api-purchasing"
import { listOrders } from "@/lib/erp/api-restaurant"
import { getAlerts } from "@/lib/erp/api-inventory"
import { todayLocal } from "@/lib/erp/finance-format"
import type { DashboardData } from "./types"

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}

const EMPTY: DashboardData = {
  overview: null,
  sales: null,
  caja: null,
  poCount: null,
  openTables: null,
  lowStock: null,
}

/**
 * Carga (en paralelo y respetando permisos) todas las fuentes que alimentan los
 * widgets del tablero. Cada fuente es independiente: si una falla o el usuario
 * no tiene permiso, el resto sigue mostrándose.
 */
export function useDashboardData() {
  const { hasPermission, isRestaurant } = useAuth()
  const canFinance = hasPermission("finance.view")
  const canReports = hasPermission("reports.view")
  const canInventory = hasPermission("inventory.view")
  const canPos = hasPermission("pos.sell")

  const [data, setData] = React.useState<DashboardData>(EMPTY)
  const [loading, setLoading] = React.useState(true)

  const reload = React.useCallback(async () => {
    setLoading(true)
    const patch = (p: Partial<DashboardData>) => setData((d) => ({ ...d, ...p }))
    await Promise.all([
      canFinance
        ? getOverview()
            .then((overview) => patch({ overview }))
            .catch(() => patch({ overview: null }))
        : Promise.resolve(),
      canReports
        ? getSalesReport({ from: daysAgo(6), to: todayLocal() })
            .then((sales) => patch({ sales }))
            .catch(() => patch({ sales: null }))
        : Promise.resolve(),
      canFinance || canPos
        ? getCajaOverview()
            .then((caja) => patch({ caja }))
            .catch(() => patch({ caja: null }))
        : Promise.resolve(),
      canFinance
        ? listPurchaseOrders()
            .then((pos) =>
              patch({
                poCount: pos.filter(
                  (p) => p.status === "sent" || p.status === "partial",
                ).length,
              }),
            )
            .catch(() => patch({ poCount: null }))
        : Promise.resolve(),
      isRestaurant && canPos
        ? listOrders()
            .then((o) =>
              patch({
                openTables: o.filter(
                  (x) => x.status !== "closed" && x.status !== "cancelled",
                ).length,
              }),
            )
            .catch(() => patch({ openTables: null }))
        : Promise.resolve(),
      canInventory
        ? getAlerts()
            .then((a) => patch({ lowStock: a.lowStock.length }))
            .catch(() => patch({ lowStock: null }))
        : Promise.resolve(),
    ])
    setLoading(false)
  }, [canFinance, canReports, canInventory, canPos, isRestaurant])

  React.useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, reload }
}
