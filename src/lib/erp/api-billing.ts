/** Cliente HTTP de facturación/suscripciones (Wompi). Base `/billing`. */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { BusinessPlan } from "@/lib/api"

export interface BillingConfig {
  publicKey: string
  environment: string
  acceptanceToken: string
  permalink: string
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
  payments: PaymentView[]
  documents: DocumentUsage
}

export interface ChargeResult {
  reference: string
  transactionId: string
  status: string
}

export interface SubscribePayload {
  plan: BusinessPlan
  billingCycle?: "monthly" | "annual"
  cardToken: string
  acceptanceToken: string
  customerEmail?: string
  addOns?: {
    payroll?: boolean
    extraSedes?: number
    extraEmployees?: number
  }
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

/**
 * Tokeniza una tarjeta directamente contra Wompi con la llave PÚBLICA (el PAN
 * nunca pasa por nuestro backend). Devuelve el `tok_...` para enviar a
 * `/billing/subscribe`. En sandbox usa la tarjeta de prueba 4242 4242 4242 4242.
 */
export async function tokenizeCard(
  publicKey: string,
  environment: string,
  card: {
    number: string
    cvc: string
    exp_month: string
    exp_year: string
    card_holder: string
  },
): Promise<string> {
  const base =
    environment === "production"
      ? "https://production.wompi.co/v1"
      : "https://sandbox.wompi.co/v1"
  const res = await fetch(`${base}/tokens/cards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${publicKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(card),
  })
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string }
    error?: { messages?: Record<string, string[]> }
  } | null
  if (!res.ok || !json?.data?.id) {
    const messages = json?.error?.messages
    const detail = messages
      ? Object.values(messages).flat().join(", ")
      : `Error ${res.status}`
    throw new Error(`No se pudo validar la tarjeta: ${detail}`)
  }
  return json.data.id
}
