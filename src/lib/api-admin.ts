/**
 * Cliente HTTP para los endpoints de administración (usuarios, roles, permisos).
 * Maneja auth automática con refresh token transparente.
 */
import { ApiError, apiRefresh, type Tokens } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const STORAGE_KEY = "sistemapos.auth"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  /** Nombre de usuario para login (si se creó con uno). */
  username?: string
  name: string
  role: string
  active: boolean
  extraPermissions: string[]
  sedeIds: string[]
  createdAt: string
}

export interface AdminRole {
  id: string
  key: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  userCount: number
}

export interface PermissionItem {
  key: string
  label: string
}

export interface PermissionGroup {
  group: string
  label: string
  items: PermissionItem[]
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired"

export interface AdminInvitation {
  id: string
  email: string
  role: string
  roleName: string
  status: InvitationStatus
  expiresAt: string
  createdAt: string
  invitedByName?: string
}

/** Respuesta al crear/reenviar: incluye el enlace (útil en modo de pruebas). */
export interface CreatedInvitation extends AdminInvitation {
  inviteUrl: string
  emailSent: boolean
}

// ─── Stored auth helpers ──────────────────────────────────────────────────────

interface StoredAuth {
  tokens: Tokens
  user: unknown
}

function readStored(): StoredAuth | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

function writeTokens(tokens: Tokens): void {
  if (typeof window === "undefined") return
  const stored = readStored()
  if (!stored) return
  // Solo persistimos el access token; el refresh vive en la cookie HttpOnly.
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...stored, tokens: { accessToken: tokens.accessToken } }),
  )
}

// ─── Core fetch with auto-refresh ────────────────────────────────────────────

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const stored = readStored()
  if (!stored) throw new ApiError(401, "No autenticado")

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${stored.tokens.accessToken}`)
  if (
    init.body !== undefined &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })

  // Happy path
  if (res.ok || res.status !== 401) return res

  // 401 → try refresh once (el refresh token va en la cookie HttpOnly)
  let newTokens: Tokens
  try {
    newTokens = await apiRefresh()
  } catch {
    throw new ApiError(401, "Sesión expirada. Vuelve a iniciar sesión.")
  }

  writeTokens(newTokens)

  // Retry with new token
  const retryHeaders = new Headers(init.headers)
  retryHeaders.set("Authorization", `Bearer ${newTokens.accessToken}`)
  if (init.body !== undefined && !retryHeaders.has("Content-Type")) {
    retryHeaders.set("Content-Type", "application/json")
  }

  return fetch(`${API_URL}${path}`, { ...init, headers: retryHeaders })
}

export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T
    return res.json() as Promise<T>
  }
  let message = `Error ${res.status}`
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (body?.message) {
      message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
    }
  } catch {
    // no JSON body
  }
  throw new ApiError(res.status, message)
}

// ─── User endpoints ───────────────────────────────────────────────────────────

export async function listUsers(): Promise<AdminUser[]> {
  const res = await authFetch("/users")
  return parseResponse<AdminUser[]>(res)
}

export interface CreateUserPayload {
  /** Email de login. Opcional si se pasa `username` (se sintetiza uno interno). */
  email?: string
  /** Nombre de usuario para login (alternativa al email). */
  username?: string
  password: string
  name: string
  role: string
  sedeIds?: string[]
  extraPermissions?: string[]
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<AdminUser> {
  const res = await authFetch("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<AdminUser>(res)
}

export interface UpdateUserPayload {
  name?: string
  role?: string
  active?: boolean
  extraPermissions?: string[]
  sedeIds?: string[]
  password?: string
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<AdminUser> {
  const res = await authFetch(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<AdminUser>(res)
}

// ─── Role endpoints ───────────────────────────────────────────────────────────

export async function listRoles(): Promise<AdminRole[]> {
  const res = await authFetch("/roles")
  return parseResponse<AdminRole[]>(res)
}

export interface CreateRolePayload {
  name: string
  description?: string
  permissions: string[]
}

export async function createRole(
  payload: CreateRolePayload,
): Promise<AdminRole> {
  const res = await authFetch("/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<AdminRole>(res)
}

export interface UpdateRolePayload {
  name?: string
  description?: string
  permissions?: string[]
}

export async function updateRole(
  id: string,
  payload: UpdateRolePayload,
): Promise<AdminRole> {
  const res = await authFetch(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<AdminRole>(res)
}

export async function deleteRole(id: string): Promise<void> {
  const res = await authFetch(`/roles/${id}`, { method: "DELETE" })
  return parseResponse<void>(res)
}

// ─── Permission catalog ───────────────────────────────────────────────────────

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  const res = await authFetch("/permissions")
  return parseResponse<PermissionGroup[]>(res)
}

// ─── Invitation endpoints ─────────────────────────────────────────────────────

export async function listInvitations(): Promise<AdminInvitation[]> {
  const res = await authFetch("/invitations")
  return parseResponse<AdminInvitation[]>(res)
}

export interface CreateInvitationPayload {
  email: string
  role: string
}

export async function createInvitation(
  payload: CreateInvitationPayload,
): Promise<CreatedInvitation> {
  const res = await authFetch("/invitations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<CreatedInvitation>(res)
}

export async function resendInvitation(
  id: string,
): Promise<CreatedInvitation> {
  const res = await authFetch(`/invitations/${id}/resend`, { method: "POST" })
  return parseResponse<CreatedInvitation>(res)
}

export async function revokeInvitation(id: string): Promise<void> {
  const res = await authFetch(`/invitations/${id}`, { method: "DELETE" })
  return parseResponse<void>(res)
}
