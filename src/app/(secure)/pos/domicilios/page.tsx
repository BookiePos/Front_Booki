"use client"

import * as React from "react"
import {
  Bike,
  ShieldOff,
  Loader2,
  Check,
  X,
  Phone,
  MapPin,
  Wallet,
  TriangleAlert,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  listDeliveries,
  getCourierSettlement,
  updateDeliveryStatus,
  DELIVERY_STATUS_LABELS,
  DELIVERY_TRANSITIONS,
  type CourierSettlement,
  type DeliveryRow,
  type DeliveryStatus,
} from "@/lib/pos/api-delivery"
import { money, timeOnly } from "@/lib/pos/format"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { FormDialog, FormAlert } from "@/components/ui/form-dialog"
import { Segmented } from "@/components/ui/segmented"
import { cn } from "@/lib/utils"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

/** Color del estado. El que está en la calle tiene que saltar a la vista. */
const TONO: Record<DeliveryStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  en_camino: "bg-warning/15 text-warning-ink",
  entregado: "bg-success/15 text-success-ink",
  fallido: "bg-destructive/10 text-destructive",
}

type Filtro = "todos" | DeliveryStatus

/**
 * Domicilios del día: en qué va cada entrega y qué trae cada repartidor.
 *
 * Es una pantalla de turno, no de administración: se mira de pie, junto a la
 * caja, mientras entran pedidos. Por eso los botones de estado están en la
 * tarjeta y no dentro de una ficha que haya que abrir.
 *
 * Muestra solo el día en curso a propósito. Un domicilio que quedó "en camino"
 * hace tres semanas es un dato viejo que nadie va a resolver, y tenerlo arriba
 * escondería los de hoy, que son los que importan.
 */
