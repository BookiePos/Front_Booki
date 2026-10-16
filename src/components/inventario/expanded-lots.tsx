"use client"

import * as React from "react"
import { getLots, type StockRow, type InvLot } from "@/lib/erp/api-inventory"
import { unidadCorta } from "@/lib/erp/unidades"
import {
  nf,
  formatUnitCost,
  df,
  dfUTC,
  errorMessage,
} from "@/components/inventario/helpers"
import { ExpiryBadge, FormError } from "@/components/inventario/ui-comunes"

// ─── Lotes de una existencia (dentro del panel desplegable) ──────────────────

/** Carga y muestra los lotes de la existencia expandida (orden FEFO). */
export function ExpandedLots({ row }: { row: StockRow }) {
  const [lots, setLots] = React.useState<InvLot[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Dependencias primitivas: el objeto row se recrea en cada refresco de
  // stock y dispararía refetches innecesarios si se usara directamente.
  const productId = row.product._id
  const sedeId = row.sede._id
  const trackLots = row.product.trackLots

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!trackLots) return
      setLots([])
      setLoading(true)
      setError(null)
      try {
        const data = await getLots(productId, sedeId)
        if (!cancelled) setLots(data)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId, sedeId, trackLots])

  if (!row.product.trackLots) {
    return <p className="text-sm text-muted-foreground">Sin lotes</p>
  }
  if (loading) {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Cargando lotes…
      </p>
    )
  }
  if (error) {
    return <FormError error={error} />
  }
  if (lots.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin lotes</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Lotes (FEFO)</p>
      <ul className="flex flex-col gap-1">
        {lots.map((lot) => (
          <li
            key={lot._id}
            className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm"
          >
            <span className="font-mono text-xs">{lot.lotCode}</span>
            <span>
              <span className="text-muted-foreground">Ingreso: </span>
              {df.format(new Date(lot.receivedAt))}
            </span>
            <span>
              <span className="text-muted-foreground">Proveedor: </span>
              {lot.supplier || row.product.supplier || "—"}
            </span>
            <span>
              <span className="text-muted-foreground">Stock: </span>
              {nf.format(lot.qty)}{" "}
              <span className="text-muted-foreground">
                {unidadCorta(row.product.unit)}
              </span>
            </span>
            {row.product.itemType !== "assembly" && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Vence:</span>
                {lot.expiresAt ? (
                  <>
                    {dfUTC.format(new Date(lot.expiresAt))}
                    <ExpiryBadge date={lot.expiresAt} />
                  </>
                ) : (
                  "—"
                )}
              </span>
            )}
            <span>
              <span className="text-muted-foreground">Costo: </span>
              {formatUnitCost(lot.unitCost, row.product)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
