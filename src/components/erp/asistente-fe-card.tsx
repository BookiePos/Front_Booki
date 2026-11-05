"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Circle, FileKey2, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import {
  cargarCertificadoEmisor,
  configurarFacturaEmisor,
  getEmisorConEstado,
  listResolutions,
  type EmisorConEstado,
  type ResolutionRow,
} from "@/lib/erp/api-einvoicing"
import {
  URL_PORTAL_DIAN,
  armarPayloadFactura,
  estadoCertificado,
  mensajeErrorEmisor,
  pasosAsistente,
  resumenPasos,
  validarCertificado,
  type DestinoPaso,
  type PasoAsistente,
} from "@/lib/erp/asistente-fe"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldGrid } from "@/components/ui/field"
import { FormAlert } from "@/components/ui/form-dialog"

/**
 * Asistente de configuración de factura electrónica de la sede: checklist de
 * puesta en marcha, panel del certificado .p12 y credenciales de factura.
 * Ver el asistente pide `einvoicing.configure`; cargar el .p12 y guardar el
 * PIN pide `einvoicing.certificate` (secretos, solo el Dueño).
 */
export function AsistenteFeCard({
  sedeId,
  onEditarSede,
}: {
  sedeId: string
  onEditarSede?: () => void
}) {
  const { hasPermission } = useAuth()
  const puedeVer = hasPermission("einvoicing.configure")
  const puedeSecretos = hasPermission("einvoicing.certificate")
  const [datos, setDatos] = React.useState<EmisorConEstado | null>(null)
  // undefined: no se pudo leer (sin permiso de emitir); null: la sede no aparece.
  const [resolucion, setResolucion] = React.useState<ResolutionRow | null | undefined>(undefined)
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const certRef = React.useRef<HTMLDivElement>(null)
  const credRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!puedeVer) return
    let activo = true
    getEmisorConEstado(sedeId)
      .then((d) => activo && setDatos(d))
      .catch((e) => activo && setError(mensajeErrorEmisor(e)))
      .finally(() => activo && setCargando(false))
    listResolutions()
      .then((rows) => activo && setResolucion(rows.find((r) => r.sedeId === sedeId) ?? null))
      .catch(() => activo && setResolucion(undefined))
    return () => {
      activo = false
    }
  }, [sedeId, puedeVer])

  if (!puedeVer) return null

  const emisor = datos?.emisor ?? null
  const pasos = pasosAsistente(emisor, datos?.estado ?? null, resolucion)
  const { hechos, total } = resumenPasos(pasos)

  function ir(destino: DestinoPaso) {
    if (destino === "sede") onEditarSede?.()
    else if (destino === "certificado") certRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    else if (destino === "credenciales") credRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden />
          Factura electrónica
          {!cargando && emisor && (
            <Badge variant={hechos === total ? "default" : "outline"}>
              {hechos} de {total} pasos
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Lo que falta para que esta sede emita factura electrónica ante la DIAN.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <FormAlert>{error}</FormAlert>
        ) : (
          <>
            <ol className="flex flex-col gap-3" aria-label="Pasos de configuración">
              {pasos.map((p) => (
                <FilaPaso key={p.id} paso={p} onIr={ir} />
              ))}
            </ol>

            <div ref={certRef}>
              <PanelCertificado
                sedeId={sedeId}
                datos={datos}
                permitido={puedeSecretos}
                onCambio={setDatos}
              />
            </div>
            <div ref={credRef}>
              <CredencialesFactura
                sedeId={sedeId}
                datos={datos}
                permitido={puedeSecretos}
                onCambio={setDatos}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function FilaPaso({ paso, onIr }: { paso: PasoAsistente; onIr: (d: DestinoPaso) => void }) {
  const hecho = paso.estado === "hecho"
  return (
    <li className="flex items-start gap-3">
      {hecho ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Hecho" />
      ) : paso.estado === "sin_dato" ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Sin dato" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Pendiente" />
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{paso.titulo}</p>
          {paso.detalle && <p className="text-xs text-muted-foreground">{paso.detalle}</p>}
        </div>
        {(!hecho || paso.id === "certificado") && <AccionPaso paso={paso} onIr={onIr} />}
      </div>
    </li>
  )
}

function AccionPaso({ paso, onIr }: { paso: PasoAsistente; onIr: (d: DestinoPaso) => void }) {
  if (paso.estado === "hecho" && paso.detalle === "") return null
  if (paso.destino === "dian") {
    return (
      <Button variant="outline" size="sm" render={<a href={URL_PORTAL_DIAN} target="_blank" rel="noreferrer" />}>
        Abrir portal DIAN
      </Button>
    )
  }
  if (paso.destino === "resoluciones") {
    return (
      <Button variant="outline" size="sm" render={<Link href="/panel/resoluciones" />}>
        Ir a resoluciones
      </Button>
    )
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onIr(paso.destino)}>
      {paso.destino === "sede" ? "Editar sede" : "Ir al formulario"}
    </Button>
  )
}

function PanelCertificado({
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
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const [password, setPassword] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const emisor = datos?.emisor ?? null
  const est = estadoCertificado(emisor)

  async function subir(e: React.FormEvent) {
    e.preventDefault()
    const msg = validarCertificado({ archivo, password })
    if (msg || !archivo) {
      setError(msg)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await cargarCertificadoEmisor(sedeId, archivo, password)
      onCambio({ emisor: r.emisor, estado: datos?.estado ?? null })
      toast.success(r.reemplazado ? "Certificado reemplazado" : "Certificado cargado")
      // Otro viaje por el estado: el backend recalcula lo que falta.
      void getEmisorConEstado(sedeId).then(onCambio).catch(() => undefined)
    } catch (err) {
      setError(mensajeErrorEmisor(err))
    } finally {
      // La contraseña no se queda en memoria de la pantalla, haya salido bien o mal.
      setPassword("")
      setArchivo(null)
      if (inputRef.current) inputRef.current.value = ""
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-4" aria-label="Certificado de firma">
      <div className="flex items-center gap-2">
        <FileKey2 className="size-4" aria-hidden />
        <h3 className="text-sm font-medium">Certificado de firma (.p12)</h3>
      </div>
      {emisor?.tieneCertificado && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Titular</dt>
            <dd>{emisor.certTitular ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">NIT</dt>
            <dd>
              {emisor.nit}
              {emisor.nitDv ? `-${emisor.nitDv}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vence</dt>
            <dd>{emisor.certVenceAt ? new Date(emisor.certVenceAt).toLocaleDateString("es-CO") : "—"}</dd>
          </div>
        </dl>
      )}
      <p
        role="status"
        className={
          est.tono === "error"
            ? "text-sm text-destructive"
            : est.tono === "aviso"
              ? "text-sm text-amber-600"
              : "text-sm text-muted-foreground"
        }
      >
        {est.texto}
      </p>
      {!emisor ? null : !permitido ? (
        <p className="text-xs text-muted-foreground">Solo el Dueño puede cargar o reemplazar el certificado.</p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={subir}>
          {error && <FormAlert>{error}</FormAlert>}
          <FieldGrid cols={2}>
            <Field id="cert-archivo" label={emisor.tieneCertificado ? "Nuevo certificado" : "Archivo .p12 / .pfx"}>
              <Input
                id="cert-archivo"
                ref={inputRef}
                type="file"
                accept=".p12,.pfx"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="cert-password" label="Contraseña del certificado">
              <Input
                id="cert-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </FieldGrid>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {emisor.tieneCertificado ? "Reemplazar certificado" : "Subir certificado"}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function CredencialesFactura({
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
  // Lo escrito manda; si no se tocó, se muestra el SoftwareID guardado.
  const [editado, setEditado] = React.useState<string | null>(null)
  const softwareId = editado ?? emisor?.facturaSoftwareId ?? ""
  const [pin, setPin] = React.useState("")
  const [testSetId, setTestSetId] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!emisor || !permitido) return null

  async function guardar(quitar: boolean) {
    const r = armarPayloadFactura({ softwareId, pin, testSetId }, quitar)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      onCambio(await configurarFacturaEmisor(sedeId, r.payload))
      toast.success("Credenciales de factura guardadas")
      if (quitar) setTestSetId("")
    } catch (e) {
      setError(mensajeErrorEmisor(e))
    } finally {
      setPin("")
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void guardar(false)
      }}
    >
      <h3 className="text-sm font-medium">Credenciales del software de factura</h3>
      <p className="text-xs text-muted-foreground">
        SoftwareID: {emisor.facturaSoftwareId ?? "sin registrar"} · PIN:{" "}
        {emisor.tieneFacturaPin ? "registrado" : "sin registrar"}
        {emisor.tieneFacturaTestSetId ? " · TestSetId registrado" : ""}. El PIN se guarda cifrado y no se vuelve a mostrar.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <FieldGrid cols={3}>
        <Field id="fe-software" label="SoftwareID" hint="UUID del software de factura en la DIAN.">
          <Input id="fe-software" value={softwareId} onChange={(e) => setEditado(e.target.value)} autoComplete="off" />
        </Field>
        <Field
          id="fe-pin"
          label="PIN"
          hint={emisor.tieneFacturaPin ? "Ya hay un PIN guardado; escríbelo de nuevo para guardar cambios." : undefined}
        >
          <Input id="fe-pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field id="fe-testset" label="TestSetId (opcional)" hint="UUID del set de pruebas de habilitación.">
          <Input id="fe-testset" value={testSetId} onChange={(e) => setTestSetId(e.target.value)} autoComplete="off" />
        </Field>
      </FieldGrid>
      <div className="flex flex-wrap justify-end gap-2">
        {emisor.tieneFacturaTestSetId && (
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
  )
}
