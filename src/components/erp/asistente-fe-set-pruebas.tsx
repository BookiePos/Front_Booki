"use client"

import * as React from "react"
import { BadgeCheck, FlaskConical, Loader2, RefreshCw } from "lucide-react"

import {
  confirmarHabilitacionPortalFactura,
  enviarSetPruebasFactura,
  getEmisorConEstado,
  getEstadoSetPruebasFactura,
  getSetPruebasFactura,
  type EmisorConEstado,
  type HabilitacionFacturaVista,
} from "@/lib/erp/api-einvoicing"
import { mensajeErrorEmisor } from "@/lib/erp/asistente-fe"
import {
  ETIQUETA_ACCION_SET,
  ETIQUETA_DOC_SET_FACTURA,
  ETIQUETA_FASE_SET,
  estadoSetPruebas,
  faltantesSetPruebas,
  textoFaseSet,
} from "@/lib/erp/set-pruebas-fe"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { FormAlert } from "@/components/ui/form-dialog"

/**
 * Set de pruebas de habilitación de la FACTURA: lo envía a la DIAN y muestra en
 * qué va. Enviar, reconsultar y confirmar el portal piden `einvoicing.certificate`
 * (los mismos permisos que exige el backend); el estado guardado que se lee al abrir
 * solo pide `einvoicing.configure`, que ya tiene quien ve este asistente. Los 409
 * del servidor ya vienen explicados en español y se muestran tal cual.
 */
