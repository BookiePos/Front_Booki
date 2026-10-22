"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Info } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes } from "@/lib/erp/api-inventory"
import {
  sinResponsabilidadFiscal,
  type SedeFiscal,
} from "@/lib/onboarding/registro-corto"

/**
 * Aviso del registro corto (ítem 6.5): mientras la sede no declare su
 * responsabilidad fiscal, los impuestos se calculan con el default
 * conservador. No bloquea nada; solo invita a declararla.
 */
export function AvisoFiscal({
  sede,
}: {
  sede?: (SedeFiscal & { _id: string }) | null
}) {
  const { hasPermission, isRestaurant } = useAuth()
  // Solo quien puede editar sedes ve el aviso (cajeros no).
  if (!hasPermission("sede.manage")) return null
  if (!sede || !sinResponsabilidadFiscal(sede)) return null
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        Aún no declaras tu responsabilidad fiscal; los impuestos se calculan
        como responsable de {isRestaurant ? "INC" : "IVA"}.{" "}
        <Link
            href={`/panel/sedes/${sede._id}`}
            className="font-semibold underline underline-offset-2"
          >
            Declararla en la sede
          </Link>
      </p>
    </div>
  )
}

/** Variante del panel: no hay sede activa, se revisan las sedes del usuario. */
export function AvisoFiscalPanel() {
  const { hasPermission } = useAuth()
  const puede = hasPermission("sede.manage")
  const pathname = usePathname()
  const [sede, setSede] = React.useState<(SedeFiscal & { _id: string }) | null>(
    null,
  )
  React.useEffect(() => {
    if (!puede) return
    let active = true
    const cargar = () => {
      listSedes()
        .then((all) => {
          if (!active) return
          setSede(
            all.find((s) => s.active && sinResponsabilidadFiscal(s)) ?? null,
          )
        })
        .catch(() => {
          /* sin permiso o sin red: el aviso es opcional */
        })
    }
    cargar()
    // Al declarar la responsabilidad el aviso se va sin recargar: se vuelve a
    // consultar al cambiar de ruta y al recuperar el foco o la visibilidad.
    const alVolver = () => {
      if (document.visibilityState === "visible") cargar()
    }
    window.addEventListener("focus", cargar)
    document.addEventListener("visibilitychange", alVolver)
    return () => {
      active = false
      window.removeEventListener("focus", cargar)
      document.removeEventListener("visibilitychange", alVolver)
    }
  }, [puede, pathname])
  return <AvisoFiscal sede={sede} />
}
