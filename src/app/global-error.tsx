"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

/**
 * Último límite de error: atrapa lo que revienta el layout raíz, donde ningún
 * `error.tsx` llega. Reemplaza al layout, por eso trae su propio <html>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Algo salió mal</h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#666" }}>
          La aplicación tuvo un error inesperado. Reintenta; si vuelve a pasar,
          avísale al administrador.
        </p>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #999", cursor: "pointer" }}
        >
          Reintentar
        </button>
        {error.digest && <p style={{ fontSize: "0.75rem", color: "#666" }}>Código: {error.digest}</p>}
      </body>
    </html>
  )
}
