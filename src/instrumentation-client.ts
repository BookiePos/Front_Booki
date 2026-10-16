import * as Sentry from "@sentry/nextjs"

import { opcionesSentry } from "@/lib/monitoreo/sentry-opciones"

// Navegador: errores no controlados de las pantallas (ítem 2.4).
const opciones = opcionesSentry({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NODE_ENV: process.env.NODE_ENV,
})
if (opciones) Sentry.init(opciones)

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
