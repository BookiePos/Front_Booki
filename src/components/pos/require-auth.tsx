"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

/**
 * Protege las rutas del POS (/pos):
 * - Sin sesión → /login.
 * - Con sesión pero sin permiso de venta (`pos.sell`) → fuera del terminal: al
 *   panel de Operación si tiene acceso, o al login si no tiene ningún área.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, canUsePos, canUseOperation } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }
    if (status === "authenticated" && !canUsePos) {
      router.replace(canUseOperation ? "/panel" : "/login")
    }
  }, [status, canUsePos, canUseOperation, router])

  if (status !== "authenticated" || !canUsePos) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Cargando…
      </div>
    )
  }

  return <>{children}</>
}
