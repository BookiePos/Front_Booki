"use client"

import * as React from "react"
import QRCode from "qrcode"

import type { ElectronicDocument } from "@/lib/erp/api-einvoicing"
import { cn } from "@/lib/utils"

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const qtyFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
const dtFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
})
const money = (n: number) => moneyFmt.format(n)
const qty = (n: number) => qtyFmt.format(n)
const dateTime = (v: string) => dtFmt.format(new Date(v))

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
 * Representación gráfica de la factura electrónica / nota crédito (admin),
 * conforme a los elementos mínimos DIAN (Res. 000165/2023, Anexo Técnico 1.9).
 * Sin proveedor tecnológico el documento va en 'draft' ("sin validar DIAN").
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

  return (
    <div
      className={cn(
        "invoice-printable mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-sm text-foreground",
        className,
      )}
    >
      {/* Encabezado: emisor + documento */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="font-display text-lg tracking-tight">
            {emisor?.name ?? "Emisor"}
          </p>
          {nit && <p className="text-muted-foreground">NIT: {nit}</p>}
          {emisor?.responsabilidadFiscal && (
            <p className="text-muted-foreground">
              {RESP_FISCAL_LABELS[emisor.responsabilidadFiscal] ??
                emisor.responsabilidadFiscal}
            </p>
          )}
          {emisor?.address && (
            <p className="text-muted-foreground">
              {emisor.address}
              {emisor.ciudad ? `, ${emisor.ciudad}` : ""}
              {emisor.departamento ? `, ${emisor.departamento}` : ""}
            </p>
          )}
          {emisor?.phone && (
            <p className="text-muted-foreground">Tel: {emisor.phone}</p>
          )}
          {emisor?.email && (
            <p className="text-muted-foreground">{emisor.email}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide">
            {title}
          </p>
          <p className="mt-1 font-mono text-base font-semibold">
            {doc.fullNumber}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dateTime(doc.createdAt)}
          </p>
          <p className="mt-1 text-xs">
            {validated ? (
              <span className="font-medium text-green-600">Validada DIAN</span>
            ) : (
              <span className="font-medium text-amber-600">Sin validar DIAN</span>
            )}
          </p>
        </div>
      </div>

      {/* Resolución de numeración */}
      {res?.numero && (
        <p className="border-b border-border py-2 text-[11px] leading-snug text-muted-foreground">
          Autorización DIAN: Resolución N.º {res.numero}
          {res.prefijo ? ` · prefijo ${res.prefijo}` : ""} · rango{" "}
          {res.rangoDesde ?? "—"} al {res.rangoHasta ?? "—"}
          {res.vigenciaHasta
            ? ` · vigencia hasta ${fmtDate(res.vigenciaHasta)}`
            : ""}
        </p>
      )}

      {/* Nota crédito: referencia a la factura */}
      {isNote && doc.referenceNumber && (
        <p className="border-b border-border py-2 text-xs">
          Anula/corrige la factura{" "}
          <span className="font-semibold">{doc.referenceNumber}</span>
          {doc.reason ? ` · Motivo: ${doc.reason}` : ""}
        </p>
      )}

      {/* Adquiriente + pago */}
      <div className="grid grid-cols-1 gap-3 border-b border-border py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Adquiriente
          </p>
          <div className="mt-0.5 leading-tight">
            <p className="font-medium">{adq?.name ?? "Consumidor final"}</p>
            {adq?.docNumber && (
              <p className="text-muted-foreground">
                {DOC_TYPE_LABELS[adq.docType ?? ""] ?? "Doc"}: {adq.docNumber}
              </p>
            )}
            {adq?.phone && (
              <p className="text-muted-foreground">Tel: {adq.phone}</p>
            )}
            {adq?.email && <p className="text-muted-foreground">{adq.email}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pago
          </p>
          <p className="mt-0.5">
            {doc.formaPago === "2" ? "Crédito" : "Contado"}
            {doc.medioPago
              ? ` · ${MEDIO_PAGO_LABELS[doc.medioPago] ?? doc.medioPago}`
              : ""}
          </p>
        </div>
      </div>

      {/* Detalle con IVA discriminado */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium">Descripción</th>
            <th className="pb-2 text-right font-medium">Cant.</th>
            <th className="pb-2 text-right font-medium">V. Unit</th>
            <th className="pb-2 text-right font-medium">IVA</th>
            <th className="pb-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-2 pr-2">
                <span className="font-medium">{l.description}</span>
                {l.code && (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {l.code}
                  </span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{qty(l.qty)}</td>
              <td className="py-2 text-right tabular-nums">
                {money(l.unitPrice)}
              </td>
              <td className="py-2 text-right tabular-nums">{l.ivaRate}%</td>
              <td className="py-2 text-right tabular-nums">{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales + QR */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {qrImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImg}
              alt="Código QR DIAN"
              style={{ width: "2.2cm", height: "2.2cm" }}
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded border border-dashed border-border text-center text-[10px] text-muted-foreground">
              QR al validar con el PT
            </div>
          )}
          {doc.cufe && (
            <p className="mt-1 break-all font-mono text-[9px] leading-tight text-muted-foreground">
              {isNote ? "CUDE" : "CUFE"}: {doc.cufe}
            </p>
          )}
        </div>

        <div className="w-full max-w-xs space-y-1">
          <Row label="Base gravable" value={money(doc.taxableBase)} muted />
          {doc.discountTotal > 0 && (
            <Row
              label="Descuento"
              value={`−${money(doc.discountTotal)}`}
              muted
            />
          )}
          <Row label="IVA" value={money(doc.ivaTotal)} muted />
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
            <span>TOTAL</span>
            <span className="tabular-nums">{money(doc.total)}</span>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] leading-snug text-muted-foreground">
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
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={cn("tabular-nums", muted && "text-muted-foreground")}>
        {value}
      </span>
    </div>
  )
}
