"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Termino } from "@/components/ui/help-tip"

/**
 * Campo numérico de nómina con su unidad a la vista.
 *
 * Reemplaza al `<input type="number">` pelado, cuyas flechitas subían de 1 en 1
 * sin decir si el número era en pesos, en horas o en salarios mínimos. Aquí
 * los pesos llevan el punto de miles (`MoneyInput`) y las horas y los días
 * dicen su unidad al lado; sin flechas, porque en nómina nadie cuenta de a uno.
 */
export function CampoNomina({
  id,
  label,
  unidad,
  value,
  onChange,
  ayuda,
  termino,
  placeholder,
}: {
  id: string
  label: string
  unidad: "pesos" | "horas" | "dias"
  /** Texto tal como lo maneja el formulario ("" = vacío). */
  value: string
  onChange: (v: string) => void
  /** Una línea debajo que explica qué poner. */
  ayuda?: React.ReactNode
  termino?: React.ComponentProps<typeof Termino>["term"]
  placeholder?: string
}) {
  const etiqueta = termino ? <Termino term={termino}>{label}</Termino> : label
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px]">
        {etiqueta}
      </Label>
      {unidad === "pesos" ? (
        <MoneyInput
          id={id}
          value={value.trim() === "" ? null : Number(value)}
          onValueChange={(n) => onChange(n === null ? "" : String(n))}
          placeholder={placeholder ?? "0"}
        />
      ) : (
        <div className="relative">
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder={placeholder ?? "0"}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
            className="pr-14 tabular-nums"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {unidad === "horas" ? "horas" : "días"}
          </span>
        </div>
      )}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  )
}
