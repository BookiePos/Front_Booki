"use client"

import * as React from "react"
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

  // Escape cierra la bienvenida.
  //
  // Sin esto el velo cubría la pantalla entera a `z-60` y solo se quitaba
  // haciendo clic: si la tarjeta quedaba fuera de vista —pantalla corta, o el
  // usuario no la reconoce como un modal— todos los clics de la página se los
  // comía el velo y la aplicación parecía congelada. Y el sitio donde más
  // duele es la pantalla de plan, que es a la que llega justo quien tiene la
  // cuenta vencida y viene a reactivarla.
  React.useEffect(() => {
    if (!welcomeOpen) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissWelcome()
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [welcomeOpen, dismissWelcome])

  if (!welcomeOpen) return null

  const firstName = user?.name?.split(" ")[0] ?? ""
  const giro = isRetail ? "tu tienda" : "tu restaurante"
  const highlights = highlightsFor(isRetail)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/50 dark:bg-navy-950/70 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a BookiPos"
      onClick={dismissWelcome}
    >
      {/* Quien scrollea mueve el CUERPO, no el velo.
          Antes el velo entero hacía de contenedor con scroll y la tarjeta
          crecía sin límite: en una pantalla corta el saludo se iba por arriba y
          los dos botones por abajo a la vez, y la bienvenida parecía un muro
          sin salida. Cabecera y botones fijos, el listado de pilares con scroll
          propio y el alto en `svh` —con `vh` se sale por debajo en el móvil. */}
      <div
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl sm:max-h-[calc(100svh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con gradiente de marca */}
        <div className="relative shrink-0 gradient-brand px-6 py-6 text-primary-foreground">
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-6 py-5">
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

        {/* Acciones. Van en el pie fijo junto con la nota de "puedes volver a
            abrirla": es la frase que quita el miedo a cerrarla, y dejarla
            dentro del scroll era dejarla sin leer. */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
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
          <p className="text-center text-xs text-muted-foreground">
            Podrás reabrir esta guía cuando quieras desde el botón{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <Compass className="size-3" /> Guía
            </span>{" "}
            de la barra superior. Además, en el panel te dejamos una lista de
            primeros pasos.
          </p>
        </div>
      </div>
    </div>
  )
}
