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
  acceptPersonalAuth?: string
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
