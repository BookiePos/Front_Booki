"use client"

import * as React from "react"
import { Banknote, Lock, Coins } from "lucide-react"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { type Sede } from "@/lib/pos/api-inventory"

interface CajaCerradaProps {
  sede: Sede | undefined
  openingBills: number | null
  setOpeningBills: React.Dispatch<React.SetStateAction<number | null>>
  openingCoins: number | null
  setOpeningCoins: React.Dispatch<React.SetStateAction<number | null>>
  openingBusy: boolean
  openCajaError: string | null
  handleOpenCaja: () => Promise<void>
}

export function CajaCerrada({
  sede,
  openingBills,
  setOpeningBills,
  openingCoins,
  setOpeningCoins,
  openingBusy,
  openCajaError,
  handleOpenCaja,
}: CajaCerradaProps) {
  return (
    <Card className="mx-auto max-w-md overflow-hidden p-0">
      {/* Barra violeta de estado: el cajero llega con prisa y necesita saber
          de un vistazo por qué no puede vender. Un icono ámbar centrado en
          medio de una tarjeta blanca no comunica "bloqueado". */}
      <div className="flex items-center gap-3 gradient-brand-r px-5 py-4 text-primary-foreground">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
          <Lock className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">Caja cerrada</p>
          <p className="truncate text-sm text-primary-foreground/80">
            {sede ? sede.name : "Esta sede"} · aún no puedes vender
          </p>
        </div>
      </div>

      <CardContent className="flex flex-col items-center gap-4 px-5 pb-6 pt-5 text-center">
        <p className="text-sm text-muted-foreground">
          Cuenta la base con la que arrancas el turno y abre la caja para
          empezar a vender.
        </p>
        <div className="flex w-full flex-col gap-2 text-left">
          <p className="text-sm font-medium text-foreground">
            Base inicial en efectivo
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opening-bills" className="gap-1.5">
              <Banknote className="size-4 text-muted-foreground" />
              Billetes
            </Label>
            <MoneyInput
              id="opening-bills"
              value={openingBills}
              onValueChange={setOpeningBills}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleOpenCaja()
                }
              }}
              placeholder="$0"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opening-coins" className="gap-1.5">
              <Coins className="size-4 text-muted-foreground" />
              Monedas
            </Label>
            <MoneyInput
              id="opening-coins"
              value={openingCoins}
              onValueChange={setOpeningCoins}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleOpenCaja()
                }
              }}
              placeholder="$0"
            />
          </div>
          <div className="mt-1 flex items-center justify-between rounded-xl bg-accent px-4 py-3">
            <span className="text-sm font-medium text-accent-foreground">
              Total base
            </span>
            <span className="stat-figure text-xl text-primary">
              {money((openingBills ?? 0) + (openingCoins ?? 0))}
            </span>
          </div>
          {openCajaError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {openCajaError}
            </p>
          )}
          <Button
            size="lg"
            className="mt-1 h-13 gap-2 text-base font-semibold shadow-[0_10px_26px_-12px_var(--primary)]"
            disabled={
              openingBusy ||
              (openingBills === null && openingCoins === null)
            }
            onClick={() => void handleOpenCaja()}
          >
            {openingBusy ? "Abriendo…" : "Abrir caja y vender"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            El arqueo y el cierre se gestionan en la pestaña Caja.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
