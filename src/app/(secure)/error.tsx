"use client"

import { useEffect } from "react"
import { RotateCcw } from "lucide-react"
import * as Sentry from "@sentry/nextjs"

import { Button } from "@/components/ui/button"

/**
 * Límite de error de la zona con sesión (`/panel` y `/pos`).
 *
 * Existe por una lección concreta: el selector de tema lanzaba una excepción al
 * abrirse y, sin ningún `error.tsx` en el árbol, esa excepción subía hasta la
 * raíz y Next respondía con su página de error genérica. Quien lo vivía no leía
 * "el menú de tema falló": veía la aplicación caída y un código de error, sin
 * forma de volver. Un fallo de un menú no puede tumbar el turno de una caja.
 *
 * `reset()` vuelve a montar el subárbol sin recargar, así que la sesión y el
 * estado del POS sobreviven al reintento.
 */
export default function SecureError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // El detalle técnico va a la consola, no a la pantalla: el mensaje de una
  // excepción puede filtrar rutas internas y no le dice nada a quien atiende.
  useEffect(() => {
    console.error("[BookiPos] error no controlado en la zona con sesión:", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">
        Algo falló en esta pantalla
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        El resto de la aplicación sigue en pie. Reintenta; si vuelve a pasar,
        avísale al administrador con el código de abajo.
      </p>
      <Button onClick={reset} className="gap-2">
        <RotateCcw className="size-4" aria-hidden />
        Reintentar
      </Button>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Código: <span className="tnum">{error.digest}</span>
        </p>
      )}
    </div>
  )
}
