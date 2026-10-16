"use client"

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
    <header className="shrink-0 gradient-brand px-4 py-3.5 text-primary-foreground sm:px-5 sm:py-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight">Cobrar</p>
          <p className="truncate text-xs text-primary-foreground/80 sm:text-sm">
            {sede ? `${sede.name} · ` : ""}
            {itemCount} ítem(s)
            {lineDiscountTotal > 0 && (
              <> · −{money(lineDiscountTotal)} de descuento</>
            )}
            {tipAmount > 0 && <> · Propina {money(tipAmount)}</>}
            {deliveryFee > 0 && <> · Domicilio {money(deliveryFee)}</>}
          </p>
        </div>
        <p className="stat-figure shrink-0 text-3xl leading-none sm:text-4xl">
          {money(netTotal)}
        </p>
        <button
          type="button"
          aria-label="Cerrar"
          disabled={saving}
          onClick={() => setCheckoutOpen(false)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground disabled:opacity-40"
        >
          <X className="size-5" />
        </button>
      </div>
    </header>
  )
}
