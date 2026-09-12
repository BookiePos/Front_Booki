"use client"

import * as React from "react"
import { Store, Loader2, FileText, MapPin, Receipt } from "lucide-react"

import {
  createSede,
  updateSede,
  type Sede,
  type CreateSedePayload,
  type UpdateSedePayload,
  type SedeFiscalFields,
  type ResolucionFe,
  type TipoPersona,
  type ResponsabilidadFiscal,
} from "@/lib/erp/api-inventory"
import { ApiError } from "@/lib/api"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormDialog,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"

const RESP_FISCAL_LABELS: Record<ResponsabilidadFiscal, string> = {
  responsable_iva: "Responsable de IVA",
  no_responsable_iva: "No responsable de IVA",
  regimen_simple: "Régimen Simple (SIMPLE)",
  gran_contribuyente: "Gran contribuyente",
}

const RESP_FISCAL_OPTIONS = (
  Object.entries(RESP_FISCAL_LABELS) as [ResponsabilidadFiscal, string][]
).map(([value, label]) => ({ value, label }))

const TIPO_PERSONA_OPTIONS = [
  { value: "natural", label: "Natural — una persona" },
  { value: "juridica", label: "Jurídica — una empresa" },
]

interface FiscalForm {
  nitDv: string
  tipoPersona: string
  responsabilidadFiscal: string
  ciiu: string
  departamento: string
  ciudad: string
  emailFacturacion: string
  resNumero: string
  resFecha: string
  resPrefijo: string
  resDesde: string
  resHasta: string
  resVigDesde: string
  resVigHasta: string
  resClave: string
}

const EMPTY_FISCAL: FiscalForm = {
  nitDv: "",
  tipoPersona: "",
  responsabilidadFiscal: "",
  ciiu: "",
  departamento: "",
  ciudad: "",
  emailFacturacion: "",
  resNumero: "",
  resFecha: "",
  resPrefijo: "",
  resDesde: "",
  resHasta: "",
  resVigDesde: "",
  resVigHasta: "",
  resClave: "",
}

const isoDate = (s?: string) => (s ? s.slice(0, 10) : "")

