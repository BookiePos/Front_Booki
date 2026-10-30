import { authFetch, parseResponse } from "@/lib/api-admin"
import { tarifaBolsaVigente } from "@/lib/pos/inc-bolsas"

/** Fecha de hoy en Colombia (`YYYY-MM-DD`), la que usa el servidor para la tarifa. */
export function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

/**
 * Tarifa del INC de bolsas vigente hoy, desde `/taxes`. `null` si no se pudo
 * leer (sin red o sin permiso sobre `/taxes`): el POS no sabe entonces si hay
 * que sumarla, y el cobro sin conexión de una bolsa se rechaza en vez de
 * adivinar.
 */
export async function leerTarifaBolsa(): Promise<number | null> {
  try {
    const res = await authFetch("/taxes")
    const impuestos = await parseResponse<
      { code: string; active: boolean; history: { rate: number; effectiveFrom: string }[] }[]
    >(res)
    return tarifaBolsaVigente(impuestos, hoyColombia())
  } catch {
    return null
  }
}
