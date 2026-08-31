"use client"

import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme/theme-context"
import type { ThemeMode } from "@/lib/theme/theme-store"
import { Segmented, type SegmentedOption } from "@/components/ui/segmented"

const OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
]

/** Las mismas tres opciones, pero solo el icono (barra superior estrecha). */
const COMPACT: SegmentedOption<ThemeMode>[] = OPTIONS.map((o) => ({
  ...o,
  label: "",
  srLabel:
    o.value === "light"
      ? "Tema claro"
      : o.value === "dark"
        ? "Tema oscuro"
        : "Seguir al sistema",
}))

/**
 * Selector de tema (claro / oscuro / sistema).
 *
 * Antes era un botón fantasma que abría un menú: había que adivinar que el
 * solecito hacía algo, abrirlo, leer tres opciones y elegir — tres pasos para
 * una preferencia que se cambia a diario cuando cae la tarde en el mostrador.
 * Y en la barra oscura el icono se confundía con los de al lado.
 *
 * Ahora los tres estados están a la vista y se cambia con un toque. Sigue
 * siendo de tres estados y no un interruptor: "seguir al sistema" es un valor
 * de pleno derecho y con un switch no habría forma de volver a él.
 *
 * Se pinta con `useTheme`, que lee el modo con `useSyncExternalStore`, así que
 * en el primer render del servidor sale "Auto" y React lo corrige al hidratar
 * sin discrepancia de marcado.
 */
export function ThemeToggle({
  className,
  /** `compact` deja solo los iconos: es lo que va en las barras superiores. */
  variant = "compact",
  size = "md",
}: {
  className?: string
  variant?: "compact" | "full"
  size?: "sm" | "md" | "lg"
}) {
  const { mode, setMode } = useTheme()

  return (
    <Segmented
      value={mode}
      onValueChange={setMode}
      options={variant === "compact" ? COMPACT : OPTIONS}
      size={size}
      ariaLabel="Tema de la interfaz"
      className={cn(
        // Icono solo: se recorta el relleno lateral para que los tres botones
        // no se coman la barra, sin bajar de los 36 px de alto tactiles.
        variant === "compact" && "[&>button]:px-2.5",
        className,
      )}
    />
  )
}
