"use client"

import * as React from "react"
import Link from "next/link"
import {
  CircleCheck,
  ClipboardList,
  Loader2,
  Pencil,
  ScrollText,
  ShieldOff,
  TriangleAlert,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listResolutions,
  registerResolution,
  ESTADO_RESOLUCION_LABELS,
  TIPOS_RESOLUCION,
  TIPO_RESOLUCION_LABELS,
  resolucionDeTipo,
  tipoExigePrefijo,
  type EstadoResolucion,
  type RegisterResolutionPayload,
  type ResolutionRow,
  type TipoResolucion,
} from "@/lib/erp/api-einvoicing"
import { errorMessage, fmtDate } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  FormDialog,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import { Field, FieldGrid } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Qué tan grave es cada estado, para el color y para el orden de la lista. */
const GRAVEDAD: Record<EstadoResolucion, number> = {
  sin_configurar: 0,
  incompleta: 1,
  vencida: 2,
  rango_agotado: 3,
  aun_no_vigente: 4,
  por_vencer: 5,
  rango_bajo: 6,
  ok: 7,
}

/** Los cuatro primeros impiden facturar; los dos siguientes son avisos. */
function tono(estado: EstadoResolucion): "bloquea" | "avisa" | "ok" {
  if (GRAVEDAD[estado] <= 4) return "bloquea"
  if (GRAVEDAD[estado] <= 6) return "avisa"
  return "ok"
}

function EstadoBadge({ estado }: { estado: EstadoResolucion }) {
  const t = tono(estado)
  const label = ESTADO_RESOLUCION_LABELS[estado]
  if (t === "bloquea") return <Badge variant="destructive">{label}</Badge>
  if (t === "avisa") {
    return (
      <Badge className="border-transparent bg-warning/15 text-warning-ink">
        {label}
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-success/15 text-success-ink">
      {label}
    </Badge>
  )
}

/** Barra de consumo del rango: se ve de un vistazo cuánto queda. */
function BarraRango({ consumido }: { consumido?: number }) {
  if (consumido === undefined) return null
  const pct = Math.round(consumido * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 100
              ? "bg-destructive"
              : pct >= 80
                ? "bg-warning"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {pct}% del rango usado
      </span>
    </div>
  )
}

/** Dato suelto de la ficha: etiqueta arriba, valor abajo. */
function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  )
}

// ─── Formulario de alta / renovación ─────────────────────────────────────────

interface ResolutionSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: ResolutionRow | null
  /** Tipo con el que abre el formulario. */
  initialTipo: TipoResolucion
  onSaved: (rows: ResolutionRow[]) => void
}

