"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { PLANS } from "@/lib/site"
import { formatNumber } from "@/lib/utils"
import type { BusinessPlan } from "@/lib/api"
import {
  BillingConfig,
  BillingStatus,
  cancelSubscription,
  getBillingConfig,
  getBillingStatus,
  purchaseDocs,
  subscribe,
  tokenizeCard,
} from "@/lib/erp/api-billing"
import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"

/** Precios mensuales de los complementos recurrentes (catálogo `plans.ts`). */
const ADDON_PRICE = {
  payroll: 34_900,
  extraSede: 89_900,
  extraEmployee: 2_900,
  docPackage: 29_900,
}

const PLAN_IDS: BusinessPlan[] = ["punto", "negocio", "control", "cadena"]
const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p]))

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: "Al día", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pago en proceso", className: "bg-amber-100 text-amber-800" },
  past_due: { label: "Pago vencido", className: "bg-red-100 text-red-800" },
  canceled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
}

export default function PlanBillingPage() {
  const { hasPermission, plan: currentPlan, entitlements } = useAuth()
  const authorized = hasPermission("params.manage")

  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedPlan, setSelectedPlan] = useState<BusinessPlan>("negocio")
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly")
  const [payroll, setPayroll] = useState(false)
  const [extraSedes, setExtraSedes] = useState(0)
  const [extraEmployees, setExtraEmployees] = useState(0)

  const [holder, setHolder] = useState("")
  const [number, setNumber] = useState("")
  const [expMonth, setExpMonth] = useState("")
  const [expYear, setExpYear] = useState("")
  const [cvc, setCvc] = useState("")

  const [docPacks, setDocPacks] = useState(1)

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<
    { kind: "ok" | "error" | "info"; text: string } | null
  >(null)

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getBillingStatus())
    } catch {
      /* silencioso: el estado es informativo */
    }
  }, [])

  useEffect(() => {
    if (!authorized) {
      setLoading(false)
      return
    }
    let active = true
    void (async () => {
      try {
        const [cfg, st] = await Promise.all([
          getBillingConfig(),
          getBillingStatus(),
        ])
        if (!active) return
        setConfig(cfg)
        setStatus(st)
        if (st.subscription) {
          setSelectedPlan(st.subscription.plan)
          setCycle(st.subscription.billingCycle)
          setPayroll(Boolean(st.subscription.addOns?.payroll))
          setExtraSedes(st.subscription.addOns?.extraSedes ?? 0)
          setExtraEmployees(st.subscription.addOns?.extraEmployees ?? 0)
        } else if (currentPlan) {
          setSelectedPlan(currentPlan)
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [authorized, currentPlan])

  const previewAmount = useMemo(() => {
    const p = PLAN_BY_ID[selectedPlan]
    if (!p) return 0
    const planPrice = cycle === "annual" ? (p.priceAnnual ?? p.price ?? 0) : p.price ?? 0
    const months = cycle === "annual" ? 12 : 1
    let addOnMonthly = 0
    if (payroll) addOnMonthly += ADDON_PRICE.payroll
    if (extraSedes > 0) addOnMonthly += extraSedes * ADDON_PRICE.extraSede
    if (extraEmployees > 0) addOnMonthly += extraEmployees * ADDON_PRICE.extraEmployee
    return planPrice + addOnMonthly * months
  }, [selectedPlan, cycle, payroll, extraSedes, extraEmployees])

  async function pollUntilActive(): Promise<boolean> {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const st = await getBillingStatus()
        setStatus(st)
        if (st.subscription?.status === "active") return true
      } catch {
        /* reintenta */
      }
    }
    return false
  }

  async function onSubscribe(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (!config?.configured) {
      setMessage({ kind: "error", text: "La pasarela de pagos no está configurada." })
      return
    }
    if (!holder.trim() || number.replace(/\s/g, "").length < 13 || !expMonth || !expYear || cvc.length < 3) {
      setMessage({ kind: "error", text: "Revisa los datos de la tarjeta." })
      return
    }
    setSubmitting(true)
    try {
      const cardToken = await tokenizeCard(config.publicKey, config.environment, {
        number: number.replace(/\s/g, ""),
        cvc,
        exp_month: expMonth.padStart(2, "0"),
        exp_year: expYear.slice(-2),
        card_holder: holder.trim(),
      })
      const result = await subscribe({
        plan: selectedPlan,
        billingCycle: cycle,
        cardToken,
        acceptanceToken: config.acceptanceToken,
        addOns: {
          payroll: payroll || undefined,
          extraSedes: extraSedes || undefined,
          extraEmployees: extraEmployees || undefined,
        },
      })
      if (result.status === "APPROVED") {
        await refreshStatus()
        setMessage({ kind: "ok", text: "¡Pago aprobado! Actualizando tu plan…" })
        setTimeout(() => window.location.reload(), 1200)
        return
      }
      setMessage({ kind: "info", text: "Pago en proceso, confirmando con la pasarela…" })
      const ok = await pollUntilActive()
      if (ok) {
        setMessage({ kind: "ok", text: "¡Listo! Tu plan quedó activo." })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setMessage({
          kind: "info",
          text: "El pago sigue en proceso. Cuando la pasarela lo confirme, tu plan se activará automáticamente.",
        })
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "No se pudo procesar el pago.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function onBuyDocs() {
    setMessage(null)
    setSubmitting(true)
    try {
      const result = await purchaseDocs(docPacks)
      if (result.status === "APPROVED") {
        await refreshStatus()
        setMessage({ kind: "ok", text: `Compraste ${docPacks * 1000} documentos.` })
      } else {
        setMessage({ kind: "info", text: "Compra en proceso, confirmando con la pasarela…" })
        await pollUntilActive()
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "No se pudo comprar el paquete.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function onCancel() {
    setMessage(null)
    setSubmitting(true)
    try {
      await cancelSubscription()
      await refreshStatus()
      setMessage({ kind: "info", text: "Suscripción cancelada. Sigue activa hasta el fin del período." })
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "No se pudo cancelar.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!authorized) {
    return (
      <>
        <PageHeader title="Plan y facturación" section="Configuración" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No tienes permiso para gestionar la facturación.
          </CardContent>
        </Card>
      </>
    )
  }

  const sub = status?.subscription
  const statusBadge = sub ? STATUS_LABEL[sub.status] : null

  return (
    <>
      <PageHeader
        title="Plan y facturación"
        section="Configuración"
        description="Gestiona tu suscripción, complementos y método de pago."
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando…
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {/* Estado actual */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <p className="text-2xl font-semibold capitalize text-foreground">
                  {currentPlan ?? "—"}
                </p>
                {entitlements && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entitlements.quotas.sedes} sede(s) ·{" "}
                    {entitlements.quotas.users === null
                      ? "usuarios ilimitados"
                      : `${entitlements.quotas.users} usuarios`}{" "}
                    · {formatNumber(entitlements.quotas.documentsPerMonth)} docs/mes
                    {entitlements.quotas.payrollEmployees > 0 &&
                      ` · nómina ${entitlements.quotas.payrollEmployees} empl.`}
                  </p>
                )}
              </div>
              {statusBadge && (
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}
                  >
                    {statusBadge.label}
                  </span>
                  {sub?.currentPeriodEnd && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sub.status === "canceled" ? "Vence" : "Renueva"}:{" "}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString("es-CO")}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {config && !config.configured && (
            <Card>
              <CardContent className="flex items-start gap-3 py-5 text-sm">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <p className="text-muted-foreground">
                  La pasarela de pagos (Wompi) aún no está configurada. Define las
                  llaves <code>WOMPI_*</code> en el backend para habilitar los pagos.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Selección de plan */}
          <Card>
            <CardContent className="py-6">
              <form onSubmit={onSubscribe} className="grid gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Elige tu plan</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {PLAN_IDS.map((id) => {
                      const p = PLAN_BY_ID[id]
                      const price = cycle === "annual" ? p?.priceAnnual ?? p?.price : p?.price
                      const active = selectedPlan === id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedPlan(id)}
                          aria-pressed={active}
                          className={`rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="font-semibold capitalize text-foreground">
                            {p?.name ?? id}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            ${formatNumber(price ?? 0)}
                            <span className="text-xs">
                              {cycle === "annual" ? "/año" : "/mes"}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Ciclo */}
                <div className="flex items-center gap-2">
                  {(["monthly", "annual"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCycle(c)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        cycle === c
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {c === "monthly" ? "Mensual" : "Anual"}
                    </button>
                  ))}
                </div>

                {/* Complementos */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Complementos</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                      <input
                        type="checkbox"
                        checked={payroll}
                        onChange={(e) => setPayroll(e.target.checked)}
                        className="size-4"
                      />
                      <span>
                        Nómina
                        <span className="block text-xs text-muted-foreground">
                          +${formatNumber(ADDON_PRICE.payroll)}/mes
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                      <span className="flex-1">
                        Sedes extra
                        <span className="block text-xs text-muted-foreground">
                          +${formatNumber(ADDON_PRICE.extraSede)}/mes c/u
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={extraSedes}
                        onChange={(e) => setExtraSedes(Math.max(0, Number(e.target.value)))}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                      <span className="flex-1">
                        Empleados extra
                        <span className="block text-xs text-muted-foreground">
                          +${formatNumber(ADDON_PRICE.extraEmployee)}/mes c/u
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={extraEmployees}
                        onChange={(e) => setExtraEmployees(Math.max(0, Number(e.target.value)))}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1"
                      />
                    </label>
                  </div>
                </div>

                {/* Tarjeta */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CreditCard className="size-4" /> Tarjeta
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      value={holder}
                      onChange={(e) => setHolder(e.target.value)}
                      placeholder="Nombre en la tarjeta"
                      autoComplete="cc-name"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                    />
                    <input
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="Número de tarjeta"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                    />
                    <div className="flex gap-2">
                      <input
                        value={expMonth}
                        onChange={(e) => setExpMonth(e.target.value)}
                        placeholder="MM"
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                      <input
                        value={expYear}
                        onChange={(e) => setExpYear(e.target.value)}
                        placeholder="AA"
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value)}
                      placeholder="CVC"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  {config?.environment === "sandbox" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sandbox: usa la tarjeta de prueba 4242 4242 4242 4242, cualquier
                      fecha futura y CVC 123.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Total a cobrar ahora</p>
                    <p className="text-2xl font-semibold text-foreground">
                      ${formatNumber(previewAmount)}
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        {cycle === "annual" ? "/año" : "/mes"} + IVA
                      </span>
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !config?.configured}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    {sub ? "Actualizar suscripción" : "Suscribirme y pagar"}
                  </button>
                </div>

                {message && (
                  <p
                    role="alert"
                    className={`rounded-xl px-4 py-3 text-sm ${
                      message.kind === "ok"
                        ? "bg-emerald-50 text-emerald-800"
                        : message.kind === "error"
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {message.kind === "ok" && (
                      <CheckCircle2 className="mr-1 inline size-4" />
                    )}
                    {message.text}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Paquetes de documentos + cancelar */}
          {sub && sub.status !== "canceled" && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Comprar documentos extra
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={docPacks}
                    onChange={(e) => setDocPacks(Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    ×1.000 docs · ${formatNumber(docPacks * ADDON_PRICE.docPackage)}
                  </span>
                  <button
                    type="button"
                    onClick={onBuyDocs}
                    disabled={submitting}
                    className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                  >
                    Comprar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  Cancelar suscripción
                </button>
              </CardContent>
            </Card>
          )}

          {/* Historial */}
          {status && status.payments.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <h3 className="text-sm font-semibold text-foreground">Pagos recientes</h3>
                <div className="mt-3 divide-y divide-border">
                  {status.payments.map((p) => (
                    <div
                      key={p.reference}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("es-CO")} ·{" "}
                        {p.kind === "docPackage"
                          ? "Documentos"
                          : p.kind === "renewal"
                            ? "Renovación"
                            : "Suscripción"}
                      </span>
                      <span className="flex items-center gap-3">
                        <span>${formatNumber(p.amountInCents / 100)}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            p.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
