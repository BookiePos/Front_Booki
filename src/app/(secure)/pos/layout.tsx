import type { Metadata } from "next"
import { PosShell } from "@/components/pos/pos-shell"
import { RequireAuth } from "@/components/pos/require-auth"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SedeProvider } from "@/lib/pos/sede-context"
import { OnboardingProvider } from "@/lib/onboarding/onboarding-context"

export const metadata: Metadata = {
  title: "Punto de venta",
}

/** Zona del punto de venta (/pos/*). */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <TooltipProvider>
        <SedeProvider>
          {/* Recorridos guiados del terminal: el botón “Guía” del PosShell abre
              el recorrido de la pantalla activa (ver lib/onboarding/guides). */}
          <OnboardingProvider>
            <PosShell>{children}</PosShell>
          </OnboardingProvider>
        </SedeProvider>
      </TooltipProvider>
    </RequireAuth>
  )
}
