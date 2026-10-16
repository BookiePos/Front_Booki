"use client"

import * as React from "react"
import { ShoppingCart } from "lucide-react"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CartItem } from "@/components/pos/venta-helpers"

interface BarraResumenCuentaProps {
  sedeId: string
  cart: CartItem[]
  cuentaAbierta: boolean
  setCuentaAbierta: React.Dispatch<React.SetStateAction<boolean>>
  openCheckout: () => void
  netTotal: number
}

export function BarraResumenCuenta({
  sedeId,
  cart,
  cuentaAbierta,
  setCuentaAbierta,
  openCheckout,
  netTotal,
}: BarraResumenCuentaProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-14 z-30 border-t border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur lg:hidden",
        cuentaAbierta && "hidden",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCuentaAbierta(true)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Ver el detalle de la cuenta"
        >
          <span className="relative shrink-0">
            <ShoppingCart className="size-5 text-muted-foreground" />
            {cart.length > 0 && (
              <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-xs leading-none font-bold text-primary-foreground">
                {cart.length}
              </span>
            )}
          </span>
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-[11px] text-muted-foreground">
              {cart.length === 0
                ? "Sin artículos"
                : `${cart.length} ${cart.length === 1 ? "artículo" : "artículos"}`}
            </span>
            <span className="stat-figure truncate text-base text-foreground">
              {money(netTotal)}
            </span>
          </span>
        </button>
        <Button
          size="lg"
          className="h-11 shrink-0 px-4 font-semibold"
          disabled={cart.length === 0 || !sedeId}
          onClick={openCheckout}
        >
          Cobrar
        </Button>
      </div>
    </div>
  )
}