export default function DomiciliosPage() {
  const { hasPermission } = useAuth()
  const canSell = hasPermission("pos.sell")
  const { sedeId, sede } = useSede()

  const [rows, setRows] = React.useState<DeliveryRow[]>([])
  const [cuadre, setCuadre] = React.useState<CourierSettlement[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<Filtro>("todos")
  const [guardando, setGuardando] = React.useState<string | null>(null)

  /** Domicilio que se está marcando como fallido (pide el motivo). */
  const [fallando, setFallando] = React.useState<DeliveryRow | null>(null)
  const [motivo, setMotivo] = React.useState("")

  const cargar = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [lista, liq] = await Promise.all([
        listDeliveries({ sedeId }),
        getCourierSettlement({ sedeId }),
      ])
      setRows(lista)
      setCuadre(liq)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    let vivo = true
    async function arrancar() {
      await Promise.resolve()
      if (!vivo || !sedeId || !canSell) return
      await cargar()
    }
    void arrancar()
    return () => {
      vivo = false
    }
  }, [sedeId, canSell, cargar])

  async function marcar(
    row: DeliveryRow,
    status: DeliveryStatus,
    failureReason?: string,
  ) {
    setGuardando(row.saleId)
    setError(null)
    try {
      await updateDeliveryStatus(row.saleId, { status, failureReason })
      await cargar()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGuardando(null)
    }
  }

  const visibles =
    filtro === "todos" ? rows : rows.filter((r) => r.status === filtro)

  const enCalle = rows.filter((r) => r.status === "en_camino").length
  const porSalir = rows.filter((r) => r.status === "pendiente").length

  if (!canSell) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldOff className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tienes permiso para ver los domicilios.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Domicilios de hoy</h1>
          <p className="text-sm text-muted-foreground">
            {sede?.name ?? "Sede"} · {porSalir} por salir · {enCalle} en la
            calle
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargar()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Actualizar
        </Button>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      {/* Cuadre arriba: es la pregunta del final del turno, y quien cierra la
          caja necesita verla sin bajar por toda la lista. */}
      {cuadre.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Qué trae cada repartidor
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {cuadre.map((c) => (
                <li
                  key={c.courier}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {c.courier}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.entregados} entregado(s)
                    {c.enCamino > 0 && ` · ${c.enCamino} en la calle`}
                    {c.fallidos > 0 && ` · ${c.fallidos} sin entregar`}
                  </span>
                  <Badge variant="secondary" className="tnum">
                    {money(c.efectivoRecaudado)} en efectivo
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Solo el efectivo de lo que ya entregó. Lo que se pagó con tarjeta
              nunca pasó por sus manos, y lo que no ha entregado todavía no lo
              ha cobrado.
            </p>
          </CardContent>
        </Card>
      )}

      <Segmented
        fill
        ariaLabel="Filtrar por estado"
        value={filtro}
        onValueChange={(v) => setFiltro(v as Filtro)}
        options={[
          { value: "todos", label: "Todos", badge: rows.length },
          { value: "pendiente", label: "Por salir", badge: porSalir },
          { value: "en_camino", label: "En camino", badge: enCalle },
          { value: "entregado", label: "Entregados" },
        ]}
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Bike className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Hoy no se ha registrado ningún domicilio."
                : "No hay domicilios en ese estado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((r) => {
            const siguientes = DELIVERY_TRANSITIONS[r.status]
            return (
              <li key={r.saleId}>
                <Card>
                  <CardContent className="flex flex-col gap-2.5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.saleNumber}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          TONO[r.status],
                        )}
                      >
                        {DELIVERY_STATUS_LABELS[r.status]}
                      </span>
                      {r.zoneName && (
                        <Badge variant="outline">{r.zoneName}</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeOnly(r.createdAt)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 text-sm">
                      <span className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {r.address}
                          {r.notes && (
                            <span className="block text-xs text-muted-foreground">
                              {r.notes}
                            </span>
                          )}
                        </span>
                      </span>
                      {r.phone && (
                        <a
                          href={`tel:${r.phone}`}
                          className="flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                        >
                          <Phone className="size-3.5 shrink-0" />
                          {r.phone}
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tnum">
                        Cobra <strong>{money(r.grandTotal)}</strong>
                        {r.paymentMethod !== "cash" && " (ya pagado)"}
                      </span>
                      {r.fee > 0 && <span>Domicilio {money(r.fee)}</span>}
                      {r.courier && <span>Lleva {r.courier}</span>}
                      {r.deliveredAt && (
                        <span>Entregado {timeOnly(r.deliveredAt)}</span>
                      )}
                    </div>

                    {r.failureReason && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {r.failureReason}
                      </p>
                    )}

                    {siguientes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {siguientes.map((s) =>
                          s === "fallido" ? (
                            <Button
                              key={s}
                              size="sm"
                              variant="outline"
                              disabled={guardando === r.saleId}
                              onClick={() => {
                                setFallando(r)
                                setMotivo("")
                              }}
                            >
                              <X />
                              No se pudo
                            </Button>
                          ) : (
                            <Button
                              key={s}
                              size="sm"
                              variant={s === "entregado" ? "default" : "outline"}
                              disabled={guardando === r.saleId}
                              onClick={() => void marcar(r, s)}
                            >
                              {guardando === r.saleId ? (
                                <Loader2 className="animate-spin" />
                              ) : s === "entregado" ? (
                                <Check />
                              ) : (
                                <Bike />
                              )}
                              {s === "en_camino" ? "Salió" : "Entregado"}
                            </Button>
                          ),
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {/* El motivo del fallido se pide, no se asume: sin él nadie puede saber
          si fue la dirección, el cliente o el repartidor. */}
      <FormDialog
        open={fallando !== null}
        onOpenChange={(v) => !v && setFallando(null)}
        size="md"
        icon={TriangleAlert}
        tone="destructive"
        title="¿Por qué no se pudo entregar?"
        description="Queda en el registro del pedido. Sin el motivo no hay nada que corregir."
        footer={
          <>
            <Button variant="outline" onClick={() => setFallando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!motivo.trim()}
              onClick={() => {
                if (!fallando) return
                const row = fallando
                setFallando(null)
                void marcar(row, "fallido", motivo.trim())
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dom-motivo">Motivo</Label>
          <Input
            id="dom-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Nadie contestó · dirección equivocada · el cliente lo rechazó"
            autoFocus
          />
        </div>
      </FormDialog>
    </div>
  )
}
