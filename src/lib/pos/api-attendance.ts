/**
 * Cliente HTTP de asistencia / control de horas (base de nómina).
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

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
  registeredByEmail?: string
}

export interface UpsertAttendancePayload {
  sedeId: string
  employeeId: string
  workDate: string
  checkIn?: string
  checkOut?: string
  note?: string
}

/** Horas trabajadas acumuladas por trabajador y sede (sección "Turnos"). */
export interface AttendanceSummaryRow {
  userId: string
  userName: string
  sedeId: string
  sedeName: string
  hours: number
  days: number
}

export async function listWorkers(sedeId: string): Promise<Worker[]> {
  const res = await authFetch(
    `/attendance/workers?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<Worker[]>(res)
}

export async function listAttendance(
  sedeId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const qs = `sedeId=${encodeURIComponent(sedeId)}&date=${encodeURIComponent(date)}`
  const res = await authFetch(`/attendance?${qs}`)
  return parseResponse<AttendanceRecord[]>(res)
}

export async function upsertAttendance(
  payload: UpsertAttendancePayload,
): Promise<AttendanceRecord> {
  const res = await authFetch("/attendance", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<AttendanceRecord>(res)
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
