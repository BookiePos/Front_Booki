"use client"

import * as React from "react"
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react"

import {
  completarDevolucion,
  listDevolucionesPendientes,
  REFUND_METHOD_LABELS,
  type SaleReturn,
} from "@/lib/pos/api-sales"
import {
  CONCEPTO_REBAJA_LABELS,
  ESTADO_DEVOLUCION_LABELS,
  mensajeCompletar,
  textoPendiente,
} from "@/lib/pos/notas"
import { money, dateTime } from "@/lib/pos/format"
import { FormAlert } from "@/components/ui/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const POR_PAGINA = 20

/**
 * Bandeja de devoluciones y rebajas que quedaron a medias en la sede, de la más
 * vieja a la más nueva. Antes solo se veían abriendo el detalle de cada venta,
 * así que una que se cortó ayer se quedaba sin completar hasta que alguien
 * tropezaba con ella.
 *
 * Sin pendientes no pinta nada: es un aviso, no una sección fija. Solo se monta
 * para quien tiene `pos.refund` (el mismo permiso de registrar y completar) y
 * siempre con la sede del terminal, que es el alcance que el servidor valida.
 */
export function DevolucionesPendientes({
  sedeId,
  version,
  onChanged,
}: {
  sedeId: string
  /** Cambia cuando otra pantalla registró o completó algo y hay que releer. */
  version?: number
  onChanged?: () => void
}) {
  const [filas, setFilas] = React.useState<SaleReturn[]>([])
  const [total, setTotal] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [fallo, setFallo] = React.useState(false)
  const [completando, setCompletando] = React.useState<string | null>(null)
  const [cargandoMas, setCargandoMas] = React.useState(false)
  const [recarga, setRecarga] = React.useState(0)

  React.useEffect(() => {
    let vivo = true
    listDevolucionesPendientes({ sedeId, page: 1, limit: POR_PAGINA })
      .then((r) => {
        if (!vivo) return
        setFilas(r.items)
        setTotal(r.total)
        setFallo(false)
      })
      .catch(() => {
        if (!vivo) return
        setFilas([])
        setTotal(0)
        setFallo(true)
      })
    return () => {
      vivo = false
    }
  }, [sedeId, version, recarga])

  async function verMas() {
    setCargandoMas(true)
    setError(null)
    try {
      const siguiente = Math.floor(filas.length / POR_PAGINA) + 1
      const r = await listDevolucionesPendientes({ sedeId, page: siguiente, limit: POR_PAGINA })
      setTotal(r.total)
      setFilas((prev) => {
        const vistos = new Set(prev.map((f) => f._id))
        return [...prev, ...r.items.filter((f) => !vistos.has(f._id))]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
    } finally {
      setCargandoMas(false)
    }
  }

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

  if (fallo) {
    return (
      <FormAlert tone="warning" icon={TriangleAlert}>
        No se pudo consultar si hay devoluciones a medias.{" "}
        <button
          type="button"
          className="font-medium underline underline-offset-2"
          onClick={() => setRecarga((n) => n + 1)}
        >
          Reintentar
        </button>
      </FormAlert>
    )
  }
  if (filas.length === 0) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <section aria-labelledby="dev-pendientes-titulo" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
            <h2 id="dev-pendientes-titulo" className="font-display text-base">
              Devoluciones a medias
            </h2>
            <Badge variant="destructive">{total}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Se registraron pero algún paso no terminó. Complétalas para que el
            stock, la caja y el libro queden al día; van de la más vieja a la
            más nueva.
          </p>
          {error && <FormAlert>{error}</FormAlert>}
          <ul className="flex flex-col gap-2">
            {filas.map((r) => {
              const que = r.kind === "rebaja" ? "la rebaja" : "la devolución"
              return (
                <li
                  key={r._id}
                  className="flex flex-col gap-1.5 rounded-xl border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {r.kind === "rebaja"
                        ? `Rebaja${r.concepto ? ` · ${CONCEPTO_REBAJA_LABELS[r.concepto]}` : ""}`
                        : "Devolución"}{" "}
                      de {r.saleNumber}
                    </span>
                    <span className="stat-figure">{money(r.refundTotal)}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {REFUND_METHOD_LABELS[r.refundMethod] ?? r.refundMethod}
                    </Badge>
                    {r.estado && (
                      <Badge variant="destructive" className="text-[11px]">
                        {ESTADO_DEVOLUCION_LABELS[r.estado]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(r.createdAt)} · {r.userEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">{textoPendiente(r.estado)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={completando !== null}
                    aria-label={`Completar ${que} de ${r.saleNumber} por ${money(r.refundTotal)}`}
                    onClick={() => void completar(r)}
                  >
                    {completando === r._id ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                    Completar
                  </Button>
                </li>
              )
            })}
          </ul>
          {filas.length < total && (
            <Button
              variant="outline"
              size="sm"
              className="self-center"
              disabled={cargandoMas}
              onClick={() => void verMas()}
            >
              {cargandoMas ? "Cargando…" : `Ver más (${total - filas.length})`}
            </Button>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
