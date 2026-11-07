"use client"

import * as React from "react"
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileCode2,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import {
  enviarDocumentoPorCorreo,
  getDescargasDocumento,
  getDetalleDocumento,
  getDocument,
  transmitirContingencia,
  transmitirDocumento,
  DIAN_STATUS_LABELS,
  type DetalleDocumentoFe,
  type ElectronicDocument,
} from "@/lib/erp/api-einvoicing"
import { PlazoContingencia } from "@/components/erp/plazo-contingencia"
import {
  correoValido,
  cufeCorto,
  etiquetaReintento,
  motivoSinCorreo,
  textoEntrega,
  tonoEstadoDian,
} from "@/lib/erp/documento-fe"
import { useAuth } from "@/lib/auth-context"
import { errorMessage } from "@/lib/erp/finance-format"
import { ApiError } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function EstadoBadge({ d }: { d: DetalleDocumentoFe }) {
  const tono = tonoEstadoDian(d.dianStatus)
  const label = DIAN_STATUS_LABELS[d.dianStatus]
  if (tono === "error") return <Badge variant="destructive">{label}</Badge>
  if (tono === "ok") {
    return (
      <Badge className="border-transparent bg-success/15 text-success-ink">
        {label}
      </Badge>
    )
  }
  if (tono === "aviso") {
    return (
      <Badge className="border-transparent bg-warning/15 text-warning-ink">
        {label}
      </Badge>
    )
  }
  return <Badge variant="secondary">{label}</Badge>
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-medium tabular-nums">{children}</span>
    </div>
  )
}

/**
 * Detalle del documento electrónico (Fase 10): estado ante la DIAN, motivos de
 * rechazo legibles, reintento, descargas (URL firmada que vive minutos) y envío
 * por correo al adquiriente. Va encima de la representación gráfica.
 */
