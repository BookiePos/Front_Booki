"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MousePointerClick, X } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import {
  buildProductSteps,
  guideById,
  type TourStep,
} from "@/lib/onboarding/guides"
import { Button } from "@/components/ui/button"

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

// ─── Componente ─────────────────────────────────────────────────────────────────

export function ProductTour() {
  const { guide, tourOpen, finishTour } = useOnboarding()
  const { isRetail } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const steps = React.useMemo<TourStep[]>(() => {
    if (guide === "product") return buildProductSteps(isRetail)
    if (guide) return guideById(guide)?.build() ?? []
    return []
  }, [guide, isRetail])
  const [index, setIndex] = React.useState(0)
  const [rect, setRect] = React.useState<Rect | null>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const [bubbleH, setBubbleH] = React.useState(180)

  // Al abrir (o cambiar de recorrido), arranca desde el principio.
  React.useEffect(() => {
    if (tourOpen) setIndex(0)
  }, [tourOpen, guide])

  const step = steps[index]
  const isLast = index === steps.length - 1
  // Para hacer scroll al objetivo una sola vez por paso (evita jitter).
  const scrolledForIndex = React.useRef<number | null>(null)

  // Navegación: si el paso pide una ruta y no estamos en ella, ir allá.
  React.useEffect(() => {
    if (!tourOpen || !step?.navigateTo) return
    if (!pathname.startsWith(step.navigateTo)) {
      router.push(step.navigateTo)
    }
  }, [tourOpen, step, pathname, router])

  // Localiza el objetivo (reintentando por si aparece tras navegar o abrir un
  // panel) y evalúa el avance automático de los pasos interactivos.
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

    function tick() {
      // Avance automático (clic real / acción completada).
      if (step.advanceWhen && step.advanceWhen({ pathname: window.location.pathname })) {
        setIndex((i) => Math.min(i + 1, steps.length - 1))
        return
      }
      // Lleva el objetivo a la vista una sola vez por paso (cuando aparece).
      if (step.target && scrolledForIndex.current !== index) {
        const el = document.querySelector<HTMLElement>(
          `[data-tour="${step.target}"]`,
        )
        if (el) {
          el.scrollIntoView({ block: "center", behavior: "smooth" })
          scrolledForIndex.current = index
        }
      }
      recalc()
    }

    raf = window.requestAnimationFrame(recalc)
    const interval = window.setInterval(tick, 350)
    window.addEventListener("resize", recalc)
    window.addEventListener("scroll", recalc, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearInterval(interval)
      window.removeEventListener("resize", recalc)
      window.removeEventListener("scroll", recalc, true)
    }
  }, [tourOpen, step, index, steps.length])

  // Mide la altura real de la burbuja para posicionarla sin recortarse.
  React.useLayoutEffect(() => {
    if (bubbleRef.current) {
      setBubbleH(bubbleRef.current.offsetHeight)
    }
  }, [index, rect])

  if (!tourOpen || !step) return null

  const isFirst = index === 0
  const interactive = Boolean(step.interactive)
  // En pasos interactivos con objetivo visible, el usuario debe hacer la acción;
  // si el objetivo no aparece, se ofrece "Siguiente" como salida.
  const showNext = !interactive || !rect

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
    <div
      className="pointer-events-none fixed inset-0 z-[70]"
      aria-live="polite"
      role="dialog"
      aria-modal="true"
    >
      {/* Capa de fondo. En pasos interactivos deja pasar los clics (para que el
          usuario pueda pulsar el elemento resaltado); en los demás, bloquea. */}
      <div
        className={[
          "absolute inset-0",
          interactive ? "pointer-events-none" : "pointer-events-auto",
          spotlight ? "" : "bg-brand-950/55 backdrop-blur-[1px]",
        ].join(" ")}
      />

      {/* Spotlight: recorte iluminado sobre el objetivo (el oscurecido lo pinta
          el box-shadow gigante). Pulsa en los pasos interactivos. */}
      {spotlight && (
        <div
          className={[
            "pointer-events-none absolute rounded-xl ring-2 transition-all duration-300",
            interactive ? "ring-primary animate-pulse" : "ring-primary/70",
          ].join(" ")}
          style={{
            ...spotlight,
            boxShadow: "0 0 0 9999px rgba(23, 12, 51, 0.55)",
          }}
        />
      )}

      {/* Burbuja */}
      <div
        ref={bubbleRef}
        className="pointer-events-auto absolute w-[320px] max-w-[calc(100vw-16px)] rounded-2xl bg-card p-4 shadow-xl"
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

        {/* Aviso de acción en pasos interactivos con objetivo visible. */}
        {interactive && rect && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <MousePointerClick className="size-3.5" />
            Haz clic en lo resaltado para continuar
          </p>
        )}

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
            {showNext && (
              <Button
                size="sm"
                onClick={() => (isLast ? finishTour() : setIndex((i) => i + 1))}
              >
                {isLast ? "Entendido" : "Siguiente"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
