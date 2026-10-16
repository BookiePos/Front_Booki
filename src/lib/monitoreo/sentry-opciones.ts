import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs"

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

/** Únicas cabeceras que viajan a Sentry (sin Referer ni x-forwarded-for). */
const CABECERAS_PERMITIDAS = new Set(["user-agent", "content-type", "accept"])

const RE_EMAIL = /[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+/g
const RE_DOCUMENTO = /\d{6,}/g
const MAX_MENSAJE = 200

/** Censura emails y secuencias de 6 o más dígitos (cédulas, NIT, teléfonos). */
export function censurar(texto: string): string {
  return texto.replace(RE_EMAIL, "[email]").replace(RE_DOCUMENTO, "[num]")
}

/**
 * Quita del evento todo lo que pueda llevar datos personales: lista blanca de
 * cabeceras, URL sin query, sin cuerpo/cookies/usuario, breadcrumbs reducidos a
 * categoría + mensaje recortado + nivel, sin `extra`, y emails y documentos
 * censurados en los mensajes de excepción.
 */
export function limpiarEvento<T extends ErrorEvent>(evento: T): T {
  const req = evento.request
  if (req) {
    delete req.data
    delete req.cookies
    delete req.query_string
    if (typeof req.url === "string") req.url = req.url.split(/[?#]/)[0]
    if (req.headers) {
      for (const h of Object.keys(req.headers)) {
        if (!CABECERAS_PERMITIDAS.has(h.toLowerCase())) delete req.headers[h]
      }
    }
  }
  delete evento.user
  delete evento.extra
  if (evento.breadcrumbs) {
    evento.breadcrumbs = evento.breadcrumbs.map((b) => {
      const limpio: Breadcrumb = {}
      if (b.category) limpio.category = b.category
      if (typeof b.message === "string") limpio.message = censurar(b.message.slice(0, MAX_MENSAJE))
      if (b.level) limpio.level = b.level
      return limpio
    })
  }
  for (const v of evento.exception?.values ?? []) {
    if (typeof v.value === "string") v.value = censurar(v.value)
  }
  if (typeof evento.message === "string") evento.message = censurar(evento.message)
  return evento
}
