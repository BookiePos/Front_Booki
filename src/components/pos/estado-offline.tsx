"use client"

// Cliente: estado del Sheet y handlers de reintento.
import * as React from "react"
import { CloudOff, RefreshCw, TriangleAlert, Wifi } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MOTIVO_LABEL } from "@/lib/offline/cola"
import { money } from "@/lib/pos/format"
import type { ModoOffline } from "@/hooks/use-modo-offline"

function fechaCorta(iso: string | null): string {
  if (!iso) return "nunca"
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Indicador «sin conexión · N ventas pendientes» y bandeja de conflictos del
 * modo offline (ítem 6.3). Con red y sin nada pendiente no ocupa espacio:
 * solo muestra la fecha de la última sincronización en pequeño.
 */
export function EstadoOffline({ modo }: { modo: ModoOffline }) {
  const [abierta, setAbierta] = React.useState(false)
  const [ocupado, setOcupado] = React.useState<string | null>(null)
  const n = modo.pendientes.length
  const c = modo.conflictos.length

  async function correr(id: string, fn: () => Promise<void>) {
    setOcupado(id)
    try {
      await fn()
    } finally {
      setOcupado(null)
    }
  }

  const tono = !modo.online
    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    : c > 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground"

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tono}`}
        aria-label="Estado de conexión y ventas pendientes"
      >
        {modo.online ? <Wifi className="size-3.5" /> : <CloudOff className="size-3.5" />}
        <span>
          {modo.online ? "En línea" : "Sin conexión"}
          {n > 0 && ` · ${n} ${n === 1 ? "venta pendiente" : "ventas pendientes"}`}
          {c > 0 && ` · ${c} con conflicto`}
        </span>
        <span className="hidden opacity-70 sm:inline">
          · sincronizado {fechaCorta(modo.ultimaSync)}
        </span>
      </button>

      <Sheet open={abierta} onOpenChange={setAbierta}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ventas sin conexión</SheetTitle>
            <SheetDescription>
              Catálogo sincronizado {fechaCorta(modo.ultimaSync)}. Quedan{" "}
              {modo.numerosLibres} consecutivos reservados para cobrar en efectivo
              sin internet.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            <Button
              variant="outline"
              size="sm"
              disabled={!modo.online || ocupado !== null || n === 0}
              onClick={() => void correr("todo", modo.sincronizarYa)}
            >
              <RefreshCw className="size-4" />
              Sincronizar ahora ({n})
            </Button>

            {c === 0 && n === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay ventas pendientes ni conflictos.
              </p>
            )}

            {n > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Pendientes de enviar</h3>
                {modo.pendientes.map((v) => (
                  <div key={v.offlineId} className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{v.saleNumber}</span>
                      <span>{money(v.expectedGrandTotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fechaCorta(v.soldAt)}</p>
                  </div>
                ))}
              </section>
            )}

            {c > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                  <TriangleAlert className="size-4" /> Con conflicto
                </h3>
                <p className="text-xs text-muted-foreground">
                  Estas ventas se cobraron pero el servidor no pudo registrarlas.
                  No se borran: corrige el motivo y reintenta.
                </p>
                {modo.conflictos.map((v) => (
                  <div key={v.offlineId} className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{v.saleNumber}</span>
                      <span>{money(v.expectedGrandTotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(v.soldAt)} ·{" "}
                      {v.lineas.map((l) => `${l.qty} × ${l.name}`).join(", ")}
                    </p>
                    {v.motivo && (
                      <p className="text-xs">
                        <span className="font-semibold">{MOTIVO_LABEL[v.motivo.reason]}:</span>{" "}
                        {v.motivo.message}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!modo.online || ocupado !== null}
                        onClick={() => void correr(v.offlineId, () => modo.reintentar(v.offlineId))}
                      >
                        Reintentar
                      </Button>
                      {v.motivo?.reason === "TURNO_CERRADO" && (
                        <Button
                          size="sm"
                          disabled={!modo.online || ocupado !== null}
                          onClick={() =>
                            void correr(v.offlineId, () =>
                              modo.reintentar(v.offlineId, { useOpenShift: true }),
                            )
                          }
                        >
                          Registrar en el turno abierto
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
