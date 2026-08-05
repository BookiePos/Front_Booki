"use client"

import { ShieldOff } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { PayablesPanel } from "@/components/erp/finance/payables-panel"

export default function CxpPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Cuentas por pagar" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver las cuentas por pagar.
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
        title="Cuentas por pagar"
        description="Facturas de proveedores pendientes de pago, con abonos y vencimientos."
      />
      <PayablesPanel />
    </>
  )
}
