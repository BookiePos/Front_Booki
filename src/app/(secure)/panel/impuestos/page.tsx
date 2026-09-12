"use client"

import * as React from "react"
import { ShieldOff, Percent, Plus, RefreshCw, History } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listTaxes,
  createTax,
  setTaxVersion,
  type TaxView,
  type TaxKind,
} from "@/lib/erp/api-tax"
import { fmtDate, errorMessage, numOr } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, InputWithIcon } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { HelpTip, Termino } from "@/components/ui/help-tip"

const KIND_OPTIONS: { v: TaxKind; l: string }[] = [
  { v: "iva", l: "IVA" },
  { v: "inc", l: "Impuesto al consumo (INC)" },
  { v: "exento", l: "Exento (0%)" },
  { v: "excluido", l: "Excluido" },
]

const kindTone: Record<string, string> = {
  iva: "text-info",
  inc: "text-warning-ink",
  exento: "text-muted-foreground",
  excluido: "text-muted-foreground",
}

export default function ImpuestosPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("tax.manage")

  const [rows, setRows] = React.useState<TaxView[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newOpen, setNewOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<TaxView | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listTaxes())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  if (!canManage) {
    return (
      <>
        <PageHeader section="Cumplimiento" title="Impuestos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>tax.manage</code> para gestionar impuestos.
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
        title="Impuestos"
        description={
          <>
            Las tarifas que le cobras al cliente y le entregas a la{" "}
            <Termino>DIAN</Termino>: <Termino>IVA</Termino>,{" "}
            <Termino term="inc">INC</Termino>,{" "}
            <Termino term="ivaExento">exento</Termino> y{" "}
            <Termino term="ivaExcluido">excluido</Termino>. Cada una guarda su
            histórico por fecha.
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              data-tour="impuestos-nuevo"
              className="gap-1.5"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="size-4" />
              Nuevo impuesto
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card data-tour="impuestos-tabla">
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">
                  Tarifa vigente
                  <HelpTip
                    title="Tarifa vigente"
                    side="bottom"
                    className="ml-1.5"
                  >
                    La que se aplica hoy. Si publicaste una tarifa futura, esta
                    sigue siendo la buena hasta que llegue esa fecha.
                  </HelpTip>
                </TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Vigencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                rows.map((t) => (
                  <TableRow
                    key={t.code}
                    className="cursor-pointer"
                    onClick={() => setDetail(t)}
                  >
                    <TableCell className="font-mono text-xs font-medium">{t.code}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>
                      <span className={kindTone[t.kind]}>{t.kindLabel}</span>
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">
                      {t.currentRate === null ? "—" : `${t.currentRate}%`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(t.currentFrom ?? undefined)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{t.history.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Percent className="mx-auto mb-2 size-8 opacity-40" />
                    No hay impuestos configurados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewTaxDialog open={newOpen} onClose={() => setNewOpen(false)} onSaved={load} />
      <TaxDetailDialog tax={detail} onClose={() => setDetail(null)} onSaved={load} />
    </>
  )
}

function NewTaxDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<TaxKind>("iva")
  const [rate, setRate] = React.useState("19")
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    new Date().toLocaleDateString("en-CA"),
  )
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setCode("")
      setName("")
      setKind("iva")
      setRate("19")
      setErr(null)
    }
  }, [open])

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      await createTax({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        kind,
        rate: numOr(rate),
        effectiveFrom,
      })
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      icon={Percent}
      title="Nuevo impuesto"
      description="El código con el que marcarás tus productos y la tarifa con la que arranca."
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void save()}
          busy={saving}
          disabled={!code || !name}
          submitLabel="Crear"
        />
      }
    >
      {err && <FormAlert>{err}</FormAlert>}

      <FormSection title="Identificación">
        <FieldGrid cols={3}>
          <Field
            id="tx-code"
            label="Código"
            required
            hint="Corto y en mayúsculas."
          >
            <Input
              id="tx-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="IVA_19"
            />
          </Field>
          <FieldSpan span={2}>
            <Field id="tx-name" label="Nombre" required>
              <Input
                id="tx-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="IVA general 19%"
              />
            </Field>
          </FieldSpan>

          <Field
            id="tx-kind"
            label="Tipo"
            help={{ term: kind === "inc" ? "inc" : "iva" }}
          >
            <NativeSelect
              id="tx-kind"
              value={kind}
              onChange={(v) => setKind(v as TaxKind)}
              options={KIND_OPTIONS.map((k) => ({ value: k.v, label: k.l }))}
            />
          </Field>
          <Field id="tx-rate" label="Tarifa (%)">
            <InputWithIcon
              id="tx-rate"
              type="number"
              inputMode="decimal"
              suffix="%"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field
            id="tx-from"
            label="Vigente desde"
            hint="Antes de esa fecha se usa la tarifa anterior."
          >
            <Input
              id="tx-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormDialog>
  )
}

function TaxDetailDialog({
  tax,
  onClose,
  onSaved,
}: {
  tax: TaxView | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [rate, setRate] = React.useState("")
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    new Date().toLocaleDateString("en-CA"),
  )
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (tax) {
      setRate(tax.currentRate !== null ? String(tax.currentRate) : "0")
      setErr(null)
    }
  }, [tax])

  if (!tax) return null

  async function addVersion() {
    if (!tax) return
    setSaving(true)
    setErr(null)
    try {
      await setTaxVersion(tax.code, { rate: numOr(rate), effectiveFrom })
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={!!tax}
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      icon={Percent}
      title={`${tax.code} · ${tax.name}`}
      description={tax.kindLabel}
      footer={
        <FormActions
          onCancel={onClose}
          onSubmit={() => void addVersion()}
          busy={saving}
          submitLabel="Publicar vigencia"
        />
      }
    >
      {err && <FormAlert>{err}</FormAlert>}

      <FormSection
        icon={History}
        title="Histórico de vigencias"
        description="Las tarifas no se editan: se publica una nueva con su fecha, y la anterior queda para los documentos ya emitidos."
        boxed
      >
        <ul className="flex flex-col gap-1.5">
          {tax.history.map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">
                {fmtDate(h.effectiveFrom)}
              </span>
              <span className="flex items-center gap-2">
                <span className="stat-figure text-sm">{h.rate}%</span>
                {h.upcoming && <Badge variant="secondary">Futura</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection
        title="Nueva vigencia"
        description="Desde la fecha que pongas, los documentos nuevos usarán esta tarifa."
      >
        <FieldGrid cols={2}>
          <Field id="txd-rate" label="Tarifa (%)">
            <InputWithIcon
              id="txd-rate"
              type="number"
              inputMode="decimal"
              suffix="%"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field id="txd-from" label="Desde">
            <Input
              id="txd-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>
    </FormDialog>
  )
}
