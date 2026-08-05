"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

/**
 * Protege el panel de Operación (/panel):
 * - Sin sesión → /login.
 * - Con sesión pero sin permisos de Operación → fuera del back-office. Un
 *   usuario “solo POS” (p. ej. un cajero) no debe poder entrar aquí ni siquiera
 *   escribiendo la URL: se le manda al punto de venta, o al login si no tiene
 *   ningún área habilitada.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, canUseOperation, canUsePos } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }
    if (status === "authenticated" && !canUseOperation) {
      router.replace(canUsePos ? "/pos" : "/login")
    }
  }, [status, canUseOperation, canUsePos, router])

  // Mientras carga, o si no tiene acceso a Operación (mientras se redirige),
  // no se pinta el panel: evita el parpadeo de módulos vacíos.
  if (status !== "authenticated" || !canUseOperation) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Cargando…
      </div>
    )
  }

  return <>{children}</>
}
