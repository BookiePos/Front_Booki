import { ShoppingCart, Tag } from "lucide-react"
import { pendingTotal, type Order, type Discount } from "@/lib/pos/api-sales"
import { money, qty as fmtQty } from "@/lib/pos/format"
import { CheckoutColumn, SummaryRow } from "@/components/pos/checkout-layout"
import { CartItem } from "@/components/pos/venta-helpers"

interface CobroColumnaDetalleProps {
  cart: CartItem[]
  unitPrice: (item: CartItem) => number
  discountById: Map<string, Discount>
  lineDiscount: (item: CartItem) => number
  total: number
  lineDiscountTotal: number
  itemCount: number
  tipAmount: number
  activeOrder: Order | null
  pagadoAntes: number
  splitLines: { productId: string; qty: number; }[] | undefined
  deliveryFee: number
  netTotal: number
}

export function CobroColumnaDetalle({
  cart,
  unitPrice,
  discountById,
  lineDiscount,
  total,
  lineDiscountTotal,
  itemCount,
  tipAmount,
  activeOrder,
  pagadoAntes,
  splitLines,
  deliveryFee,
  netTotal,
}: CobroColumnaDetalleProps) {
  return (
    <CheckoutColumn
      title="Qué estás cobrando"
      icon={ShoppingCart}
      hint={`${itemCount} ítem(s)`}
      className="max-lg:order-2 max-lg:border-t max-lg:border-border"
      footer={
        <div className="flex flex-col gap-1.5">
          {activeOrder ? (
            <>
              <SummaryRow
                label="Consumo de la cuenta"
                value={money(total)}
              />
              {pagadoAntes > 0 && (
                <SummaryRow
                  label="Ya pagaron"
                  value={`−${money(pagadoAntes)}`}
                  tone="positive"
                />
              )}
              {splitLines && (
                <SummaryRow
                  label="Falta por cobrar"
                  value={money(pendingTotal(activeOrder))}
                />
              )}
            </>
          ) : (
            <>
              <SummaryRow
                label="Productos"
                value={money(total + lineDiscountTotal)}
              />
              {lineDiscountTotal > 0 && (
                <SummaryRow
                  label="Descuentos"
                  value={`−${money(lineDiscountTotal)}`}
                  tone="positive"
                />
              )}
            </>
          )}
          {tipAmount > 0 && (
            <SummaryRow label="Propina" value={money(tipAmount)} />
          )}
          {deliveryFee > 0 && (
            <SummaryRow label="Domicilio" value={money(deliveryFee)} />
          )}
          <div className="mt-1 flex items-baseline justify-between gap-3 rounded-xl bg-accent px-3 py-2.5">
            <span className="font-display text-[0.9375rem] text-accent-foreground">
              Total a cobrar
            </span>
            <span className="stat-figure text-2xl leading-none text-primary">
              {money(netTotal)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Los precios ya incluyen impuestos.
          </p>
        </div>
      }
    >
      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay nada en la cuenta.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cart.map((i) => {
            const unit = unitPrice(i)
            const gross = i.qty * unit
            const lineDisc = lineDiscount(i)
            const applied = i.discountId
              ? discountById.get(i.discountId)
              : undefined
            return (
              <li
                key={i.product._id}
                className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium leading-snug text-foreground">
                    {i.product.name}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {fmtQty(i.qty)} {i.product.unit} × {money(unit)}
                  </span>
                  {applied && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                      <Tag className="size-3" />
                      {applied.name} −{money(lineDisc)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[0.8125rem] font-medium tabular-nums text-foreground">
                  {money(gross - lineDisc)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </CheckoutColumn>
  )
}
