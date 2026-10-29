"use client"

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormSection } from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"
import {
  AVISO_SIN_TIPO_DIAN,
  DIAN_DOC_TYPE_OPTIONS,
  REGIMEN_OPTIONS,
  RESPONSABILIDADES_OPTIONS,
  TIPO_PERSONA_OPTIONS,
  calcularDvNit,
  municipioDaneValido,
  type DatosFiscalesForm,
} from "@/lib/erp/datos-fiscales"

/**
 * Datos fiscales del cliente (adquiriente de la factura electrónica).
 * `dvError` es el 400 del API sobre el DV; se pega al campo. `docNumber` solo
 * se usa para sugerir el DV con el mismo módulo 11 que valida el backend.
 */
export function CustomerFiscalFields({
  value,
  onChange,
  docNumber,
  dvError,
  onDvChange,
}: {
  value: DatosFiscalesForm
  onChange: (next: DatosFiscalesForm) => void
  docNumber: string
  dvError?: string | null
  /** Se llama al teclear el DV, para limpiar el error del API. */
  onDvChange?: () => void
}) {
  const [municipioTocado, setMunicipioTocado] = React.useState(false)
  const set = <K extends keyof DatosFiscalesForm>(
    k: K,
    v: DatosFiscalesForm[K],
  ) => onChange({ ...value, [k]: v })

  const esNit = value.dianDocType === "31"
  const sugerido = esNit
    ? calcularDvNit(docNumber.replace(/\D/g, ""))
    : undefined
  const municipioMal =
    municipioTocado && !municipioDaneValido(value.municipioDane)

  function toggleResp(codigo: string, on: boolean) {
    const sin = value.responsabilidadesFiscales.filter((r) => r !== codigo)
    set("responsabilidadesFiscales", on ? [...sin, codigo] : sin)
  }

  return (
    <FormSection
      title="Datos fiscales (factura electrónica)"
      description="Opcionales. Es lo que la DIAN pide del adquiriente."
    >
      {!value.dianDocType && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {AVISO_SIN_TIPO_DIAN}.
        </p>
      )}

      <FieldGrid cols={3}>
        <FieldSpan span={2}>
          <Field id="c-dian-type" label="Tipo de documento (DIAN)">
            <NativeSelect
              id="c-dian-type"
              value={value.dianDocType}
              onChange={(v) => set("dianDocType", v)}
              placeholder="Sin tipo (consumidor final)"
              options={DIAN_DOC_TYPE_OPTIONS}
            />
          </Field>
        </FieldSpan>

        {esNit && (
          <Field
            id="c-nit-dv"
            label="DV"
            required
            error={dvError}
            hint={
              sugerido !== undefined ? (
                <>
                  Calculado para este NIT: {sugerido}.{" "}
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto p-0"
                    onClick={() => set("nitDv", String(sugerido))}
                  >
                    Usar
                  </Button>
                </>
              ) : (
                "Dígito de verificación del NIT."
              )
            }
          >
            <Input
              id="c-nit-dv"
              inputMode="numeric"
              maxLength={1}
              value={value.nitDv}
              onChange={(e) => {
                onDvChange?.()
                set("nitDv", e.target.value.replace(/\D/g, ""))
              }}
              placeholder="0"
            />
          </Field>
        )}

        <Field id="c-persona" label="Tipo de persona">
          <NativeSelect
            id="c-persona"
            value={value.tipoPersona}
            onChange={(v) => set("tipoPersona", v)}
            placeholder="Sin definir"
            options={TIPO_PERSONA_OPTIONS}
          />
        </Field>
        <Field id="c-regimen" label="Régimen">
          <NativeSelect
            id="c-regimen"
            value={value.regimen}
            onChange={(v) => set("regimen", v)}
            placeholder="Sin definir"
            options={REGIMEN_OPTIONS}
          />
        </Field>
        <Field
          id="c-dane"
          label="Municipio (código DANE)"
          error={municipioMal ? "Son 5 dígitos, por ejemplo 05001." : null}
          hint="Código DANE de 5 dígitos."
        >
          <Input
            id="c-dane"
            inputMode="numeric"
            maxLength={5}
            onBlur={() => setMunicipioTocado(true)}
            value={value.municipioDane}
            onChange={(e) =>
              set("municipioDane", e.target.value.replace(/\D/g, ""))
            }
            placeholder="05001"
          />
        </Field>

        <FieldSpan span={2}>
          <Field
            id="c-address"
            label="Dirección"
            hint="Se usa en la factura electrónica"
          >
            <Input
              id="c-address"
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle 10 # 20-30"
            />
          </Field>
        </FieldSpan>
        <Field id="c-email-fe" label="Correo de facturación">
          <Input
            id="c-email-fe"
            type="email"
            value={value.emailFacturacion}
            onChange={(e) => set("emailFacturacion", e.target.value)}
            placeholder="facturas@empresa.com"
          />
        </Field>
      </FieldGrid>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Responsabilidades fiscales
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RESPONSABILIDADES_OPTIONS.map((r) => (
            <CheckboxField
              key={r.value}
              id={`c-resp-${r.value}`}
              label={r.label}
              checked={value.responsabilidadesFiscales.includes(r.value)}
              onCheckedChange={(on) => toggleResp(r.value, on)}
            />
          ))}
        </div>
      </fieldset>
    </FormSection>
  )
}
