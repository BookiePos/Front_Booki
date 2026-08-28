"use client"

import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme/theme-context"
import type { ThemeMode } from "@/lib/theme/theme-store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Según el sistema", icon: Monitor },
]

/**
 * Selector de tema (claro / oscuro / sistema).
 *
 * Es un menú y no un interruptor de dos estados porque "seguir al sistema" es
 * un tercer valor de pleno derecho: con un switch no habría forma de volver a
 * él una vez elegido claro u oscuro.
 */
export function ThemeToggle({
  className,
  size = "icon-lg",
}: {
  className?: string
  size?: "icon" | "icon-sm" | "icon-lg"
}) {
  const { mode, ready, setMode } = useTheme()

  // El modo guardado no se conoce hasta después de hidratar, así que no se
  // anuncia todavía: durante un frame diría uno equivocado.
  const current = ready
    ? (OPTIONS.find((o) => o.value === mode)?.label ?? "Claro")
    : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={size}
            className={cn(className)}
            aria-label={
              current ? `Tema: ${current}. Cambiar tema` : "Cambiar tema"
            }
            title="Tema de la interfaz"
          />
        }
      >
        {/* Los dos iconos se pintan y CSS decide cuál se ve. Elegirlo con
            estado de React haría que el primer render (siempre "claro", como
            el HTML del servidor) mostrara el sol un instante aunque la página
            ya estuviera oscura: la clase `dark` la puso el script del <head>
            antes de que React existiera. */}
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="hidden size-4 dark:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Tema de la interfaz</DropdownMenuLabel>
        {/* Siempre controlado: pasar `undefined` mientras se lee localStorage
            convertiría el grupo de no-controlado a controlado y React avisa. */}
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as ThemeMode)}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
