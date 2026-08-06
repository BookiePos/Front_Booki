import type * as React from "react"
import type { FinanceOverview } from "@/lib/erp/api-finance"
import type { SalesReport } from "@/lib/erp/api-reports"
import type { CajaOverview } from "@/lib/erp/api-caja"
import type { BusinessType } from "@/lib/api"

/** Ancho de un widget en la grilla (1, 2 o 3 columnas en escritorio). */
export type WidgetSize = "compact" | "wide" | "full"

/** Un widget colocado en el tablero: su id y el ancho elegido por el usuario. */
export interface LayoutItem {
  id: string
  size: WidgetSize
}

/** Datos compartidos que alimentan a todos los widgets (se cargan una vez). */
export interface DashboardData {
  overview: FinanceOverview | null
  sales: SalesReport | null
  caja: CajaOverview | null
  poCount: number | null
  openTables: number | null
  lowStock: number | null
}

/** Props que recibe cada widget. */
export interface WidgetProps {
  data: DashboardData
  loading: boolean
}

/** Definición de un widget disponible para el tablero. */
export interface WidgetDef {
  id: string
  /** Nombre corto (se muestra en el selector "Agregar widget"). */
  title: string
  /** Descripción breve para el selector. */
  description: string
  defaultSize: WidgetSize
  /** Anchos permitidos (para el botón de redimensionar). */
  sizes: WidgetSize[]
  /** Permiso requerido para ofrecer el widget (si aplica). */
  permission?: string
  /** Restringe el widget a ciertos giros de negocio (si aplica). */
  businessTypes?: BusinessType[]
  Component: React.FC<WidgetProps>
}
