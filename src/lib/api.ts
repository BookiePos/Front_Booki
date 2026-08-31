/**
 * Cliente HTTP del backend Sistema POS. La URL base se resuelve en `lib/env.ts`,
 * que valida NEXT_PUBLIC_API_URL y rompe el build si falta en producción.
 */
import { API_URL } from "@/lib/env"

export interface AuthUser {
  id: string
  email: string
  /** Nombre de usuario para login (si se creó con uno). */
  username?: string
  name: string
  role: string
  permissions: string[]
  sedeIds: string[]
  /** Giro del negocio (restaurante | retail). Diferencia la experiencia. */
  tipoNegocio?: BusinessType
  /** Plan comercial contratado. Undefined en tokens viejos (fail-open). */
  plan?: BusinessPlan
  /** Capacidades habilitadas por el plan. Undefined en tokens viejos. */
  entitlements?: Entitlements
}

export interface Tokens {
  accessToken: string
  /** El refresh token ya no se usa desde JS: viaja en una cookie HttpOnly.
   *  Se mantiene opcional porque el backend aún lo incluye en la respuesta. */
  refreshToken?: string
}

export interface LoginResponse {
  tokens: Tokens
  user: AuthUser
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Discriminador de negocio del backend (p. ej. "ACCOUNT_SUSPENDED"). */
    public readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Código que el backend envía cuando la empresa está suspendida o el trial venció. */
export const ACCOUNT_SUSPENDED_CODE = "ACCOUNT_SUSPENDED"

/** Evento global que se emite al detectar una respuesta de cuenta suspendida. */
export const ACCOUNT_SUSPENDED_EVENT = "bookipos:account-suspended"

export type SuspensionReason = "suspended" | "trial_expired"

/**
 * Avisa a toda la app (vía un evento en `window`) que la cuenta está suspendida.
 * El `AuthProvider` lo escucha y muestra el bloqueo de reactivación. Se llama
 * desde el único punto por donde pasan las respuestas del backend, así cualquier
 * llamada que reciba el 403 de suspensión dispara el aviso una sola vez.
 */
export function notifyAccountSuspended(reason?: SuspensionReason): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(ACCOUNT_SUSPENDED_EVENT, {
      detail: { reason: reason ?? "suspended" },
    }),
  )
}

/** Cuerpo de error del backend (Nest): incluye el discriminador `code` opcional. */
interface ErrorBody {
  message?: string | string[]
  code?: string
  reason?: SuspensionReason
}

async function parseError(res: Response): Promise<never> {
  let message = `Error ${res.status}`
  let code: string | undefined
  try {
    const body = (await res.json()) as ErrorBody
    if (body?.message) {
      message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
    }
    code = body?.code
    if (code === ACCOUNT_SUSPENDED_CODE) notifyAccountSuspended(body?.reason)
  } catch {
    // respuesta sin cuerpo JSON
  }
  throw new ApiError(res.status, message, code)
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // recibe la cookie HttpOnly del refresh token
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<LoginResponse>
}

// ─── Registro de empresa (ruta pública) ──────────────────────────────────────

export type BusinessPlan = "punto" | "negocio" | "control" | "cadena"
export type BusinessType = "restaurante" | "retail"

/** Capacidad de plan. Debe calzar EXACTO con el backend. */
export type PlanFeature =
  | "pos"
  | "inventory"
  | "caja"
  | "customers"
  | "reports"
  | "einvoicing"
  | "restaurant"
  | "lots"
  | "purchasing"
  | "expenses"
  | "accounting"
  | "audit"
  | "multi_sede"
  | "transfers"
  | "roles_per_sede"
  | "payroll"

/** Cupos del plan. `null` = ilimitado. */
export interface PlanQuotas {
  sedes: number
  users: number | null
  documentsPerMonth: number
  payrollEmployees: number
  /** Facturas de compra que se pueden leer por foto al mes. */
  invoiceScansPerMonth: number
}

/** Capacidades y cupos que el backend calcula a partir del plan. */
export interface Entitlements {
  plan: BusinessPlan
  features: PlanFeature[]
  quotas: PlanQuotas
}

/** Datos para dar de alta una empresa nueva y su dueño. */
export interface RegisterPayload {
  // Negocio
  businessName: string
  plan: BusinessPlan
  tipoNegocio: BusinessType
  nit?: string
  nitDv?: string
  tipoPersona?: "natural" | "juridica"
  responsabilidadFiscal?:
    | "responsable_iva"
    | "no_responsable_iva"
    | "regimen_simple"
    | "gran_contribuyente"
  ciiu?: string
  departamento?: string
  ciudad?: string
  address?: string
  phone?: string
  emailFacturacion?: string
  // Dueño
  ownerName: string
  ownerEmail: string
  password: string
}

export interface RegisterResponse extends LoginResponse {
  plan: BusinessPlan
}

/** Crea la empresa + su dueño y devuelve la sesión (auto-login). */
export async function apiRegister(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // recibe la cookie HttpOnly del refresh token
    body: JSON.stringify(payload),
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<RegisterResponse>
}

export async function apiMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<AuthUser>
}

export async function apiRefresh(): Promise<Tokens> {
  // El refresh token viaja en la cookie HttpOnly; no se envía desde JS.
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<Tokens>
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include", // envía la cookie para revocarla y limpiarla
  }).catch(() => {
    // el logout es best-effort
  })
}

// ─── Recuperación de contraseña (rutas públicas) ─────────────────────────────

/**
 * Pide el correo con el enlace para cambiar la contraseña. Acepta correo o
 * nombre de usuario, igual que el login.
 *
 * El backend responde 202 exista o no la cuenta (no revela quién está
 * registrado), así que la pantalla siempre muestra el mismo mensaje.
 */
export async function apiForgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) return parseError(res)
}

/** Valida el enlace del correo y devuelve la cuenta a la que pertenece. */
export async function apiValidatePasswordReset(
  token: string,
): Promise<{ email: string }> {
  const res = await fetch(
    `${API_URL}/auth/reset-password/${encodeURIComponent(token)}`,
  )
  if (!res.ok) return parseError(res)
  return res.json() as Promise<{ email: string }>
}

/**
 * Guarda la nueva contraseña. No devuelve sesión a propósito: el cambio revoca
 * todas las sesiones abiertas, así que hay que volver a entrar.
 */
export async function apiResetPassword(
  token: string,
  password: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/auth/reset-password/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // permite al backend limpiar la cookie de refresh
      body: JSON.stringify({ password }),
    },
  )
  if (!res.ok) return parseError(res)
}

// ─── Invitaciones (rutas públicas) ────────────────────────────────────────────

export interface InvitationInfo {
  email: string
  role: string
  roleName: string
}

/** Valida un token de invitación y devuelve a quién y con qué rol invita. */
export async function apiGetInvitation(
  token: string,
): Promise<InvitationInfo> {
  const res = await fetch(
    `${API_URL}/invitations/accept/${encodeURIComponent(token)}`,
  )
  if (!res.ok) return parseError(res)
  return res.json() as Promise<InvitationInfo>
}

/** Acepta la invitación (define nombre + contraseña) e inicia sesión. */
export async function apiAcceptInvitation(
  token: string,
  data: { name: string; password: string },
): Promise<LoginResponse> {
  const res = await fetch(
    `${API_URL}/invitations/accept/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // recibe la cookie HttpOnly del refresh token
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) return parseError(res)
  return res.json() as Promise<LoginResponse>
}
