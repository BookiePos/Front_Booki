"use client"

import * as React from "react"
import QRCode from "qrcode"

import type { ElectronicDocument } from "@/lib/pos/api-einvoicing"
import { money, qty, dateTime } from "@/lib/pos/format"
import { cn } from "@/lib/utils"

const RESP_FISCAL_LABELS: Record<string, string> = {
  responsable_iva: "Responsable de IVA",
  no_responsable_iva: "No responsable de IVA",
  regimen_simple: "Régimen Simple (SIMPLE)",
  gran_contribuyente: "Gran contribuyente",
}

const MEDIO_PAGO_LABELS: Record<string, string> = {
  "10": "Efectivo",
  "48": "Tarjeta de crédito",
  "49": "Tarjeta débito",
  "42": "Transferencia",
}

const DOC_TYPE_LABELS: Record<string, string> = {
  "13": "CC",
  "31": "NIT",
  "22": "CE",
}

function fmtDate(iso?: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

/**
 * Representación gráfica de la factura electrónica de venta / nota crédito,
 * conforme a los elementos mínimos exigidos por la DIAN (Res. 000165/2023,
 * Anexo Técnico 1.9). Formato de una sola columna (tirilla / facturero de
 * 80 mm) para que se lea ordenada tanto en pantalla como impresa. Mientras no
 * haya proveedor tecnológico, el documento va en estado 'draft' y se marca
 * "sin validar ante la DIAN".
 */
export function FacturaElectronica({
  doc,
  className,
}: {
  doc: ElectronicDocument
  className?: string
}) {
  const [qrImg, setQrImg] = React.useState<string | null>(null)
  const isNote = doc.type === "credit_note"
  const title = isNote ? "NOTA CRÉDITO ELECTRÓNICA" : "FACTURA ELECTRÓNICA DE VENTA"
  const emisor = doc.emisor
  const adq = doc.adquiriente
  const res = doc.resolution
  const validated = doc.dianStatus === "accepted"

  React.useEffect(() => {
    let active = true
    if (doc.qrUrl) {
      QRCode.toDataURL(doc.qrUrl, { margin: 1, width: 160 })
        .then((url) => active && setQrImg(url))
        .catch(() => active && setQrImg(null))
    } else {
      setQrImg(null)
    }
    return () => {
      active = false
    }
  }, [doc.qrUrl])

  const nit = emisor?.nit
    ? `${emisor.nit}${emisor.nitDv ? `-${emisor.nitDv}` : ""}`
    : undefined

  const emisorUbicacion = [emisor?.address, emisor?.ciudad, emisor?.departamento]
    .filter(Boolean)
    .join(", ")

  return (
    <div
      className={cn(
        "invoice-printable mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-5 text-sm text-foreground",
        className,
      )}
    >
      {/* Encabezado: emisor (centrado) */}
      <header className="flex flex-col items-center gap-0.5 border-b border-border pb-3 text-center">
        <p className="font-display text-base font-semibold leading-tight">
          {emisor?.name ?? "Emisor"}
        </p>
        {nit && <p className="text-xs text-muted-foreground">NIT {nit}</p>}
        {emisor?.responsabilidadFiscal && (
          <p className="text-xs text-muted-foreground">
            {RESP_FISCAL_LABELS[emisor.responsabilidadFiscal] ??
              emisor.responsabilidadFiscal}
          </p>
        )}
        {emisorUbicacion && (
          <p className="text-xs text-muted-foreground">{emisorUbicacion}</p>
        )}
        {emisor?.phone && (
          <p className="text-xs text-muted-foreground">Tel {emisor.phone}</p>
        )}
        {emisor?.email && (
          <p className="text-xs text-muted-foreground">{emisor.email}</p>
        )}
      </header>

      {/* Denominación + número + estado */}
      <div className="flex flex-col items-center gap-1 border-b border-border py-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide">
          {title}
        </p>
        <p className="font-mono text-lg font-bold leading-none">
          {doc.fullNumber}
        </p>
        <p className="text-xs text-muted-foreground">{dateTime(doc.createdAt)}</p>
        <span
          className={cn(
            "mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            validated
              ? "bg-success/10 text-success-ink"
              : "bg-warning/10 text-warning-ink",
          )}
        >
          {validated ? "Validada DIAN" : "Sin validar DIAN"}
        </span>
      </div>

      {/* Resolución de numeración */}
      {res?.numero && (
        <p className="border-b border-border py-2 text-center text-[11px] leading-snug text-muted-foreground">
          Autorización DIAN — Resolución N.º {res.numero}
          {res.prefijo ? ` · prefijo ${res.prefijo}` : ""}
          {res.rangoDesde != null && res.rangoHasta != null
            ? ` · del ${res.rangoDesde} al ${res.rangoHasta}`
            : ""}
          {res.vigenciaHasta ? ` · vigente hasta ${fmtDate(res.vigenciaHasta)}` : ""}
        </p>
      )}

      {/* Nota crédito: referencia a la factura */}
      {isNote && doc.referenceNumber && (
        <p className="border-b border-border py-2 text-center text-xs">
          Anula/corrige la factura{" "}
          <span className="font-semibold">{doc.referenceNumber}</span>
          {doc.reason ? ` · Motivo: ${doc.reason}` : ""}
        </p>
      )}

      {/* Adquiriente + pago */}
      <div className="space-y-1 border-b border-border py-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Adquiriente</span>
          <span className="text-right font-medium">
            {adq?.name ?? "Consumidor final"}
          </span>
        </div>
        {adq?.docNumber && (
          <Row
            label={DOC_TYPE_LABELS[adq.docType ?? ""] ?? "Documento"}
            value={adq.docNumber}
            muted
          />
        )}
        {adq?.phone && <Row label="Teléfono" value={adq.phone} muted />}
        {adq?.email && <Row label="Correo" value={adq.email} muted />}
        <Row
          label="Pago"
          value={`${doc.formaPago === "2" ? "Crédito" : "Contado"}${
            doc.medioPago
              ? ` · ${MEDIO_PAGO_LABELS[doc.medioPago] ?? doc.medioPago}`
              : ""
          }`}
        />
      </div>

      {/* Detalle: cada ítem apilado (cant × unit → total, IVA discriminado) */}
      <div className="py-1">
        <p className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Detalle
        </p>
        <ul className="divide-y divide-dashed divide-border">
          {doc.lines.map((l, i) => (
            <li key={i} className="py-2">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium leading-snug">{l.description}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {money(l.total)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {qty(l.qty)} × {money(l.unitPrice)}
                </span>
                <span className="tabular-nums">
                  IVA {l.ivaRate}%
                  {l.ivaAmount > 0 ? ` · ${money(l.ivaAmount)}` : ""}
                </span>
              </div>
              {l.discountAmount > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Descuento: −{money(l.discountAmount)}
                </p>
              )}
              {l.code && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {l.code}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Totales */}
      <div className="space-y-1 border-t border-border pt-3">
        <Row label="Base gravable" value={money(doc.taxableBase)} muted />
        {doc.discountTotal > 0 && (
          <Row label="Descuento" value={`−${money(doc.discountTotal)}`} muted />
        )}
        <Row label="IVA" value={money(doc.ivaTotal)} muted />
        <div className="flex items-baseline justify-between border-t border-border pt-1.5 text-base font-semibold">
          <span>TOTAL</span>
          <span className="tabular-nums">{money(doc.total)}</span>
        </div>
      </div>

      {/* QR + CUFE (centrados) */}
      <div className="mt-4 flex flex-col items-center gap-1.5 border-t border-border pt-4 text-center">
        {qrImg ? (
          <img
            src={qrImg}
            alt="Código QR DIAN"
            style={{ width: "2.2cm", height: "2.2cm" }}
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded border border-dashed border-border p-1 text-center text-[10px] text-muted-foreground">
            QR al validar con el PT
          </div>
        )}
        {doc.cufe && (
          <div className="w-full">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isNote ? "CUDE" : "CUFE"}
            </p>
            <p className="break-all font-mono text-[9px] leading-tight text-muted-foreground">
              {doc.cufe}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] leading-snug text-muted-foreground">
        {validated
          ? "Documento validado por la DIAN."
          : "Documento sin validar ante la DIAN — pendiente de integración con proveedor tecnológico."}
        {doc.technicalProvider ? ` Proveedor: ${doc.technicalProvider}.` : ""}
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
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}
