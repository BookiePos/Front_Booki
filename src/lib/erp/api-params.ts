/** Cliente HTTP de Parámetros con vigencia (core-params). Base `/params`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export type ParamValueType = "number" | "percent" | "money" | "text" | "boolean"

export interface ParamVersion {
  value: number | string | boolean
  effectiveFrom: string
  note?: string
  createdByEmail?: string
  upcoming: boolean
}

export interface ParameterView {
  key: string
  label: string
  group: string
  valueType: ParamValueType
  unit?: string
  system: boolean
  current: {
    value: number | string | boolean
    effectiveFrom: string
    note?: string
  } | null
  history: ParamVersion[]
}

export const PARAM_GROUP_LABELS: Record<string, string> = {
  caja: "Caja",
  nomina: "Nómina",
  propina: "Propina",
  recargos: "Recargos",
  operacion: "Operación",
}

export async function listParams(): Promise<ParameterView[]> {
  const res = await authFetch("/params")
  return parseResponse<ParameterView[]>(res)
}

export interface CreateParamPayload {
  key: string
  label: string
  group: string
  valueType: ParamValueType
  value: number | string | boolean
  unit?: string
  effectiveFrom: string
  note?: string
}

export async function createParam(
  payload: CreateParamPayload,
): Promise<ParameterView> {
  const res = await authFetch("/params", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ParameterView>(res)
}

export interface SetParamVersionPayload {
  value: number | string | boolean
  effectiveFrom: string
  note?: string
}

export async function setParamVersion(
  key: string,
  payload: SetParamVersionPayload,
): Promise<ParameterView> {
  const res = await authFetch(`/params/${encodeURIComponent(key)}/versions`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ParameterView>(res)
}