/** Arma el bloque de campos fiscales para el payload (omite vacíos). */
function buildFiscalPayload(f: FiscalForm): SedeFiscalFields {
  const res: ResolucionFe = {
    numero: f.resNumero.trim() || undefined,
    fechaResolucion: f.resFecha || undefined,
    prefijo: f.resPrefijo.trim().toUpperCase() || undefined,
    rangoDesde: f.resDesde ? Number(f.resDesde) : undefined,
    rangoHasta: f.resHasta ? Number(f.resHasta) : undefined,
    vigenciaDesde: f.resVigDesde || undefined,
    vigenciaHasta: f.resVigHasta || undefined,
    claveTecnica: f.resClave.trim() || undefined,
  }
  const hasRes = Object.values(res).some((v) => v !== undefined)
  return {
    nitDv: f.nitDv.trim() || undefined,
    tipoPersona: (f.tipoPersona || undefined) as TipoPersona | undefined,
    responsabilidadFiscal: (f.responsabilidadFiscal || undefined) as
      | ResponsabilidadFiscal
      | undefined,
    ciiu: f.ciiu.trim() || undefined,
    departamento: f.departamento.trim() || undefined,
    ciudad: f.ciudad.trim() || undefined,
    emailFacturacion: f.emailFacturacion.trim() || undefined,
    resolucionFe: hasRes ? res : undefined,
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

export interface SedeDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  sede?: Sede
  onSuccess: (sede: Sede) => void
}

/** Id del `<form>`: el botón de guardar vive en el pie, fuera del formulario. */
const FORM_ID = "sede-form"

/**
 * Ficha para crear o editar una sede.
 *
 * Los datos fiscales siguen plegados, pero ya no en un `<details>` de sistema:
 * lo que abre la sección es un interruptor explícito, porque la mayoría de los
 * negocios crea la sede antes de tener la resolución de la DIAN y no tiene
 * sentido enseñarle catorce campos que no puede llenar todavía.
 */
export function SedeDialog({
  open,
  onOpenChange,
  mode,
  sede,
  onSuccess,
}: SedeDialogProps) {
  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [businessName, setBusinessName] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [nit, setNit] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [legalNote, setLegalNote] = React.useState("")
  const [active, setActive] = React.useState(true)
  const [fiscal, setFiscal] = React.useState<FiscalForm>(EMPTY_FISCAL)
  const [showFiscal, setShowFiscal] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function setF<K extends keyof FiscalForm>(key: K, value: FiscalForm[K]) {
    setFiscal((prev) => ({ ...prev, [key]: value }))
  }

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && sede) {
        setCode(sede.code)
        setName(sede.name)
        setBusinessName(sede.businessName ?? "")
        setAddress(sede.address ?? "")
        setNit(sede.nit ?? "")
        setPhone(sede.phone ?? "")
        setLegalNote(sede.legalNote ?? "")
        setActive(sede.active)
        const r = sede.resolucionFe ?? {}
        const next: FiscalForm = {
          nitDv: sede.nitDv ?? "",
          tipoPersona: sede.tipoPersona ?? "",
          responsabilidadFiscal: sede.responsabilidadFiscal ?? "",
          ciiu: sede.ciiu ?? "",
          departamento: sede.departamento ?? "",
          ciudad: sede.ciudad ?? "",
          emailFacturacion: sede.emailFacturacion ?? "",
          resNumero: r.numero ?? "",
          resFecha: isoDate(r.fechaResolucion),
          resPrefijo: r.prefijo ?? "",
          resDesde: r.rangoDesde != null ? String(r.rangoDesde) : "",
          resHasta: r.rangoHasta != null ? String(r.rangoHasta) : "",
          resVigDesde: isoDate(r.vigenciaDesde),
          resVigHasta: isoDate(r.vigenciaHasta),
          resClave: r.claveTecnica ?? "",
        }
        setFiscal(next)
        // Si la sede ya trae datos fiscales, la sección se abre sola: esconder
        // lo que ya está lleno haría pensar que se perdió.
        setShowFiscal(Object.values(next).some((v) => v !== ""))
      } else {
        setCode("")
        setName("")
        setBusinessName("")
        setAddress("")
        setNit("")
        setPhone("")
        setLegalNote("")
        setActive(true)
        setFiscal(EMPTY_FISCAL)
        setShowFiscal(false)
      }
      setError(null)
    }
    void reset()
  }, [open, mode, sede])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let result: Sede
      const fiscalPayload = buildFiscalPayload(fiscal)
      if (mode === "create") {
        const payload: CreateSedePayload = {
          code: code.trim(),
          name: name.trim(),
          businessName: businessName.trim() || undefined,
          address: address.trim() || undefined,
          nit: nit.trim() || undefined,
          phone: phone.trim() || undefined,
          legalNote: legalNote.trim() || undefined,
          ...fiscalPayload,
        }
        result = await createSede(payload)
      } else if (sede) {
        const payload: UpdateSedePayload = {
          code: code.trim(),
          name: name.trim(),
          businessName: businessName.trim(),
          address: address.trim(),
          nit: nit.trim(),
          phone: phone.trim(),
          legalNote: legalNote.trim(),
          active,
          ...fiscalPayload,
        }
        result = await updateSede(sede._id, payload)
      } else {
        return
      }
      toast.success(mode === "create" ? "Sede creada" : "Sede actualizada")
      onSuccess(result)
      onOpenChange(false)
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={Store}
      title={mode === "create" ? "Nueva sede" : "Editar sede"}
      description={
        mode === "create"
          ? "Cada sede lleva su propio inventario y su propia caja. Solo el código y el nombre son obligatorios."
          : `Datos del local, de la factura y de la DIAN · ${sede?.name ?? ""}`
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            data-tour="sede-guardar"
            disabled={saving}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Store />}
            {saving
              ? "Guardando…"
              : mode === "create"
                ? "Crear sede"
                : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <FormAlert>{error}</FormAlert>}

        {/* ── Identificación ─────────────────────────────────────── */}
        <FormSection
          icon={MapPin}
          title="La sede"
          description="Cómo la reconoces tú dentro del sistema."
        >
          <FieldGrid cols={3}>
            <Field
              id="s-code"
              label="Código"
              required
              hint="Corto y único: centro, norte, bodega."
            >
              <Input
                id="s-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="centro"
                required
              />
            </Field>
            <FieldSpan span={2}>
              <Field id="s-name" label="Nombre" required>
                <Input
                  id="s-name"
                  data-tour="sede-nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sede Centro"
                  required
                />
              </Field>
            </FieldSpan>

            <FieldSpan span={2}>
              <Field
                id="s-address"
                label="Dirección"
                hint="Sale impresa en la factura y en el tiquete."
              >
                <Input
                  id="s-address"
                  data-tour="sede-direccion"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle 10 # 5-20, Centro"
                />
              </Field>
            </FieldSpan>
            <Field id="s-phone" label="Teléfono">
              <Input
                id="s-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="310 000 0000"
              />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* ── Cómo sale en la factura ────────────────────────────── */}
        <FormSection
          icon={FileText}
          title="Cómo sale en la factura"
          description="Lo que el cliente lee en el papel que se lleva."
        >
          <FieldGrid cols={3}>
            <FieldSpan span={2}>
              <Field
                id="s-business"
                label="Nombre del negocio"
                hint="Si lo dejas vacío usamos el nombre de la sede."
              >
                <Input
                  id="s-business"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Comercial La 50"
                />
              </Field>
            </FieldSpan>
            <Field id="s-nit" label="NIT" help={{ term: "nit" }}>
              <Input
                id="s-nit"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                placeholder="900.123.456-7"
              />
            </Field>
            <FieldSpan span={3}>
              <Field
                id="s-legal"
                label="Leyenda legal al pie"
                hint="Texto que aparece al final de la factura."
              >
                <Input
                  id="s-legal"
                  value={legalNote}
                  onChange={(e) => setLegalNote(e.target.value)}
                  placeholder="Régimen simple. No responsable de IVA."
                />
              </Field>
            </FieldSpan>
          </FieldGrid>
        </FormSection>

        {/* ── Facturación electrónica (opcional) ─────────────────── */}
        <FormSection
          icon={Receipt}
          title="Facturación electrónica"
          description="Solo si ya vas a emitir factura electrónica. Puedes llenarlo después."
          boxed
        >
          <CheckboxField
            id="s-fiscal-toggle"
            label="Configurar los datos de la DIAN"
            hint="Datos fiscales del emisor y la resolución de numeración."
            help={{ term: "facturaElectronica" }}
            checked={showFiscal}
            onCheckedChange={setShowFiscal}
          />

          {showFiscal && (
            <div className="flex flex-col gap-4 pt-1">
              <FieldGrid cols={3}>
                <Field
                  id="s-nitdv"
                  label="Dígito de verificación"
                  help={{ term: "dv" }}
                >
                  <Input
                    id="s-nitdv"
                    inputMode="numeric"
                    value={fiscal.nitDv}
                    onChange={(e) => setF("nitDv", e.target.value)}
                    placeholder="7"
                  />
                </Field>
                <Field
                  id="s-ciiu"
                  label="Actividad (CIIU)"
                  help={{
                    title: "Código CIIU",
                    children:
                      "El número con el que la DIAN clasifica a qué se dedica tu negocio. Aparece en tu RUT: 5611 es restaurante, 4711 tienda de víveres.",
                  }}
                >
                  <Input
                    id="s-ciiu"
                    inputMode="numeric"
                    value={fiscal.ciiu}
                    onChange={(e) => setF("ciiu", e.target.value)}
                    placeholder="5611"
                  />
                </Field>
                <Field id="s-tipoper" label="Tipo de persona">
                  <NativeSelect
                    id="s-tipoper"
                    value={fiscal.tipoPersona}
                    onChange={(v) => setF("tipoPersona", v)}
                    options={TIPO_PERSONA_OPTIONS}
                    placeholder="Seleccionar"
                  />
                </Field>

                <FieldSpan span={3}>
                  <Field
                    id="s-resp"
                    label="Responsabilidad fiscal"
                    help={{ term: "responsableIva" }}
                  >
                    <NativeSelect
                      id="s-resp"
                      value={fiscal.responsabilidadFiscal}
                      onChange={(v) => setF("responsabilidadFiscal", v)}
                      options={RESP_FISCAL_OPTIONS}
                      placeholder="Seleccionar"
                    />
                  </Field>
                </FieldSpan>

                <Field id="s-depto" label="Departamento">
                  <Input
                    id="s-depto"
                    value={fiscal.departamento}
                    onChange={(e) => setF("departamento", e.target.value)}
                    placeholder="Antioquia"
                  />
                </Field>
                <Field id="s-ciudad" label="Ciudad">
                  <Input
                    id="s-ciudad"
                    value={fiscal.ciudad}
                    onChange={(e) => setF("ciudad", e.target.value)}
                    placeholder="Rionegro"
                  />
                </Field>
                <Field id="s-femail" label="Correo de facturación">
                  <Input
                    id="s-femail"
                    type="email"
                    value={fiscal.emailFacturacion}
                    onChange={(e) => setF("emailFacturacion", e.target.value)}
                    placeholder="facturacion@negocio.com"
                  />
                </Field>
              </FieldGrid>

              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="mb-3 text-[0.8125rem] font-bold text-foreground">
                  Resolución de numeración
                </p>
                <FieldGrid cols={3}>
                  <Field
                    id="s-resnum"
                    label="N.º de resolución"
                    help={{ term: "resolucion" }}
                  >
                    <Input
                      id="s-resnum"
                      value={fiscal.resNumero}
                      onChange={(e) => setF("resNumero", e.target.value)}
                      placeholder="18760000001"
                    />
                  </Field>
                  <Field id="s-resfecha" label="Fecha de la resolución">
                    <Input
                      id="s-resfecha"
                      type="date"
                      value={fiscal.resFecha}
                      onChange={(e) => setF("resFecha", e.target.value)}
                    />
                  </Field>
                  <Field
                    id="s-prefijo"
                    label="Prefijo"
                    help={{ term: "prefijo" }}
                  >
                    <Input
                      id="s-prefijo"
                      value={fiscal.resPrefijo}
                      onChange={(e) => setF("resPrefijo", e.target.value)}
                      placeholder="FE"
                    />
                  </Field>

                  <Field
                    id="s-desde"
                    label="Rango desde"
                    help={{ term: "rangoNumeracion" }}
                  >
                    <Input
                      id="s-desde"
                      type="number"
                      min="0"
                      value={fiscal.resDesde}
                      onChange={(e) => setF("resDesde", e.target.value)}
                      placeholder="1"
                    />
                  </Field>
                  <Field id="s-hasta" label="Rango hasta">
                    <Input
                      id="s-hasta"
                      type="number"
                      min="0"
                      value={fiscal.resHasta}
                      onChange={(e) => setF("resHasta", e.target.value)}
                      placeholder="5000"
                    />
                  </Field>
                  <Field
                    id="s-clave"
                    label="Clave técnica"
                    help={{
                      title: "Clave técnica",
                      children:
                        "Una clave que la DIAN entrega junto con la resolución y que se usa para firmar cada factura. Se copia tal cual del documento: no se inventa.",
                    }}
                  >
                    <Input
                      id="s-clave"
                      value={fiscal.resClave}
                      onChange={(e) => setF("resClave", e.target.value)}
                      placeholder="Clave técnica de la DIAN"
                    />
                  </Field>

                  <Field id="s-vigd" label="Vigencia desde">
                    <Input
                      id="s-vigd"
                      type="date"
                      value={fiscal.resVigDesde}
                      onChange={(e) => setF("resVigDesde", e.target.value)}
                    />
                  </Field>
                  <Field id="s-vigh" label="Vigencia hasta">
                    <Input
                      id="s-vigh"
                      type="date"
                      value={fiscal.resVigHasta}
                      onChange={(e) => setF("resVigHasta", e.target.value)}
                    />
                  </Field>
                </FieldGrid>
              </div>
            </div>
          )}
        </FormSection>

        {mode === "edit" && (
          <CheckboxField
            id="s-active"
            label="Sede activa"
            hint="Una sede inactiva deja de aparecer en el POS y en los selectores, pero conserva su historial."
            checked={active}
            onCheckedChange={setActive}
          />
        )}
      </form>
    </FormDialog>
  )
}
