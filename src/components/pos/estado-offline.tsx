"use client"

// Cliente: estado del Sheet, handlers de reintento y bandeja del servidor.
import * as React from "react"
import { CloudOff, RefreshCw, TriangleAlert, Wifi } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { MOTIVO_LABEL, type MotivoConflicto } from "@/lib/offline/cola"
import {
  enviarVentaOffline,
  listarConflictosServidor,
  listarFaltantes,
  regularizarFaltantes,
  type ConflictoServidor,
  type FaltanteServidor,
} from "@/lib/pos/api-offline"
import { money } from "@/lib/pos/format"
import type { ModoOffline } from "@/hooks/use-modo-offline"

/** Conflictos que quien autoriza anulaciones puede registrar con lo cobrado. */
const CON_SALIDA: MotivoConflicto[] = ["TOTAL_DISTINTO", "SIN_STOCK", "PRODUCTO_INACTIVO"]

/** Permiso del servidor para registrar con lo cobrado y ver su bandeja. */
const PERMISO_AUTORIZAR = "pos.void.authorize"

const AVISO_TURNO_CERRADO = {
  title: "Registrar en el turno abierto",
  description:
    "Esta venta se cobró en un turno que ya se cerró: su efectivo pudo quedar contado en ese arqueo (como sobrante). Al registrarla aquí entra al turno abierto y el turno queda con una nota de que el efectivo es de un turno cerrado. Revisa el arqueo anterior antes de cerrar este.",
  confirmLabel: "Registrar en el turno abierto",
}

const AVISO_CON_LO_COBRADO = {
  title: "Registrar con lo cobrado",
  description:
    "La venta se registra con el precio que salió en el comprobante, aunque hoy el producto valga otra cosa, esté inactivo o falte en el inventario registrado. Lo que falte de stock queda anotado en la venta para regularizarlo con un ajuste.",
  confirmLabel: "Registrar con lo cobrado",
}

