"use client"

import * as React from "react"
import { ShoppingCart, Plus, ClipboardList } from "lucide-react"
import { type Sede } from "@/lib/pos/api-inventory"
import { type Order } from "@/lib/pos/api-sales"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface CuentasAbiertasProps {
  sedeId: string
  sede: Sede | undefined
  orders: Order[]
  orderBusy: boolean
  setNewOrderOpen: React.Dispatch<React.SetStateAction<boolean>>
  setNewOrderName: React.Dispatch<React.SetStateAction<string>>
  selectDirect: () => Promise<void>
  selectOrder: (o: Order) => Promise<void>
}

export function CuentasAbiertas({
  sedeId,
  sede,
  orders,
  orderBusy,
  setNewOrderOpen,
  setNewOrderName,
  selectDirect,
  selectOrder,
}: CuentasAbiertasProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Cuentas abiertas</h1>
          <p className="text-sm text-muted-foreground">
            {sede ? `${sede.name} · ` : ""}
            Consumos que quedaron pendientes de cobrar (mesas o clientes).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="gap-2"
            disabled={!sedeId}
            onClick={() => void selectDirect()}
          >
            <ShoppingCart className="size-4" />
            Vender
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={orderBusy || !sedeId}
            onClick={() => {
              setNewOrderName("")
              setNewOrderOpen(true)
            }}
          >
            <Plus className="size-4" />
            Abrir cuenta
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <p className="font-display text-lg">No hay cuentas abiertas</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Todo está cobrado. Usa <strong>Vender</strong> para una venta
              normal, o abre una cuenta si necesitas dejar el consumo de una
              mesa pendiente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const count = o.lines.reduce((a, l) => a + l.qty, 0)
            const oTotal = o.lines.reduce((a, l) => a + l.lineTotal, 0)
            return (
              <button
                key={o._id}
                type="button"
                onClick={() => void selectOrder(o)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {o.label?.trim() || o.orderNumber}
                  </span>
                  <Badge variant="secondary">{count} ítem(s)</Badge>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {o.orderNumber}
                  </span>
                  <span className="font-display text-lg">
                    {money(oTotal)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
