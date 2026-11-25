"use client"

import * as React from "react"
import {
  X,
  CircleHelp,
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
import { CatalogoEjemplo } from "@/components/onboarding/catalogo-ejemplo"

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
      title: "Comprobante en cada venta",
      body: "Desde el mismo cobro sale el tiquete o, si el cliente la pide, la factura electrónica de la DIAN.",
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#16141d]/40 p-4 motion-safe:animate-in motion-safe:fade-in-0 sm:p-6 dark:bg-black/60"
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
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-[var(--elevation-xl)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[0.98] sm:max-h-[calc(100svh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con gradiente de marca */}
        <div className="relative shrink-0 border-b border-border px-6 py-6 text-foreground">
          <button
            type="button"
            onClick={dismissWelcome}
            aria-label="Cerrar"
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <h2 className="pr-8 text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">
            {firstName ? `¡Bienvenido, ${firstName}!` : "¡Bienvenido a BookiPos!"}
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            Vamos a poner {giro} a funcionar. Estos son los pilares que vas a
            usar cada día:
          </p>
        </div>

        {/* Pilares del software */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 py-2">
          {/* Sin cuadritos de icono: una lista con líneas finas se lee de
              corrido; cuatro iconos en recuadro eran adorno. */}
          <ul className="divide-y divide-border">
            {highlights.map((h) => (
              <li key={h.title} className="flex items-start gap-3 py-3.5">
                <h.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-foreground">{h.title}</p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{h.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="pb-4">
          {/* Solo se ofrece a quien puede cargarlo (Dueño y Administrador). */}
          <CatalogoEjemplo onDone={dismissWelcome} />
          </div>
        </div>

        {/* Acciones. Van en el pie fijo junto con la nota de "puedes volver a
            abrirla": es la frase que quita el miedo a cerrarla, y dejarla
            dentro del scroll era dejarla sin leer. */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button className="gap-2 sm:flex-1" onClick={startTour}>
              <Compass className="size-4" />
              Muéstrame en un minuto
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
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            En cada pantalla, el botón{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
              <CircleHelp className="size-3" /> Ayuda
            </span>{" "}
            te explica cómo se hace cada cosa. Esta bienvenida vuelve desde tu
            menú, arriba a la derecha.
          </p>
        </div>
      </div>
    </div>
  )
}
