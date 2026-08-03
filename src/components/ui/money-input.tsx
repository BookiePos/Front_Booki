"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Campo de dinero en pesos colombianos: solo enteros, con separador de miles y
 * símbolo "$". El valor se maneja como número (null = vacío), nunca como texto.
 */
export function MoneyInput({
  id,
  value,
  onValueChange,
  placeholder,
  autoFocus,
  className,
  onKeyDown,
}: {
  id?: string
  value: number | null
  onValueChange: (value: number | null) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}) {
  const display =
    value === null || Number.isNaN(value)
      ? ""
      : new Intl.NumberFormat("es-CO").format(value)
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "")
          onValueChange(digits === "" ? null : Number(digits))
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("pl-7 tabular-nums", className)}
      />
    </div>
  )
}
