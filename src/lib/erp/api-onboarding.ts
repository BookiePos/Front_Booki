/** Cliente HTTP de las plantillas de arranque (ítem 6.6). Base `/onboarding`. */
import { authFetch, parseResponse } from "@/lib/api-admin"

export interface ResumenPlantilla {
  tipo: string
  nombre: string
  descripcion: string
  productos: number
  categorias: number
  mesas: number
  ejemplos: string[]
  cargados: number
}

export interface EstadoOnboarding {
  tipoNegocio: "restaurante" | "retail" | null
  /** Productos que la empresa ya tiene y no vienen de una plantilla. */
  productosPropios: number
  plantillas: ResumenPlantilla[]
}

export interface ResultadoPlantilla {
  tipo: string
  sedeId: string
  categorias: { creadas: number; existentes: number }
  productos: { creados: number; omitidos: number }
  mesas: { creadas: number; omitidas: number }
  impuestos: { conInc: number; conIva: number; excluidos: number }
  stockInicial: number
}

export async function getEstadoOnboarding(): Promise<EstadoOnboarding> {
  const res = await authFetch("/onboarding/plantillas")
  return parseResponse<EstadoOnboarding>(res)
}

export async function aplicarPlantilla(payload: {
  tipo: string
  sedeId?: string
  confirmar?: boolean
}): Promise<ResultadoPlantilla> {
  const res = await authFetch("/onboarding/plantilla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return parseResponse<ResultadoPlantilla>(res)
}
