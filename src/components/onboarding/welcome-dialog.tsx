"use client"

import {
  X,
  Sparkles,
  ShoppingCart,
  ScanLine,
  UtensilsCrossed,
  Wallet,
  FileText,
  ArrowRight,
  Compass,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { Button } from "@/components/ui/button"

interface Highlight {
  icon: LucideIcon
  title: string
  body: string
}

function highlightsFor(isRetail: boolean): Highlight[] {
  const common: Highlight[] = [
    {
      icon: ShoppingCart,
      title: "Vende y cuadra caja",
      body: "Abre tu caja, cobra en el punto de venta y cierra el turno con arqueo.",
    },
    {
      icon: Wallet,
      title: "Controla tu dinero",
      body: "Ventas, gastos, cuentas por cobrar y pagar, y tu utilidad del mes.",
    },
    {
      icon: FileText,
      title: "Factura electrónica DIAN",
      body: "Emite la factura del cliente directamente desde el cobro.",
    },
  ]
  const first: Highlight = isRetail
    ? {
        icon: ScanLine,
        title: "Escáner y variantes",
        body: "Da de alta productos con código de barras y variantes (talla, color).",
      }
    : {
        icon: UtensilsCrossed,
        title: "Mesas, comandas y recetas",
        body: "Gestiona el salón, arma tus recetas y descuenta el inventario al vender.",
      }
  return [first, ...common]
}

export function WelcomeDialog() {
  const { welcomeOpen, dismissWelcome, startTour } = useOnboarding()
  const { user, isRetail } = useAuth()

  if (!welcomeOpen) return null

  const firstName = user?.name?.split(" ")[0] ?? ""
  const giro = isRetail ? "tu tienda" : "tu restaurante"
  const highlights = highlightsFor(isRetail)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-brand-950/50 dark:bg-navy-950/70 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a BookiPos"
      onClick={dismissWelcome}
    >
      <div
        className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con gradiente de marca */}
        <div className="relative gradient-brand px-6 py-6 text-primary-foreground">
          <button
            type="button"
            onClick={dismissWelcome}
            aria-label="Cerrar"
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
          >
            <X className="size-4" />
          </button>
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Sparkles className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-2xl leading-tight">
            {firstName ? `¡Bienvenido, ${firstName}!` : "¡Bienvenido a BookiPos!"}
          </h2>
          <p className="mt-1.5 text-sm text-primary-foreground/85">
            Vamos a poner {giro} a funcionar. Estos son los pilares que vas a
            usar cada día:
          </p>
        </div>

        {/* Pilares del software */}
        <div className="flex flex-col gap-3 px-6 py-5">
          {highlights.map((h) => (
            <div key={h.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                <h.icon />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {h.title}
                </p>
                <p className="text-sm text-muted-foreground">{h.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row-reverse">
          <Button className="gap-2 sm:flex-1" onClick={startTour}>
            <Compass className="size-4" />
            Hacer el tour guiado
          </Button>
          <Button
            variant="outline"
            className="gap-2 sm:flex-1"
            onClick={dismissWelcome}
          >
            Explorar por mi cuenta
            <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="px-6 pb-5 text-center text-xs text-muted-foreground">
          Podrás reabrir esta guía cuando quieras desde el botón{" "}
          <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
            <Compass className="size-3" /> Guía
          </span>{" "}
          de la barra superior. Además, en el panel te dejamos una lista de
          primeros pasos.
        </p>
      </div>
    </div>
  )
}
