"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/lib/auth-context"

/**
 * Estado del onboarding, persistido por usuario en localStorage. Recuerda si ya
 * vio la bienvenida y el tour, si ocultó la checklist, y qué pasos marcó como
 * hechos manualmente (los demás se derivan de datos reales en la propia
 * checklist).
 */
interface OnboardingState {
  welcomeSeen: boolean
  tourSeen: boolean
  checklistHidden: boolean
  completedSteps: string[]
  /** Ids de las guías de sección que ya se abrieron solas (una vez por módulo). */
  seenGuides: string[]
}

const EMPTY: OnboardingState = {
  welcomeSeen: false,
  tourSeen: false,
  checklistHidden: false,
  completedSteps: [],
  seenGuides: [],
}

/**
 * Id del recorrido guiado activo. "product" = tour general de bienvenida; el
 * resto son ids de recorridos por sección registrados en `guides/`.
 */
export type GuideId = string

interface OnboardingContextValue {
  /**
   * El estado guardado (localStorage) ya se cargó para el usuario actual. Hasta
   * que sea `true`, `seenGuides`/`welcomeSeen` están vacíos y no se debe decidir
   * nada de auto-apertura: hacerlo mostraría guías ya vistas en cada login.
   */
  ready: boolean
  /** El diálogo de bienvenida debe estar abierto. */
  welcomeOpen: boolean
  /** Cierra la bienvenida y la marca como vista. */
  dismissWelcome: () => void
  /** Reabre la bienvenida (desde el botón "Guía"). */
  openGuide: () => void

  /** Recorrido guiado activo (o null si no hay ninguno). */
  guide: GuideId | null
  /** El tour interactivo está activo (cualquier recorrido). */
  tourOpen: boolean
  /** Inicia un recorrido por su id (registrado en `guides/`). */
  startGuide: (id: GuideId) => void
  /** Inicia el tour general de la app (cierra la bienvenida). */
  startTour: () => void
  /** Inicia el recorrido paso a paso para personalizar una sede. */
  startSedeGuide: () => void
  /** Termina el recorrido activo (por completarlo u omitirlo). */
  finishTour: () => void

  /** La checklist de primeros pasos está oculta. */
  checklistHidden: boolean
  hideChecklist: () => void
  showChecklist: () => void

  /** ¿El paso quedó marcado como hecho manualmente? */
  isStepCompleted: (id: string) => boolean
  /** Marca un paso como hecho (p. ej. al abrir su sección). */
  markStepCompleted: (id: string) => void

  /** ¿La guía de sección ya se abrió automáticamente alguna vez? */
  hasSeenGuide: (id: string) => boolean
  /** Registra que una guía de sección ya se mostró sola (no repetir). */
  markGuideSeen: (id: string) => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

const KEY_PREFIX = "bookipos.onboarding."

function readState(userId: string): OnboardingState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<OnboardingState>) }
  } catch {
    return EMPTY
  }
}

function writeState(userId: string, state: OnboardingState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(state))
  } catch {
    // localStorage lleno o bloqueado: el onboarding no es crítico.
  }
}

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, status } = useAuth()
  const userId = user?.id ?? null

  const [state, setState] = useState<OnboardingState>(EMPTY)
  const [ready, setReady] = useState(false)
  const [guide, setGuide] = useState<GuideId | null>(null)
  /** Reapertura manual de la bienvenida aunque ya se haya visto. */
  const [guideForced, setGuideForced] = useState(false)

  // Carga el estado guardado cuando ya se conoce al usuario.
  useEffect(() => {
    if (!userId) {
      setReady(false)
      return
    }
    setState(readState(userId))
    setReady(true)
  }, [userId])

  const persist = useCallback(
    (updater: (prev: OnboardingState) => OnboardingState) => {
      setState((prev) => {
        const next = updater(prev)
        if (userId) writeState(userId, next)
        return next
      })
    },
    [userId],
  )

  const dismissWelcome = useCallback(() => {
    setGuideForced(false)
    persist((prev) => ({ ...prev, welcomeSeen: true }))
  }, [persist])

  const openGuide = useCallback(() => {
    setGuide(null)
    setGuideForced(true)
    // Reabrir la guía también repone la checklist si estaba oculta.
    persist((prev) =>
      prev.checklistHidden ? { ...prev, checklistHidden: false } : prev,
    )
  }, [persist])

  const startGuide = useCallback((id: GuideId) => {
    setGuideForced(false)
    setGuide(id)
  }, [])

  const startTour = useCallback(() => {
    setGuideForced(false)
    persist((prev) => ({ ...prev, welcomeSeen: true }))
    setGuide("product")
  }, [persist])

  const startSedeGuide = useCallback(() => {
    setGuideForced(false)
    setGuide("sede")
  }, [])

  const finishTour = useCallback(() => {
    setGuide(null)
    persist((prev) => ({ ...prev, tourSeen: true }))
  }, [persist])

  const hideChecklist = useCallback(() => {
    persist((prev) => ({ ...prev, checklistHidden: true }))
  }, [persist])

  const showChecklist = useCallback(() => {
    persist((prev) => ({ ...prev, checklistHidden: false }))
  }, [persist])

  const isStepCompleted = useCallback(
    (id: string) => state.completedSteps.includes(id),
    [state.completedSteps],
  )

  const markStepCompleted = useCallback(
    (id: string) => {
      persist((prev) =>
        prev.completedSteps.includes(id)
          ? prev
          : { ...prev, completedSteps: [...prev.completedSteps, id] },
      )
    },
    [persist],
  )

  const hasSeenGuide = useCallback(
    (id: string) => state.seenGuides.includes(id),
    [state.seenGuides],
  )

  const markGuideSeen = useCallback(
    (id: string) => {
      persist((prev) =>
        prev.seenGuides.includes(id)
          ? prev
          : { ...prev, seenGuides: [...prev.seenGuides, id] },
      )
    },
    [persist],
  )

  // La bienvenida se abre la primera vez (tras registrarse/iniciar sesión) o
  // cuando el usuario la reabre desde el botón "Guía".
  const welcomeOpen =
    status === "authenticated" &&
    ready &&
    (guideForced || !state.welcomeSeen)

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ready,
      welcomeOpen,
      dismissWelcome,
      openGuide,
      guide,
      tourOpen: guide !== null,
      startGuide,
      startTour,
      startSedeGuide,
      finishTour,
      checklistHidden: state.checklistHidden,
      hideChecklist,
      showChecklist,
      isStepCompleted,
      markStepCompleted,
      hasSeenGuide,
      markGuideSeen,
    }),
    [
      ready,
      welcomeOpen,
      dismissWelcome,
      openGuide,
      guide,
      startGuide,
      startTour,
      startSedeGuide,
      finishTour,
      state.checklistHidden,
      hideChecklist,
      showChecklist,
      isStepCompleted,
      markStepCompleted,
      hasSeenGuide,
      markGuideSeen,
    ],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error("useOnboarding debe usarse dentro de <OnboardingProvider>")
  }
  return ctx
}
