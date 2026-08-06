import type { BusinessType } from "@/lib/api"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Store,
  Wallet,
  Boxes,
  Package,
  Truck,
  Building2,
  Users,
  Contact,
  Landmark,
  Receipt,
  FileMinus,
  TrendingUp,
  BarChart3,
  Target,
  LineChart,
  BadgeDollarSign,
  UserCog,
  CalendarClock,
  ReceiptText,
  Percent,
  FileText,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /**
   * Giros de negocio en los que aparece el ítem. Si se omite, se muestra en
   * todos. P. ej. "Restaurante" solo aplica a `restaurante`.
   */
  businessTypes?: BusinessType[]
}

export type NavSection = {
  label: string
  items: NavItem[]
}

/** Ítem suelto arriba (Panel / Dashboard). */
export const dashboardItem: NavItem = {
  title: "Panel",
  href: "/panel",
  icon: LayoutDashboard,
}

/** Navegación agrupada del Sistema POS. */
export const navSections: NavSection[] = [
  {
    label: "Operación",
    items: [
      { title: "Sedes", href: "/panel/sedes", icon: Store },
      { title: "Caja", href: "/panel/caja", icon: Wallet },
      { title: "Inventario", href: "/panel/inventario", icon: Boxes },
      { title: "Productos", href: "/panel/productos", icon: Package },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Compras", href: "/panel/compras", icon: Truck },
      { title: "Proveedores", href: "/panel/proveedores", icon: Building2 },
      { title: "Directorio clientes", href: "/panel/clientes/directorio", icon: Contact },
      { title: "Clientes (CxC)", href: "/panel/clientes", icon: Users },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Caja y bancos", href: "/panel/finanzas/bancos", icon: Landmark },
      { title: "Gastos", href: "/panel/finanzas/gastos", icon: FileMinus },
      { title: "Cuentas por pagar", href: "/panel/finanzas/cxp", icon: Receipt },
      { title: "P&L", href: "/panel/finanzas/pl", icon: TrendingUp },
      { title: "Reportes", href: "/panel/finanzas/reportes", icon: BarChart3 },
      { title: "Metas", href: "/panel/finanzas/metas", icon: Target },
      { title: "Flujo de caja", href: "/panel/finanzas/flujo", icon: LineChart },
    ],
  },
  {
    label: "Personal",
    items: [
      { title: "Empleados", href: "/panel/empleados", icon: BadgeDollarSign },
      { title: "Nómina", href: "/panel/nomina", icon: Wallet },
      { title: "Consumos / deducciones", href: "/panel/nomina/deducciones", icon: ReceiptText },
      { title: "Turnos", href: "/panel/turnos", icon: CalendarClock },
    ],
  },
  {
    label: "Cumplimiento",
    items: [
      { title: "Impuestos", href: "/panel/impuestos", icon: Percent },
      { title: "Facturación electrónica", href: "/panel/facturacion", icon: FileText },
      { title: "Resoluciones", href: "/panel/resoluciones", icon: ScrollText },
      { title: "Auditoría", href: "/panel/auditoria", icon: ShieldCheck },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Usuarios y roles", href: "/panel/config/usuarios", icon: UserCog },
      { title: "Parámetros", href: "/panel/config/parametros", icon: SlidersHorizontal },
    ],
  },
]

/**
 * Navegación adaptada al giro del negocio: oculta los ítems marcados con
 * `businessTypes` que no incluyan al tipo activo. Si `tipoNegocio` es
 * `undefined` (sesión cargando o token viejo sin el claim) no oculta nada, para
 * no dejar al usuario sin accesos por un dato que aún no llegó. Se descartan las
 * secciones que queden vacías.
 */
export function getNavSections(tipoNegocio?: BusinessType): NavSection[] {
  if (!tipoNegocio) return navSections
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.businessTypes || item.businessTypes.includes(tipoNegocio),
      ),
    }))
    .filter((section) => section.items.length > 0)
}
