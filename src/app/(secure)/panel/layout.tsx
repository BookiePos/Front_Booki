import type { Metadata } from "next"
import { AppShell } from "@/components/erp/app-shell"
import { FeatureGuard } from "@/components/erp/feature-guard"
import { RequireAuth } from "@/components/erp/require-auth"
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
          <FeatureGuard>{children}</FeatureGuard>
        </AppShell>
      </TooltipProvider>
    </RequireAuth>
  )
}
