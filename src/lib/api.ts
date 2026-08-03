/**
 * Cliente HTTP del backend Sistema POS. La URL base se toma de NEXT_PUBLIC_API_URL
 * (por defecto http://localhost:3001).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  sedeIds: string[]
}

export interface Tokens {
  accessToken: string
  refreshToken: string
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
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<LoginResponse>
}

export async function apiMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<AuthUser>
}

export async function apiRefresh(refreshToken: string): Promise<Tokens> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) return parseError(res)
  return res.json() as Promise<Tokens>
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
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
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) return parseError(res)
  return res.json() as Promise<LoginResponse>
}
