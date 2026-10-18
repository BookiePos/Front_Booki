import type { DashboardData } from "./types"

export interface AlertaHoy {
  id: string
  texto: string
  href: string
  /** `critica` pide acción hoy; `aviso` es informativa. */
  nivel: "critica" | "aviso"
}

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`

/**
 * Alertas del dueño a partir de los datos que ya carga el tablero. Cada fuente
 * es `null` cuando falta permiso o falló la carga: en ese caso no se inventa
 * ninguna alerta.
 */
export function buildAlertasHoy(data: DashboardData): AlertaHoy[] {
  const out: AlertaHoy[] = []

  const filas = data.caja?.rows ?? []
  const descuadres = filas.filter(
    (r) => r.status === "closed" && (r.difference ?? 0) !== 0,
  )
  if (descuadres.length > 0) {
    out.push({
      id: "caja-descuadre",
      texto: `${plural(descuadres.length, "caja cerró", "cajas cerraron")} con diferencia en el arqueo`,
      href: "/panel/caja",
      nivel: "critica",
    })
  }
  const sinAbrir = filas.filter((r) => r.status === "none").length
  if (sinAbrir > 0) {
    out.push({
      id: "caja-sin-abrir",
      texto: `${plural(sinAbrir, "sede sin abrir caja", "sedes sin abrir caja")} hoy`,
      href: "/panel/caja",
      nivel: "aviso",
    })
  }
  if (data.lowStock) {
    out.push({
      id: "stock-bajo",
      texto: `${plural(data.lowStock, "producto con stock bajo", "productos con stock bajo")}`,
      href: "/panel/inventario",
      nivel: "critica",
    })
  }
  if (data.expiring) {
    out.push({
      id: "por-vencer",
      texto: `${plural(data.expiring, "lote por vencer", "lotes por vencer")}`,
      href: "/panel/inventario",
      nivel: "aviso",
    })
  }
  if (data.pendingScans) {
    out.push({
      id: "facturas-foto",
      texto: `${plural(data.pendingScans, "factura por foto", "facturas por foto")} esperando revisión`,
      href: "/panel/compras/facturas",
      nivel: "aviso",
    })
  }
  if (data.poCount) {
    out.push({
      id: "ordenes-compra",
      texto: `${plural(data.poCount, "orden de compra", "órdenes de compra")} sin recibir completa`,
      href: "/panel/compras",
      nivel: "aviso",
    })
  }
  return out
}
