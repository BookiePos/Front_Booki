import { authFetch, parseResponse } from "@/lib/api-admin"

/** Fecha de hoy en Colombia (`YYYY-MM-DD`), la que usa el servidor para la tarifa. */
export function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

/** Respuesta de `GET /taxes/inc-bolsas/vigente` (permiso `pos.sell` o `tax.manage`). */
export interface IncBolsasVigente {
  activo: boolean
  tarifa: number
  vigenteDesde: string | null
}

/** Tarifa a partir de la respuesta: inactivo o sin vigencia es 0. */
export function tarifaDeRespuesta(r: IncBolsasVigente): number {
  return r.activo ? Math.round(r.tarifa || 0) : 0
}

/**
 * Tarifa del INC de bolsas vigente hoy. `null` si no se pudo leer (sin red,
 * 4xx o 5xx): el POS no sabe entonces si hay que sumarla y bloquea el cobro con
 * bolsa en vez de sumar 0. Aislada aquí para cambiarle la ruta fácil.
 */
export async function leerTarifaBolsa(): Promise<number | null> {
  try {
    const res = await authFetch(
      `/taxes/inc-bolsas/vigente?fecha=${encodeURIComponent(hoyColombia())}`,
    )
    return tarifaDeRespuesta(await parseResponse<IncBolsasVigente>(res))
  } catch {
    return null
  }
}
