import { ApiError } from "@/lib/api"
import type { ConfigurarNominaPayload } from "@/lib/erp/api-einvoicing"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const esUuid = (v: string): boolean => UUID.test(v.trim())

export interface FormNominaEmisor {
  softwareId: string
  pin: string
  testSetId: string
}

/**
 * Valida y arma el cuerpo del PUT. El PIN nunca se reenvía vacío: el backend
 * exige uno y este formulario nunca lo muestra, así que cada guardado lo pide.
 * `quitarTestSetId` envía `null` (borra); un TestSetId vacío no viaja (no toca
 * el guardado).
 */
export function armarPayloadNomina(
  f: FormNominaEmisor,
  quitarTestSetId: boolean,
):
  | { ok: true; payload: ConfigurarNominaPayload }
  | { ok: false; error: string } {
  const softwareId = f.softwareId.trim()
  const pin = f.pin.trim()
  const testSetId = f.testSetId.trim()
  if (!esUuid(softwareId)) return { ok: false, error: "El SoftwareID debe ser un UUID." }
  if (!pin) return { ok: false, error: "Escribe el PIN del software de nómina." }
  if (!quitarTestSetId && testSetId && !esUuid(testSetId)) {
    return { ok: false, error: "El TestSetId debe ser un UUID." }
  }
  const payload: ConfigurarNominaPayload = { softwareId, pin }
  if (quitarTestSetId) payload.testSetId = null
  else if (testSetId) payload.testSetId = testSetId
  return { ok: true, payload }
}

export function mensajeErrorNomina(err: unknown): string {
  if (err instanceof ApiError && err.status === 503) {
    return "Falta la llave de cifrado en el servidor; avisa al soporte."
  }
  if (err instanceof ApiError && err.status === 403) {
    return "No tienes permiso para ver la configuración fiscal de esta sede."
  }
  if (err instanceof Error) return err.message
  return "Error desconocido"
}
