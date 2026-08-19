"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock, Sparkles } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"

/** Ruta de reactivación que sigue accesible aunque la cuenta esté suspendida. */
const PLAN_PATH = "/panel/config/plan"

/**
 * Bloquea el panel cuando la empresa está suspendida o con el trial vencido.
 * En vez de dejar los datos en blanco (el backend responde 403 a todo), muestra
 * un aviso explícito con la salida clara: ir a la página de plan a reactivar.
 * Esa página queda exenta para que el dueño pueda pagar/reactivar.
 */
export function SuspensionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { suspended, suspensionReason } = useAuth()

  const onPlanPage = (pathname ?? "").startsWith(PLAN_PATH)
  if (!suspended || onPlanPage) return <>{children}</>

  const trialExpired = suspensionReason === "trial_expired"
  const titulo = trialExpired
    ? "Tu periodo de prueba venció"
    : "Tu cuenta está suspendida"
  const detalle = trialExpired
    ? "El periodo de prueba de tu empresa terminó. Reactiva tu plan para volver a operar."
    : "Tu suscripción no está al día. Reactiva tu plan para volver a operar."

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <Lock className="size-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{titulo}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {detalle}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Tus datos siguen intactos: al reactivar, recuperas el acceso a todo.
            </p>
          </div>
          <div className="mt-2 flex flex-col items-center gap-3">
            <Link
              href={PLAN_PATH}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-opacity hover:opacity-90"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Ver planes y reactivar
            </Link>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Cierra sesión desde el bloqueo (por si quieren entrar con otra cuenta). */
function LogoutButton() {
  const { logout } = useAuth()
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Cerrar sesión
    </button>
  )
}
