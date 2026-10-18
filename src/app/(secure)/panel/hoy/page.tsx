"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BellRing,
  ChevronRight,
  RefreshCw,
  ShieldOff,
  Wallet,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data"
import { buildAlertasHoy } from "@/lib/dashboard/alertas-hoy"
import { money } from "@/lib/erp/finance-format"
import type { CajaOverviewRow } from "@/lib/erp/api-caja"

import { PageHeader } from "@/components/erp/page-header"
import { BotonInstalar } from "@/components/pwa/boton-instalar"
import { RegistroSw } from "@/components/pwa/registro-sw"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const ESTADO: Record<CajaOverviewRow["status"], string> = {
  open: "Abierta",
  closed: "Cerrada",
  none: "Sin abrir",
}

/**
 * Vista compacta del dueño (ítem 7.10), pensada para el celular y para la PWA
 * instalada: ventas del día, estado de la caja por sede y alertas. Reutiliza
 * los datos y los permisos del tablero; cada bloque aparece solo si el usuario
 * puede verlo.
 */
export default function HoyPage() {
  const { hasPermission } = useAuth()
  const { data, loading, reload } = useDashboardData()

  const veCaja = hasPermission("finance.view") || hasPermission("pos.sell")
  const veAlertas =
    veCaja || hasPermission("inventory.view") || hasPermission("reports.view")
  const alertas = buildAlertasHoy(data)
  const caja = data.caja

  if (!veAlertas) {
    return (
      <>
        <PageHeader section="Panel" title="Hoy" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tienes permisos para ver el resumen del día.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <RegistroSw />
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-foreground">Hoy</h1>
        <div className="flex items-center gap-2">
          <BotonInstalar />
          <Button
            variant="outline"
            size="icon"
            onClick={() => void reload()}
            title="Actualizar"
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {veCaja && (
        <Card className="border-primary/30 gradient-brand text-primary-foreground">
          <CardContent className="flex flex-col gap-1 py-5">
            <p className="text-xs opacity-80">Ventas del día</p>
            {loading && !caja ? (
              <Skeleton className="h-9 w-40" />
            ) : (
              <p className="font-display text-4xl leading-tight tabular-nums">
                {caja ? money.format(caja.totals.salesTotal) : "—"}
              </p>
            )}
            <p className="text-xs opacity-80">
              {caja
                ? `${caja.totals.salesCount} venta${caja.totals.salesCount === 1 ? "" : "s"} · efectivo ${money.format(caja.totals.cashSalesTotal)}`
                : "Sin datos"}
            </p>
          </CardContent>
        </Card>
      )}

      {veCaja && (
        <section aria-label="Caja" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-display text-sm text-foreground">
              <Wallet className="size-4 text-muted-foreground" />
              Caja por sede
            </h2>
            <Link href="/panel/caja" className="text-xs text-primary">
              Ver detalle
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {loading && !caja ? (
                <div className="p-4">
                  <Skeleton className="h-12 rounded-lg" />
                </div>
              ) : !caja || caja.rows.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No hay sedes para mostrar.
                </p>
              ) : (
                caja.rows.map((r) => (
                  <div
                    key={r.sedeId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.sedeName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {r.status === "none"
                          ? "—"
                          : `${money.format(r.salesTotal)} · ${r.salesCount} venta${r.salesCount === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <Badge
                      variant={r.status === "open" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {ESTADO[r.status]}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-label="Alertas" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm text-foreground">
          <BellRing className="size-4 text-muted-foreground" />
          Alertas
        </h2>
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {loading && alertas.length === 0 ? (
              <div className="p-4">
                <Skeleton className="h-10 rounded-lg" />
              </div>
            ) : alertas.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Todo en orden por ahora.
              </p>
            ) : (
              alertas.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <AlertTriangle
                    className={`size-4 shrink-0 ${a.nivel === "critica" ? "text-destructive" : "text-muted-foreground"}`}
                  />
                  <span className="flex-1">{a.texto}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
