import type { BusinessType, PlanFeature } from "@/lib/api"
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
  CreditCard,
  ScanLine,
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
  /**
   * Permiso(s) que la página exige para verse. Si se omite, el ítem no se
   * filtra por permiso (visible para cualquier usuario del panel). Basta con
   * tener uno de los permisos listados (OR). Deben coincidir con los strings
   * del catálogo de permisos y con el `hasPermission("...")` de cada página.
   */
  requiredPermissions?: string[]
  /**
   * Capacidad de plan que la página exige. Si se omite, es una función base
   * visible en todos los planes. Se filtra con `hasFeature` en `getNavSections`.
   */
  requiredFeature?: PlanFeature
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
      { title: "Sedes", href: "/panel/sedes", icon: Store, requiredPermissions: ["sede.manage"] },
      { title: "Caja", href: "/panel/caja", icon: Wallet, requiredPermissions: ["pos.sell"] },
      { title: "Inventario", href: "/panel/inventario", icon: Boxes, requiredPermissions: ["inventory.view"] },
      { title: "Productos", href: "/panel/productos", icon: Package, requiredPermissions: ["inventory.view"] },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Compras", href: "/panel/compras", icon: Truck, requiredPermissions: ["finance.view", "purchasing.manage"], requiredFeature: "purchasing" },
      { title: "Facturas por foto", href: "/panel/compras/facturas", icon: ScanLine, requiredPermissions: ["finance.view", "purchasing.manage"], requiredFeature: "purchasing" },
      { title: "Proveedores", href: "/panel/proveedores", icon: Building2, requiredPermissions: ["inventory.view"], requiredFeature: "purchasing" },
      { title: "Directorio clientes", href: "/panel/clientes/directorio", icon: Contact, requiredPermissions: ["customers.view"] },
      { title: "Clientes (CxC)", href: "/panel/clientes", icon: Users, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Caja y bancos", href: "/panel/finanzas/bancos", icon: Landmark, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Gastos", href: "/panel/finanzas/gastos", icon: FileMinus, requiredPermissions: ["finance.view"], requiredFeature: "expenses" },
      { title: "Cuentas por pagar", href: "/panel/finanzas/cxp", icon: Receipt, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "P&L", href: "/panel/finanzas/pl", icon: TrendingUp, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Reportes", href: "/panel/finanzas/reportes", icon: BarChart3, requiredPermissions: ["reports.view"] },
      { title: "Metas", href: "/panel/finanzas/metas", icon: Target, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Flujo de caja", href: "/panel/finanzas/flujo", icon: LineChart, requiredPermissions: ["finance.view"], requiredFeature: "expenses" },
    ],
  },
  {
    label: "Personal",
    items: [
      { title: "Empleados", href: "/panel/empleados", icon: BadgeDollarSign, requiredPermissions: ["employees.view", "employees.manage"] },
      { title: "Nómina", href: "/panel/nomina", icon: Wallet, requiredPermissions: ["payroll.manage"], requiredFeature: "payroll" },
      { title: "Consumos / deducciones", href: "/panel/nomina/deducciones", icon: ReceiptText, requiredPermissions: ["payroll.view", "payroll.deduction.approve", "payroll.manage"], requiredFeature: "payroll" },
      { title: "Turnos", href: "/panel/turnos", icon: CalendarClock, requiredPermissions: ["attendance.manage"] },
    ],
  },
  {
    label: "Cumplimiento",
    items: [
      { title: "Impuestos", href: "/panel/impuestos", icon: Percent, requiredPermissions: ["tax.manage"], requiredFeature: "accounting" },
      { title: "Facturación electrónica", href: "/panel/facturacion", icon: FileText, requiredPermissions: ["einvoicing.issue"] },
      { title: "Resoluciones", href: "/panel/resoluciones", icon: ScrollText, requiredPermissions: ["einvoicing.issue"] },
      { title: "Auditoría", href: "/panel/auditoria", icon: ShieldCheck, requiredPermissions: ["audit.view"], requiredFeature: "audit" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Usuarios y roles", href: "/panel/config/usuarios", icon: UserCog, requiredPermissions: ["users.manage"] },
      { title: "Parámetros", href: "/panel/config/parametros", icon: SlidersHorizontal, requiredPermissions: ["params.manage"] },
      { title: "Plan y facturación", href: "/panel/config/plan", icon: CreditCard, requiredPermissions: ["params.manage"] },
    ],
  },
]

/**
 * Navegación adaptada al giro del negocio y a los permisos del usuario.
 *
 * - Giro: oculta los ítems marcados con `businessTypes` que no incluyan al tipo
 *   activo. Si `tipoNegocio` es `undefined` (sesión cargando o token viejo sin
 *   el claim) no filtra por giro, para no dejar al usuario sin accesos por un
 *   dato que aún no llegó.
 * - Permiso: oculta los ítems cuyo `requiredPermissions` el usuario no cumple.
 *   Basta con tener uno de los permisos listados (OR). Si no se pasa
 *   `hasPermission`, no se filtra por permiso (compatibilidad hacia atrás). El
 *   Dueño tiene todos los permisos, así que ve todo.
 * - Plan: oculta los ítems cuyo `requiredFeature` el plan no incluye. Si no se
 *   pasa `hasFeature`, no se filtra por plan (compatibilidad hacia atrás).
 *   `hasFeature` es fail-open mientras la sesión carga.
 *
 * Se descartan las secciones que queden sin ítems visibles.
 */
export function getNavSections(
  tipoNegocio?: BusinessType,
  hasPermission?: (permission: string) => boolean,
  hasFeature?: (feature: PlanFeature) => boolean,
): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const okBusiness =
          !tipoNegocio ||
          !item.businessTypes ||
          item.businessTypes.includes(tipoNegocio)
        const okPermission =
          !hasPermission ||
          !item.requiredPermissions ||
          item.requiredPermissions.length === 0 ||
          item.requiredPermissions.some((p) => hasPermission(p))
        const okFeature =
          !hasFeature ||
          !item.requiredFeature ||
          hasFeature(item.requiredFeature)
        return okBusiness && okPermission && okFeature
      }),
    }))
    .filter((section) => section.items.length > 0)
}
