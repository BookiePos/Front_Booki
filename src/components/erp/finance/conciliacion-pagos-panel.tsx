"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  FileUp,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  RECON_CHANNEL_LABELS,
  createPaymentReconciliation,
  deletePaymentReconciliation,
  listPaymentReconciliation,
  previewStatementCsv,
  type ReconChannel,
  type ReconList,
  type ReconPreview,
  type ReconRow,
  type SettlementItem,
} from "@/lib/erp/api-finance"
import {
  diferenciaConciliacion,
  validarCsv,
  estadoConciliacion,
} from "@/lib/erp/conciliacion-pagos"
import {
  errorMessage,
  fmtDate,
  money,
  monthStart,
  numOr,
  todayLocal,
} from "@/lib/erp/finance-format"
import { FRANCHISE_LABELS } from "@/lib/pos/pago-digital"
import type { CardFranchise } from "@/lib/pos/api-sales"

import { useConfirm } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import {
  FormActions,
  FormAlert,
  FormDialog,
} from "@/components/ui/form-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useResetOnChange } from "@/hooks/use-reset-on-change"
import { useLoadEffect } from "@/hooks/use-load-effect"

function canalLabel(r: { channel: ReconChannel; franchise?: string }): string {
  const base = RECON_CHANNEL_LABELS[r.channel]
  const f = FRANCHISE_LABELS[(r.franchise ?? "") as CardFranchise]
  return f ? `${base} · ${f}` : base
}

const ESTADO_BADGE = {
  pendiente: { label: "Pendiente", variant: "outline" },
  conciliado: { label: "Conciliado", variant: "secondary" },
  diferencia: { label: "Con diferencia", variant: "destructive" },
} as const

/**
 * Conciliación de pagos digitales (ítem 6.4): lo que el POS cobró por datáfono,
 * Nequi, Daviplata y QR, día por día, contra lo que dice el extracto. Se
 * concilia a mano o subiendo el CSV; la comisión y las retenciones se asientan
 * solas contra Bancos.
 */
