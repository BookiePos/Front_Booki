"use client"

import * as React from "react"
import Link from "next/link"
import {
  Store,
  Boxes,
  ShoppingCart,
  UtensilsCrossed,
  Users,
  CheckCircle2,
  ChevronRight,
  X,
  PartyPopper,
  Compass,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { listProducts } from "@/lib/erp/api-inventory"
import { getSalesReport } from "@/lib/erp/api-reports"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Step {
  id: string
  title: string
  body: string
  href: string
  cta: string
  icon: LucideIcon
  /** Comprobación automática de "hecho" contra datos reales (opcional). */
  derive?: () => Promise<boolean>
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}

export function OnboardingChecklist() {
  const { isRetail, isRestaurant, hasPermission } = useAuth()
  const {
    checklistHidden,
    hideChecklist,
    isStepCompleted,
    markStepCompleted,
    openGuide,
  } = useOnboarding()

  const steps = React.useMemo<Step[]>(() => {
    const list: Step[] = [
      {
        id: "sede",
        title: "Personaliza tu sede",
        body: "Agrega tu NIT y datos fiscales para poder facturar.",
        href: "/panel/sedes",
        cta: "Configurar",
        icon: Store,
      },
      {
        id: "productos",
        title: isRetail ? "Carga tus productos" : "Carga productos y recetas",
        body: isRetail
          ? "Da de alta tus productos con su código de barras para escanearlos."
          : "Registra tu inventario y arma las recetas que vende el POS.",
        href: isRetail ? "/panel/inventario" : "/panel/productos",
        cta: "Agregar",
        icon: Boxes,
        derive: async () => (await listProducts()).length > 0,
      },
      {
        id: "venta",
        title: "Abre caja y haz tu primera venta",
        body: "Abre el turno de caja y cobra desde el punto de venta.",
        href: "/pos",
        cta: "Ir al POS",
        icon: ShoppingCart,
        derive: async () => {
          if (!hasPermission("reports.view")) return false
          const report = await getSalesReport({
            from: daysAgo(90),
            to: new Date().toLocaleDateString("en-CA"),
          })
          return report.totalRevenue > 0
        },
      },
    ]

    if (isRestaurant) {
      list.push({
        id: "mesas",
        title: "Configura tus mesas",
        body: "Crea los salones y mesas para abrir comandas.",
        href: "/panel/restaurante",
        cta: "Configurar",
        icon: UtensilsCrossed,
      })
    }

    if (hasPermission("users.manage")) {
      list.push({
        id: "equipo",
        title: "Invita a tu equipo",
        body: "Crea usuarios y define qué puede hacer cada uno.",
        href: "/panel/config/usuarios",
        cta: "Invitar",
        icon: Users,
      })
    }

    return list
  }, [isRetail, isRestaurant, hasPermission])

  // Estado "hecho" derivado de datos (best-effort, no bloquea el render).
  const [derived, setDerived] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (checklistHidden) return
    let active = true
    for (const step of steps) {
      if (!step.derive) continue
      step
        .derive()
        .then((ok) => {
          if (active && ok) setDerived((d) => ({ ...d, [step.id]: true }))
        })
        .catch(() => {
          /* sin datos o sin permiso: se marca al hacer clic */
        })
    }
    return () => {
      active = false
    }
  }, [steps, checklistHidden])

  if (checklistHidden) return null

  const isDone = (step: Step) => derived[step.id] || isStepCompleted(step.id)
  const doneCount = steps.filter(isDone).length
  const total = steps.length
  const allDone = doneCount === total
  const pct = Math.round((doneCount / total) * 100)

  if (allDone) {
    return (
      <Card
        data-tour="checklist"
        className="mb-4 border-success/40 bg-success/5"
      >
        <CardContent className="flex items-center gap-3 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <PartyPopper className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-foreground">
              ¡Listo! Ya diste tus primeros pasos.
            </p>
            <p className="text-sm text-muted-foreground">
              Tu negocio está en marcha. Puedes reabrir la guía cuando quieras.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={hideChecklist}>
            Ocultar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-tour="checklist" className="mb-4 border-primary/25">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg text-foreground">
              Primeros pasos
            </p>
            <p className="text-sm text-muted-foreground">
              Deja tu negocio listo para vender. Puedes hacerlos en cualquier
              orden.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={openGuide}
              title="Reabrir la guía"
            >
              <Compass className="size-4" />
              Guía
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ocultar primeros pasos"
              onClick={hideChecklist}
            >
              <X />
            </Button>
          </div>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-sm font-medium text-muted-foreground">
            {doneCount}/{total}
          </span>
        </div>

        {/* Pasos */}
        <ul className="flex flex-col gap-2">
          {steps.map((step) => {
            const done = isDone(step)
            return (
              <li key={step.id}>
                <div
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    done
                      ? "border-success/30 bg-success/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <span
                    className={
                      done
                        ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success [&_svg]:size-5"
                        : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4"
                    }
                  >
                    {done ? <CheckCircle2 /> : <step.icon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        done
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {step.title}
                    </p>
                    {!done && (
                      <p className="text-xs text-muted-foreground">
                        {step.body}
                      </p>
                    )}
                  </div>
                  {done ? (
                    <span className="shrink-0 text-xs font-medium text-success">
                      Hecho
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      render={<Link href={step.href} />}
                      onClick={() => markStepCompleted(step.id)}
                    >
                      {step.cta}
                      <ChevronRight className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
