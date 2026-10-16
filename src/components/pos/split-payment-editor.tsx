"use client"

import { Plus, Trash2 } from "lucide-react"
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/pos/api-sales"
import { money } from "@/lib/pos/format"
import { Button } from "@/components/ui/button"
import { MoneyInput } from "@/components/ui/money-input"
import { NativeSelect } from "@/components/ui/field"
import {
  addSplitRow,
  fillRemaining,
  type SplitRow,
} from "@/lib/pos/split-payment"
import { cn } from "@/lib/utils"

/**
 * Filas de «dividir pago» (ítem 6.9): un medio y un monto por fila, con el
 * restante siempre a la vista. La cuenta la hace `lib/pos/split-payment.ts`.
 */
export function SplitPaymentEditor({
  rows,
  onChange,
  due,
  remaining,
  change,
  error,
}: {
  rows: SplitRow[]
  onChange: (rows: SplitRow[]) => void
  due: number
  remaining: number
  change: number
  error: string | null
}) {
  const metodos = Object.entries(PAYMENT_METHOD_LABELS) as [
    PaymentMethod,
    string,
  ][]
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
      <p className="text-[0.8125rem] font-medium">Dividir pago</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <NativeSelect
              value={r.method}
              onChange={(v) =>
                onChange(
                  rows.map((x) =>
                    x.id === r.id ? { ...x, method: v as PaymentMethod } : x,
                  ),
                )
              }
              aria-label={`Medio de pago ${i + 1}`}
              options={metodos.map(([value, label]) => ({ value, label }))}
            />
            <MoneyInput
              value={r.amount}
              onValueChange={(v) =>
                onChange(
                  rows.map((x) => (x.id === r.id ? { ...x, amount: v } : x)),
                )
              }
              aria-label={`Monto del medio ${i + 1}`}
              className="h-10 min-w-28 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(fillRemaining(rows, r.id, due))}
            >
              Lo que falta
            </Button>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Quitar el medio ${i + 1}`}
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {rows.length < 6 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(addSplitRow(rows, due))}
        >
          <Plus className="size-4" />
          Agregar medio
        </Button>
      )}
      <div
        role="status"
        className={cn(
          "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm",
          remaining > 0
            ? "bg-destructive/10 text-destructive"
            : change > 0
              ? "bg-success/10 text-success-ink"
              : "bg-muted text-muted-foreground",
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">
          {remaining > 0
            ? "Restante"
            : change > 0
              ? "Devuelta (del efectivo)"
              : "Cubierto"}
        </span>
        <span className="stat-figure text-2xl leading-none">
          {money(remaining > 0 ? remaining : change)}
        </span>
      </div>
      {error && remaining === 0 && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
