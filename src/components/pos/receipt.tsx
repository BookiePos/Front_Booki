"use client"

import { PAYMENT_METHOD_LABELS, type Sale } from "@/lib/pos/api-sales"
import type { Sede } from "@/lib/pos/api-inventory"
import { money, qty, dateTime } from "@/lib/pos/format"
import { cn } from "@/lib/utils"

/**
 * Comprobante estilo tirilla térmica. Se usa tras cobrar y en el detalle del
 * historial. La clase `receipt-printable` la reconoce el CSS de impresión
 * (globals.css) para imprimir solo esta zona.
 */
export function Receipt({
  sale,
  sede,
  className,
}: {
  sale: Sale
  sede?: Pick<Sede, "businessName" | "name" | "nit" | "address" | "phone" | "legalNote">
  className?: string
}) {
  const { payment } = sale
  const cashier = sale.cashierName || sale.cashierEmail
  // Título = marca del negocio si existe; si no, el nombre de la sede.
  const title = sede?.businessName || sede?.name || "Punto de venta"
  // Subtítulo = sede, solo cuando hay una marca distinta arriba.
  const subtitle = sede?.businessName ? sede?.name : undefined
  const customer = sale.customer
  const hasCustomer =
    !!customer &&
    !!(customer.name || customer.idNumber || customer.phone || customer.email)
  return (
    <div
      className={cn(
        "receipt-printable mx-auto w-full max-w-xs rounded-xl border border-dashed border-border bg-card p-5 font-mono text-xs text-foreground",
        className,
      )}
    >
      {/* Encabezado */}
      <div className="text-center">
        <p className="font-display text-base tracking-tight">{title}</p>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        {sede?.nit && (
          <p className="text-muted-foreground">NIT {sede.nit}</p>
        )}
        {sede?.address && (
          <p className="text-muted-foreground">{sede.address}</p>
        )}
        {sede?.phone && (
          <p className="text-muted-foreground">Tel {sede.phone}</p>
        )}
        <p className="mt-1 text-muted-foreground">{dateTime(sale.createdAt)}</p>
      </div>

      <Dashed />

      <p className="mb-2 text-center font-semibold tracking-wide">
        FACTURA DE VENTA
      </p>

      <div className="flex justify-between">
        <span className="text-muted-foreground">Comprobante</span>
        <span className="font-semibold">{sale.saleNumber}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Cajero</span>
        <span className="max-w-[60%] truncate">{cashier}</span>
      </div>

      {hasCustomer && (
        <>
          <Dashed />
          <p className="mb-1 text-muted-foreground">Cliente</p>
          {customer!.name && (
            <p className="font-medium">{customer!.name}</p>
          )}
          {customer!.idNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Identificación</span>
              <span>{customer!.idNumber}</span>
            </div>
          )}
          {customer!.phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teléfono</span>
              <span>{customer!.phone}</span>
            </div>
          )}
        </>
      )}

      <Dashed />

      {/* Líneas */}
      <ul className="flex flex-col gap-1.5">
        {sale.lines.map((l, i) => {
          const disc = l.discountAmount ?? 0
          const net = l.lineTotal - disc
          return (
            <li key={i} className="leading-tight">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="tabular-nums">{money(net)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {qty(l.qty)} {l.unit} × {money(l.unitPrice)}
              </div>
              {disc > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Desc. {l.discountName ?? ""} −{money(disc)}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Dashed />

      {/* Totales */}
      <div className="flex flex-col gap-1">
        {(sale.discountTotal > 0 || sale.taxTotal > 0) && (
          <Row label="Subtotal" value={money(sale.subtotal)} muted />
        )}
        {sale.discountTotal > 0 && (
          <Row
            label={
              sale.discount?.type === "percent"
                ? `Descuento (${sale.discount.value}%)`
                : "Descuento"
            }
            value={`−${money(sale.discountTotal)}`}
            muted
          />
        )}
        {sale.taxTotal > 0 && (
          <Row label="Impuestos" value={money(sale.taxTotal)} muted />
        )}
        <div className="flex justify-between text-sm font-semibold">
          <span>TOTAL</span>
          <span className="tabular-nums">{money(sale.total)}</span>
        </div>
      </div>

      <Dashed />

      {/* Pago */}
      <div className="flex flex-col gap-1">
        <Row label="Pago" value={PAYMENT_METHOD_LABELS[payment.method]} />
        {payment.received !== undefined && (
          <Row label="Recibido" value={money(payment.received)} muted />
        )}
        {payment.change !== undefined && payment.change > 0 && (
          <Row label="Cambio" value={money(payment.change)} muted />
        )}
      </div>

      <Dashed />

      {sede?.legalNote && (
        <p className="mb-2 text-center text-[11px] leading-snug text-muted-foreground">
          {sede.legalNote}
        </p>
      )}
      <p className="text-center text-muted-foreground">¡Gracias por su compra!</p>
    </div>
  )
}

function Row({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={cn("tabular-nums", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  )
}

function Dashed() {
  return <div className="my-3 border-t border-dashed border-border" />
}