function ResolutionSheet({ open, onOpenChange, row, initialTipo, onSaved }: ResolutionSheetProps) {
  const [tipo, setTipo] = React.useState<TipoResolucion>("invoice")
  const [f, setF] = React.useState<RegisterResolutionPayload>({})
  const [empezarEn, setEmpezarEn] = React.useState("")
  const [claveTecnica, setClaveTecnica] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [errorPrefijo, setErrorPrefijo] = React.useState<string | null>(null)

  /** Lo que el formulario mostró al cargarse: para saber si hay datos tecleados. */
  const baseline = React.useRef("")
  const cargar = React.useCallback(
    (r: ResolutionRow, t: TipoResolucion) => {
      const actual = resolucionDeTipo(r, t)
      const res = actual?.resolucion
      const nuevo: RegisterResolutionPayload = {
        numero: res?.numero ?? "",
        fechaResolucion: res?.fechaResolucion?.slice(0, 10) ?? "",
        prefijo: res?.prefijo ?? "",
        rangoDesde: res?.rangoDesde,
        rangoHasta: res?.rangoHasta,
        vigenciaDesde: res?.vigenciaDesde?.slice(0, 10) ?? "",
        vigenciaHasta: res?.vigenciaHasta?.slice(0, 10) ?? "",
      }
      baseline.current = JSON.stringify(nuevo)
      setF(nuevo)
      setEmpezarEn(
        actual?.status.consecutivo.siguiente
          ? String(actual.status.consecutivo.siguiente)
          : "",
      )
    },
    [],
  )

  React.useEffect(() => {
    if (!open || !row) return
    setTipo(initialTipo)
    cargar(row, initialTipo)
    setClaveTecnica("")
    setError(null)
    setErrorPrefijo(null)
  }, [open, row, initialTipo, cargar])

  const exigePrefijo = tipoExigePrefijo(tipo)
  const nombreTipo = TIPO_RESOLUCION_LABELS[tipo].toLowerCase()

  function cambiarTipo(t: TipoResolucion) {
    setError(null)
    setErrorPrefijo(null)
    if (!row) {
      setTipo(t)
      return
    }
    const editado = JSON.stringify(f) !== baseline.current
    const existente = resolucionDeTipo(row, t)?.resolucion
    if (editado && !existente) {
      // Hay datos tecleados y el tipo nuevo no tiene nada guardado: se
      // conservan las fechas, el rango y el número; el prefijo y el
      // consecutivo son propios de cada tipo y se vacían.
      setTipo(t)
      setF((prev) => ({ ...prev, prefijo: "" }))
      setEmpezarEn("")
      toast.info(
        "Conservé los datos que escribiste. Falta el prefijo y el consecutivo propios de este tipo.",
      )
      return
    }
    setTipo(t)
    cargar(row, t)
    if (editado && existente) {
      toast.info(
        `Se cargó la resolución guardada de ${TIPO_RESOLUCION_LABELS[t].toLowerCase()}; los cambios sin guardar del tipo anterior se descartaron.`,
      )
    }
  }

  function set<K extends keyof RegisterResolutionPayload>(
    key: K,
    value: RegisterResolutionPayload[K],
  ) {
    setF((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!row) return
    if (exigePrefijo && !f.prefijo?.trim()) {
      setErrorPrefijo(
        `La resolución de ${nombreTipo} necesita un prefijo propio, distinto al de la factura.`,
      )
      document.getElementById("r-prefijo")?.focus()
      return
    }
    setErrorPrefijo(null)
    setSaving(true)
    setError(null)
    try {
      const rows = await registerResolution(row.sedeId, {
        ...f,
        tipoDocumento: tipo,
        numero: f.numero || undefined,
        prefijo: f.prefijo || undefined,
        fechaResolucion: f.fechaResolucion || undefined,
        vigenciaDesde: f.vigenciaDesde || undefined,
        vigenciaHasta: f.vigenciaHasta || undefined,
        claveTecnica: claveTecnica.trim() || undefined,
        empezarEn: empezarEn ? Number(empezarEn) : undefined,
      })
      onSaved(rows)
      toast.success("Resolución guardada")
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
      size="2xl"
      icon={ScrollText}
      title={`Resolución de ${row?.sedeName ?? "la sede"} · ${TIPO_RESOLUCION_LABELS[tipo]}`}
      description="Copia los datos tal como los entregó la DIAN. Al guardar se ajusta también por qué número seguirá la numeración."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="sm:min-w-44"
          >
            {saving ? <Loader2 className="animate-spin" /> : <ScrollText />}
            {saving ? "Guardando…" : "Guardar resolución"}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <FormSection
        title="Tipo de documento"
        description="La DIAN autoriza la numeración por tipo de documento: cada uno lleva su propio prefijo y rango."
      >
        <Field id="r-tipo" label="Tipo de documento">
          <select
            id="r-tipo"
            value={tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoResolucion)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {TIPOS_RESOLUCION.map((t) => (
              <option key={t} value={t}>
                {TIPO_RESOLUCION_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection
        title="La resolución"
        description="El acto administrativo con el que la DIAN te autoriza a facturar."
        help={{ term: "resolucion" }}
      >
        <FieldGrid cols={2}>
          <Field id="r-num" label="N.º de resolución">
            <Input
              id="r-num"
              value={f.numero ?? ""}
              onChange={(e) => set("numero", e.target.value)}
              placeholder="18764096721256"
            />
          </Field>
          <Field id="r-fecha" label="Fecha">
            <Input
              id="r-fecha"
              type="date"
              value={f.fechaResolucion ?? ""}
              onChange={(e) => set("fechaResolucion", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Prefijo y rango autorizado"
        description="Los folios que puedes emitir con esta resolución."
        help={{ term: "rangoNumeracion" }}
      >
        <FieldGrid cols={3}>
          <Field
            id="r-prefijo"
            label={exigePrefijo ? "Prefijo (obligatorio)" : "Prefijo"}
            error={errorPrefijo}
            hint={
              exigePrefijo
                ? "Distinto al de la factura: el consecutivo se comparte por prefijo."
                : undefined
            }
            help={{ term: "prefijo" }}
          >
            <Input
              id="r-prefijo"
              maxLength={4}
              value={f.prefijo ?? ""}
              aria-required={exigePrefijo}
              onChange={(e) => set("prefijo", e.target.value.toUpperCase())}
              placeholder={exigePrefijo ? "NC" : "FE"}
            />
          </Field>
          <Field id="r-desde" label="Desde">
            <Input
              id="r-desde"
              inputMode="numeric"
              value={f.rangoDesde ?? ""}
              onChange={(e) =>
                set(
                  "rangoDesde",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="1"
            />
          </Field>
          <Field id="r-hasta" label="Hasta">
            <Input
              id="r-hasta"
              inputMode="numeric"
              value={f.rangoHasta ?? ""}
              onChange={(e) =>
                set(
                  "rangoHasta",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="5000"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Vigencia"
        description="Fuera de estas fechas la DIAN rechaza las facturas."
      >
        <FieldGrid cols={2}>
          <Field id="r-vd" label="Vigencia desde">
            <Input
              id="r-vd"
              type="date"
              value={f.vigenciaDesde ?? ""}
              onChange={(e) => set("vigenciaDesde", e.target.value)}
            />
          </Field>
          <Field id="r-vh" label="Vigencia hasta">
            <Input
              id="r-vh"
              type="date"
              value={f.vigenciaHasta ?? ""}
              onChange={(e) => set("vigenciaHasta", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Por dónde sigue la numeración"
        description="Lo único que no viene en el papel: en qué folio estás hoy."
      >
        <Field
          id="r-empezar"
          label={`El próximo documento (${nombreTipo}) llevará el número`}
          hint="Al estrenar una resolución es el primer número del rango. Se pregunta porque es lo que hay que ajustar al renovar: si no, la numeración salta y se pierden folios autorizados."
        >
          <Input
            id="r-empezar"
            inputMode="numeric"
            value={empezarEn}
            onChange={(e) => setEmpezarEn(e.target.value)}
            placeholder={String(f.rangoDesde ?? 1)}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Clave técnica"
        description="La entrega la DIAN junto con la resolución."
        help={{ term: "cufe" }}
      >
        <Field
          id="r-clave"
          label="Clave técnica"
          hint="Entra en el cálculo del CUFE. Sin ella no se puede emitir ninguna factura electrónica."
        >
          <Input
            id="r-clave"
            value={claveTecnica}
            onChange={(e) => setClaveTecnica(e.target.value)}
            placeholder={
              row?.status.claveTecnicaOk
                ? "Ya registrada · escribe solo para reemplazarla"
                : "Clave técnica entregada por la DIAN"
            }
          />
        </Field>
      </FormSection>
    </FormDialog>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ResolucionesPage() {
  const { hasPermission } = useAuth()
  const canIssue = hasPermission("einvoicing.issue")

  const [rows, setRows] = React.useState<ResolutionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<ResolutionRow | null>(null)
  const [editingTipo, setEditingTipo] = React.useState<TipoResolucion>("invoice")

  function abrir(row: ResolutionRow, tipo: TipoResolucion) {
    setEditingTipo(tipo)
    setEditing(row)
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listResolutions())
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canIssue) void load()
  }, [canIssue, load])

  if (!canIssue) {
    return (
      <>
        <PageHeader
          section="Facturación"
          title="Resoluciones"
          description="Autorizaciones de numeración de la DIAN, por sede."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver la facturación electrónica. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  // Lo que exige atención primero. Dentro de cada estado, por código de sede.
  const peor = (r: ResolutionRow) =>
    Math.min(
      GRAVEDAD[r.status.estado],
      ...(r.otras ?? []).map((o) => GRAVEDAD[o.status.estado]),
    )
  const ordenadas = [...rows].sort(
    (a, b) => peor(a) - peor(b) || a.sedeCode.localeCompare(b.sedeCode),
  )
  // Cuenta la factura y también las demás resoluciones: vencida, agotada o por vencer.
  const conProblema = ordenadas.filter((r) => peor(r) <= GRAVEDAD.por_vencer).length

  return (
    <>
      <PageHeader
        section="Facturación"
        title="Resoluciones"
        description="La autorización de numeración de la DIAN se agota por dos lados: los números del rango y los días de vigencia. Aquí se ve cuánto queda de cada uno."
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : ordenadas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <ScrollText className="size-9 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              No hay sedes a las que tengas acceso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {conProblema > 0 && (
            <Card className="border-destructive/40">
              <CardContent className="flex items-start gap-3 py-4">
                <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
                <p className="text-sm">
                  <strong>
                    {conProblema} sede(s) tienen resoluciones que piden atención
                    (vencidas, agotadas, por vencer o sin completar).
                  </strong>{" "}
                  Revisa abajo qué le falta a cada una.
                </p>
              </CardContent>
            </Card>
          )}

          {ordenadas.map((row) => {
            const r = row.resolucion
            const c = row.status.consecutivo
            return (
              <Card key={row.sedeId}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2 font-display text-lg">
                      {row.sedeName}
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.sedeCode}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {r?.numero
                        ? `Resolución ${r.numero}${r.fechaResolucion ? ` · ${fmtDate(r.fechaResolucion)}` : ""}`
                        : "Sin resolución registrada"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <EstadoBadge estado={row.status.estado} />
                    <Button size="sm" variant="outline" onClick={() => abrir(row, "invoice")}>
                      <Pencil className="size-4" aria-hidden />
                      {r?.numero ? "Renovar o corregir" : "Registrar"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {row.status.alertas.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {row.status.alertas.map((alerta, i) => (
                        <p
                          key={i}
                          className={cn(
                            "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                            tono(row.status.estado) === "bloquea"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning-ink",
                          )}
                        >
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {alerta}
                        </p>
                      ))}
                    </div>
                  )}

                  {row.status.estado === "ok" && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CircleCheck className="size-4 text-success-ink" aria-hidden />
                      Puede emitir sin problema.
                    </p>
                  )}

                  {r?.numero && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-4">
                        <Dato label="Prefijo">{r.prefijo || "—"}</Dato>
                        <Dato label="Rango autorizado">
                          {r.rangoDesde ?? "—"} – {r.rangoHasta ?? "—"}
                        </Dato>
                        <Dato label="Próxima factura">
                          {r.prefijo ?? ""}
                          {c.siguiente ?? "—"}
                        </Dato>
                        <Dato label="Números restantes">
                          {c.restantes ?? "—"}
                        </Dato>
                      </div>

                      <BarraRango consumido={c.consumido} />

                      <div className="grid gap-4 sm:grid-cols-3">
                        <Dato label="Vigencia desde">
                          {r.vigenciaDesde ? fmtDate(r.vigenciaDesde) : "—"}
                        </Dato>
                        <Dato label="Vigencia hasta">
                          {r.vigenciaHasta ? fmtDate(r.vigenciaHasta) : "—"}
                        </Dato>
                        <Dato label="Días restantes">
                          {row.status.vigencia.diasRestantes ?? "—"}
                        </Dato>
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Otros tipos de documento
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          abrir(
                            row,
                            TIPOS_RESOLUCION.find(
                              (t) =>
                                t !== "invoice" &&
                                !(row.otras ?? []).some(
                                  (o) => o.tipoDocumento === t,
                                ),
                            ) ?? "pos",
                          )
                        }
                      >
                        <Pencil className="size-4" aria-hidden />
                        Registrar otro tipo
                      </Button>
                    </div>
                    {(row.otras ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin resoluciones de documento equivalente POS, notas ni
                        contingencia.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {(row.otras ?? []).map((o) => (
                          <li
                            key={o.tipoDocumento}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {TIPO_RESOLUCION_LABELS[o.tipoDocumento]}
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                Prefijo {o.resolucion.prefijo || "—"} · rango{" "}
                                {o.resolucion.rangoDesde ?? "—"} –{" "}
                                {o.resolucion.rangoHasta ?? "—"} · próximo{" "}
                                {o.status.consecutivo.siguiente ?? "—"}
                              </span>
                              {o.status.alertas.map((a, i) => (
                                <span
                                  key={i}
                                  className="text-xs text-warning-ink"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <EstadoBadge estado={o.status.estado} />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrir(row, o.tipoDocumento)}
                              >
                                Renovar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ClipboardList className="size-4" aria-hidden />
            Cómo se consigue una resolución
          </p>
          <p>
            Se solicita en el portal MUISCA de la DIAN, en{" "}
            <span className="font-medium text-foreground">
              Facturación &rsaquo; Solicitud autorización
            </span>
            , con el RUT actualizado y la firma digital vigente. Ahí se define el
            prefijo, el rango y la vigencia; la clave técnica se consulta en el
            servicio de numeración.
          </p>
          <p>
            Los datos fiscales del emisor (NIT, responsabilidad, dirección) se
            editan en{" "}
            <Link
              href="/panel/sedes"
              className="font-medium text-primary underline underline-offset-4"
            >
              Sedes
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <ResolutionSheet
        open={editing !== null}
        onOpenChange={(v) => setEditing(v ? editing : null)}
        row={editing}
        initialTipo={editingTipo}
        onSaved={setRows}
      />
    </>
  )
}
