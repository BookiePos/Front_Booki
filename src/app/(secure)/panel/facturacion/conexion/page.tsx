"use client"

import * as React from "react"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  FileKey2,
  FlaskConical,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Rocket,
  ShieldOff,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  checkTestSet,
  configureSoftware,
  getNumberingRanges,
  listConnections,
  registerCompany,
  registerResolution,
  runTestSet,
  setEnvironment,
  uploadCertificate,
  type ConnectionStep,
  type EinvoicingConnection,
  type NumberingRange,
  type TestSetDoc,
} from "@/lib/erp/api-einvoicing"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/**
 * Asistente de habilitación ante la DIAN (modalidad software propio).
 *
 * Una tarjeta por NIT, con los cinco pasos en orden: empresa, certificado,
 * software, set de pruebas y producción. Cada paso solo se habilita cuando el
 * anterior quedó hecho, y si el facturador rechaza algo, el motivo queda
 * visible arriba de la tarjeta.
 *
 * Con la opción 3 (BookiPos custodia el certificado), lo opera el equipo de
 * BookiPos; el permiso que lo protege es `einvoicing.configure`.
 */

const STEPS: { key: ConnectionStep; title: string; icon: React.ElementType }[] = [
  { key: "empresa", title: "Empresa", icon: Building2 },
  { key: "certificado", title: "Certificado digital", icon: FileKey2 },
  { key: "software", title: "Software DIAN", icon: KeyRound },
  { key: "set_pruebas", title: "Set de pruebas", icon: FlaskConical },
  { key: "produccion", title: "Producción", icon: Rocket },
]

