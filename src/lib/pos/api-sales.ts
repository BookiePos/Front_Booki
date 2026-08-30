/**
 * Cliente HTTP del POS (ventas por sede).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { SedeRef } from "@/lib/pos/api-inventory"

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "card" | "transfer" | "credit"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Fiado",
}

export type DiscountType = "amount" | "percent"

export interface SaleDiscount {
  type: DiscountType
  value: number
  amount: number
}

/** Producto vendible con el stock disponible en la sede consultada. */
export interface PosProduct {
  _id: string
  sku: string
  name: string
  unit: string
  salePrice: number
  stock: number
  /** Foto del producto (Vercel Blob). null si no tiene. */
  imageUrl?: string | null
  /** Código de barras del ítem de inventario vinculado (para escanear). */
  barcode?: string | null
  categoryId: string | null
  categoryName: string | null
}

export interface SaleLine {
  productId: string
  sku: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  lineTotal: number
  /** Descuento aplicado a la línea (0 si ninguno). Neto = lineTotal − esto. */
  discountAmount?: number
  /** Nombre del descuento aplicado (para el recibo). */
  discountName?: string
}

/** Descuento predefinido de la sede (se aplica por línea en el POS). */
export interface Discount {
  _id: string
  sedeId: string
  name: string
  type: DiscountType
  value: number
  active: boolean
}

/** Datos del cliente para la factura (todos opcionales). */
export interface Customer {
  name?: string
  idNumber?: string
  phone?: string
  email?: string
}

export interface Sale {
  _id: string
  saleNumber: string
  sedeId: SedeRef
  cashierEmail: string
  cashierName?: string
  status: "completed" | "void"
  lines: SaleLine[]
  subtotal: number
  discount?: SaleDiscount
  discountTotal: number
  taxTotal: number
  total: number
  /** Propina (restaurante): se cobró encima del total. */
  tip?: number
  payment: { method: PaymentMethod; received?: number; change?: number }
  customer?: Customer
  orderId?: string
  createdAt: string
}

export interface SalesPage {
  total: number
  page: number
  limit: number
  rows: Sale[]
}

/** Pago de una venta. `dueDate` (YYYY-MM-DD) solo aplica al fiado (crédito). */
export interface SalePaymentInput {
  method: PaymentMethod
  received?: number
  dueDate?: string
  /**
   * Deudor del fiado (obligatorio en crédito): cliente registrado (→ CxC) o
   * empleado (→ deducción de nómina, pendiente de aprobación).
   */
  debtorType?: "customer" | "employee"
  customerId?: string
  employeeId?: string
}

export interface CreateSalePayload {
  sedeId: string
  lines: { productId: string; qty: number; discountId?: string }[]
  payment: SalePaymentInput
  discount?: { type: DiscountType; value: number }
  customer?: Customer
  /** Propina voluntaria (restaurante), en pesos. */
  tip?: number
}

// ─── Cuentas abiertas (comandas / mesas) ─────────────────────────────────────

export type OrderStatus = "open" | "closed" | "void"

export interface OrderLine {
  productId: string
  sku: string
  name: string
  unit: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface Order {
  _id: string
  orderNumber: string
  sedeId: SedeRef
  status: OrderStatus
  label?: string
  note?: string
  lines: OrderLine[]
  openedByEmail: string
  saleId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateOrderPayload {
  sedeId: string
  label?: string
  note?: string
  lines?: { productId: string; qty: number }[]
}

export interface UpdateOrderPayload {
  label?: string
  note?: string
  lines?: { productId: string; qty: number }[]
}

export interface CheckoutOrderPayload {
  payment: SalePaymentInput
  discount?: { type: DiscountType; value: number }
  customer?: Customer
  /** Propina voluntaria (restaurante), en pesos. */
  tip?: number
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function posProducts(sedeId: string): Promise<PosProduct[]> {
  const res = await authFetch(
    `/sales/pos-products?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<PosProduct[]>(res)
}

/** Descuentos predefinidos de la sede (para aplicar por línea). */
export async function listDiscounts(sedeId: string): Promise<Discount[]> {
  const res = await authFetch(
    `/discounts?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<Discount[]>(res)
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const res = await authFetch("/sales", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sale>(res)
}

export async function listSales(
  sedeId: string,
  page = 1,
  limit = 20,
): Promise<SalesPage> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&page=${page}&limit=${limit}`
  const res = await authFetch(`/sales?${qs}`)
  return parseResponse<SalesPage>(res)
}

/** Anula una venta y devuelve su consumo al inventario. */
export async function voidSale(id: string): Promise<Sale> {
  const res = await authFetch(`/sales/${id}/void`, { method: "POST" })
  return parseResponse<Sale>(res)
}

// ─── Cuentas abiertas ────────────────────────────────────────────────────────

/** Cuentas de una sede por estado (abiertas por defecto). */
export async function listOrders(
  sedeId: string,
  status: OrderStatus = "open",
): Promise<Order[]> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&status=${status}`
  const res = await authFetch(`/orders?${qs}`)
  return parseResponse<Order[]>(res)
}

export async function getOrder(id: string): Promise<Order> {
  const res = await authFetch(`/orders/${id}`)
  return parseResponse<Order>(res)
}

/** Abre una cuenta (opcionalmente con ítems iniciales). */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await authFetch("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Order>(res)
}

/** Actualiza etiqueta / nota / líneas de una cuenta abierta. */
export async function updateOrder(
  id: string,
  payload: UpdateOrderPayload,
): Promise<Order> {
  const res = await authFetch(`/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Order>(res)
}

/** Liquida la cuenta: crea la venta y descuenta inventario. */
export async function checkoutOrder(
  id: string,
  payload: CheckoutOrderPayload,
): Promise<Sale> {
  const res = await authFetch(`/orders/${id}/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Sale>(res)
}

/** Cierra la cuenta sin cobrar (no toca inventario). */
export async function voidOrder(id: string): Promise<Order> {
  const res = await authFetch(`/orders/${id}/void`, { method: "POST" })
  return parseResponse<Order>(res)
}
