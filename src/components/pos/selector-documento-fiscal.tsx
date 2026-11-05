"use client"

import * as React from "react"
import { Info } from "lucide-react"
import type { Customer, DocumentoFiscalSolicitado } from "@/lib/pos/api-sales"
import {
  AVISO_CONSUMIDOR_FINAL,
  SALIDAS_FISCALES,
  separarNitConDv,
} from "@/lib/pos/documento-fiscal"
import { DIAN_DOC_TYPE_OPTIONS, calcularDvNit } from "@/lib/erp/datos-fiscales"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/**
 * Las tres salidas de la caja (D1 del anexo POS): tiquete POS a consumidor
 * final, tiquete POS con los datos del cliente o factura electrónica.
 *
 * Radios nativos dentro de un `radiogroup` con nombre: el navegador ya da las
 * flechas del teclado, el foco y la etiqueta de cada opción, cosa que una
 * botonera con `role="radio"` tendría que reimplementar.
 */
export function SelectorDocumentoFiscal({
  value,
  onChange,
  fevDisponible = true,
}: {
  value: DocumentoFiscalSolicitado
  onChange: (v: DocumentoFiscalSolicitado) => void
  /** Sin resolución de factura vigente, «Quiero factura» se ve pero no se elige. */
  fevDisponible?: boolean
}) {
  const id = React.useId()
  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-titulo`} className="text-xs font-medium text-muted-foreground">
        ¿Qué documento se lleva el cliente?
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-titulo`}
        className="flex flex-col gap-1.5"
      >
        {SALIDAS_FISCALES.map((s) => {
          const activo = value === s.value
          const deshabilitada = s.value === "fev" && !fevDisponible
          return (
            <label
              key={s.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-colors",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/45",
                activo
                  ? "border-primary/60 bg-primary/5"
                  : "border-border hover:bg-muted/60",
                deshabilitada && "cursor-not-allowed opacity-60 hover:bg-transparent",
              )}
            >
              <input
                type="radio"
                name={`${id}-salida`}
                value={s.value}
                checked={activo}
                disabled={deshabilitada}
                onChange={() => onChange(s.value)}
                aria-describedby={`${id}-${s.value}`}
                className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 text-[0.8125rem]">
                <span className="block font-medium text-foreground">{s.label}</span>
                <span id={`${id}-${s.value}`} className="block text-xs text-muted-foreground">
                  {deshabilitada
                    ? "Esta sede no tiene resolución de factura vigente."
                    : s.descripcion}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {value === "pos_anonimo" && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {AVISO_CONSUMIDOR_FINAL}
        </p>
      )}
    </div>
  )
}

/**
 * Tipo de documento DIAN y DV del NIT, para el tiquete con datos y la factura.
 * Se suman a los campos de «Datos para la factura» (nombre y número) en vez de
 * duplicar el formulario del cliente. El DV se valida con el módulo 11; si no
 * coincide se dice cuál debería ser, que es lo que el cajero puede corregir con
 * el RUT del cliente delante.
 */
export function CamposDocumentoCliente({
  customer,
  setCustomer,
  requerido,
}: {
  customer: Customer
  setCustomer: React.Dispatch<React.SetStateAction<Customer>>
  /** En el tiquete con datos el tipo es obligatorio; en la factura, opcional. */
  requerido: boolean
}) {
  const id = React.useId()
  const esNit = customer.docType === "31"
  // La base es lo que va antes del guion: «900123456-7» no es la base 9001234567.
  const base = separarNitConDv(customer.idNumber)?.base ?? ""
  const sugerido = esNit && base ? calcularDvNit(base) : undefined
  const dvMal =
    esNit && !!customer.nitDv && sugerido !== undefined && customer.nitDv !== String(sugerido)

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={`${id}-tipo`} className="text-xs">
          Tipo de documento{requerido ? "" : " (opcional)"}
        </Label>
        <NativeSelect
          id={`${id}-tipo`}
          value={customer.docType ?? ""}
          onChange={(v) =>
            setCustomer((c) => ({
              ...c,
              docType: v || undefined,
              nitDv: v === "31" ? c.nitDv : undefined,
            }))
          }
          options={DIAN_DOC_TYPE_OPTIONS}
          placeholder="Elige el tipo"
          aria-invalid={requerido && !customer.docType ? true : undefined}
        />
      </div>
      {esNit && (
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor={`${id}-dv`} className="text-xs">
            DV
          </Label>
          <Input
            id={`${id}-dv`}
            inputMode="numeric"
            maxLength={1}
            value={customer.nitDv ?? ""}
            onChange={(e) =>
              setCustomer((c) => ({
                ...c,
                nitDv: e.target.value.replace(/\D/g, "").slice(0, 1) || undefined,
              }))
            }
            aria-invalid={dvMal || undefined}
            aria-describedby={dvMal ? `${id}-dv-error` : undefined}
          />
        </div>
      )}
      {dvMal && (
        <p id={`${id}-dv-error`} className="text-xs text-destructive sm:col-span-2">
          El DV de ese NIT es {sugerido}.
        </p>
      )}
    </div>
  )
}
