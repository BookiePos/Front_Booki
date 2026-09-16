/** Cliente HTTP de facturación/suscripciones (Wompi). Base `/billing`. */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { BusinessPlan } from "@/lib/api"

export interface BillingConfig {
  publicKey: string
  environment: string
  acceptanceToken: string
  permalink: string
  /** Autorización de tratamiento de datos personales (Wompi la exige aparte). */
  personalDataAuthToken?: string
  personalDataPermalink?: string
  configured: boolean
}

export interface SubscriptionView {
  businessId: string
  plan: BusinessPlan
  billingCycle: "monthly" | "annual"
  addOns?: {
    payroll?: boolean
    extraSedes?: number
    extraEmployees?: number
    docPackages?: number
  }
  amountInCents: number
  status: "pending" | "active" | "past_due" | "canceled"
  currentPeriodEnd?: string
  nextChargeAt?: string
  failedAttempts?: number
}

/** Tarjeta registrada de la empresa, tal como la guarda el backend. */
export interface PaymentMethodView {
  paymentSourceId: number
  customerEmail: string
  /** Marca (VISA, MASTERCARD…) y últimos cuatro dígitos: datos públicos de Wompi. */
  brand?: string | null
  lastFour?: string | null
}

export interface PaymentView {
  reference: string
  kind: "subscription" | "renewal" | "docPackage"
  amountInCents: number
  status: "pending" | "approved" | "declined" | "voided" | "error"
  createdAt: string
  docPackages?: number
}

export interface DocumentUsage {
  used: number
  base: number
  credits: number
  period: string
}

export interface BillingStatus {
  subscription: SubscriptionView | null
  /** Tarjeta guardada; `null`/ausente si la empresa nunca registró una. */
  paymentMethod?: PaymentMethodView | null
  payments: PaymentView[]
  documents: DocumentUsage
}

/** Estado real de un cobro, consultado a la pasarela si seguía pendiente. */
export interface PaymentSyncResult {
  reference: string
  status: PaymentView["status"]
  applied: boolean
}

export interface ChargeResult {
  reference: string
  transactionId: string
  status: string
}

export interface SubscribePayload {
  plan: BusinessPlan
  billingCycle?: "monthly" | "annual"
  /**
   * Tarjeta nueva del widget. Se omite cuando ya hay una registrada: el token
   * de Wompi es de un solo uso, así que la tarjeta guardada es la que sirve
   * para cambiar de plan sin volver a escribirla.
   */
  cardToken?: string
  acceptanceToken?: string
  acceptPersonalAuth?: string
  customerEmail?: string
  addOns?: {
    payroll?: boolean
    extraSedes?: number
    extraEmployees?: number
  }
}

/** Registro de la tarjeta sin cobrar nada. */
export interface SavePaymentMethodPayload {
  cardToken: string
  acceptanceToken: string
  acceptPersonalAuth?: string
  customerEmail?: string
}

export async function getBillingConfig(): Promise<BillingConfig> {
  return parseResponse<BillingConfig>(await authFetch("/billing/config"))
}

export async function getBillingStatus(): Promise<BillingStatus> {
  return parseResponse<BillingStatus>(await authFetch("/billing/status"))
}

export async function subscribe(payload: SubscribePayload): Promise<ChargeResult> {
  return parseResponse<ChargeResult>(
    await authFetch("/billing/subscribe", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  )
}

/**
 * Guarda la tarjeta en el backend (la cambia por una fuente de pago de Wompi).
 * Sin esto la tarjeta solo vivía en memoria de la pestaña y desaparecía al
 * recargar la página.
 */
export async function savePaymentMethod(
  payload: SavePaymentMethodPayload,
): Promise<PaymentMethodView> {
  return parseResponse<PaymentMethodView>(
    await authFetch("/billing/payment-method", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  )
}

/**
 * Pregunta por el estado real de un cobro. El backend consulta a Wompi si
 * sigue pendiente, en vez de esperar al webhook: es lo que permite cerrar el
 * pago en segundos en vez de quedarse en "pago en proceso".
 */
export async function syncPayment(reference: string): Promise<PaymentSyncResult> {
  return parseResponse<PaymentSyncResult>(
    await authFetch(`/billing/payments/${encodeURIComponent(reference)}`),
  )
}

export async function purchaseDocs(packages: number): Promise<ChargeResult> {
  return parseResponse<ChargeResult>(
    await authFetch("/billing/purchase-docs", {
      method: "POST",
      body: JSON.stringify({ packages }),
    }),
  )
}

export async function cancelSubscription(): Promise<SubscriptionView> {
  return parseResponse<SubscriptionView>(
    await authFetch("/billing/cancel", { method: "POST" }),
  )
}
