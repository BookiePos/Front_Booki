import type { ErrorEvent } from "@sentry/nextjs"

/**
 * Opciones comunes de Sentry (ítem 2.4). Sin DSN no se inicia nada, así que
 * desarrollo, pruebas y despliegues sin cuenta siguen igual.
 */
export function opcionesSentry(env: Record<string, string | undefined>) {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return null
  return {
    dsn,
    environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    beforeSend: limpiarEvento,
  }
}

/** Quita cuerpo, cookies, usuario y cabeceras secretas antes de enviar. */
export function limpiarEvento<T extends ErrorEvent>(evento: T): T {
  const req = evento.request
  if (req) {
    delete req.data
    delete req.cookies
    if (req.headers) {
      for (const h of Object.keys(req.headers)) {
        if (/^(authorization|cookie)$/i.test(h)) delete req.headers[h]
      }
    }
  }
  delete evento.user
  return evento
}
