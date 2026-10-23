import type { Alcance } from "@/lib/offline/idb"

/** Misma llave que usa `auth-context` para la sesión. */
const AUTH_KEY = "sistemapos.auth"
const DEVICE_KEY = "bookipos.deviceId"

/**
 * Empresa y usuario de la sesión, leídos del access token guardado. El token
 * ya está en `localStorage` y el backend lo firmó: aquí solo se lee para
 * separar los datos offline por empresa (`biz`) y usuario (`sub`), no se
 * confía en él para nada más. Sin sesión o con un token viejo sin `biz`,
 * devuelve null y el modo offline queda apagado.
 */
export function alcanceDeSesion(): Alcance | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const token = (JSON.parse(raw) as { tokens?: { accessToken?: string } })?.tokens
      ?.accessToken
    return alcanceDeToken(token)
  } catch {
    return null
  }
}

export function alcanceDeToken(token: string | undefined): Alcance | null {
  const parte = token?.split(".")[1]
  if (!parte) return null
  try {
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/"))
    const p = JSON.parse(json) as { sub?: unknown; biz?: unknown }
    if (typeof p.sub !== "string" || typeof p.biz !== "string") return null
    if (!p.sub || !p.biz) return null
    return { businessId: p.biz, userId: p.sub }
  } catch {
    return null
  }
}

/** Identificador estable de este terminal (solo trazabilidad de la reserva). */
export function deviceId(): string {
  try {
    const hit = window.localStorage.getItem(DEVICE_KEY)
    if (hit) return hit
    const nuevo = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, nuevo)
    return nuevo
  } catch {
    return "terminal"
  }
}
