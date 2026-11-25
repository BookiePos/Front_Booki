"use client"

import { contar } from "@/lib/utils"
import * as React from "react"
import { X } from "lucide-react"
import { money } from "@/lib/pos/format"
import { type Sede } from "@/lib/pos/api-inventory"

interface CobroCabeceraProps {
  sede: Sede | undefined
  setCheckoutOpen: React.Dispatch<React.SetStateAction<boolean>>
  saving: boolean
  lineDiscountTotal: number
  itemCount: number
  tipAmount: number
  deliveryFee: number
  netTotal: number
}

export function CobroCabecera({
  sede,
  setCheckoutOpen,
  saving,
  lineDiscountTotal,
  itemCount,
  tipAmount,
  deliveryFee,
  netTotal,
}: CobroCabeceraProps) {
  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-3.5 text-foreground sm:px-5 sm:py-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Cobrar</p>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {sede ? `${sede.name} · ` : ""}
            {contar(itemCount, "producto")}
            {lineDiscountTotal > 0 && (
              <> · −{money(lineDiscountTotal)} de descuento</>
            )}
            {tipAmount > 0 && <> · Propina {money(tipAmount)}</>}
            {deliveryFee > 0 && <> · Domicilio {money(deliveryFee)}</>}
          </p>
        </div>
        <p key={netTotal} className="cifra-total shrink-0 text-[2rem] leading-none sm:text-[2.6rem]">
          {money(netTotal)}
        </p>
        <button
          type="button"
          aria-label="Cerrar"
          disabled={saving}
          onClick={() => setCheckoutOpen(false)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="size-5" />
        </button>
      </div>
    </header>
  )
}
