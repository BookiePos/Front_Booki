"use client"

import * as React from "react"
import { Loader2, ShieldOff, TriangleAlert } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { getReporteSaldosFavor, type ReporteSaldosFavor } from "@/lib/erp/api-notas"
import { limitadoPorSede } from "@/lib/pos/notas"
import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FormAlert } from "@/components/ui/form-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function Sin({ texto }: { texto: string }) {
  return (
    <>
      <PageHeader section="Finanzas" title="Saldos a favor" />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldOff className="size-10 text-muted-foreground" />
          <p className="font-display text-lg text-foreground">Sin acceso</p>
          <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>
        </CardContent>
      </Card>
    </>
  )
}

export default function SaldosFavorPage() {
  const { hasPermission, user } = useAuth()
  const canView = hasPermission("finance.view")
  // El saldo a favor es de toda la empresa: el cliente lo gasta en cualquier
  // sede. A quien está limitado a unas sedes el servidor le responde 403, así
  // que ni se le pregunta.
  const limitado = limitadoPorSede(user)
  const [reporte, setReporte] = React.useState<ReporteSaldosFavor | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    async function leer() {
      await Promise.resolve()
      if (!vivo || !canView || limitado) return
      try {
        const r = await getReporteSaldosFavor()
        if (vivo) setReporte(r)
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : "Error inesperado")
      }
    }
    void leer()
    return () => {
      vivo = false
    }
  }, [canView, limitado])

  if (!canView) return <Sin texto="No tienes permiso para ver las finanzas." />
  if (limitado) {
    return (
      <Sin texto="El saldo a favor es de toda la empresa, no de una sede. Este reporte está disponible para quien ve todas las sedes." />
    )
  }

  const hayDescuadre =
    reporte !== null &&
    (reporte.filas.some((f) => f.descuadre !== 0) ||
      (reporte.diferenciaLibro ?? 0) !== 0)

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Saldos a favor"
        description="Lo que cada cliente tiene a favor por devoluciones, rebajas y descuentos, y que puede gastar en cualquier sede (cuenta 2805)."
      />
      {error && <FormAlert>{error}</FormAlert>}
      {!reporte && !error && (
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      )}
      {reporte && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="stat-figure text-xl">{money.format(reporte.totalClientes)}</p>
                <p className="text-xs text-muted-foreground">A favor de los clientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="stat-figure text-xl">{money.format(reporte.sinTercero)}</p>
                <p className="text-xs text-muted-foreground">Sin cliente asignado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="stat-figure text-xl">
                  {reporte.libro2805 === undefined ? "—" : money.format(reporte.libro2805)}
                </p>
                <p className="text-xs text-muted-foreground">Mayor de la 2805</p>
              </CardContent>
            </Card>
          </div>

          {hayDescuadre && (
            <FormAlert tone="warning" icon={TriangleAlert}>
              Hay diferencias entre el saldo, el auxiliar y el libro
              {reporte.diferenciaLibro
                ? ` (el libro difiere en ${money.format(reporte.diferenciaLibro)})`
                : ""}
              . Un paso quedó a medias: revísalo antes de cerrar el periodo.
            </FormAlert>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Según el auxiliar</TableHead>
                      <TableHead className="text-right">Descuadre</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.filas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          Ningún cliente tiene saldo a favor.
                        </TableCell>
                      </TableRow>
                    )}
                    {reporte.filas.map((f) => (
                      <TableRow key={f.customerId}>
                        <TableCell className="font-medium">{f.customerName ?? f.customerId}</TableCell>
                        <TableCell className="tnum text-right">{money.format(f.saldo)}</TableCell>
                        <TableCell className="tnum text-right">{money.format(f.movimientos)}</TableCell>
                        <TableCell className="tnum text-right">
                          {f.descuadre === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Badge variant="destructive">{money.format(f.descuadre)}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
