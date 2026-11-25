"use client"

import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist"
import { Inicio } from "@/components/dashboard/inicio/inicio"

/**
 * Inicio del panel. El tablero personalizable de widgets se reemplazó por una
 * página fija y ordenada (sistema "Libro", 19-nov-2026): ver `Inicio`.
 */
export default function DashboardPage() {
  return <Inicio primerosPasos={<OnboardingChecklist />} />
}
