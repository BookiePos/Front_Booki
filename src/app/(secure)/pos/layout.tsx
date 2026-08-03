import type { Metadata } from "next"
import { PosShell } from "@/components/pos/pos-shell"
import { RequireAuth } from "@/components/pos/require-auth"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SedeProvider } from "@/lib/pos/sede-context"

export const metadata: Metadata = {
  title: "Punto de venta",
}

/** Zona del punto de venta (/pos/*). */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <TooltipProvider>
        <SedeProvider>
          <PosShell>{children}</PosShell>
        </SedeProvider>
      </TooltipProvider>
    </RequireAuth>
  )
}
