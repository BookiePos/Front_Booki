"use client"

import { usePathname } from "next/navigation"

import type { PlanFeature } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { PlanUpsell } from "@/components/erp/plan-upsell"

/**
 * Prefijo de ruta → capacidad de plan que exige. El bloqueo por URL evita que
 * un usuario llegue a una página fuera de plan tecleando la ruta a mano (la
 * navegación ya la oculta, pero eso no basta).
 *
 * `/panel/clientes/directorio` es base (sin feature) aunque cuelgue de
 * `/panel/clientes`, que sí exige `accounting`; se resuelve tomando el prefijo
 * MÁS LARGO que matchee, y ese prefijo base gana sobre el genérico.
 */
const ROUTE_FEATURE: Record<string, PlanFeature | null> = {
  "/panel/clientes/directorio": null, // base: siempre permitido
  "/panel/compras": "purchasing",
  "/panel/proveedores": "purchasing",
  "/panel/finanzas/gastos": "expenses",
  "/panel/finanzas/flujo": "expenses",
  "/panel/finanzas/bancos": "accounting",
  "/panel/finanzas/cxp": "accounting",
  "/panel/finanzas/pl": "accounting",
  "/panel/finanzas/metas": "accounting",
  "/panel/clientes": "accounting",
  "/panel/impuestos": "accounting",
  "/panel/auditoria": "audit",
  "/panel/nomina": "payroll",
  "/panel/restaurante": "restaurant",
}

/** Prefijos ordenados de más específico (largo) a más genérico (corto). */
const ROUTE_PREFIXES = Object.keys(ROUTE_FEATURE).sort(
  (a, b) => b.length - a.length,
)

/** Resuelve la capacidad que exige un pathname, o null si es base/desconocido. */
function featureForPath(pathname: string): PlanFeature | null {
  for (const prefix of ROUTE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return ROUTE_FEATURE[prefix]
    }
  }
  return null
}

/**
 * Envuelve el contenido del panel: si la ruta actual exige una capacidad que el
 * plan no incluye, muestra el upsell en vez de la página. Mientras la sesión
 * carga, `hasFeature` es fail-open (devuelve true) y no bloquea.
 */
export function FeatureGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hasFeature } = useAuth()

  const feature = featureForPath(pathname ?? "")
  if (feature && !hasFeature(feature)) {
    return <PlanUpsell feature={feature} />
  }
  return <>{children}</>
}
