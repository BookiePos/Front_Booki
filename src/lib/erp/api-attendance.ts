/**
 * Cliente HTTP de control de horas / turnos (nómina) para el admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

/** Horas trabajadas acumuladas por trabajador y sede (sección "Turnos"). */
export interface AttendanceSummaryRow {
  userId: string
  userName: string
  sedeId: string
  sedeName: string
  hours: number
  days: number
}

export async function attendanceSummary(
  from: string,
  to: string,
  sedeId?: string,
): Promise<AttendanceSummaryRow[]> {
  const params = new URLSearchParams({ from, to })
  if (sedeId) params.set("sedeId", sedeId)
  const res = await authFetch(`/attendance/summary?${params.toString()}`)
  return parseResponse<AttendanceSummaryRow[]>(res)
}

// ── Edición de horas desde Operación ──────────────────────────────────────────

export interface Worker {
  id: string
  name: string
  position: string
}

export interface AttendanceRecord {
  _id: string
  sedeId: string
  employeeId: string
  employeeName: string
  workDate: string
  checkIn?: string
  checkOut?: string
  hours: number
  note?: string
}

export async function listAttendanceWorkers(sedeId: string): Promise<Worker[]> {
  const res = await authFetch(
    `/attendance/workers?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<Worker[]>(res)
}

export async function listAttendanceDay(
  sedeId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&date=${encodeURIComponent(date)}`
  const res = await authFetch(`/attendance?${qs}`)
  return parseResponse<AttendanceRecord[]>(res)
}

export interface AdminSetPayload {
  sedeId: string
  employeeId: string
  workDate: string
  /** "" limpia la hora; "HH:MM" la fija; undefined no la toca. */
  checkIn?: string
  checkOut?: string
  note?: string
}

/** Fija/corrige las horas de un empleado en un día (Operación, sin write-once). */
export async function adminSetAttendance(
  payload: AdminSetPayload,
): Promise<AttendanceRecord> {
  const res = await authFetch("/attendance/admin", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<AttendanceRecord>(res)
}

// ── Solicitudes de edición (aprobar / rechazar) ───────────────────────────────

export type EditRequestStatus = "pending" | "approved" | "rejected"

export interface AttendanceEditRequest {
  _id: string
  sedeId: string
  employeeId: string
  employeeName: string
  workDate: string
  currentCheckIn?: string
  currentCheckOut?: string
  proposedCheckIn?: string
  proposedCheckOut?: string
  reason: string
  status: EditRequestStatus
  requestedByEmail?: string
  resolvedByEmail?: string
  resolutionNote?: string
  createdAt: string
}

export async function listEditRequests(
  status?: EditRequestStatus,
  sedeId?: string,
): Promise<AttendanceEditRequest[]> {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (sedeId) params.set("sedeId", sedeId)
  const qs = params.toString()
  const res = await authFetch(`/attendance/requests${qs ? `?${qs}` : ""}`)
  return parseResponse<AttendanceEditRequest[]>(res)
}

/** Aprueba (aplica las horas propuestas) o rechaza una solicitud. */
export async function resolveEditRequest(
  id: string,
  approve: boolean,
  note?: string,
): Promise<AttendanceEditRequest> {
  const res = await authFetch(`/attendance/requests/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ approve, note }),
  })
  return parseResponse<AttendanceEditRequest>(res)
}
