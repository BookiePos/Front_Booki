"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useOnboarding } from "@/lib/onboarding/onboarding-context"
import { guideForPath } from "@/lib/onboarding/guides"

/**
 * Abre automáticamente la guía de una sección la PRIMERA vez que el usuario
 * entra a ese módulo (una sola vez por guía, recordado en localStorage). Después
 * de eso, la guía solo se reabre manualmente con el botón "Guía".
 *
 * No dispara nada si hay una bienvenida o un recorrido ya abierto (para no
 * pisarlos, ni auto-abrir guías mientras el tour general navega entre módulos).
 * Se monta una vez por shell (panel y POS); no renderiza nada.
 */
export function GuideAutoStart() {
  const pathname = usePathname()
  const { guide, welcomeOpen, hasSeenGuide, markGuideSeen, startGuide } =
    useOnboarding()

  React.useEffect(() => {
    // Un recorrido o la bienvenida ya están en pantalla: no interrumpir.
    if (guide !== null || welcomeOpen) return
    const match = guideForPath(pathname)
    if (!match || hasSeenGuide(match.id)) return
    // Marca antes de abrir para que no se reintente en el mismo módulo.
    markGuideSeen(match.id)
    startGuide(match.id)
  }, [pathname, guide, welcomeOpen, hasSeenGuide, markGuideSeen, startGuide])

  return null
}