function fechaCorta(iso: string | null | undefined): string {
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
export function EstadoOffline({ modo, sedeId }: { modo: ModoOffline; sedeId: string }) {
  const { hasPermission } = useAuth()
  const confirm = useConfirm()
  const [abierta, setAbierta] = React.useState(false)
  const [ocupado, setOcupado] = React.useState<string | null>(null)
  const [servidor, setServidor] = React.useState<ConflictoServidor[]>([])
  const [errorServidor, setErrorServidor] = React.useState<string | null>(null)
  const [faltantes, setFaltantes] = React.useState<FaltanteServidor[]>([])
  const [avisoFaltante, setAvisoFaltante] = React.useState<string | null>(null)
  const puedeAutorizar = hasPermission(PERMISO_AUTORIZAR)
  const n = modo.pendientes.length
  const c = modo.conflictos.length

  // La bandeja del servidor (ventas de cualquier terminal de la sede) la ve
  // quien autoriza anulaciones, al abrir el panel y con red.
  const cargarServidor = React.useCallback(async () => {
    if (!puedeAutorizar || !sedeId || !modo.online) return
    try {
      const propias = new Set(modo.conflictos.map((v) => v.offlineId))
      const [todas, pendientes] = await Promise.all([
        listarConflictosServidor(sedeId),
        listarFaltantes(sedeId),
      ])
      setServidor(todas.filter((x) => !propias.has(x._id)))
      setFaltantes(pendientes)
      setErrorServidor(null)
    } catch {
      setErrorServidor("No se pudo traer la bandeja del servidor.")
    }
  }, [puedeAutorizar, sedeId, modo.online, modo.conflictos])

  React.useEffect(() => {
    if (!abierta) return
    let vivo = true
    void Promise.resolve().then(() => {
      if (vivo) void cargarServidor()
    })
    return () => {
      vivo = false
    }
  }, [abierta, cargarServidor])

  async function correr(id: string, fn: () => Promise<void>) {
    setOcupado(id)
    try {
      await fn()
    } finally {
      setOcupado(null)
    }
  }

  async function registrarEnTurnoAbierto(offlineId: string) {
    if (!(await confirm(AVISO_TURNO_CERRADO))) return
    await correr(offlineId, () => modo.reintentar(offlineId, { useOpenShift: true }))
  }

  async function registrarConLoCobrado(offlineId: string) {
    if (!(await confirm(AVISO_CON_LO_COBRADO))) return
    await correr(offlineId, () => modo.reintentar(offlineId, { override: true }))
  }

  async function registrarDelServidor(x: ConflictoServidor) {
    if (!(await confirm(AVISO_CON_LO_COBRADO))) return
    await correr(x._id, async () => {
      try {
        await enviarVentaOffline({ ...x.payload, override: true })
      } catch {
        /* sigue en la bandeja con su motivo; se recarga abajo */
      }
      await cargarServidor()
    })
  }

  async function regularizar(f: FaltanteServidor) {
    await correr(f.saleId, async () => {
      try {
        const r = await regularizarFaltantes(f.saleId)
        setAvisoFaltante(
          `${f.saleNumber}: faltante regularizado (estimado ${money(r.estimado)}, real ${money(r.real)}).`,
        )
      } catch (err) {
        setAvisoFaltante(err instanceof Error ? err.message : "No se pudo regularizar.")
      }
      await cargarServidor()
    })
  }

  const tono = !modo.online
    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
    : c > 0
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground"

  return (
    <>
      {/* El estado se anuncia al cambiar (sin conexión, pendientes): el texto
          visible es el nombre del botón, sin aria-label que lo tape. */}
      <div role="status" aria-live="polite" className="inline-flex">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tono}`}
        >
          {modo.online ? (
            <Wifi className="size-3.5" aria-hidden="true" />
          ) : (
            <CloudOff className="size-3.5" aria-hidden="true" />
          )}
          <span>
            {modo.online ? "En línea" : "Sin conexión"}
            {n > 0 && ` · ${n} ${n === 1 ? "venta pendiente" : "ventas pendientes"}`}
            {c > 0 && ` · ${c} con conflicto`}
          </span>
          <span className="hidden opacity-70 sm:inline">
            · sincronizado {fechaCorta(modo.ultimaSync)}
          </span>
        </button>
      </div>

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
              <RefreshCw className="size-4" aria-hidden="true" />
              Sincronizar ahora ({n})
            </Button>

            {modo.reemplazadas.length > 0 && (
              <section className="space-y-2" aria-labelledby="offline-reemplazadas">
                <h3 id="offline-reemplazadas" className="text-sm font-semibold">
                  Ya estaban registradas
                </h3>
                <p className="text-xs text-muted-foreground">
                  El cobro en línea sí llegó antes de caerse la red: la venta de
                  verdad tiene otro número. Usa ese si el cliente pide el comprobante.
                </p>
                <ul className="space-y-1 text-sm">
                  {modo.reemplazadas.map((x) => (
                    <li key={x.offlineId}>
                      {x.offline} → <span className="font-semibold">{x.real}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c === 0 && n === 0 && servidor.length === 0 && faltantes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay ventas pendientes ni conflictos.
              </p>
            )}

            {n > 0 && (
              <section className="space-y-2" aria-labelledby="offline-pendientes">
                <h3 id="offline-pendientes" className="text-sm font-semibold">
                  Pendientes de enviar
                </h3>
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
              <section className="space-y-2" aria-labelledby="offline-conflictos">
                <h3
                  id="offline-conflictos"
                  className="flex items-center gap-1.5 text-sm font-semibold text-destructive"
                >
                  <TriangleAlert className="size-4" aria-hidden="true" /> Con conflicto
                </h3>
                <p className="text-xs text-muted-foreground">
                  Estas ventas se cobraron pero el servidor no pudo registrarlas.
                  No se borran: corrige el motivo y reintenta.
                  {!puedeAutorizar &&
                    " Las de precio, stock o producto inactivo las puede registrar con lo cobrado quien autoriza anulaciones, desde su bandeja."}
                </p>
                {modo.conflictos.map((v) => (
                  <div
                    key={v.offlineId}
                    className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"
                  >
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
                          onClick={() => void registrarEnTurnoAbierto(v.offlineId)}
                        >
                          Registrar en el turno abierto
                        </Button>
                      )}
                      {puedeAutorizar && v.motivo && CON_SALIDA.includes(v.motivo.reason) && (
                        <Button
                          size="sm"
                          disabled={!modo.online || ocupado !== null}
                          onClick={() => void registrarConLoCobrado(v.offlineId)}
                        >
                          Registrar con lo cobrado
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {puedeAutorizar && (servidor.length > 0 || errorServidor) && (
              <section className="space-y-2" aria-labelledby="offline-servidor">
                <h3 id="offline-servidor" className="text-sm font-semibold">
                  Bandeja de la sede (otros terminales)
                </h3>
                {errorServidor && (
                  <p className="text-xs text-destructive">{errorServidor}</p>
                )}
                {servidor.map((x) => (
                  <div key={x._id} className="space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{x.saleNumber}</span>
                      <span>{money(x.expectedGrandTotal ?? 0)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta(x.soldAt)} · {x.userEmail ?? "sin usuario"}
                    </p>
                    <p className="text-xs">
                      <span className="font-semibold">
                        {MOTIVO_LABEL[x.reason] ?? x.reason}:
                      </span>{" "}
                      {x.message}
                    </p>
                    {CON_SALIDA.includes(x.reason) && (
                      <Button
                        size="sm"
                        disabled={!modo.online || ocupado !== null}
                        onClick={() => void registrarDelServidor(x)}
                      >
                        Registrar con lo cobrado
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            )}
            {puedeAutorizar && faltantes.length > 0 && (
              <section className="space-y-2" aria-labelledby="offline-faltantes">
                <h3 id="offline-faltantes" className="text-sm font-semibold">
                  Faltantes de stock por regularizar
                </h3>
                <p className="text-xs text-muted-foreground">
                  Se vendieron sin estar en el inventario registrado y se costearon
                  al último costo. Registra la compra o el ajuste que trae ese stock
                  y regulariza: se saca del inventario con su costo real.
                </p>
                {avisoFaltante && (
                  <p role="status" className="text-xs">
                    {avisoFaltante}
                  </p>
                )}
                {faltantes.map((f) => (
                  <div key={f.saleId} className="space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{f.saleNumber}</span>
                      <span>{money(f.faltantes.reduce((s, x) => s + x.cost, 0))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.faltantes.map((x) => `${x.qty} und`).join(", ")} · {f.cashierEmail ?? ""}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!modo.online || ocupado !== null}
                      onClick={() => void regularizar(f)}
                    >
                      Regularizar
                    </Button>
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
