"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, MapPin } from "lucide-react"
import { toast } from "sonner"

import {
  configurarDomicilioEmisor,
  getMunicipiosDane,
  type BloqueoEmisor,
  type EmisorConEstado,
  type MunicipioDane,
} from "@/lib/erp/api-einvoicing"
import { mensajeErrorEmisor } from "@/lib/erp/asistente-fe"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGrid } from "@/components/ui/field"
import { FormAlert } from "@/components/ui/form-dialog"

/** Texto con el que se muestra (y se busca) un municipio en la lista. */
export const etiquetaMunicipio = (m: MunicipioDane) => `${m.municipio} — ${m.departamento} (${m.codigo})`

/**
 * Por qué la sede todavía no tiene emisor, con un enlace a cada sede que hay
 * que corregir. Antes la pantalla decía «completa NIT y razón social» aunque
 * estuvieran completos, y el dueño no tenía cómo saber que el problema era otra
 * sede del mismo NIT.
 */
export function BloqueoEmisorAviso({ bloqueo, sedeActual }: { bloqueo: BloqueoEmisor; sedeActual: string }) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <p className="font-medium">Esta sede aún no tiene emisor fiscal</p>
        <p className="text-muted-foreground">{bloqueo.mensaje}</p>
        {bloqueo.sedes.length > 0 && bloqueo.motivo !== "sin_guardar" && (
          <ul className="flex flex-wrap gap-2">
            {bloqueo.sedes.map((s) => (
              <li key={s.id}>
                <Button variant="outline" size="sm" render={<Link href={`/panel/sedes/${s.id}`} />}>
                  {s.id === sedeActual ? `Esta sede (${s.nombre})` : `Abrir ${s.nombre}`}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Domicilio fiscal del emisor: dirección, municipio y correo tal como salen en
 * el RUT. Uno por NIT: con varias sedes, cada una tiene su dirección y ninguna
 * es la fiscal, así que se fija aquí una vez y vale para todas.
 */
export function DomicilioFiscal({
  sedeId,
  datos,
  permitido,
  onCambio,
}: {
  sedeId: string
  datos: EmisorConEstado | null
  permitido: boolean
  onCambio: (d: EmisorConEstado) => void
}) {
  const emisor = datos?.emisor ?? null
  const [municipios, setMunicipios] = React.useState<MunicipioDane[] | null>(null)
  // null = no se ha tocado: se muestra lo guardado en el emisor.
  const [direccion, setDireccion] = React.useState<string | null>(null)
  const [municipioTexto, setMunicipioTexto] = React.useState<string | null>(null)
  const [correo, setCorreo] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!emisor || !permitido) return
    let activo = true
    getMunicipiosDane()
      .then((m) => activo && setMunicipios(m))
      .catch(() => activo && setMunicipios([]))
    return () => {
      activo = false
    }
  }, [emisor, permitido])

  if (!emisor || !permitido) return null

  const guardado = municipios?.find((m) => m.codigo === emisor.municipioDane)
  const dir = direccion ?? emisor.direccion ?? ""
  const mun = municipioTexto ?? (guardado ? etiquetaMunicipio(guardado) : "")
  const mail = correo ?? emisor.emailFacturacion ?? ""

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const elegido = municipios?.find((m) => etiquetaMunicipio(m) === mun.trim())
    if (!dir.trim()) return setError("Escribe la dirección del RUT.")
    if (!elegido) return setError("Elige el municipio de la lista (escribe y selecciona una opción).")
    setBusy(true)
    setError(null)
    try {
      onCambio(
        await configurarDomicilioEmisor(sedeId, {
          direccion: dir.trim(),
          municipioDane: elegido.codigo,
          ...(mail.trim() ? { emailFacturacion: mail.trim() } : {}),
        }),
      )
      setDireccion(null)
      setMunicipioTexto(null)
      setCorreo(null)
      toast.success("Domicilio fiscal guardado")
    } catch (err) {
      setError(mensajeErrorEmisor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-3 border-t pt-4" onSubmit={guardar} aria-label="Domicilio fiscal">
      <div className="flex items-center gap-2">
        <MapPin className="size-4" aria-hidden />
        <h3 className="text-sm font-medium">Domicilio fiscal</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        La dirección, el municipio y el correo del RUT. Van en cada factura y valen para todas las sedes con este NIT.
        {emisor.domicilioManual ? " Editar una sede ya no los cambia." : ""}
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <FieldGrid cols={3}>
        <Field id="dom-direccion" label="Dirección (la del RUT)">
          <Input id="dom-direccion" value={dir} onChange={(e) => setDireccion(e.target.value)} autoComplete="off" />
        </Field>
        <Field id="dom-municipio" label="Municipio" hint="Escribe el nombre y elige de la lista.">
          <Input
            id="dom-municipio"
            list="dom-municipios"
            value={mun}
            onChange={(e) => setMunicipioTexto(e.target.value)}
            placeholder={municipios ? "Ej. RIONEGRO" : "Cargando municipios…"}
            disabled={!municipios}
            autoComplete="off"
          />
          <datalist id="dom-municipios">
            {municipios?.map((m) => <option key={m.codigo} value={etiquetaMunicipio(m)} />)}
          </datalist>
        </Field>
        <Field id="dom-correo" label="Correo de facturación">
          <Input id="dom-correo" type="email" value={mail} onChange={(e) => setCorreo(e.target.value)} autoComplete="off" />
        </Field>
      </FieldGrid>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !municipios}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Guardar domicilio
        </Button>
      </div>
    </form>
  )
}
