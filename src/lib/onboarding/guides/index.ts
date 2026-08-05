import { sedeGuide } from "./core"
import { guidesA } from "./registry-a"
import { guidesB } from "./registry-b"
import { guidesPos } from "./registry-pos"
import type { GuideDescriptor } from "./types"

export type { GuideDescriptor, TourStep } from "./types"
export { buildProductSteps } from "./core"

/**
 * Registro completo de recorridos por sección. El orden importa para el
 * emparejamiento por ruta: los descriptores más específicos deben ir primero
 * (cada registro ya se ordena internamente).
 */
export const GUIDES: GuideDescriptor[] = [
  sedeGuide,
  ...guidesA,
  ...guidesB,
  ...guidesPos,
]

/** Devuelve el recorrido por su id (o undefined). */
export function guideById(id: string): GuideDescriptor | undefined {
  return GUIDES.find((g) => g.id === id)
}

/** Devuelve el recorrido cuyo `match` coincide con la ruta (o undefined). */
export function guideForPath(pathname: string): GuideDescriptor | undefined {
  return GUIDES.find((g) => g.match.test(pathname))
}
