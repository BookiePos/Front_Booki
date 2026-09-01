"use client"

import * as React from "react"
import Link from "next/link"
import {
  CircleCheck,
  ClipboardList,
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
  type EstadoResolucion,
  type RegisterResolutionPayload,
  type ResolutionRow,
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
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  onSaved: (rows: ResolutionRow[]) => void
}

function ResolutionSheet({ open, onOpenChange, row, onSaved }: ResolutionSheetProps) {
  const [f, setF] = React.useState<RegisterResolutionPayload>({})
  const [empezarEn, setEmpezarEn] = React.useState("")
  const [claveTecnica, setClaveTecnica] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !row) return
    const r = row.resolucion
    setF({
      numero: r?.numero ?? "",
      fechaResolucion: r?.fechaResolucion?.slice(0, 10) ?? "",
      prefijo: r?.prefijo ?? "",
      rangoDesde: r?.rangoDesde,
      rangoHasta: r?.rangoHasta,
      vigenciaDesde: r?.vigenciaDesde?.slice(0, 10) ?? "",
      vigenciaHasta: r?.vigenciaHasta?.slice(0, 10) ?? "",
    })
    setEmpezarEn(
      row.status.consecutivo.siguiente
        ? String(row.status.consecutivo.siguiente)
        : "",
    )
    setClaveTecnica("")
    setError(null)
  }, [open, row])

  function set<K extends keyof RegisterResolutionPayload>(
    key: K,
    value: RegisterResolutionPayload[K],
  ) {
    setF((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!row) return
    setSaving(true)
    setError(null)
    try {
      const rows = await registerResolution(row.sedeId, {
        ...f,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Resolución de {row?.sedeName}
          </SheetTitle>
          <SheetDescription>
            Copia los datos tal como los entregó la DIAN. Al guardar se ajusta
            también por qué número seguirá la numeración.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-num">N.º de resolución</Label>
              <Input
                id="r-num"
                value={f.numero ?? ""}
                onChange={(e) => set("numero", e.target.value)}
                placeholder="18764096721256"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-fecha">Fecha</Label>
              <Input
                id="r-fecha"
                type="date"
                value={f.fechaResolucion ?? ""}
                onChange={(e) => set("fechaResolucion", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-prefijo">Prefijo</Label>
              <Input
                id="r-prefijo"
                maxLength={4}
                value={f.prefijo ?? ""}
                onChange={(e) => set("prefijo", e.target.value.toUpperCase())}
                placeholder="FE"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-desde">Desde</Label>
              <Input
                id="r-desde"
                inputMode="numeric"
                value={f.rangoDesde ?? ""}
                onChange={(e) =>
                  set("rangoDesde", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-hasta">Hasta</Label>
              <Input
                id="r-hasta"
                inputMode="numeric"
                value={f.rangoHasta ?? ""}
                onChange={(e) =>
                  set("rangoHasta", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="5000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-vd">Vigencia desde</Label>
              <Input
                id="r-vd"
                type="date"
                value={f.vigenciaDesde ?? ""}
                onChange={(e) => set("vigenciaDesde", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-vh">Vigencia hasta</Label>
              <Input
                id="r-vh"
                type="date"
                value={f.vigenciaHasta ?? ""}
                onChange={(e) => set("vigenciaHasta", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-empezar">La próxima factura llevará el número</Label>
            <Input
              id="r-empezar"
              inputMode="numeric"
              value={empezarEn}
              onChange={(e) => setEmpezarEn(e.target.value)}
              placeholder={String(f.rangoDesde ?? 1)}
            />
            <p className="text-xs text-muted-foreground">
              Al estrenar una resolución es el primer número del rango. Se
              pregunta porque es lo que hay que ajustar al renovar: si no, la
              numeración salta y se pierden folios autorizados.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-clave">Clave técnica</Label>
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
            <p className="text-xs text-muted-foreground">
              Entra en el cálculo del CUFE. Sin ella no se puede emitir ninguna
              factura electrónica.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar resolución"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function ResolucionesPage() {
  const { hasPermission } = useAuth()
  const canIssue = hasPermission("einvoicing.issue")

  const [rows, setRows] = React.useState<ResolutionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<ResolutionRow | null>(null)

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
  const ordenadas = [...rows].sort(
    (a, b) =>
      GRAVEDAD[a.status.estado] - GRAVEDAD[b.status.estado] ||
      a.sedeCode.localeCompare(b.sedeCode),
  )
  const conProblema = ordenadas.filter((r) => !r.status.puedeEmitir).length

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
                    {conProblema} sede(s) no pueden emitir factura electrónica
                    ahora mismo.
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
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
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
        onSaved={setRows}
      />
    </>
  )
}
