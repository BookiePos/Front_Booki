"use client"

import * as React from "react"
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react"

import {
  completarDevolucion,
  listSaleReturns,
  REFUND_METHOD_LABELS,
  type SaleReturn,
} from "@/lib/pos/api-sales"
import {
  CONCEPTO_REBAJA_LABELS,
  ESTADO_DEVOLUCION_LABELS,
  estaPendiente,
  mensajeCompletar,
  resumenNota,
  textoPendiente,
} from "@/lib/pos/notas"
import { money } from "@/lib/pos/format"
import { FormAlert, FormSection } from "@/components/ui/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Devoluciones y rebajas de una venta, con su nota fiscal. Las que quedaron a
 * medias (`en_curso`, `pendiente_caja`) llevan el botón «Completar»: retoma lo
 * que falta (stock, salida de caja, libro) sin repetir lo que ya se hizo.
 */
export function DevolucionesVenta({
  saleId,
  canComplete,
  version,
  onChanged,
}: {
  saleId: string
  /** `pos.refund`: el mismo permiso con que se registró la devolución. */
  canComplete: boolean
  /** Cambia cuando otra pantalla registró algo y hay que releer. */
  version?: number
  onChanged?: () => void
}) {
  const [filas, setFilas] = React.useState<SaleReturn[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [completando, setCompletando] = React.useState<string | null>(null)
  const [recarga, setRecarga] = React.useState(0)

  React.useEffect(() => {
    let vivo = true
    listSaleReturns(saleId)
      .then((rs) => vivo && setFilas(rs))
      .catch((err) => vivo && setError(err instanceof Error ? err.message : "Error inesperado"))
    return () => {
      vivo = false
    }
  }, [saleId, version, recarga])

  async function completar(r: SaleReturn) {
    setCompletando(r._id)
    setError(null)
    try {
      await completarDevolucion(r._id)
      setRecarga((n) => n + 1)
      onChanged?.()
    } catch (err) {
      setError(mensajeCompletar(err))
    } finally {
      setCompletando(null)
    }
  }

  if (filas === null && !error) return null
  if (filas && filas.length === 0 && !error) return null

  const pendientes = (filas ?? []).filter(estaPendiente)

  return (
    <FormSection title="Devoluciones y rebajas de esta venta" className="no-print">
      {error && <FormAlert>{error}</FormAlert>}
      {pendientes.length > 0 && (
        <FormAlert tone="warning" icon={TriangleAlert}>
          Hay {pendientes.length} operación(es) a medias. Complétalas para que
          el stock, la caja y el libro queden al día.
        </FormAlert>
      )}
      <ul className="flex flex-col gap-2">
        {(filas ?? []).map((r) => {
          const pendiente = estaPendiente(r)
          const nota = resumenNota(r.notaFiscal)
          return (
            <li
              key={r._id}
              className="flex flex-col gap-1.5 rounded-xl border border-border p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {r.kind === "rebaja"
                    ? `Rebaja · ${r.concepto ? CONCEPTO_REBAJA_LABELS[r.concepto] : ""}`
                    : "Devolución"}
                </span>
                <span className="stat-figure">{money(r.refundTotal)}</span>
                <Badge variant="outline" className="text-[11px]">
                  {REFUND_METHOD_LABELS[r.refundMethod] ?? r.refundMethod}
                </Badge>
                {r.estado && r.estado !== "completa" && (
                  <Badge variant="destructive" className="text-[11px]">
                    {ESTADO_DEVOLUCION_LABELS[r.estado]}
                  </Badge>
                )}
              </div>
              {nota && (
                <p className="text-xs text-muted-foreground">
                  {r.notaFiscal?.estado === "emitida" ? "Quedó la " : "Sin nota: "}
                  {nota}
                </p>
              )}
              {pendiente && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {textoPendiente(r.estado)}
                  </p>
                  {canComplete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start"
                      disabled={completando !== null}
                      onClick={() => void completar(r)}
                    >
                      {completando === r._id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RotateCcw />
                      )}
                      Completar
                    </Button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </FormSection>
  )
}
