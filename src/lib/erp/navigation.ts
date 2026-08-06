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
  /**
   * Permiso(s) que la página exige para verse. Si se omite, el ítem no se
   * filtra por permiso (visible para cualquier usuario del panel). Basta con
   * tener uno de los permisos listados (OR). Deben coincidir con los strings
   * del catálogo de permisos y con el `hasPermission("...")` de cada página.
   */
  requiredPermissions?: string[]
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
      { title: "Compras", href: "/panel/compras", icon: Truck, requiredPermissions: ["finance.view", "purchasing.manage"] },
      { title: "Proveedores", href: "/panel/proveedores", icon: Building2, requiredPermissions: ["inventory.view"] },
      { title: "Directorio clientes", href: "/panel/clientes/directorio", icon: Contact, requiredPermissions: ["customers.view"] },
      { title: "Clientes (CxC)", href: "/panel/clientes", icon: Users, requiredPermissions: ["finance.view"] },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Caja y bancos", href: "/panel/finanzas/bancos", icon: Landmark, requiredPermissions: ["finance.view"] },
      { title: "Gastos", href: "/panel/finanzas/gastos", icon: FileMinus, requiredPermissions: ["finance.view"] },
      { title: "Cuentas por pagar", href: "/panel/finanzas/cxp", icon: Receipt, requiredPermissions: ["finance.view"] },
      { title: "P&L", href: "/panel/finanzas/pl", icon: TrendingUp, requiredPermissions: ["finance.view"] },
      { title: "Reportes", href: "/panel/finanzas/reportes", icon: BarChart3, requiredPermissions: ["reports.view"] },
      { title: "Metas", href: "/panel/finanzas/metas", icon: Target, requiredPermissions: ["finance.view"] },
      { title: "Flujo de caja", href: "/panel/finanzas/flujo", icon: LineChart, requiredPermissions: ["finance.view"] },
    ],
  },
  {
    label: "Personal",
    items: [
      { title: "Empleados", href: "/panel/empleados", icon: BadgeDollarSign, requiredPermissions: ["employees.view", "employees.manage"] },
      { title: "Nómina", href: "/panel/nomina", icon: Wallet, requiredPermissions: ["payroll.manage"] },
      { title: "Consumos / deducciones", href: "/panel/nomina/deducciones", icon: ReceiptText, requiredPermissions: ["payroll.view", "payroll.deduction.approve", "payroll.manage"] },
      { title: "Turnos", href: "/panel/turnos", icon: CalendarClock, requiredPermissions: ["attendance.manage"] },
    ],
  },
  {
    label: "Cumplimiento",
    items: [
      { title: "Impuestos", href: "/panel/impuestos", icon: Percent, requiredPermissions: ["tax.manage"] },
      { title: "Facturación electrónica", href: "/panel/facturacion", icon: FileText, requiredPermissions: ["einvoicing.issue"] },
      { title: "Resoluciones", href: "/panel/resoluciones", icon: ScrollText, requiredPermissions: ["einvoicing.issue"] },
      { title: "Auditoría", href: "/panel/auditoria", icon: ShieldCheck, requiredPermissions: ["audit.view"] },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Usuarios y roles", href: "/panel/config/usuarios", icon: UserCog, requiredPermissions: ["users.manage"] },
      { title: "Parámetros", href: "/panel/config/parametros", icon: SlidersHorizontal, requiredPermissions: ["params.manage"] },
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
 *
 * Se descartan las secciones que queden sin ítems visibles.
 */
export function getNavSections(
  tipoNegocio?: BusinessType,
  hasPermission?: (permission: string) => boolean,
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
        return okBusiness && okPermission
      }),
    }))
    .filter((section) => section.items.length > 0)
}
