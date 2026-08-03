/** Cliente HTTP de la auditoría inmutable (core-audit). Base `/audit`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export interface AuditLog {
  _id: string
  userId?: string
  userEmail?: string
  userName?: string
  role?: string
  method: string
  path: string
  module?: string
  statusCode?: number
  success: boolean
  ip?: string
  durationMs?: number
  error?: string
  at: string
}

export interface AuditQuery {
  userEmail?: string
  module?: string
  method?: string
  from?: string
  to?: string
  limit?: number
}

export async function listAudit(query: AuditQuery = {}): Promise<AuditLog[]> {
  const qs = new URLSearchParams()
  if (query.userEmail) qs.set("userEmail", query.userEmail)
  if (query.module) qs.set("module", query.module)
  if (query.method) qs.set("method", query.method)
  if (query.from) qs.set("from", query.from)
  if (query.to) qs.set("to", query.to)
  if (query.limit) qs.set("limit", String(query.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await authFetch(`/audit${suffix}`)
  return parseResponse<AuditLog[]>(res)
}

export async function listAuditModules(): Promise<string[]> {
  const res = await authFetch("/audit/modules")
  return parseResponse<string[]>(res)
}
