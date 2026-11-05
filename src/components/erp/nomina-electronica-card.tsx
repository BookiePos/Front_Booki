"use client"

import * as React from "react"
import { Loader2, ReceiptText } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import {
  configurarNominaEmisor,
  getEmisorNomina,
  getHabilitacionNomina,
  iniciarHabilitacionNomina,
  type EmisorNominaVista,
  type HabilitacionNominaVista,
} from "@/lib/erp/api-einvoicing"
import {
  ESTADO_DOC_HABILITACION_LABELS,
  mensajeErrorNominaPeriodo,
} from "@/lib/erp/nomina-electronica-periodo"
import {
  armarPayloadNomina,
  mensajeErrorNomina,
} from "@/lib/erp/nomina-emisor"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGrid } from "@/components/ui/field"
import { FormAlert } from "@/components/ui/form-dialog"

/**
 * Credenciales de nómina electrónica del emisor de la sede (SoftwareID, PIN y
 * TestSetId de la DIAN). Solo con `einvoicing.certificate` (el Dueño): el PIN
 * es un secreto, se cifra en el servidor y nunca vuelve al navegador.
 */
export function NominaElectronicaCard({ sedeId }: { sedeId: string }) {
  const { hasPermission } = useAuth()
  const permitido = hasPermission("einvoicing.certificate")
  const [vista, setVista] = React.useState<EmisorNominaVista | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [softwareId, setSoftwareId] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [testSetId, setTestSetId] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hab, setHab] = React.useState<HabilitacionNominaVista | null>(null)
  const [habBusy, setHabBusy] = React.useState(false)
  const [habError, setHabError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!permitido) return
    let activo = true
    getEmisorNomina(sedeId)
      .then((v) => {
        if (!activo) return
        setVista(v)
        setSoftwareId(v?.nominaSoftwareId ?? "")
      })
      .catch((e) => activo && setError(mensajeErrorNomina(e)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [sedeId, permitido])

  if (!permitido) return null

  async function guardar(quitarTestSetId: boolean) {
    const r = armarPayloadNomina({ softwareId, pin, testSetId }, quitarTestSetId)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const v = await configurarNominaEmisor(sedeId, r.payload)
      setVista(v)
      setPin("")
      if (quitarTestSetId) setTestSetId("")
      toast.success("Nómina electrónica guardada")
    } catch (e) {
      setError(mensajeErrorNomina(e))
    } finally {
      setBusy(false)
    }
  }

  // El 409 del backend (ambiente de producción, TestSetId faltante, corrida en
  // curso…) ya viene explicado en español: se muestra tal cual.
  async function habilitacion(accion: "iniciar" | "consultar") {
    setHabBusy(true)
    setHabError(null)
    try {
      setHab(
        accion === "iniciar"
          ? await iniciarHabilitacionNomina(sedeId)
          : await getHabilitacionNomina(sedeId),
      )
    } catch (e) {
      setHabError(mensajeErrorNominaPeriodo(e))
    } finally {
      setHabBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4" aria-hidden />
          Nómina electrónica
          {!cargando && vista && (
            <Badge variant={vista.nominaConfigurada ? "default" : "outline"}>
              {vista.nominaConfigurada ? "Configurada" : "Sin configurar"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Credenciales del software de nómina electrónica ante la DIAN. El PIN se
          guarda cifrado y no se vuelve a mostrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !vista ? (
          error ? (
            <FormAlert>{error}</FormAlert>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta sede aún no tiene emisor fiscal: configura primero sus datos fiscales.
            </p>
          )
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void guardar(false)
            }}
          >
            <p className="text-sm text-muted-foreground">
              SoftwareID: {vista.nominaSoftwareId ?? "sin registrar"} · PIN:{" "}
              {vista.tieneNominaPin ? "registrado" : "sin registrar"}
              {vista.tieneNominaTestSetId ? " · TestSetId registrado" : ""}
            </p>
            {error && <FormAlert>{error}</FormAlert>}
            <FieldGrid cols={3}>
              <Field id="nom-software" label="SoftwareID" hint="UUID del software de nómina en la DIAN.">
                <Input
                  id="nom-software"
                  value={softwareId}
                  onChange={(e) => setSoftwareId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field
                id="nom-pin"
                label="PIN"
                hint={vista.tieneNominaPin ? "Ya hay un PIN guardado; escríbelo de nuevo para guardar cambios." : undefined}
              >
                <Input
                  id="nom-pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field id="nom-testset" label="TestSetId (opcional)" hint="UUID del set de pruebas de habilitación.">
                <Input
                  id="nom-testset"
                  value={testSetId}
                  onChange={(e) => setTestSetId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </FieldGrid>
            <div className="flex flex-wrap justify-end gap-2">
              {vista.tieneNominaTestSetId && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void guardar(true)}>
                  Quitar TestSetId
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Guardar
              </Button>
            </div>
          </form>
        )}
        {vista && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Set de pruebas de habilitación</p>
                <p className="text-xs text-muted-foreground">
                  Envía a la DIAN (ambiente de habilitación) documentos de prueba con un
                  trabajador sintético. Requiere SoftwareID, PIN y TestSetId guardados.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={habBusy} onClick={() => void habilitacion("consultar")}>
                  Ver avance
                </Button>
                <Button type="button" disabled={habBusy} onClick={() => void habilitacion("iniciar")}>
                  {habBusy && <Loader2 className="animate-spin" aria-hidden />}
                  Correr set de pruebas de habilitación
                </Button>
              </div>
            </div>
            {habError && <FormAlert>{habError}</FormAlert>}
            {hab && (
              <div className="flex flex-col gap-2 text-sm" role="status" aria-live="polite">
                <p>
                  <Badge variant={hab.aprobada ? "default" : "outline"}>
                    {hab.aprobada ? "Aprobada" : hab.estado === "en_curso" ? "En curso" : "Sin iniciar"}
                  </Badge>{" "}
                  {hab.mensaje}
                </p>
                {hab.resumen && (
                  <p className="text-muted-foreground">
                    Nóminas: {hab.resumen.porTipo.nie.aceptados}/{hab.resumen.porTipo.nie.exigidos} aceptadas · Ajustes:{" "}
                    {hab.resumen.porTipo.niae.aceptados}/{hab.resumen.porTipo.niae.exigidos} aceptados
                  </p>
                )}
                {hab.error && <FormAlert>{hab.error}</FormAlert>}
                {hab.documentos.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {hab.documentos.map((d) => (
                      <li key={`${d.tipo}-${d.numero}`}>
                        {d.tipo === "nie" ? "Nómina" : "Ajuste"} {d.numero}: {ESTADO_DOC_HABILITACION_LABELS[d.estado]}
                        {d.mensaje ? ` — ${d.mensaje}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
