/**
 * Cliente HTTP del backend Sistema POS. La URL base se toma de NEXT_PUBLIC_API_URL
 * (por defecto http://localhost:3001).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

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
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Error ${res.status}`
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (body?.message) {
      message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
    }
  } catch {
    // respuesta sin cuerpo JSON
  }
  throw new ApiError(res.status, message)
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

export type BusinessPlan = "punto" | "operacion"
export type BusinessType = "restaurante" | "retail"

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
