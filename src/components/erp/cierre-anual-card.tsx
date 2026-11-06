"use client"

import * as React from "react"
import { CalendarCheck, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"

import { actorSeesAllSedes } from "@/lib/access"
import { useAuth } from "@/lib/auth-context"
import { cerrarAnio, getCierres, reabrirAnio, type EstadoAnio } from "@/lib/erp/api-reports"
import { errorMessage, fmtDate, money } from "@/lib/erp/finance-format"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLoadEffect } from "@/hooks/use-load-effect"

/**
 * Cierre anual MANUAL (R4 de la revisión contable 1.16; el dueño eligió manual).
 *
 * Cerrar un año lleva sus ingresos y gastos a la 3605 el 31 de diciembre y,
 * el 1 de enero, la 3605 a la 3705 «Resultados de ejercicios anteriores».
 * Reabrir reversa los dos asientos. Es de toda la empresa: quien está limitado
 * por sede recibe 403 del API y aquí lo ve explicado.
 */
/** Cerrado sin traslado, con un resultado que trasladar (un año en 0 no lleva). */
function faltaTraslado(a: EstadoAnio): boolean {
  return a.cerrado && !!a.cierre && !a.cierre.trasladoNumber && a.resultado !== 0
}

export function CierreAnualCard() {
  const { hasPermission, user } = useAuth()
  // El API niega el cierre a quien está limitado por sede (cancela los
  // resultados de toda la empresa): a ese usuario no se le muestra la tarjeta.
  const veTodas = user ? actorSeesAllSedes(user) : false
  const canView = hasPermission("finance.view") && veTodas
  const canManage = hasPermission("finance.manage")
  const confirm = useConfirm()

  const [anios, setAnios] = React.useState<EstadoAnio[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setError(null)
    try {
      setAnios(await getCierres())
    } catch (err) {
      setError(errorMessage(err))
      setAnios([])
    }
  }, [])

  useLoadEffect(load, canView)

  if (!canView) return null

  // El primer año abierto que se podría reabrir: solo el último cerrado.
  const ultimoCerrado = anios
    ? [...anios].reverse().find((a) => a.cerrado)?.anio
    : undefined

  async function cerrar(a: EstadoAnio) {
    const ok = await confirm({
      title: `¿Cerrar el año ${a.anio}?`,
      description: (
        <>
          Se registra un asiento al 31 de diciembre que lleva los ingresos y
          gastos de {a.anio} ({a.resultado >= 0 ? "utilidad" : "pérdida"} de{" "}
          {money.format(Math.abs(a.resultado))}) a la cuenta 3605, y otro el 1 de
          enero que la pasa a la 3705 «Resultados de ejercicios anteriores».
          Después no se podrán registrar asientos manuales con fecha de{" "}
          {a.anio}. Si hace falta corregir algo, puedes reabrirlo.
        </>
      ),
      confirmLabel: `Cerrar ${a.anio}`,
    })
    if (!ok) return
    setBusy(a.anio)
    try {
      await cerrarAnio(a.anio)
      toast.success(`Año ${a.anio} cerrado`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  /**
   * El cierre quedó posteado pero el traslado a la 3705 no (falla entre los
   * dos asientos). El mismo POST de cerrar lo completa: el backend ve el
   * cierre existente y solo postea lo que falta.
   */
  async function completarTraslado(a: EstadoAnio) {
    setBusy(a.anio)
    try {
      await cerrarAnio(a.anio)
      toast.success(`Traslado de ${a.anio} a la 3705 registrado`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function reabrir(a: EstadoAnio) {
    const ok = await confirm({
      title: `¿Reabrir el año ${a.anio}?`,
      description: (
        <>
          Se reversan el traslado a la 3705 y el asiento de cierre, cada uno con
          su propia fecha. Los ingresos y gastos de {a.anio} vuelven a quedar
          abiertos y el año vuelve a aceptar asientos. Tendrás que cerrarlo de
          nuevo cuando termines los ajustes.
        </>
      ),
      confirmLabel: `Reabrir ${a.anio}`,
      destructive: true,
    })
    if (!ok) return
    setBusy(a.anio)
    try {
      await reabrirAnio(a.anio)
      toast.success(`Año ${a.anio} reabierto`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardContent className="px-0 sm:px-2">
        <div className="flex items-start gap-2 px-4 pt-3">
          <CalendarCheck className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Cierre anual</p>
            <p className="text-xs text-muted-foreground">
              Cierra cada año ya terminado, en orden, cuando el contador lo dé por
              bueno. {canManage ? "" : "Cerrar o reabrir requiere el permiso finance.manage."}
            </p>
          </div>
        </div>
        {anios === null ? (
          <Skeleton className="m-4 h-24" />
        ) : error ? (
          <p className="px-4 py-4 text-sm text-destructive">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    El libro todavía no tiene asientos.
                  </TableCell>
                </TableRow>
              )}
              {anios.map((a) => (
                <TableRow key={a.anio}>
                  <TableCell className="font-medium">{a.anio}</TableCell>
                  <TableCell>
                    {a.cerrado ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="default" className="w-fit">Cerrado</Badge>
                        {a.cierre && (
                          <span className="text-xs text-muted-foreground">
                            {a.cierre.number} del {fmtDate(a.cierre.date)}
                            {a.cierre.trasladoNumber
                              ? ` · traslado ${a.cierre.trasladoNumber}`
                              : ""}
                            {a.cierre.createdByEmail ? ` · ${a.cierre.createdByEmail}` : ""}
                          </span>
                        )}
                        {faltaTraslado(a) && (
                          <span className="text-xs text-destructive">
                            Falta el traslado a la 3705: el cierre quedó a medias.
                          </span>
                        )}
                        {a.saldoPosteriorAlCierre > 0 && (
                          <span className="text-xs text-destructive">
                            Entraron movimientos después del cierre: reábrelo y ciérralo de nuevo.
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline">Abierto</Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`tnum text-right font-medium ${a.resultado >= 0 ? "text-success-ink" : "text-destructive"}`}
                  >
                    {money.format(a.resultado)}
                  </TableCell>
                  <TableCell className="text-right">
                    {faltaTraslado(a) ? (
                      <Button
                        size="sm"
                        disabled={!canManage || busy !== null}
                        onClick={() => void completarTraslado(a)}
                      >
                        <Lock className="size-4" />
                        Completar traslado
                      </Button>
                    ) : a.cerrado ? (
                      a.anio === ultimoCerrado && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canManage || busy !== null}
                          onClick={() => void reabrir(a)}
                        >
                          <LockOpen className="size-4" />
                          Reabrir
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        disabled={!canManage || !a.puedeCerrar || busy !== null}
                        title={a.puedeCerrar ? undefined : "Solo se cierra un año terminado, después de cerrar los anteriores"}
                        onClick={() => void cerrar(a)}
                      >
                        <Lock className="size-4" />
                        Cerrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
