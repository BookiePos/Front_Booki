"use client"

import * as React from "react"

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

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const RESP_FISCAL_LABELS: Record<ResponsabilidadFiscal, string> = {
  responsable_iva: "Responsable de IVA",
  no_responsable_iva: "No responsable de IVA",
  regimen_simple: "Régimen Simple (SIMPLE)",
  gran_contribuyente: "Gran contribuyente",
}

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

export interface SedeSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  sede?: Sede
  onSuccess: (sede: Sede) => void
}

/** Sheet reutilizable para crear o editar una sede. */
export function SedeSheet({ open, onOpenChange, mode, sede, onSuccess }: SedeSheetProps) {
  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [businessName, setBusinessName] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [nit, setNit] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [legalNote, setLegalNote] = React.useState("")
  const [active, setActive] = React.useState(true)
  const [fiscal, setFiscal] = React.useState<FiscalForm>(EMPTY_FISCAL)
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
        setFiscal({
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
        })
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
      onSuccess(result)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {mode === "create" ? "Nueva sede" : "Editar sede"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Registra una nueva sede o local para operar el negocio."
              : "Modifica los datos de la sede."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-code">Código</Label>
            <Input
              id="s-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej. centro, norte…"
              required
            />
            <p className="text-xs text-muted-foreground">
              Identificador corto y único de la sede.
            </p>
          </div>

          <div className="flex flex-col gap-1.5" data-tour="sede-nombre">
            <Label htmlFor="s-name">Nombre</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sede Centro"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-business">Nombre del negocio (factura)</Label>
            <Input
              id="s-business"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. Comercial La 50"
            />
            <p className="text-xs text-muted-foreground">
              Aparece como título en la factura. Si se deja vacío, se usa el
              nombre de la sede.
            </p>
          </div>

          <div className="flex flex-col gap-1.5" data-tour="sede-direccion">
            <Label htmlFor="s-address">Dirección (opcional)</Label>
            <Input
              id="s-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle 10 # 5-20, Centro"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-nit">NIT (opcional)</Label>
              <Input
                id="s-nit"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                placeholder="900.123.456-7"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-phone">Teléfono (opcional)</Label>
              <Input
                id="s-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="310 000 0000"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-legal">Leyenda legal al pie (opcional)</Label>
            <Input
              id="s-legal"
              value={legalNote}
              onChange={(e) => setLegalNote(e.target.value)}
              placeholder="Ej. Régimen simple. No responsable de IVA."
            />
            <p className="text-xs text-muted-foreground">
              Texto que aparece al final de la factura.
            </p>
          </div>

          {/* Facturación electrónica (opcional, colapsable) */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium">
              Facturación electrónica (opcional)
            </summary>
            <div className="flex flex-col gap-3 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                Datos fiscales del emisor y la resolución de numeración DIAN.
                Necesarios para emitir la factura electrónica.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-nitdv">Dígito de verificación (DV)</Label>
                  <Input
                    id="s-nitdv"
                    value={fiscal.nitDv}
                    onChange={(e) => setF("nitDv", e.target.value)}
                    placeholder="7"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-ciiu">Actividad (CIIU)</Label>
                  <Input
                    id="s-ciiu"
                    value={fiscal.ciiu}
                    onChange={(e) => setF("ciiu", e.target.value)}
                    placeholder="5611"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-tipoper">Tipo de persona</Label>
                  <Select
                    value={fiscal.tipoPersona}
                    items={{ natural: "Natural", juridica: "Jurídica" }}
                    onValueChange={(v) => {
                      if (v !== null) setF("tipoPersona", v as string)
                    }}
                  >
                    <SelectTrigger id="s-tipoper" className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="juridica">Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-resp">Responsabilidad fiscal</Label>
                  <Select
                    value={fiscal.responsabilidadFiscal}
                    items={RESP_FISCAL_LABELS}
                    onValueChange={(v) => {
                      if (v !== null) setF("responsabilidadFiscal", v as string)
                    }}
                  >
                    <SelectTrigger id="s-resp" className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(RESP_FISCAL_LABELS) as [string, string][]
                      ).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-depto">Departamento</Label>
                  <Input
                    id="s-depto"
                    value={fiscal.departamento}
                    onChange={(e) => setF("departamento", e.target.value)}
                    placeholder="Antioquia"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-ciudad">Ciudad</Label>
                  <Input
                    id="s-ciudad"
                    value={fiscal.ciudad}
                    onChange={(e) => setF("ciudad", e.target.value)}
                    placeholder="Rionegro"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-femail">Correo de facturación</Label>
                <Input
                  id="s-femail"
                  type="email"
                  value={fiscal.emailFacturacion}
                  onChange={(e) => setF("emailFacturacion", e.target.value)}
                  placeholder="facturacion@negocio.com"
                />
              </div>

              <p className="pt-1 text-xs font-medium text-foreground">
                Resolución de numeración DIAN
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-resnum">N.º resolución</Label>
                  <Input
                    id="s-resnum"
                    value={fiscal.resNumero}
                    onChange={(e) => setF("resNumero", e.target.value)}
                    placeholder="18760000001"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-resfecha">Fecha resolución</Label>
                  <Input
                    id="s-resfecha"
                    type="date"
                    value={fiscal.resFecha}
                    onChange={(e) => setF("resFecha", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-prefijo">Prefijo</Label>
                  <Input
                    id="s-prefijo"
                    value={fiscal.resPrefijo}
                    onChange={(e) => setF("resPrefijo", e.target.value)}
                    placeholder="FE"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-desde">Rango desde</Label>
                  <Input
                    id="s-desde"
                    type="number"
                    min="0"
                    value={fiscal.resDesde}
                    onChange={(e) => setF("resDesde", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-hasta">Rango hasta</Label>
                  <Input
                    id="s-hasta"
                    type="number"
                    min="0"
                    value={fiscal.resHasta}
                    onChange={(e) => setF("resHasta", e.target.value)}
                    placeholder="5000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-vigd">Vigencia desde</Label>
                  <Input
                    id="s-vigd"
                    type="date"
                    value={fiscal.resVigDesde}
                    onChange={(e) => setF("resVigDesde", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-vigh">Vigencia hasta</Label>
                  <Input
                    id="s-vigh"
                    type="date"
                    value={fiscal.resVigHasta}
                    onChange={(e) => setF("resVigHasta", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-clave">Clave técnica</Label>
                <Input
                  id="s-clave"
                  value={fiscal.resClave}
                  onChange={(e) => setF("resClave", e.target.value)}
                  placeholder="Clave técnica de la DIAN"
                />
              </div>
            </div>
          </details>

          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="s-active"
                checked={active}
                onCheckedChange={(v) => setActive(Boolean(v))}
              />
              <Label htmlFor="s-active">Sede activa</Label>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <SheetFooter className="px-0 pt-2">
            <SheetClose render={<Button variant="outline" type="button" />}>
              Cancelar
            </SheetClose>
            <Button type="submit" data-tour="sede-guardar" disabled={saving}>
              {saving
                ? "Guardando…"
                : mode === "create"
                  ? "Crear sede"
                  : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
