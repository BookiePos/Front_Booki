"use client"

import { PAYMENT_METHOD_LABELS, type Sale } from "@/lib/pos/api-sales"
import { money, qty, dateTime } from "@/lib/pos/format"
import { cn } from "@/lib/utils"

export interface FacturaBusiness {
  name: string
  address?: string
  nit?: string
  phone?: string
}

/**
 * Comprobante de venta imprimible (tamaño carta / A4), pensado para
 * "Imprimir" o "Guardar como PDF" desde el navegador. Muestra los datos del
 * negocio, del cliente, el detalle de ítems y los totales. No es factura
 * electrónica DIAN (eso vive en su propio módulo).
 */
export function Factura({
  sale,
  business,
  className,
}: {
  sale: Sale
  business: FacturaBusiness
  className?: string
}) {
  const { payment, customer } = sale
  const hasCustomer =
    customer &&
    (customer.name || customer.idNumber || customer.phone || customer.email)

  return (
    <div
      className={cn(
        "invoice-printable mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-sm text-foreground",
        className,
      )}
    >
      {/* Encabezado: negocio + comprobante */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="font-display text-xl tracking-tight">{business.name}</p>
          {business.nit && (
            <p className="text-muted-foreground">NIT: {business.nit}</p>
          )}
          {business.address && (
            <p className="text-muted-foreground">{business.address}</p>
          )}
          {business.phone && (
            <p className="text-muted-foreground">Tel: {business.phone}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Comprobante
          </p>
          <p className="font-mono text-base font-semibold">{sale.saleNumber}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dateTime(sale.createdAt)}
          </p>
          {sale.status === "void" && (
            <p className="mt-1 text-xs font-semibold text-destructive">
              ANULADA
            </p>
          )}
        </div>
      </div>

      {/* Cliente + cajero */}
      <div className="grid grid-cols-1 gap-3 border-b border-border py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Cliente
          </p>
          {hasCustomer ? (
            <div className="mt-0.5 leading-tight">
              {customer?.name && <p className="font-medium">{customer.name}</p>}
              {customer?.idNumber && (
                <p className="text-muted-foreground">
                  CC/NIT: {customer.idNumber}
                </p>
              )}
              {customer?.phone && (
                <p className="text-muted-foreground">Tel: {customer.phone}</p>
              )}
              {customer?.email && (
                <p className="text-muted-foreground">{customer.email}</p>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-muted-foreground">Consumidor final</p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Atendió
          </p>
          <p className="mt-0.5 truncate">{sale.cashierEmail}</p>
        </div>
      </div>

      {/* Detalle */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">Producto</th>
            <th className="pb-2 text-right font-medium">Cant.</th>
            <th className="pb-2 text-right font-medium">Precio</th>
            <th className="pb-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-2 pr-2">
                <span className="font-medium">{l.name}</span>
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  {l.sku}
                </span>
              </td>
              <td className="py-2 text-right tabular-nums">
                {qty(l.qty)} {l.unit}
              </td>
              <td className="py-2 text-right tabular-nums">
                {money(l.unitPrice)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {money(l.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1">
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
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
            <span>TOTAL</span>
            <span className="tabular-nums">{money(sale.total)}</span>
          </div>
          <Row label="Pago" value={PAYMENT_METHOD_LABELS[payment.method]} muted />
          {payment.received !== undefined && (
            <Row label="Recibido" value={money(payment.received)} muted />
          )}
          {payment.change !== undefined && payment.change > 0 && (
            <Row label="Cambio" value={money(payment.change)} muted />
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Documento equivalente · No es factura electrónica DIAN · ¡Gracias por su
        compra!
      </p>
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
