"use client"

import * as React from "react"
import Link from "next/link"
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
  const { hasPermission } = useAuth()
  if (!sede || !sinResponsabilidadFiscal(sede)) return null
  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        Aún no declaras tu responsabilidad fiscal; los impuestos se calculan
        como responsable de IVA/INC.{" "}
        {hasPermission("sede.manage") && (
          <Link
            href={`/panel/sedes/${sede._id}`}
            className="font-semibold underline underline-offset-2"
          >
            Declararla en la sede
          </Link>
        )}
      </p>
    </div>
  )
}

/** Variante del panel: no hay sede activa, se revisan las sedes del usuario. */
export function AvisoFiscalPanel() {
  const [sede, setSede] = React.useState<(SedeFiscal & { _id: string }) | null>(
    null,
  )
  React.useEffect(() => {
    let active = true
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
    return () => {
      active = false
    }
  }, [])
  return <AvisoFiscal sede={sede} />
}
