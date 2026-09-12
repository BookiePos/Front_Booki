import type { Metadata } from "next"
import { AppShell } from "@/components/erp/app-shell"
import { FeatureGuard } from "@/components/erp/feature-guard"
import { NovedadesCard } from "@/components/erp/novedades-card"
import { RequireAuth } from "@/components/erp/require-auth"
import { SuspensionGuard } from "@/components/erp/suspension-guard"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "Panel ejecutivo",
}

/**
 * Zona del panel de operación (/panel/*).
 *
 * `TooltipProvider` vive aquí y no en la raíz: la web pública no usa tooltips
 * y no tiene por qué descargar ese cliente solo para ver la portada.
 */
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth>
      <TooltipProvider>
        <AppShell>
          <SuspensionGuard>
            <FeatureGuard>{children}</FeatureGuard>
          </SuspensionGuard>
        </AppShell>
        {/* Qué trae la última versión. Va fuera de los guardias a propósito:
            una cuenta suspendida no necesita enterarse de las novedades. */}
        <NovedadesCard />
      </TooltipProvider>
    </RequireAuth>
  )
}
