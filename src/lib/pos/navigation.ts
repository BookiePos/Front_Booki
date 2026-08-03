import type { LucideIcon } from "lucide-react"
import {
  ShoppingCart,
  Receipt,
  Boxes,
  Wallet,
  Calculator,
  FileText,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Permiso requerido; si falta, el ítem se muestra deshabilitado. */
  permission?: string
  /** true → sección aún sin backend ("En construcción"). */
  wip?: boolean
}

/** Navegación del punto de venta (lo que maneja el trabajador). */
export const navItems: NavItem[] = [
  { title: "Venta", href: "/pos", icon: ShoppingCart, permission: "pos.sell" },
  { title: "Ventas", href: "/pos/ventas", icon: Receipt, permission: "pos.sell" },
  { title: "Caja", href: "/pos/caja", icon: Calculator, permission: "pos.sell" },
  {
    title: "Inventario",
    href: "/pos/inventario",
    icon: Boxes,
    permission: "inventory.view",
  },
  { title: "Nómina", href: "/pos/nomina", icon: Wallet, permission: "pos.sell" },
  {
    title: "Factura electrónica",
    href: "/pos/facturacion",
    icon: FileText,
    permission: "einvoicing.issue",
  },
]
