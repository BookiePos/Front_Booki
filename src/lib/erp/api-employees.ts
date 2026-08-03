/**
 * Cliente HTTP de Empleados (RRHH) y Cargos para el admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type EmpDocType = "CC" | "CE" | "TI" | "PA" | "PEP" | "NIT"
export type ContractType =
  | "indefinido"
  | "fijo"
  | "obra_labor"
  | "aprendizaje"
  | "prestacion_servicios"
export type SalaryType = "ordinario" | "integral"
export type ArlRiskLevel = "I" | "II" | "III" | "IV" | "V"
export type AccountType = "ahorros" | "corriente"
export type EmployeeStatus = "activo" | "inactivo" | "retirado"
export type Gender = "M" | "F" | "O"
export type DocStatus = "pendiente" | "entregado" | "vencido"

export interface LegalDocument {
  type: string
  number?: string
  issueDate?: string
  expiryDate?: string
  status: DocStatus
  note?: string
}

export interface Employee {
  _id: string
  docType: EmpDocType
  docNumber: string
  firstName: string
  lastName: string
  birthDate?: string
  gender?: Gender
  phone?: string
  email?: string
  address?: string
  city?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  positionId?: string
  positionName?: string
  sedeId?: string
  contractType: ContractType
  hireDate?: string
  endDate?: string
  salary?: number
  salaryType?: SalaryType
  workSchedule?: string
  eps?: string
  afp?: string
  arl?: string
  arlRiskLevel?: ArlRiskLevel
  compensationFund?: string
  severanceFund?: string
  bank?: string
  accountType?: AccountType
  accountNumber?: string
  documents: LegalDocument[]
  status: EmployeeStatus
  terminationDate?: string
  terminationReason?: string
  userId?: string
  notes?: string
  createdAt: string
}

/** Payload de creación/edición (todos los campos opcionales salvo en crear). */
export type EmployeeInput = Partial<Omit<Employee, "_id" | "createdAt">>

export interface Position {
  _id: string
  name: string
  description?: string
  active: boolean
  createdAt: string
}

// ── Empleados ──────────────────────────────────────────────────────────────────
export async function listEmployees(): Promise<Employee[]> {
  const res = await authFetch("/employees")
  return parseResponse<Employee[]>(res)
}

export async function createEmployee(
  payload: EmployeeInput,
): Promise<Employee> {
  const res = await authFetch("/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Employee>(res)
}

export async function updateEmployee(
  id: string,
  payload: EmployeeInput,
): Promise<Employee> {
  const res = await authFetch(`/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return parseResponse<Employee>(res)
}

export async function deleteEmployee(id: string): Promise<void> {
  const res = await authFetch(`/employees/${id}`, { method: "DELETE" })
  await parseResponse<{ ok: boolean }>(res)
}

// ── Cargos ─────────────────────────────────────────────────────────────────────
export async function listPositions(): Promise<Position[]> {
  const res = await authFetch("/positions")
  return parseResponse<Position[]>(res)
}

export async function createPosition(payload: {
  name: string
  description?: string
}): Promise<Position> {
  const res = await authFetch("/positions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<Position>(res)
}

export async function deletePosition(id: string): Promise<void> {
  const res = await authFetch(`/positions/${id}`, { method: "DELETE" })
  await parseResponse<{ ok: boolean }>(res)
}