export function DetalleDocumentoFe({
  docId,
  onCambio,
}: {
  docId: string
  /** Avisa que el estado cambió (para refrescar la lista de atrás). */
  onCambio?: () => void
}) {
  const { hasPermission } = useAuth()
  const puedeOtroCorreo = hasPermission("einvoicing.configure")
  const puedeEmitir = hasPermission("einvoicing.issue")
  const [d, setD] = React.useState<DetalleDocumentoFe | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [correo, setCorreo] = React.useState("")
  /** El detalle no trae la contingencia: se lee del documento (falla sin romper el detalle). */
  const [doc, setDoc] = React.useState<ElectronicDocument | null>(null)

  React.useEffect(() => {
    let vivo = true
    getDetalleDocumento(docId)
      .then((x) => vivo && setD(x))
      .catch((err) => vivo && setError(errorMessage(err)))
    getDocument(docId)
      .then((x) => vivo && setDoc(x))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [docId])

  async function reintentar() {
    setBusy("reintento")
    try {
      const r = await transmitirDocumento(docId)
      if (r.dianStatus === "accepted") toast.success("La DIAN aceptó el documento")
      else if (r.dianStatus === "rejected") toast.error("La DIAN rechazó el documento")
      else toast.info(r.mensajes[0] ?? `Estado: ${DIAN_STATUS_LABELS[r.dianStatus]}`)
      onCambio?.()
      try {
        setD(await getDetalleDocumento(docId))
      } catch {
        // El envío ya ocurrió: no se tapa el detalle con un error de recarga.
        toast.warning("No se pudo actualizar el detalle. Ciérralo y ábrelo de nuevo.")
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function transmitirEnContingencia() {
    setBusy("contingencia")
    try {
      const r = await transmitirContingencia(docId)
      if (r.cerrada) toast.success("La DIAN aceptó el documento y sus notas")
      else toast.info(r.documento.mensajes[0] ?? `Estado: ${DIAN_STATUS_LABELS[r.documento.dianStatus]}`)
      onCambio?.()
      try {
        const [nuevo, nuevoDoc] = await Promise.all([getDetalleDocumento(docId), getDocument(docId)])
        setD(nuevo)
        setDoc(nuevoDoc)
      } catch {
        toast.warning("No se pudo actualizar el detalle. Ciérralo y ábrelo de nuevo.")
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function descargar(tipo: "xml" | "pdf" | "zip") {
    setBusy(tipo)
    try {
      // La URL se pide al hacer clic y se usa de una vez: vive pocos minutos.
      const r = await getDescargasDocumento(docId)
      const url = r[tipo]
      if (!url) {
        toast.error("Ese archivo todavía no está disponible.")
        return
      }
      const a = document.createElement("a")
      a.href = url
      a.rel = "noopener noreferrer"
      a.target = "_blank"
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function enviarCorreo() {
    const indicado = correo.trim()
    if (indicado && !correoValido(indicado)) {
      toast.error("El correo no es válido.")
      return
    }
    setBusy("correo")
    try {
      const r = await enviarDocumentoPorCorreo(docId, indicado || undefined)
      toast.success(`Enviado a ${r.para}`)
      setCorreo("")
      try {
        setD(await getDetalleDocumento(docId))
      } catch {
        toast.warning("El correo salió, pero no se pudo actualizar el detalle.")
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 429
          ? "Este documento se acaba de enviar o llegó al máximo de envíos. Espera un minuto."
          : errorMessage(err),
      )
    } finally {
      setBusy(null)
    }
  }

  if (error) {
    return (
      <p className="no-print rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    )
  }
  if (!d) {
    return (
      <p className="no-print flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando el
        estado ante la DIAN…
      </p>
    )
  }

  // Contingencia abierta: se transmite con su propio endpoint (documento y notas, en orden).
  const contingenciaAbierta =
    puedeEmitir &&
    !!doc?.contingencia &&
    !doc.contingencia.noAplico &&
    !doc.contingencia.cerradaAt &&
    d.dianStatus !== "accepted"
  const sinCorreo = motivoSinCorreo(d)
  const entrega = textoEntrega(d)
  const correoAdquiriente = d.adquiriente.email
  const archivos: { tipo: "xml" | "pdf" | "zip"; label: string; icon: React.ReactNode }[] = [
    { tipo: "xml", label: "XML firmado", icon: <FileCode2 className="size-4" /> },
    { tipo: "pdf", label: "PDF", icon: <FileText className="size-4" /> },
    { tipo: "zip", label: "ZIP para el cliente", icon: <Archive className="size-4" /> },
  ]

  return (
    <section
      aria-label="Estado ante la DIAN"
      className="no-print flex flex-col gap-3 rounded-xl border border-border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <EstadoBadge d={d} />
        <span className="text-sm text-muted-foreground">{d.estadoResumen}</span>
        {d.ambiente === "2" && (
          <Badge variant="outline" className="ml-auto">
            Habilitación (pruebas)
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Dato label="Número">{d.numero}</Dato>
        <Dato label="Total">{moneyFmt.format(d.total)}</Dato>
        <Dato label="Intentos de envío">{d.intentos}</Dato>
        <Dato label={d.tipo === "credit_note" || d.tipo === "debit_note" ? "CUDE" : "CUFE"}>
          <span title={d.cufe}>{cufeCorto(d.cufe)}</span>
        </Dato>
      </div>

      {d.motivos.length > 0 && (
        <div
          role="alert"
          className={cn(
            "flex flex-col gap-2 rounded-lg px-3 py-2 text-sm",
            d.dianStatus === "rejected"
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/10 text-warning-ink",
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {d.dianStatus === "rejected" ? "Motivos del rechazo" : "Por qué no ha avanzado"}
          </p>
          <ul className="flex flex-col gap-1.5">
            {d.motivos.map((m, i) => (
              <li key={i} className="flex flex-col">
                <span>
                  {m.regla && <span className="mr-1 font-mono text-xs">[{m.regla}]</span>}
                  {m.texto}
                </span>
                {m.sugerencia && (
                  <span className="text-xs opacity-80">{m.sugerencia}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {doc?.contingencia && (
        <PlazoContingencia dianStatus={d.dianStatus} contingencia={doc.contingencia} />
      )}

      {contingenciaAbierta && (
          <div>
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => void transmitirEnContingencia()}
            >
              {busy === "contingencia" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Transmitir contingencia
            </Button>
          </div>
        )}

      {d.puedeReintentar && !contingenciaAbierta && (
        <div>
          <Button
            variant={d.dianStatus === "rejected" ? "default" : "outline"}
            size="sm"
            disabled={busy !== null}
            onClick={() => void reintentar()}
          >
            {busy === "reintento" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {etiquetaReintento(d.dianStatus)}
          </Button>
        </div>
      )}

      {d.dianStatus === "accepted" && (
        <>
          {entrega && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success-ink" aria-hidden />
              {entrega}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {archivos.map((a) => (
              <Button
                key={a.tipo}
                variant="outline"
                size="sm"
                disabled={!d.descargas[a.tipo] || busy !== null}
                onClick={() => void descargar(a.tipo)}
              >
                {busy === a.tipo ? <Loader2 className="animate-spin" /> : a.icon}
                {a.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Enviar por correo al cliente</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                className="w-72 max-w-full"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder={correoAdquiriente ?? "correo@cliente.com"}
                aria-label="Correo del destinatario"
                disabled={sinCorreo !== null || !puedeOtroCorreo}
                title={puedeOtroCorreo ? undefined : "Enviar a otra dirección requiere permiso de configuración"}
              />
              <Button
                size="sm"
                disabled={
                  sinCorreo !== null ||
                  busy !== null ||
                  (!correo.trim() && !correoAdquiriente) ||
                  (!puedeOtroCorreo && !correoAdquiriente)
                }
                onClick={() => void enviarCorreo()}
              >
                {busy === "correo" ? <Loader2 className="animate-spin" /> : <Mail />}
                Enviar por correo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {sinCorreo ??
                (correoAdquiriente
                  ? `Sin escribir nada se envía a ${correoAdquiriente}. `
                  : "El cliente no tiene correo registrado: escribe uno. ")}
              {d.correo.envios > 0 &&
                `Enviado ${d.correo.envios} ${d.correo.envios === 1 ? "vez" : "veces"} (quedan ${d.correo.restantes}).`}
            </p>
          </div>
        </>
      )}
    </section>
  )
}
