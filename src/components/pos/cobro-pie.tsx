"use client"

import * as React from "react"
import { AlertTriangle, Info } from "lucide-react"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"

interface CobroPieProps {
  setCheckoutOpen: React.Dispatch<React.SetStateAction<boolean>>
  method: string
  splitOn: boolean
  saving: boolean
  checkoutError: string | null
  netTotal: number
  confirmBlocked: boolean
  motivoBloqueo: string | null
  handleConfirm: () => Promise<void>
}

export function CobroPie({
  setCheckoutOpen,
  method,
  splitOn,
  saving,
  checkoutError,
  netTotal,
  confirmBlocked,
  motivoBloqueo,
  handleConfirm,
}: CobroPieProps) {
  return (
    <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1 text-xs sm:text-[0.8125rem]">
        {checkoutError ? (
          <p className="flex items-start gap-1.5 font-medium text-destructive">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            {checkoutError}
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            {motivoBloqueo ? (
              <>
                <Info className="mt-px size-4 shrink-0 text-primary" />
                {motivoBloqueo}
              </>
            ) : (
              <span className="hidden sm:inline">
                Enter cobra · Esc cierra
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          disabled={saving}
          className="flex-1 sm:min-w-28 sm:flex-none"
          onClick={() => setCheckoutOpen(false)}
        >
          Cancelar
        </Button>
        <Button
          className="h-12 flex-1 px-6 text-base font-semibold sm:flex-none"
          disabled={confirmBlocked}
          onClick={() => void handleConfirm()}
        >
          {saving
            ? "Registrando…"
            : !splitOn && method === "credit"
              ? `Fiar ${money(netTotal)}`
              : `Confirmar ${money(netTotal)}`}
        </Button>
      </div>
    </footer>
  )
}
