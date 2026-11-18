"use client"

import * as React from "react"
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"

import {
  copiarDatosFiscales,
  listSedes,
  type ResultadoCopiaFiscal,
  type Sede,
} from "@/lib/erp/api-inventory"
import { mensajeErrorEmisor } from "@/lib/erp/asistente-fe"

import { Button } from "@/components/ui/button"
import { CheckboxField } from "@/components/ui/field"
import { FormAlert } from "@/components/ui/form-dialog"

const soloDigitos = (nit?: string) => (nit ?? "").replace(/\D/g, "").slice(0, 9)

/**
 * «¿Usar estos datos en otras sedes?»: cuando esta sede ya tiene sus datos
 * fiscales completos, ofrece copiar los del RUT a otras sedes de la empresa.
 * Quedan enlazadas al mismo emisor y comparten certificado, SoftwareID, PIN y
 * domicilio fiscal: no hay que repetir el formulario sede por sede.
 */
export function CopiarDatosASedes({ sedeId, emisorId }: { sedeId: string; emisorId: string }) {
  const [sedes, setSedes] = React.useState<Sede[] | null>(null)
  const [elegidas, setElegidas] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resultados, setResultados] = React.useState<ResultadoCopiaFiscal[] | null>(null)

  const cargar = React.useCallback(() => {
    listSedes()
      .then(setSedes)
      .catch(() => setSedes([]))
  }, [])
  React.useEffect(cargar, [cargar])

  if (!sedes) return null
  const origen = sedes.find((s) => s._id === sedeId)
  const otras = sedes.filter((s) => s._id !== sedeId && s.active !== false)
  if (otras.length === 0) return null
  const yaComparten = otras.filter((s) => s.emisorId === emisorId)
  const candidatas = otras.filter((s) => s.emisorId !== emisorId)

  function alternar(id: string, marcada: boolean) {
    setElegidas((prev) => {
      const sig = new Set(prev)
      if (marcada) sig.add(id)
      else sig.delete(id)
      return sig
    })
  }

  async function copiar() {
    if (elegidas.size === 0) return setError("Marca al menos una sede.")
    setBusy(true)
    setError(null)
    try {
      const r = await copiarDatosFiscales(sedeId, [...elegidas])
      setResultados(r)
      setElegidas(new Set())
      const bien = r.filter((x) => x.ok).length
      if (bien > 0) toast.success(`Datos copiados a ${bien} sede${bien === 1 ? "" : "s"}`)
      cargar()
    } catch (err) {
      setError(mensajeErrorEmisor(err))
    } finally {
      setBusy(false)
    }
  }

  const nombreDe = (r: ResultadoCopiaFiscal) => r.nombre ?? sedes.find((s) => s._id === r.sedeId)?.name ?? "Sede"

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4"
      aria-label="Usar estos datos en otras sedes"
    >
      <div className="flex items-center gap-2">
        <Copy className="size-4" aria-hidden />
        <h3 className="text-sm font-medium">¿Usar estos datos en otras sedes?</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Copia los datos del RUT de esta sede (NIT, razón social, tipo de persona y responsabilidades) a las sedes que
        marques. Quedan con la misma configuración de factura electrónica: certificado, SoftwareID, PIN y domicilio
        fiscal. La dirección de cada local no cambia, y la resolución de numeración sigue siendo de cada sede (cada una
        necesita su propio prefijo).
      </p>
      {yaComparten.length > 0 && (
        <p className="text-xs">
          Ya comparten esta configuración: <strong>{yaComparten.map((s) => s.name).join(", ")}</strong>.
        </p>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {candidatas.length > 0 ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {candidatas.map((s) => {
              const otroNit = !!s.nit && !!origen?.nit && soloDigitos(s.nit) !== soloDigitos(origen.nit)
              return (
                <CheckboxField
                  key={s._id}
                  id={`copiar-${s._id}`}
                  label={s.name}
                  hint={
                    otroNit
                      ? `Tiene otro NIT (${s.nit}): quedará con el de esta sede.`
                      : s.nit
                        ? "Mismo NIT, pero sus datos fiscales no coinciden."
                        : "Sin datos fiscales todavía."
                  }
                  checked={elegidas.has(s._id)}
                  onCheckedChange={(v) => alternar(s._id, v)}
                  disabled={busy}
                />
              )
            })}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={copiar} disabled={busy || elegidas.size === 0}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {elegidas.size > 1 ? `Copiar a ${elegidas.size} sedes` : "Copiar a la sede"}
            </Button>
          </div>
        </>
      ) : (
        !resultados && <p className="text-xs text-muted-foreground">Todas las sedes activas ya usan estos datos.</p>
      )}
      {resultados && (
        <ul className="flex flex-col gap-1.5 text-sm" aria-label="Resultado de la copia">
          {resultados.map((r) => (
            <li key={r.sedeId} className="flex items-start gap-2">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              )}
              <span>
                <strong>{nombreDe(r)}:</strong> {r.mensaje}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
