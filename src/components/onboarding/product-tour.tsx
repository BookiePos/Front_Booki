"use client"

import * as React from "react"
import { X } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { Button } from "@/components/ui/button"

interface TourStep {
  /** Atributo data-tour del elemento a resaltar, o null para burbuja centrada. */
  target: string | null
  title: string
  body: string
}

/** Rectángulo del elemento resaltado (coordenadas de viewport). */
interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 8
const BUBBLE_W = 320
const GAP = 14

function buildSteps(isRetail: boolean): TourStep[] {
  return [
    {
      target: null,
      title: "Te muestro lo esencial",
      body: "Un recorrido rápido por lo que más vas a usar. Puedes omitirlo en cualquier momento.",
    },
    {
      target: "menu",
      title: "El menú lateral",
      body: "Desde aquí llegas a todos los módulos: sedes, inventario, productos, finanzas y más.",
    },
    {
      target: "sede",
      title: "Tu sede activa",
      body: "Si tienes varias sedes, elige con cuál estás trabajando aquí.",
    },
    {
      target: "buscar",
      title: "Búsqueda rápida",
      body: "Encuentra productos, facturas o clientes al instante.",
    },
    {
      target: "nueva-venta",
      title: isRetail ? "Vende y escanea" : "Abre el punto de venta",
      body: isRetail
        ? "Abre el POS para escanear, cobrar y facturar."
        : "Abre el POS para tomar pedidos, cobrar y facturar.",
    },
    {
      target: "checklist",
      title: "Tus primeros pasos",
      body: "Sigue esta lista para dejar tu negocio listo para vender.",
    },
    {
      target: "guia",
      title: "¿Necesitas verlo de nuevo?",
      body: "Reabre esta guía cuando quieras desde este botón.",
    },
  ]
}

export function ProductTour() {
  const { tourOpen, finishTour } = useOnboarding()
  const { isRetail } = useAuth()

  const steps = React.useMemo(() => buildSteps(isRetail), [isRetail])
  const [index, setIndex] = React.useState(0)
  const [rect, setRect] = React.useState<Rect | null>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const [bubbleH, setBubbleH] = React.useState(180)

  // Al abrir, arranca desde el principio.
  React.useEffect(() => {
    if (tourOpen) setIndex(0)
  }, [tourOpen])

  const step = steps[index]

  // Localiza el elemento objetivo y calcula su rectángulo (siguiendo scroll y
  // cambios de tamaño). Si no existe, la burbuja se muestra centrada.
  React.useEffect(() => {
    if (!tourOpen || !step) return
    let raf = 0

    function recalc() {
      if (!step.target) {
        setRect(null)
        return
      }
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      )
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) {
        setRect(null)
        return
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // Asegura que el objetivo esté visible antes de medir.
    if (step.target) {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      )
      el?.scrollIntoView({ block: "center", behavior: "smooth" })
    }
    raf = window.requestAnimationFrame(recalc)

    window.addEventListener("resize", recalc)
    window.addEventListener("scroll", recalc, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", recalc)
      window.removeEventListener("scroll", recalc, true)
    }
  }, [tourOpen, step, index])

  // Mide la altura real de la burbuja para posicionarla sin recortarse.
  React.useLayoutEffect(() => {
    if (bubbleRef.current) {
      setBubbleH(bubbleRef.current.offsetHeight)
    }
  }, [index, rect])

  if (!tourOpen || !step) return null

  const isLast = index === steps.length - 1
  const isFirst = index === 0

  // Posición de la burbuja.
  let bubbleStyle: React.CSSProperties
  if (!rect) {
    bubbleStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    }
  } else {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = rect.top + rect.height + GAP + bubbleH < vh
    const top = below
      ? rect.top + rect.height + GAP
      : Math.max(GAP, rect.top - bubbleH - GAP)
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - BUBBLE_W / 2, PADDING),
      vw - BUBBLE_W - PADDING,
    )
    bubbleStyle = { top, left }
  }

  const spotlight: React.CSSProperties | null = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite" role="dialog" aria-modal="true">
      {/* Capa que bloquea la interacción con la app durante el tour. Si no hay
          objetivo, ella misma pinta el oscurecido (para el paso centrado). */}
      <div
        className={
          spotlight
            ? "absolute inset-0"
            : "absolute inset-0 bg-brand-950/55 backdrop-blur-[1px]"
        }
      />

      {/* Spotlight: recorte iluminado sobre el objetivo (el oscurecido lo pinta
          el box-shadow gigante). */}
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary/70 transition-all duration-300"
          style={{
            ...spotlight,
            boxShadow: "0 0 0 9999px rgba(23, 12, 51, 0.55)",
          }}
        />
      )}

      {/* Burbuja */}
      <div
        ref={bubbleRef}
        className="absolute w-[320px] max-w-[calc(100vw-16px)] rounded-2xl bg-card p-4 shadow-xl"
        style={bubbleStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Paso {index + 1} de {steps.length}
          </span>
          <button
            type="button"
            onClick={finishTour}
            aria-label="Omitir tour"
            className="-mr-1 -mt-1 inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="mt-1.5 font-display text-lg text-foreground">
          {step.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>

        {/* Puntos de progreso */}
        <div className="mt-3 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={finishTour}
          >
            Omitir
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Atrás
              </Button>
            )}
            <Button
              size="sm"
              onClick={() =>
                isLast ? finishTour() : setIndex((i) => i + 1)
              }
            >
              {isLast ? "Entendido" : "Siguiente"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
