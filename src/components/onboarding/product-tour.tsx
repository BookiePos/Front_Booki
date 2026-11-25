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
import { useResetOnChange } from "@/hooks/use-reset-on-change"

/** Rectángulo del elemento resaltado (coordenadas de viewport). */
interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PADDING = 6
const BUBBLE_W = 360
const GAP = 12
/**
 * Cuánto se espera a que aparezca lo que el paso quiere resaltar antes de
 * saltarlo. Tras el rediseño varios pasos apuntaban a botones que ya no
 * existían y el recorrido se quedaba mostrando una burbuja que hablaba de algo
 * invisible: era la "traba". Ahora, si no aparece, se pasa al siguiente.
 */
const ESPERA_OBJETIVO_MS = 1600

// ─── Componente ─────────────────────────────────────────────────────────────────

export function ProductTour() {
  const { guide, tourOpen, finishTour } = useOnboarding()
  const { isRetail, hasPermission } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const steps = React.useMemo<TourStep[]>(() => {
    if (guide === "product") return buildProductSteps(isRetail, hasPermission)
    if (guide) return guideById(guide)?.build() ?? []
    return []
  }, [guide, isRetail, hasPermission])
  const [index, setIndex] = React.useState(0)
  /** Hacia dónde se movió el usuario: un paso que falta se salta en ese sentido. */
  const direccion = React.useRef<1 | -1>(1)
  const inicioPaso = React.useRef(0)
  const [rect, setRect] = React.useState<Rect | null>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const [bubbleH, setBubbleH] = React.useState(180)

  // Al abrir (o cambiar de recorrido), arranca desde el principio.
  useResetOnChange(() => {
    if (tourOpen) {
      direccion.current = 1
      setIndex(0)
    }
  }, [tourOpen, guide])

  const irA = React.useCallback(
    (destino: number) => {
      direccion.current = destino < index ? -1 : 1
      setIndex(Math.max(0, Math.min(destino, steps.length - 1)))
    },
    [index, steps.length],
  )

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
    inicioPaso.current = performance.now()

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
      // El objetivo no apareció: se salta el paso en vez de dejar una burbuja
      // suelta. El último paso nunca se salta (es el cierre).
      if (
        step.target &&
        !document.querySelector(`[data-tour="${step.target}"]`) &&
        performance.now() - inicioPaso.current > ESPERA_OBJETIVO_MS
      ) {
        const siguiente = index + direccion.current
        if (siguiente >= 0 && siguiente < steps.length) setIndex(siguiente)
      }
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

  // Teclado: flecha derecha o Enter avanza, flecha izquierda retrocede. Quien
  // lee una burbuja no tiene por qué buscar el botón con el ratón.
  React.useEffect(() => {
    if (!tourOpen || !step) return
    const alPulsar = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")
      if (enCampo) return
      if ((e.key === "ArrowRight" || e.key === "Enter") && !step.interactive) {
        e.preventDefault()
        if (index === steps.length - 1) finishTour()
        else irA(index + 1)
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault()
        irA(index - 1)
      }
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [tourOpen, step, index, steps.length, irA, finishTour])

  // Escape abandona el recorrido.
  //
  // El foco del tour no es un fondo: es un `box-shadow` enorme alrededor del
  // recorte, así que tapa todo menos el elemento resaltado. Si un paso apunta a
  // algo que ya no está en la página, no queda nada pulsable y la aplicación se
  // siente bloqueada. Escape es la salida que todo el mundo intenta primero.
  React.useEffect(() => {
    if (!tourOpen) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishTour()
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [tourOpen, finishTour])

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
          spotlight ? "" : "bg-[#16141d]/35 dark:bg-black/55",
        ].join(" ")}
      />

      {/* Spotlight: recorte iluminado sobre el objetivo (el oscurecido lo pinta
          el box-shadow gigante). Pulsa en los pasos interactivos. */}
      {spotlight && (
        <div
          className={[
            "tour-spotlight pointer-events-none absolute rounded-[8px] ring-2 ring-primary transition-[top,left,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          ].join(" ")}
          style={{
            ...spotlight,
            boxShadow: "0 0 0 9999px var(--tour-scrim)",
          }}
        />
      )}

      {/* Burbuja */}
      <div
        ref={bubbleRef}
        className="pointer-events-auto absolute w-[360px] max-w-[calc(100vw-16px)] rounded-[8px] border border-border bg-card p-5 text-card-foreground shadow-[0_1px_2px_rgba(20,16,30,0.06),0_16px_40px_-12px_rgba(20,16,30,0.28)] transition-[top,left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={bubbleStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium tabular-nums text-primary">
            {index + 1} de {steps.length}
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

        {/* key: el texto entra con un fundido corto al cambiar de paso, para
            que se note que cambió sin que la burbuja salte. */}
        <div key={index} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <h3 className="mt-1 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-balance">
            {step.title}
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-pretty text-foreground/80">{step.body}</p>
        </div>

        {/* Aviso de acción en pasos interactivos con objetivo visible. */}
        {interactive && rect && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <MousePointerClick className="size-3.5" />
            Haz clic en lo resaltado para continuar
          </p>
        )}

        {/* Progreso: una barra fina que se llena, no una fila de puntos. */}
        <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-border" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={finishTour}
          >
            Salir
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => irA(index - 1)}
              >
                Atrás
              </Button>
            )}
            {showNext && (
              <Button
                size="sm"
                onClick={() => (isLast ? finishTour() : irA(index + 1))}
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
