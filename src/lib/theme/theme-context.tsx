"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  applyTheme,
  readThemeMode,
  resolveTheme,
  writeThemeMode,
  THEME_STORAGE_KEY,
  isThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme-store"

interface ThemeContextValue {
  /** Lo que la persona eligió: claro, oscuro o "seguir al sistema". */
  mode: ThemeMode
  /** Lo que se está pintando de verdad (con "system" ya resuelto). */
  resolved: ResolvedTheme
  /**
   * El estado guardado ya se leyó en el cliente. Antes de eso `mode` vale
   * "system" (el valor con el que se renderiza en el servidor) y los controles
   * no deben mostrar una selección que podría ser la equivocada.
   */
  ready: boolean
  setMode: (mode: ThemeMode) => void
  /** Alterna claro ↔ oscuro partiendo de lo que se ve ahora. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Arranca en "system" para que el HTML del servidor y el de la hidratación
  // coincidan. La clase `dark` real ya la puso el script inline del <head>, así
  // que este estado inicial no repinta nada: solo alimenta a los controles.
  const [mode, setModeState] = useState<ThemeMode>("system")
  const [resolved, setResolved] = useState<ResolvedTheme>("light")
  const [ready, setReady] = useState(false)

  // Lectura del valor persistido, ya en el cliente.
  useEffect(() => {
    const stored = readThemeMode()
    setModeState(stored)
    setResolved(resolveTheme(stored))
    setReady(true)
  }, [])

  // Cuando el modo es "system", seguir en vivo al sistema operativo: si alguien
  // cambia el tema del equipo con la app abierta, la app cambia con él.
  useEffect(() => {
    if (mode !== "system") return
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setResolved(applyTheme("system"))
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [mode])

  // Otra pestaña cambió el tema: esta se pone al día sin recargar.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return
      const next = isThemeMode(event.newValue) ? event.newValue : "system"
      setModeState(next)
      setResolved(applyTheme(next))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writeThemeMode(next)
    setResolved(applyTheme(next))
  }, [])

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark")
  }, [resolved, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, ready, setMode, toggle }),
    [mode, resolved, ready, setMode, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>")
  }
  return ctx
}
