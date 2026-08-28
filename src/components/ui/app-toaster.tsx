"use client"

import { Toaster } from "sonner"

import { useTheme } from "@/lib/theme/theme-context"

/**
 * Toaster de sonner atado al tema de la app.
 *
 * Sonner tiene su propio tema y por defecto pinta claro: sin esto, sobre el
 * lienzo marino los avisos salían como rectángulos blancos. Se le pasa el tema
 * ya resuelto (no "system") para que siga también al selector manual.
 */
export function AppToaster() {
  const { mode } = useTheme()
  // "system" se le pasa tal cual: sonner ya sabe seguir a `prefers-color-scheme`
  // y así acierta también antes de que se lea la preferencia guardada.
  return <Toaster position="top-center" richColors closeButton theme={mode} />
}