const DOC_LABEL: Record<TestSetDoc["kind"], string> = {
  invoice: "Factura",
  credit_note: "Nota crédito",
  debit_note: "Nota débito",
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

/** Lee un archivo como base64 (sin el prefijo `data:`). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? "")
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function ConexionDianPage() {
  const { hasPermission } = useAuth()
  const canConfigure = hasPermission("einvoicing.configure")

  const [connections, setConnections] = React.useState<EinvoicingConnection[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setError(null)
    try {
      setConnections(await listConnections())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial: el estado se toca solo cuando responde la API, no dentro
  // del efecto (evita renders en cascada).
  React.useEffect(() => {
    if (!canConfigure) return
    let active = true
    listConnections()
      .then((list) => active && setConnections(list))
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [canConfigure])

  if (!canConfigure) {
    return (
      <>
        <PageHeader section="Cumplimiento" title="Conexión DIAN" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Configurar la conexión con la DIAN requiere el permiso de
              configuración de facturación electrónica.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        section="Cumplimiento"
        title="Conexión DIAN"
        description="Habilita cada NIT ante la DIAN: certificado digital, software propio, set de pruebas y paso a producción."
        icon={PlugZap}
      />

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ninguna sede tiene NIT todavía. Complétalo en{" "}
            <span className="font-medium text-foreground">Sedes → editar</span>{" "}
            para empezar.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {connections.map((c) => (
            <ConnectionCard
              key={c.nit}
              connection={c}
              onChange={(list) => setConnections(list)}
              reload={load}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Índice del paso en curso: los anteriores están hechos. */
function stepIndex(step: ConnectionStep): number {
  return STEPS.findIndex((s) => s.key === step)
}

function ConnectionCard({
  connection: c,
  onChange,
  reload,
}: {
  connection: EinvoicingConnection
  onChange: (list: EinvoicingConnection[]) => void
  reload: () => Promise<void>
}) {
  const current = stepIndex(c.step)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [stepError, setStepError] = React.useState<string | null>(null)

  /** Corre una acción del asistente mostrando "ocupado" y su error. */
  async function run<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(name)
    setStepError(null)
    try {
      return await fn()
    } catch (err) {
      setStepError(errorMessage(err))
      // El backend guarda el último error en la conexión: se refresca.
      await reload()
      return undefined
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-display text-lg text-foreground">
              NIT {c.nit}
              {c.dv ? `-${c.dv}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Sedes: {c.sedes.map((s) => s.name).join(", ")}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              c.environment === "produccion"
                ? "bg-success/10 text-success-ink"
                : "bg-warning/15 text-warning-ink",
            )}
          >
            {c.environment === "produccion" ? "Producción" : "Habilitación (pruebas)"}
          </span>
        </div>

        {/* Pasos */}
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => {
            const done = i < current || c.step === "produccion"
            const active = i === current && c.step !== "produccion"
            const Icon = s.icon
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  done && "border-success/40 bg-success/5 text-success-ink",
                  active && "border-primary bg-primary/5 text-foreground",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : active ? (
                  <Icon className="size-4 shrink-0" />
                ) : (
                  <Circle className="size-4 shrink-0" />
                )}
                <span>
                  {i + 1}. {s.title}
                </span>
              </li>
            )
          })}
        </ol>

        {(stepError || c.lastError) && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{stepError ?? c.lastError}</span>
          </div>
        )}

        {c.step === "empresa" && (
          <StepEmpresa c={c} busy={busy} run={run} onChange={onChange} />
        )}
        {c.step === "certificado" && (
          <StepCertificado c={c} busy={busy} run={run} onChange={onChange} />
        )}
        {c.step === "software" && (
          <StepSoftware c={c} busy={busy} run={run} onChange={onChange} />
        )}
        {c.step === "set_pruebas" && (
          <StepSetPruebas c={c} busy={busy} run={run} reload={reload} />
        )}
        {(c.step === "set_pruebas" || c.step === "produccion") && (
          <StepProduccion c={c} busy={busy} run={run} onChange={onChange} />
        )}

        {c.certificateExpiresAt && (
          <p className="text-xs text-muted-foreground">
            Certificado digital vigente hasta{" "}
            {new Date(c.certificateExpiresAt).toLocaleDateString("es-CO")}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

type Runner = <T>(name: string, fn: () => Promise<T>) => Promise<T | undefined>

interface StepProps {
  c: EinvoicingConnection
  busy: string | null
  run: Runner
  onChange: (list: EinvoicingConnection[]) => void
}

function BusyButton({
  busy,
  name,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { busy: string | null; name: string }) {
  return (
    <Button {...props} disabled={busy !== null || props.disabled}>
      {busy === name && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  )
}

/** Paso 1: crear la empresa en el facturador con los datos de una sede. */
function StepEmpresa({ c, busy, run, onChange }: StepProps) {
  const [sedeId, setSedeId] = React.useState(c.sedes[0]?.id ?? "")
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Se crea la empresa en el facturador con los datos fiscales de la sede:
        razón social, dirección, teléfono, correo de facturación, departamento y
        ciudad. Si falta alguno, el error dice cuál.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {c.sedes.length > 1 && (
          <Field id={`sede-${c.nit}`} label="Datos fiscales de la sede" className="w-60">
            <NativeSelect
              id={`sede-${c.nit}`}
              value={sedeId}
              onChange={setSedeId}
              options={c.sedes.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
        )}
        <BusyButton
          busy={busy}
          name="empresa"
          onClick={async () => {
            const list = await run("empresa", () => registerCompany(sedeId))
            if (list) onChange(list)
          }}
        >
          Crear empresa en el facturador
        </BusyButton>
      </div>
    </div>
  )
}

/** Paso 2: certificado digital (.p12/.pfx) con su clave. */
function StepCertificado({ c, busy, run, onChange }: StepProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [password, setPassword] = React.useState("")
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        El certificado digital a nombre del NIT (
        <span className="font-medium text-foreground">.p12</span> o{" "}
        <span className="font-medium text-foreground">.pfx</span>) y su clave.
        Pasa directo al facturador: BookiPos no lo guarda.
      </p>
      <FieldGrid cols={2}>
        <Field id={`cert-${c.nit}`} label="Archivo del certificado" required>
          <Input
            id={`cert-${c.nit}`}
            type="file"
            accept=".p12,.pfx,application/x-pkcs12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field id={`pass-${c.nit}`} label="Clave del certificado" required>
          <Input
            id={`pass-${c.nit}`}
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </FieldGrid>
      <div>
        <BusyButton
          busy={busy}
          name="certificado"
          disabled={!file || !password}
          onClick={async () => {
            if (!file) return
            if (file.size > 48_000) {
              await run("certificado", () =>
                Promise.reject(new Error("El archivo es muy grande para ser un certificado (.p12 suele pesar menos de 10 KB).")),
              )
              return
            }
            const list = await run("certificado", async () =>
              uploadCertificate(c.nit, await fileToBase64(file), password),
            )
            if (list) {
              setPassword("")
              onChange(list)
            }
          }}
        >
          Cargar certificado
        </BusyButton>
      </div>
    </div>
  )
}

/** Paso 3: software propio registrado en el portal de la DIAN. */
function StepSoftware({ c, busy, run, onChange }: StepProps) {
  const [softwareId, setSoftwareId] = React.useState(c.softwareId ?? "")
  const [pin, setPin] = React.useState("")
  const [testSetId, setTestSetId] = React.useState("")
  const uuid = /^[0-9a-fA-F-]{36}$/
  const valid = uuid.test(softwareId.trim()) && /^\d{5}$/.test(pin) && uuid.test(testSetId.trim())
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Los tres datos que da el portal de la DIAN al registrar el modo{" "}
        <span className="font-medium text-foreground">software propio</span>:
        el ID del software, el PIN de 5 dígitos que se escogió y el ID del set
        de pruebas.
      </p>
      <FieldGrid cols={3}>
        <Field id={`sw-${c.nit}`} label="ID del software" required>
          <Input
            id={`sw-${c.nit}`}
            value={softwareId}
            onChange={(e) => setSoftwareId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
        <Field id={`pin-${c.nit}`} label="PIN" required>
          <Input
            id={`pin-${c.nit}`}
            inputMode="numeric"
            maxLength={5}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="12345"
          />
        </Field>
        <Field id={`set-${c.nit}`} label="ID del set de pruebas" required>
          <Input
            id={`set-${c.nit}`}
            value={testSetId}
            onChange={(e) => setTestSetId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </Field>
      </FieldGrid>
      <div>
        <BusyButton
          busy={busy}
          name="software"
          disabled={!valid}
          onClick={async () => {
            const list = await run("software", () =>
              configureSoftware(c.nit, {
                softwareId: softwareId.trim(),
                pin,
                testSetId: testSetId.trim(),
              }),
            )
            if (list) onChange(list)
          }}
        >
          Registrar software
        </BusyButton>
      </div>
    </div>
  )
}

/** Paso 4: el set de pruebas de la DIAN y su resultado. */
function StepSetPruebas({
  c,
  busy,
  run,
  reload,
}: Omit<StepProps, "onChange"> & { reload: () => Promise<void> }) {
  const set = c.testSet
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        La DIAN pide 8 facturas, 1 nota crédito y 1 nota débito con su
        numeración de pruebas. Se envían de una vez; el resultado tarda unos
        minutos en estar listo. Cuando las 10 salgan aceptadas, revisa en el
        portal de la DIAN que el NIT figure{" "}
        <span className="font-medium text-foreground">Habilitado</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <BusyButton
          busy={busy}
          name="set"
          variant={set.summary.sent > 0 ? "outline" : "default"}
          onClick={async () => {
            if (await run("set", () => runTestSet(c.nit))) await reload()
          }}
        >
          <FlaskConical />
          {set.summary.sent > 0 ? "Enviar el set otra vez" : "Enviar set de pruebas"}
        </BusyButton>
        {set.summary.sent > 0 && (
          <BusyButton
            busy={busy}
            name="check"
            onClick={async () => {
              if (await run("check", () => checkTestSet(c.nit))) await reload()
            }}
          >
            <RefreshCw />
            Consultar resultado
          </BusyButton>
        )}
      </div>

      {set.summary.sent > 0 && (
        <>
          <p
            className={cn(
              "rounded-xl px-4 py-3 text-sm",
              set.summary.complete
                ? "bg-success/10 text-success-ink"
                : set.summary.rejected > 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/15 text-warning-ink",
            )}
          >
            {set.summary.complete
              ? "La DIAN aceptó el set completo. Revisa el portal y pasa a producción."
              : `${set.summary.accepted} de 10 aceptados · ${set.summary.pending} pendientes · ${set.summary.rejected} rechazados.`}
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {set.docs.map((d) => (
              <li key={`${d.kind}-${d.prefix}${d.number}`} className="flex flex-col gap-1 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {DOC_LABEL[d.kind]} {d.prefix}
                    {d.number}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      d.status === "accepted" && "bg-success/10 text-success-ink",
                      d.status === "pending" && "bg-warning/15 text-warning-ink",
                      d.status === "rejected" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {d.status === "accepted"
                      ? "Aceptado"
                      : d.status === "pending"
                        ? "Pendiente"
                        : "Rechazado"}
                  </span>
                </div>
                {d.status === "rejected" && (d.message || d.errors.length > 0) && (
                  <p className="text-xs text-destructive">
                    {[d.message, ...d.errors].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * Paso 5: producción. Primero se cambia el ambiente y enseguida se registra la
 * resolución real de cada sede (el facturador ata cada resolución al ambiente
 * en que se registra). La clave técnica la trae la DIAN: nadie la teclea.
 */
function StepProduccion({ c, busy, run, onChange }: StepProps) {
  const [ranges, setRanges] = React.useState<NumberingRange[] | null>(null)
  const [sedeFor, setSedeFor] = React.useState<Record<string, string>>({})
  const [registered, setRegistered] = React.useState<Record<string, boolean>>({})
  const enProduccion = c.environment === "produccion"
  const setListo = c.testSet.summary.complete

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">Producción</p>
      {!enProduccion && (
        <>
          <p className="text-sm text-muted-foreground">
            Cuando el portal de la DIAN muestre el NIT habilitado, pásalo a
            producción y registra enseguida la resolución real de cada sede.
          </p>
          <div>
            <BusyButton
              busy={busy}
              name="prod"
              disabled={!setListo}
              title={setListo ? undefined : "Primero la DIAN debe aceptar el set de pruebas"}
              onClick={async () => {
                const list = await run("prod", () => setEnvironment(c.nit, "produccion"))
                if (list) onChange(list)
              }}
            >
              <Rocket />
              Pasar a producción
            </BusyButton>
          </div>
        </>
      )}

      {enProduccion && (
        <>
          <p className="text-sm text-muted-foreground">
            Trae de la DIAN los rangos de numeración autorizados a este software
            y asigna cada uno a su sede.
          </p>
          <div>
            <BusyButton
              busy={busy}
              name="ranges"
              variant="outline"
              onClick={async () => {
                const r = await run("ranges", () => getNumberingRanges(c.nit))
                if (r) setRanges(r)
              }}
            >
              <RefreshCw />
              Traer rangos de la DIAN
            </BusyButton>
          </div>
          {ranges && ranges.length === 0 && (
            <p className="text-sm text-muted-foreground">
              La DIAN no tiene rangos asociados a este software todavía. Pide la
              resolución de numeración y asóciala al software en el portal.
            </p>
          )}
          {ranges && ranges.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {ranges.map((r) => {
                const key = `${r.prefix}-${r.resolutionNumber}`
                const sedeId = sedeFor[key] ?? c.sedes[0]?.id ?? ""
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{r.prefix}</span>{" "}
                      {r.from}–{r.to} · Res. {r.resolutionNumber}
                      {r.dateTo ? ` · vence ${r.dateTo}` : ""}
                    </span>
                    {registered[key] ? (
                      <span className="text-xs font-medium text-success-ink">Registrada</span>
                    ) : (
                      <>
                        <NativeSelect
                          value={sedeId}
                          onChange={(v) => setSedeFor((m) => ({ ...m, [key]: v }))}
                          options={c.sedes.map((s) => ({ value: s.id, label: s.name }))}
                          aria-label="Sede"
                          className="w-44"
                        />
                        <BusyButton
                          busy={busy}
                          name={`res-${key}`}
                          size="sm"
                          disabled={!r.technicalKey}
                          onClick={async () => {
                            const ok = await run(`res-${key}`, () =>
                              registerResolution(sedeId, {
                                numero: r.resolutionNumber,
                                fechaResolucion: r.resolutionDate,
                                prefijo: r.prefix,
                                rangoDesde: r.from,
                                rangoHasta: r.to,
                                vigenciaDesde: r.dateFrom,
                                vigenciaHasta: r.dateTo,
                                claveTecnica: r.technicalKey,
                              }),
                            )
                            if (ok) setRegistered((m) => ({ ...m, [key]: true }))
                          }}
                        >
                          Usar en esta sede
                        </BusyButton>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
