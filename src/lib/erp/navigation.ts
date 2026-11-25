import type { BusinessType, PlanFeature } from "@/lib/api"
import type { LucideIcon } from "lucide-react"
import {
  House,
  MonitorSmartphone,
  UtensilsCrossed,
  Store,
  Wallet,
  Boxes,
  Factory,
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
  FileCheck2,
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
  /**
   * La página es de toda la empresa y el servidor la niega (403) a quien está
   * limitado a unas sedes: se oculta del menú a ese usuario.
   */
  requiresAllSedes?: boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

/** Ítem suelto arriba: el tablero. */
export const dashboardItem: NavItem = {
  title: "Inicio",
  href: "/panel",
  icon: House,
}

/**
 * Menú del panel, agrupado por lo que el dueño viene a hacer (rediseño
 * "Libro", 19-nov-2026). Antes eran 6 grupos técnicos con 31 destinos que no
 * cabían en pantalla, y Mesas no aparecía. Los grupos se pliegan y cada uno
 * se abre solo cuando contiene la página actual.
 *
 * Los permisos de cada ítem no cambian: son los mismos que exige la página.
 */
export const navSections: NavSection[] = [
  {
    label: "Vender",
    items: [
      { title: "Punto de venta", href: "/pos", icon: MonitorSmartphone, requiredPermissions: ["pos.sell"] },
      { title: "Mesas", href: "/panel/restaurante", icon: UtensilsCrossed, businessTypes: ["restaurante"], requiredPermissions: ["restaurant.operate"] },
      { title: "Caja", href: "/panel/caja", icon: Wallet, requiredPermissions: ["pos.sell"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Inventario", href: "/panel/inventario", icon: Boxes, requiredPermissions: ["inventory.view"] },
      { title: "Productos y precios", href: "/panel/productos", icon: Package, requiredPermissions: ["inventory.view"] },
      { title: "Producción", href: "/panel/produccion", icon: Factory, requiredPermissions: ["production.view", "production.manage"] },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Compras", href: "/panel/compras", icon: Truck, requiredPermissions: ["finance.view", "purchasing.manage"], requiredFeature: "purchasing" },
      { title: "Facturas por foto", href: "/panel/compras/facturas", icon: ScanLine, requiredPermissions: ["finance.view", "purchasing.manage"], requiredFeature: "purchasing" },
      { title: "Proveedores", href: "/panel/proveedores", icon: Building2, requiredPermissions: ["inventory.view"], requiredFeature: "purchasing" },
    ],
  },
  {
    label: "Clientes",
    items: [
      { title: "Clientes", href: "/panel/clientes/directorio", icon: Contact, requiredPermissions: ["customers.view"] },
      { title: "Fiado por cobrar", href: "/panel/clientes", icon: Users, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Saldos a favor", href: "/panel/finanzas/saldos-favor", icon: Wallet, requiredPermissions: ["finance.view"], requiresAllSedes: true },
    ],
  },
  {
    label: "Dinero",
    items: [
      { title: "Bancos y caja", href: "/panel/finanzas/bancos", icon: Landmark, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Conciliación", href: "/panel/finanzas/conciliacion", icon: Landmark, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Gastos", href: "/panel/finanzas/gastos", icon: FileMinus, requiredPermissions: ["finance.view"], requiredFeature: "expenses" },
      { title: "Por pagar", href: "/panel/finanzas/cxp", icon: Receipt, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Resultados", href: "/panel/finanzas/pl", icon: TrendingUp, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Reportes contables", href: "/panel/finanzas/reportes", icon: BarChart3, requiredPermissions: ["reports.view"] },
      { title: "Metas", href: "/panel/finanzas/metas", icon: Target, requiredPermissions: ["finance.view"], requiredFeature: "accounting" },
      { title: "Flujo de caja", href: "/panel/finanzas/flujo", icon: LineChart, requiredPermissions: ["finance.view"], requiredFeature: "expenses" },
    ],
  },
  {
    label: "Impuestos y DIAN",
    items: [
      { title: "Facturación electrónica", href: "/panel/facturacion", icon: FileText, requiredPermissions: ["einvoicing.issue"] },
      { title: "Impuestos", href: "/panel/impuestos", icon: Percent, requiredPermissions: ["tax.manage"], requiredFeature: "accounting" },
      { title: "Resoluciones", href: "/panel/resoluciones", icon: ScrollText, requiredPermissions: ["einvoicing.issue"] },
    ],
  },
  {
    label: "Equipo",
    items: [
      { title: "Personas", href: "/panel/empleados", icon: BadgeDollarSign, requiredPermissions: ["employees.view", "employees.manage"] },
      { title: "Turnos", href: "/panel/turnos", icon: CalendarClock, requiredPermissions: ["attendance.manage"] },
      { title: "Nómina", href: "/panel/nomina", icon: Wallet, requiredPermissions: ["payroll.manage"], requiredFeature: "payroll" },
      { title: "Nómina electrónica", href: "/panel/nomina/electronica", icon: FileCheck2, requiredPermissions: ["payroll.einvoice"], requiredFeature: "payroll" },
      { title: "Consumos y deducciones", href: "/panel/nomina/deducciones", icon: ReceiptText, requiredPermissions: ["payroll.view", "payroll.deduction.approve", "payroll.manage"], requiredFeature: "payroll" },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { title: "Sedes", href: "/panel/sedes", icon: Store, requiredPermissions: ["sede.manage"] },
      { title: "Usuarios y roles", href: "/panel/config/usuarios", icon: UserCog, requiredPermissions: ["users.manage"] },
      { title: "Parámetros", href: "/panel/config/parametros", icon: SlidersHorizontal, requiredPermissions: ["params.manage"] },
      { title: "Plan y facturación", href: "/panel/config/plan", icon: CreditCard, requiredPermissions: ["billing.manage"] },
      { title: "Auditoría", href: "/panel/auditoria", icon: ShieldCheck, requiredPermissions: ["audit.view"], requiredFeature: "audit" },
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
  /** ¿Ve todas las sedes? `undefined` = no se filtra (sesión cargando). */
  veTodasLasSedes?: boolean,
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
        const okSedes =
          !item.requiresAllSedes || veTodasLasSedes === undefined || veTodasLasSedes
        return okBusiness && okPermission && okFeature && okSedes
      }),
    }))
    .filter((section) => section.items.length > 0)
}
