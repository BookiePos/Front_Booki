"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"

import {
  applyTheme,
  getServerSystemTheme,
  getServerThemeMode,
  readThemeMode,
  setStoredThemeMode,
  subscribeSystemTheme,
  subscribeThemeMode,
  systemTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme-store"

interface ThemeContextValue {
  /** Lo que la persona eligió: claro, oscuro o "seguir al sistema". */
  mode: ThemeMode
  /** Lo que se está pintando de verdad (con "system" ya resuelto). */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** Alterna claro ↔ oscuro partiendo de lo que se ve ahora. */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // El tema no es estado de React: vive en localStorage y en la clase del
  // <html>, y puede cambiarlo otra pestaña o el propio sistema operativo.
  // `useSyncExternalStore` es la forma de leer justo eso sin un efecto que
  // haga setState en cada carga.
  const mode = useSyncExternalStore(
    subscribeThemeMode,
    readThemeMode,
    getServerThemeMode,
  )
  const system = useSyncExternalStore(
    subscribeSystemTheme,
    systemTheme,
    getServerSystemTheme,
  )

  const resolved: ResolvedTheme = mode === "system" ? system : mode

  // Único efecto, y no toca estado: empuja el tema al DOM (clase del <html> y
  // metaetiquetas `theme-color`). El script del <head> ya dejó bien el primer
  // pintado; esto cubre los cambios posteriores, incluido el del sistema
  // operativo mientras el modo es "system".
  useEffect(() => {
    applyTheme(mode)
  }, [mode, resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setStoredThemeMode(next)
  }, [])

  const toggle = useCallback(() => {
    setStoredThemeMode(resolved === "dark" ? "light" : "dark")
  }, [resolved])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
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