export function SetPruebasFe({
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
  const confirm = useConfirm()
  const emisor = datos?.emisor ?? null
  const faltantes = faltantesSetPruebas(emisor)
  const listo = faltantes.length === 0
  const [vista, setVista] = React.useState<HabilitacionFacturaVista | null>(null)
  const [busy, setBusy] = React.useState<"enviar" | "consultar" | "confirmar" | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const habilitado = !!emisor?.habilitado

  // Al quedar aceptado, el backend enciende `habilitado`: se relee el emisor para que el checklist lo refleje.
  function recibir(v: HabilitacionFacturaVista) {
    setVista(v)
    if (v.listoParaProduccion && !habilitado) {
      void getEmisorConEstado(sedeId).then(onCambio).catch(() => undefined)
    }
  }
  const recibirRef = React.useRef(recibir)
  React.useEffect(() => {
    recibirRef.current = recibir
  })

  // Estado guardado del set al abrir: solo lectura, sin ir a la DIAN ni auditar. Lo ve también quien no
  // puede enviar (solo `einvoicing.configure`), y no depende de tener ya el certificado o el TestSetId.
  const hayEmisor = !!emisor
  React.useEffect(() => {
    if (!hayEmisor) return
    let activo = true
    getEstadoSetPruebasFactura(sedeId)
      .then((v) => activo && recibirRef.current(v))
      // Sin estado no se bloquea nada: el botón sigue disponible y el servidor dirá qué pasa.
      .catch(() => undefined)
    return () => {
      activo = false
    }
  }, [sedeId, hayEmisor])

  if (!emisor) return null

  const est = estadoSetPruebas(vista)
  // Con el emisor ya habilitado y sin vista cargada, el set está aprobado.
  const fase = vista ? est.fase : habilitado ? "aceptado" : est.fase
  const accion = fase === "aceptado" ? null : est.accion
  const puedeConfirmar = fase === "por_confirmar" && !!vista?.puedeConfirmarPortal

  // El dueño afirma lo que ve en el portal de la DIAN: queda auditado a su nombre y marca la sede lista para
  // producción, así que se pide confirmación explícita.
  async function confirmarPortal() {
    const ok = await confirm({
      title: "¿Ya figura habilitado en el portal de la DIAN?",
      description:
        "Confírmalo solo si en el portal de habilitación de la DIAN el software ya aparece como habilitado. La sede quedará lista para producción con tu nombre como constancia; el paso a producción lo das tú después.",
      confirmLabel: "Sí, ya figura habilitado",
    })
    if (!ok) return
    setBusy("confirmar")
    setError(null)
    try {
      recibir(await confirmarHabilitacionPortalFactura(sedeId))
    } catch (e) {
      setError(mensajeErrorEmisor(e))
    } finally {
      setBusy(null)
    }
  }

  async function ejecutar(tipo: "enviar" | "consultar") {
    if (tipo === "enviar") {
      const ok = await confirm({
        title: accion ? ETIQUETA_ACCION_SET[accion] : "Enviar set de pruebas",
        description:
          "BookiPos firmará con tu certificado y enviará a la DIAN, en el ambiente de habilitación, los documentos de prueba que faltan (facturas y notas). No toca tu numeración ni tus ventas. Puede tardar hasta un minuto.",
        confirmLabel: accion ? ETIQUETA_ACCION_SET[accion] : "Enviar",
      })
      if (!ok) return
    }
    setBusy(tipo)
    setError(null)
    try {
      recibir(tipo === "enviar" ? await enviarSetPruebasFactura(sedeId) : await getSetPruebasFactura(sedeId))
    } catch (e) {
      setError(mensajeErrorEmisor(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-4" aria-label="Set de pruebas de habilitación">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="size-4" aria-hidden />
        <h3 className="text-sm font-medium">Set de pruebas de habilitación</h3>
        <Badge variant={fase === "aceptado" ? "default" : "outline"}>{ETIQUETA_FASE_SET[fase]}</Badge>
      </div>

      <div className="flex flex-col gap-2 text-sm" role="status" aria-live="polite">
        <p className="text-muted-foreground">{textoFaseSet({ ...est, fase })}</p>
        {vista?.mensaje && fase !== "sin_iniciar" && <p className="text-xs text-muted-foreground">{vista.mensaje}</p>}
        {fase === "aceptado" && vista?.confirmadoEnPortal && (
          <p className="text-xs text-muted-foreground">
            Lo confirmaste tú con lo que muestra el portal de la DIAN (no fue un veredicto del servicio web).
          </p>
        )}
      </div>

      {fase === "rechazado" && est.motivos.length > 0 && (
        <FormAlert>
          <span className="font-medium">Motivos de la DIAN</span>
          <ul className="mt-1 list-disc pl-4">
            {est.motivos.map((m) => (
              <li key={m} className="break-words">
                {m}
              </li>
            ))}
          </ul>
        </FormAlert>
      )}
      {vista?.error && <FormAlert tone="warning">{vista.error}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}

      {vista && vista.documentos.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none py-1">
            Ver los {vista.documentos.length} documentos del set
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {vista.documentos.map((d) => (
              <li key={`${d.tipo}-${d.numero}`} className="break-words">
                {d.etiqueta} {d.numero}: {ETIQUETA_DOC_SET_FACTURA[d.estado]}
                {d.mensaje ? ` — ${d.mensaje}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {fase === "aceptado" ? null : !permitido ? (
        <p className="text-xs text-muted-foreground">Solo el Dueño puede enviar el set de pruebas.</p>
      ) : (
        <>
          {!listo && accion && (
            <p id="set-pruebas-falta" className="text-xs text-muted-foreground">
              Para enviarlo falta: {faltantes.join(", ")}.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {est.puedeActualizar && (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void ejecutar("consultar")}>
                {busy === "consultar" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                Actualizar estado
              </Button>
            )}
            {accion && (
              <Button
                type="button"
                disabled={!listo || busy !== null}
                aria-describedby={listo ? undefined : "set-pruebas-falta"}
                onClick={() => void ejecutar("enviar")}
              >
                {busy === "enviar" && <Loader2 className="animate-spin" aria-hidden />}
                {busy === "enviar" ? "Enviando a la DIAN…" : ETIQUETA_ACCION_SET[accion]}
              </Button>
            )}
            {puedeConfirmar && (
              <Button type="button" disabled={busy !== null} onClick={() => void confirmarPortal()}>
                {busy === "confirmar" ? <Loader2 className="animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />}
                Ya figura habilitado en el portal
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
