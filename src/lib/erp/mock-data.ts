import type { LucideIcon } from "lucide-react"
import {
  DollarSign,
  ReceiptText,
  ShoppingBag,
  Percent,
} from "lucide-react"

export type Kpi = {
  label: string
  value: string
  delta: number // variación % vs ayer
  icon: LucideIcon
  tone: "primary" | "info" | "warning" | "neutral"
}

export const kpis: Kpi[] = [
  {
    label: "Ventas de hoy",
    value: "$ 4.820.500",
    delta: 12.4,
    icon: DollarSign,
    tone: "primary",
  },
  {
    label: "Tiquetes",
    value: "184",
    delta: 6.1,
    icon: ReceiptText,
    tone: "info",
  },
  {
    label: "Ticket promedio",
    value: "$ 26.198",
    delta: -3.2,
    icon: ShoppingBag,
    tone: "warning",
  },
  {
    label: "Margen",
    value: "38,6 %",
    delta: 1.8,
    icon: Percent,
    tone: "neutral",
  },
]

export type OnboardingTask = {
  id: string
  title: string
  description: string
  done: boolean
  cta: string
}

export const onboardingTasks: OnboardingTask[] = [
  {
    id: "sede",
    title: "Crear tu primera sede",
    description: "Registra la ubicación, NIT y datos fiscales del negocio.",
    done: true,
    cta: "Ver sede",
  },
  {
    id: "productos",
    title: "Cargar productos",
    description: "Importa tu catálogo o crea productos manualmente.",
    done: true,
    cta: "Ir a inventario",
  },
  {
    id: "impuestos",
    title: "Configurar impuestos",
    description: "Define IVA, INC y retenciones según la DIAN.",
    done: false,
    cta: "Configurar",
  },
  {
    id: "caja",
    title: "Abrir caja",
    description: "Registra el fondo inicial para empezar a vender.",
    done: false,
    cta: "Abrir caja",
  },
  {
    id: "usuarios",
    title: "Invitar usuarios",
    description: "Suma a tu equipo y asigna roles y permisos.",
    done: false,
    cta: "Invitar",
  },
]

export type Movimiento = {
  id: string
  hora: string
  tipo: "Venta" | "Compra" | "Gasto" | "Devolución"
  referencia: string
  sede: string
  monto: string
  estado: "Aprobado" | "Pendiente" | "Anulado"
}

export const movimientos: Movimiento[] = [
  {
    id: "FV-001824",
    hora: "14:32",
    tipo: "Venta",
    referencia: "POS · Caja 1",
    sede: "Sede Centro",
    monto: "$ 52.900",
    estado: "Aprobado",
  },
  {
    id: "OC-000391",
    hora: "13:58",
    tipo: "Compra",
    referencia: "Distribuidora El Trigo",
    sede: "Sede Centro",
    monto: "$ 1.240.000",
    estado: "Pendiente",
  },
  {
    id: "GA-000112",
    hora: "12:15",
    tipo: "Gasto",
    referencia: "Servicios públicos",
    sede: "Sede Norte",
    monto: "$ 318.500",
    estado: "Aprobado",
  },
  {
    id: "FV-001823",
    hora: "11:47",
    tipo: "Venta",
    referencia: "POS · Caja 2",
    sede: "Sede Norte",
    monto: "$ 18.400",
    estado: "Aprobado",
  },
  {
    id: "DV-000045",
    hora: "10:22",
    tipo: "Devolución",
    referencia: "FV-001790",
    sede: "Sede Centro",
    monto: "-$ 24.000",
    estado: "Anulado",
  },
  {
    id: "FV-001822",
    hora: "09:50",
    tipo: "Venta",
    referencia: "POS · Caja 1",
    sede: "Sede Sur",
    monto: "$ 41.600",
    estado: "Aprobado",
  },
]
