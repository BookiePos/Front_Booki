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
