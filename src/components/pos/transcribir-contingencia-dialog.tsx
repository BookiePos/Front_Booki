"use client"

import * as React from "react"
import { FileSignature, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { transcribirContingencia, type Sale } from "@/lib/pos/api-sales"
import {
  FORM_TRANSCRIPCION_VACIO,
  PLAZO_TRANSMISION_HORAS,
  validarTranscripcion,
  type CampoTranscripcion,
  type FormTranscripcion,
} from "@/lib/contingencia-fe"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import { CheckboxField, Field, FieldGrid } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado"
}

/**
 * Transcribe a documento electrónico una venta hecha en contingencia (Fase 9):
 * del talonario de papel (03/07) o sin conexión. Los errores 400/409 del
 * backend (número fuera de la serie, serie agotada, número repetido, venta con
 * otro documento…) se muestran tal cual dentro de la ficha. Exige
 * `einvoicing.issue`: quien llama no la monta sin ese permiso.
 */
export function TranscribirContingenciaDialog({
  sale,
  open,
  onOpenChange,
  onDone,
}: {
  sale: Sale | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [f, setF] = React.useState<FormTranscripcion>(FORM_TRANSCRIPCION_VACIO)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [tocado, setTocado] = React.useState(false)

  const momentoVenta = React.useMemo(() => {
    const t = sale?.createdAt ? new Date(sale.createdAt) : null
    return t && !Number.isNaN(t.getTime()) ? t : null
  }, [sale?.createdAt])

  const { errores, payload } = validarTranscripcion(f, { momentoVenta })

  function cerrar() {
    if (saving) return
    onOpenChange(false)
    setF(FORM_TRANSCRIPCION_VACIO)
    setError(null)
    setTocado(false)
  }

  function set<K extends keyof FormTranscripcion>(k: K, v: FormTranscripcion[K]) {
    setF((prev) => ({ ...prev, [k]: v }))
  }

  async function guardar() {
    setTocado(true)
    if (!sale || !payload) return
    setSaving(true)
    setError(null)
    try {
      const r = await transcribirContingencia(sale._id, payload)
      toast.success(
        r.pendientes > 0
          ? `Transcrita, pero ${r.pendientes} nota(s) quedaron sin emitir`
          : `Transcrita: ${r.documento.fullNumber ?? "documento emitido"}`,
      )
      onDone()
      setSaving(false)
      onOpenChange(false)
      setF(FORM_TRANSCRIPCION_VACIO)
      setTocado(false)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  const ver = (campo: CampoTranscripcion) => (tocado ? (errores[campo] ?? null) : null)

  return (
    <FormDialog
      busy={saving}
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(v) : cerrar())}
      size="xl"
      icon={FileSignature}
      title={`Transcribir ${sale?.saleNumber ?? "la venta"}`}
      description={`Genera el documento electrónico de una venta hecha sin BookiPos. Se transmite a la DIAN dentro de ${PLAZO_TRANSMISION_HORAS} horas desde que se superó la falla.`}
      footer={
        <>
          <Button variant="outline" onClick={cerrar} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={saving || (tocado && !payload)}>
            {saving ? <Loader2 className="animate-spin" /> : <FileSignature />}
            {saving ? "Transcribiendo…" : "Transcribir"}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <FormSection
        title="Origen de la venta"
        description="Con talonario manda el papel: su número, su fecha y su hora. Sin él, el número sale del contador de contingencia de la sede."
      >
        <CheckboxField
          id="t-papel"
          label="Se hizo en el talonario de papel"
          hint="Márcalo si la venta tiene un comprobante numerado a mano."
          checked={f.conPapel}
          onCheckedChange={(v) => set("conPapel", v)}
        />
        {f.conPapel && (
          <FieldGrid cols={3}>
            <Field
              id="t-numero"
              label="Número del papel"
              hint="Solo el número impreso, sin prefijo."
              error={ver("numero")}
            >
              <Input
                id="t-numero"
                inputMode="numeric"
                value={f.numero}
                onChange={(e) => set("numero", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field id="t-fecha" label="Fecha del papel" error={ver("fecha")}>
              <Input
                id="t-fecha"
                type="date"
                value={f.fecha}
                onChange={(e) => set("fecha", e.target.value)}
              />
            </Field>
            <Field
              id="t-hora"
              label="Hora del papel"
              hint="Opcional; sin ella, la de la venta."
              error={ver("hora")}
            >
              <Input
                id="t-hora"
                type="time"
                value={f.hora}
                onChange={(e) => set("hora", e.target.value)}
              />
            </Field>
          </FieldGrid>
        )}
      </FormSection>

      <FormSection title="Cuándo se superó la falla">
        <Field
          id="t-superada"
          label="Fecha y hora (Colombia)"
          hint={`Desde ahí corren las ${PLAZO_TRANSMISION_HORAS} h. Sin llenar: ahora si es de talonario, o cuando la venta llegó al servidor si fue sin conexión. No puede ser futura ni anterior a la venta.`}
          error={ver("superadaEn")}
        >
          <Input
            id="t-superada"
            type="datetime-local"
            value={f.superadaEn}
            onChange={(e) => set("superadaEn", e.target.value)}
          />
        </Field>
      </FormSection>
    </FormDialog>
  )
}