export function ConciliacionPagosPanel() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("finance.manage")
  const confirm = useConfirm()

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [sedeId, setSedeId] = React.useState("")
  const [from, setFrom] = React.useState(monthStart())
  const [to, setTo] = React.useState(todayLocal())
  const [data, setData] = React.useState<ReconList | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [manual, setManual] = React.useState<ReconRow | null>(null)
  const [csvOpen, setCsvOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    listSedes()
      .then((sd) => {
        if (!active) return
        const activas = sd.filter((s) => s.active)
        setSedes(activas)
        setSedeId((cur) => cur || activas[0]?._id || "")
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [])

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      setData(await listPaymentReconciliation({ sedeId, from, to }))
    } catch (err) {
      setData(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId, from, to])

  useLoadEffect(load, sedeId !== "")

  async function quitar(r: ReconRow) {
    if (!r.settlement) return
    const ok = await confirm({
      title: "¿Deshacer esta conciliación?",
      description:
        "Se reversan el asiento de la comisión y las retenciones y el movimiento de la cuenta. El día vuelve a quedar pendiente.",
      confirmLabel: "Deshacer",
      destructive: true,
    })
    if (!ok) return
    setDeleting(r.settlement.id)
    try {
      await deletePaymentReconciliation(r.settlement.id)
      toast.success("Conciliación deshecha")
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  const t = data?.totals

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Field id="cp-sede" label="Sede">
            <NativeSelect
              id="cp-sede"
              value={sedeId}
              onChange={setSedeId}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
            />
          </Field>
          <Field id="cp-desde" label="Desde">
            <Input
              id="cp-desde"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field id="cp-hasta" label="Hasta">
            <Input
              id="cp-hasta"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            title="Actualizar"
            aria-label="Actualizar"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canManage && (
            <Button
              className="ml-auto"
              onClick={() => setCsvOpen(true)}
              disabled={!sedeId}
            >
              <FileUp className="size-4" />
              Subir extracto (CSV)
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Resumen
          label="Cobrado en el POS"
          value={t ? money.format(t.expected) : "—"}
        />
        <Resumen
          label="Consignado"
          value={t ? money.format(t.statementAmount) : "—"}
        />
        <Resumen
          label="Comisiones e IVA"
          value={t ? money.format(t.fees) : "—"}
        />
        <Resumen
          label="Retenciones"
          value={t ? money.format(t.retentions) : "—"}
        />
        <Resumen
          label="Por conciliar"
          value={
            t
              ? `${t.pending}${t.withDifference ? ` · ${t.withDifference} con diferencia` : ""}`
              : "—"
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !data || data.rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No hubo cobros por datáfono, Nequi, Daviplata ni QR en estas
              fechas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Consignado</TableHead>
                  <TableHead className="text-right">Comisión + IVA</TableHead>
                  <TableHead className="text-right">Retenciones</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => {
                  const s = r.settlement
                  const est = ESTADO_BADGE[estadoConciliacion(s)]
                  return (
                    <TableRow key={`${r.date}|${r.key}`}>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell>
                        {canalLabel(r)}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {r.tickets} {r.tickets === 1 ? "venta" : "ventas"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(r.expected)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s ? money.format(s.statementAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s ? money.format(s.commission + s.commissionIva) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s
                          ? money.format(s.retefuente + s.reteIca + s.reteIva)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s ? money.format(s.difference) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={est.variant}>{est.label}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {s ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Deshacer la conciliación de ${canalLabel(r)} del ${fmtDate(r.date)}`}
                              disabled={deleting === s.id}
                              onClick={() => void quitar(r)}
                            >
                              {deleting === s.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setManual(r)}
                            >
                              Conciliar
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ManualDialog
        row={manual}
        sedeId={sedeId}
        onClose={() => setManual(null)}
        onSaved={() => {
          setManual(null)
          void load()
        }}
      />
      <CsvDialog
        open={csvOpen}
        sedeId={sedeId}
        onClose={() => setCsvOpen(false)}
        onSaved={() => {
          setCsvOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function Resumen({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="stat-figure text-lg">{value}</p>
    </div>
  )
}

const FORM_VACIO = {
  statement: "",
  commission: "",
  iva: "",
  rf: "",
  ica: "",
  riva: "",
  note: "",
}

/** Marcar a mano: lo que dice el extracto de ese día y canal. */
function ManualDialog({
  row,
  sedeId,
  onClose,
  onSaved,
}: {
  row: ReconRow | null
  sedeId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = React.useState(FORM_VACIO)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  useResetOnChange(() => {
    if (row) {
      setF({ ...FORM_VACIO, statement: String(row.expected) })
      setError(null)
    }
  }, [row])

  if (!row) return null
  const cifras = {
    statementAmount: numOr(f.statement),
    commission: numOr(f.commission),
    commissionIva: numOr(f.iva),
    retefuente: numOr(f.rf),
    reteIca: numOr(f.ica),
    reteIva: numOr(f.riva),
  }
  const diff = diferenciaConciliacion(row.expected, cifras)

  async function guardar() {
    if (!row) return
    setBusy(true)
    setError(null)
    try {
      const item: SettlementItem = {
        date: row.date,
        channel: row.channel,
        franchise: row.franchise || undefined,
        ...cifras,
        note: f.note.trim() || undefined,
      }
      const r = await createPaymentReconciliation({
        sedeId,
        source: "manual",
        items: [item],
      })
      if (r.skipped.length > 0) {
        setError(r.skipped[0]!.reason)
        return
      }
      toast.success(diff === 0 ? "Conciliado" : "Guardado con diferencia")
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const campo = (id: keyof typeof FORM_VACIO, label: string) => (
    <Field id={`cp-${id}`} label={label}>
      <Input
        id={`cp-${id}`}
        inputMode="numeric"
        value={f[id]}
        onChange={(e) => setF({ ...f, [id]: e.target.value })}
        placeholder="0"
      />
    </Field>
  )

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="2xl"
      title={`Conciliar ${canalLabel(row)}`}
      description={`${fmtDate(row.date)} · el POS cobró ${money.format(row.expected)}`}
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void guardar()}
          busy={busy}
          submitLabel="Conciliar"
          extra={`Diferencia: ${money.format(diff)}`}
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      <FieldGrid>
        {campo("statement", "Consignado según el extracto")}
        {campo("commission", "Comisión del adquirente")}
        {campo("iva", "IVA de la comisión")}
        {campo("rf", "Retefuente")}
        {campo("ica", "ReteICA")}
        {campo("riva", "ReteIVA")}
      </FieldGrid>
      <Field id="cp-note" label="Nota">
        <Input
          id="cp-note"
          value={f.note}
          maxLength={200}
          onChange={(e) => setF({ ...f, note: e.target.value })}
          placeholder="Opcional"
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        La comisión y las retenciones se asientan solas: la comisión como
        gasto bancario y las retenciones como anticipo de impuestos.
      </p>
    </FormDialog>
  )
}

/** Subir el CSV del extracto: se ve el cruce y recién ahí se confirma. */
function CsvDialog({
  open,
  sedeId,
  onClose,
  onSaved,
}: {
  open: boolean
  sedeId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [csv, setCsv] = React.useState("")
  const [fileName, setFileName] = React.useState("")
  const [canal, setCanal] = React.useState("")
  const [preview, setPreview] = React.useState<ReconPreview | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  useResetOnChange(() => {
    if (open) {
      setCsv("")
      setFileName("")
      setCanal("")
      setPreview(null)
      setError(null)
    }
  }, [open])

  async function leer(file: File | undefined) {
    if (!file) return
    setError(null)
    setPreview(null)
    const problema = validarCsv(file.size)
    if (problema) {
      setError(problema)
      return
    }
    setFileName(file.name)
    setCsv(await file.text())
  }

  async function revisar() {
    setBusy(true)
    setError(null)
    try {
      setPreview(
        await previewStatementCsv({
          sedeId,
          csv,
          channel: (canal || undefined) as ReconChannel | undefined,
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const nuevas = preview?.rows.filter((r) => !r.alreadyReconciled) ?? []

  async function confirmar() {
    setBusy(true)
    setError(null)
    try {
      const r = await createPaymentReconciliation({
        sedeId,
        source: "csv",
        items: nuevas.map((n) => ({
          date: n.date,
          channel: n.channel,
          franchise: n.franchise || undefined,
          statementAmount: n.statementAmount,
          commission: n.commission,
          commissionIva: n.commissionIva,
          retefuente: n.retefuente,
          reteIca: n.reteIca,
          reteIva: n.reteIva,
        })),
      })
      toast.success(
        `${r.created.length} conciliadas${r.skipped.length ? ` · ${r.skipped.length} omitidas` : ""}`,
      )
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="4xl"
      title="Subir el extracto"
      description="CSV del adquirente o la billetera, con columnas fecha y neto (o bruto) y, si las tiene, canal, franquicia, comisión, IVA y retenciones."
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void (preview ? confirmar() : revisar())}
          busy={busy}
          disabled={preview ? nuevas.length === 0 : csv === ""}
          submitLabel={preview ? `Conciliar ${nuevas.length}` : "Revisar"}
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}
      <FieldGrid>
        <Field id="cp-csv" label="Archivo CSV">
          <Input
            id="cp-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void leer(e.target.files?.[0])}
          />
        </Field>
        <Field
          id="cp-canal"
          label="Canal si el archivo no lo trae"
          hint={fileName}
        >
          <NativeSelect
            id="cp-canal"
            value={canal}
            onChange={setCanal}
            placeholder="Lo dice el archivo"
            options={Object.entries(RECON_CHANNEL_LABELS).map(
              ([value, label]) => ({ value, label }),
            )}
          />
        </Field>
      </FieldGrid>
      {preview && (
        <div className="flex flex-col gap-2">
          {preview.errors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-ink"
            >
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4" />
                {preview.errors.length}{" "}
                {preview.errors.length === 1
                  ? "línea con problema"
                  : "líneas con problema"}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {preview.errors.slice(0, 6).map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    Línea {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">POS cobró</TableHead>
                  <TableHead className="text-right">Extracto</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow key={`${r.line}-${r.date}-${r.key}`}>
                    <TableCell>{fmtDate(r.date)}</TableCell>
                    <TableCell>{canalLabel(r)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(r.expected)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(r.statementAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money.format(r.difference)}
                    </TableCell>
                    <TableCell>
                      {r.alreadyReconciled ? (
                        <Badge variant="secondary">Ya conciliada</Badge>
                      ) : r.expected === 0 ? (
                        <Badge variant="outline">Sin cobros ese día</Badge>
                      ) : r.difference === 0 ? (
                        <Check
                          className="size-4 text-success-ink"
                          aria-label="Cuadra"
                        />
                      ) : (
                        <Badge variant="destructive">Diferencia</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </FormDialog>
  )
}
