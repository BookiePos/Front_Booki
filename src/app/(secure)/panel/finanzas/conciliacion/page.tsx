"use client"

import { ShieldOff } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { ConciliacionPagosPanel } from "@/components/erp/finance/conciliacion-pagos-panel"
import { CobroDigitalConfig } from "@/components/erp/finance/cobro-digital-config"

export default function ConciliacionPagosPage() {
  const { hasPermission } = useAuth()

  if (!hasPermission("finance.view")) {
    return (
      <>
        <PageHeader section="Finanzas" title="Conciliación de pagos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver la conciliación de pagos.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Conciliación de pagos"
        description="Lo que el POS cobró por datáfono, Nequi, Daviplata y QR contra lo que consignó el extracto, con la comisión y las retenciones."
      />
      <div className="flex flex-col gap-4">
        <ConciliacionPagosPanel />
        <CobroDigitalConfig />
      </div>
    </>
  )
}
