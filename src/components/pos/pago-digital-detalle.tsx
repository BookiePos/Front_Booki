"use client"

import { Info } from "lucide-react"
import type { CobroDigital } from "@/lib/pos/api-inventory"
import type { CardFranchise, CardType, PaymentMethod } from "@/lib/pos/api-sales"
import {
  CARD_TYPE_LABELS,
  CHANNEL_LABELS,
  FRANCHISE_LABELS,
  TRANSFER_CHANNELS,
  type DigitalDetail,
} from "@/lib/pos/pago-digital"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/field"

/**
 * Detalle de un cobro digital (ítem 6.4): datáfono (débito/crédito, franquicia,
 * aprobación o últimos 4) o transferencia (Nequi, Daviplata, QR / Bre-B, con su
 * referencia). Se usa igual para un solo medio y para cada fila de «dividir
 * pago». Con transferencia muestra el QR o la llave que el negocio cargó.
 */
export function PagoDigitalDetalle({
  method,
  detail,
  onChange,
  cobro,
  idBase,
}: {
  method: PaymentMethod
  detail: DigitalDetail
  onChange: (next: DigitalDetail) => void
  cobro?: CobroDigital
  idBase: string
}) {
  if (method !== "card" && method !== "transfer") return null
  const set = (patch: Partial<DigitalDetail>) => onChange({ ...detail, ...patch })

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-background p-2.5">
      {method === "card" ? (
        <>
          <p className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Pasa la tarjeta por el datáfono y confirma aquí cuando la
              transacción quede aprobada.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${idBase}-tipo`} className="text-xs">
                Tipo
              </Label>
              <NativeSelect
                id={`${idBase}-tipo`}
                value={detail.cardType}
                onChange={(v) => set({ cardType: v as "" | CardType })}
                placeholder="Elige…"
                options={(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((k) => ({
                  value: k,
                  label: CARD_TYPE_LABELS[k],
                }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${idBase}-franq`} className="text-xs">
                Franquicia
              </Label>
              <NativeSelect
                id={`${idBase}-franq`}
                value={detail.franchise}
                onChange={(v) => set({ franchise: v as "" | CardFranchise })}
                placeholder="Elige…"
                options={(Object.keys(FRANCHISE_LABELS) as CardFranchise[]).map(
                  (k) => ({ value: k, label: FRANCHISE_LABELS[k] }),
                )}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idBase}-canal`} className="text-xs">
            Por dónde pagó
          </Label>
          <NativeSelect
            id={`${idBase}-canal`}
            value={detail.channel}
            onChange={(v) => set({ channel: v as DigitalDetail["channel"] })}
            placeholder="Transferencia bancaria"
            options={TRANSFER_CHANNELS.map((c) => ({
              value: c,
              label: CHANNEL_LABELS[c],
            }))}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idBase}-ref`} className="text-xs">
          {method === "card"
            ? "Aprobación o últimos 4 (opcional)"
            : "Referencia o celular (opcional)"}
        </Label>
        <Input
          id={`${idBase}-ref`}
          value={detail.reference}
          maxLength={40}
          onChange={(e) => set({ reference: e.target.value })}
          placeholder={method === "card" ? "Ej. 004512" : "Ej. 300 123 4567"}
        />
      </div>
      {method === "transfer" && <QrCobro cobro={cobro} />}
    </div>
  )
}

/** El QR o la llave Bre-B del negocio, para que el cliente pague escaneando. */
export function QrCobro({ cobro }: { cobro?: CobroDigital }) {
  if (!cobro || (!cobro.qrImagen && !cobro.qrLlave)) return null
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
      {cobro.qrImagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cobro.qrImagen}
          alt="QR para pagar"
          className="size-28 shrink-0 rounded-md border border-border bg-white object-contain"
        />
      )}
      <div className="min-w-0 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Paga a
        </p>
        {cobro.qrLlave && (
          <p className="break-all font-medium" data-testid="qr-llave">
            {cobro.qrLlave}
          </p>
        )}
        {cobro.qrTitular && (
          <p className="text-xs text-muted-foreground">{cobro.qrTitular}</p>
        )}
      </div>
    </div>
  )
}
