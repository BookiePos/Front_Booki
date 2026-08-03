import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Store,
  Wallet,
  Boxes,
  Package,
  UtensilsCrossed,
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
      { title: "Restaurante", href: "/panel/restaurante", icon: UtensilsCrossed },
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
      { title: "Presupuestos", href: "/panel/finanzas/presupuestos", icon: Target },
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

/** Sedes disponibles para el selector del topbar. */
export const sedes = [
  { id: "sede-centro", nombre: "Sede Centro" },
  { id: "sede-norte", nombre: "Sede Norte" },
  { id: "sede-sur", nombre: "Sede Sur" },
]
