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
  // ── Variantes (talla / color) ──────────────────────────────────────────────
  // Cada talla es su propio vendible con su stock; estos campos son lo que
  // permite al POS juntarlas en una sola tarjeta con selector en vez de pintar
  // quince tarjetas casi idénticas de la misma camisa.

  /** Id del producto padre que agrupa las variantes. `null` si no es una. */
  variantGroupId?: string | null
  /** Nombre del padre ("Camisa manga larga"), sin el sufijo de la variante. */
  variantGroupName?: string | null
  /** Valores de los ejes: `{ Talla: "M", Color: "Rojo" }`. */
  variantAttrs?: Record<string, string> | null
  /**
   * Ejes del producto padre con sus valores EN ORDEN (XS, S, M, L…). Es el
   * orden en que se dieron de alta, y el único que tiene sentido para una
   * talla: alfabéticamente saldría "L, M, S, XL".
   */
  variantAxes?: { name: string; values: string[] }[] | null

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
  /**
   * Base gravable de la línea, ya neta del descuento de línea y de la parte
   * que le tocó del descuento de toda la venta.
   */
  taxBase?: number
  /** IVA de la línea, incluido en lo que pagó el cliente. */
  taxAmount?: number
}

/**
 * Lo que el cliente PAGÓ por una línea: la base más su IVA.
 *
 * Es de aquí —y no de `unitPrice × qty`— de donde sale lo que se le devuelve.
 * El precio de lista no tiene descontado nada, así que devolverlo regalaría el
 * descuento por segunda vez.
 *
 * Las ventas viejas pueden no traer los dos campos; en ese caso se cae al neto
 * de la línea, que es lo más cercano que hay.
 */
export function paidForLine(line: SaleLine): number {
  if (line.taxBase !== undefined && line.taxAmount !== undefined) {
    return line.taxBase + line.taxAmount
  }
  return line.lineTotal - (line.discountAmount ?? 0)
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
  /**
   * Cliente REGISTRADO al que se le vende, pague como pague.
   *
   * `payment.customerId` solo existe para el fiado, donde identifica al deudor.
   * La tienda que compra por cajas paga de contado casi siempre, y su lista de
   * precios tiene que aplicarse igual: para eso está este campo.
   */
  customerId?: string
  /**
   * Lista de precios elegida A MANO en el terminal, para el cliente de paso que
   * se lleva una caja y no está registrado. Requiere `pos.discount.authorize`:
   * elegirla es decidir cobrar menos. La lista que el cliente registrado ya
   * tiene asignada se aplica sola y no pide permiso.
   */
  priceListId?: string
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
// ─── Devoluciones parciales ───────────────────────────────────────────────────

export type ReturnReason =
  | "defectuoso"
  | "equivocado"
  | "sobrante"
  | "garantia"
  | "otro"

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  defectuoso: "Vino malo o dañado",
  equivocado: "No era lo que pidió",
  sobrante: "Compró de más",
  garantia: "Garantía",
  otro: "Otro",
}

/** Qué se hace con lo devuelto. */
export type RestockMode = "inventory" | "waste"

/** Cómo se le devuelve la plata. */
export type RefundMethod = "cash" | "transfer" | "credit_note" | "none"

export const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  cash: "Efectivo de la caja",
  transfer: "Transferencia",
  credit_note: "Le queda a favor",
  none: "Cambio por otro producto",
}

export interface SaleReturn {
  _id: string
  saleId: string
  saleNumber: string
  lines: {
    productId: string
    sku: string
    name: string
    qty: number
    refund: number
    refundTax: number
  }[]
  reason: ReturnReason
  restock: RestockMode
  /** Si la merma alcanzó a registrarse (solo importa cuando restock = waste). */
  wasteRecorded: boolean
  refundMethod: RefundMethod
  refundTotal: number
  refundTax: number
  note?: string
  userEmail: string
  createdAt: string
}

export interface CreateSaleReturnPayload {
  lines: { productId: string; qty: number }[]
  reason: ReturnReason
  restock: RestockMode
  refundMethod: RefundMethod
  note?: string
}

/** Devoluciones ya registradas de una venta (para no devolver dos veces). */
export async function listSaleReturns(saleId: string): Promise<SaleReturn[]> {
  const res = await authFetch(`/sales/${saleId}/returns`)
  return parseResponse<SaleReturn[]>(res)
}

export async function createSaleReturn(
  saleId: string,
  payload: CreateSaleReturnPayload,
): Promise<SaleReturn> {
  const res = await authFetch(`/sales/${saleId}/returns`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<SaleReturn>(res)
}

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
