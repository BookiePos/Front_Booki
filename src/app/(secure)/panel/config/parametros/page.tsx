"use client"

import * as React from "react"
import { ShieldOff, SlidersHorizontal, RefreshCw, History } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listParams,
  setParamVersion,
  PARAM_GROUP_LABELS,
  type ParameterView,
} from "@/lib/erp/api-params"
import { money, fmtDate, errorMessage } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import { Field, FieldGrid, NativeSelect } from "@/components/ui/field"
import { Termino } from "@/components/ui/help-tip"

function formatValue(p: ParameterView): string {
  const v = p.current?.value
  if (v === undefined || v === null) return "—"
  if (p.valueType === "money") return money.format(Number(v))
  if (p.valueType === "percent") return `${v}%`
  if (p.valueType === "boolean") return v ? "Sí" : "No"
  if (p.valueType === "number") return `${v}${p.unit ? ` ${p.unit}` : ""}`
  return String(v)
}

export default function ParametrosPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("params.manage")

  const [rows, setRows] = React.useState<ParameterView[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<ParameterView | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listParams())
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
        <PageHeader section="Configuración" title="Parámetros" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>params.manage</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const groups = Array.from(new Set(rows.map((r) => r.group)))

  return (
    <>
      <PageHeader
        section="Configuración"
        title="Parámetros"
        titleHelp={{ term: "parametros" }}
        description={
          <>
            Las tarifas, los recargos y los topes que usa todo el sistema —
            <Termino>SMMLV</Termino>, <Termino term="auxilioTransporte">auxilio
            de transporte</Termino>, <Termino>UVT</Termino>—, cada uno con su
            histórico por fecha.
          </>
        }
        actions={
          <Button
            data-tour="parametros-actualizar"
            variant="outline"
            size="icon"
            onClick={() => void load()}
            title="Actualizar"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div data-tour="parametros-grupos" className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">
                  {PARAM_GROUP_LABELS[g] ?? g}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border">
                {rows
                  .filter((r) => r.group === g)
                  .map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setDetail(p)}
                      className="flex items-center justify-between py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{p.key}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <span className="tnum text-sm font-semibold">{formatValue(p)}</span>
                        {p.history.some((h) => h.upcoming) && (
                          <Badge variant="secondary" className="text-[10px]">Futura</Badge>
                        )}
                      </div>
                    </button>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ParamDetailDialog param={detail} onClose={() => setDetail(null)} onSaved={load} />
    </>
  )
}

function ParamDetailDialog({
  param,
  onClose,
  onSaved,
}: {
  param: ParameterView | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [value, setValue] = React.useState("")
  const [effectiveFrom, setEffectiveFrom] = React.useState(
    new Date().toLocaleDateString("en-CA"),
  )
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (param) {
      setValue(param.current ? String(param.current.value) : "")
      setErr(null)
    }
  }, [param])

  if (!param) return null

  async function addVersion() {
    if (!param) return
    setSaving(true)
    setErr(null)
    try {
      let parsed: number | string | boolean = value
      if (param.valueType === "boolean") parsed = value === "true" || value === "Sí"
      else if (param.valueType !== "text") parsed = Math.round(Number(value))
      await setParamVersion(param.key, { value: parsed, effectiveFrom })
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
      open={!!param}
      onOpenChange={(o) => !o && onClose()}
      size="2xl"
      icon={SlidersHorizontal}
      title={param.label}
      description={
        <span className="font-mono text-xs">{param.key}</span>
      }
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
        description="Los parámetros no se editan: se publica un valor nuevo con su fecha, y el anterior queda para lo ya calculado."
        boxed
      >
        <ul className="flex flex-col gap-1.5">
          {param.history.map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">
                {fmtDate(h.effectiveFrom)}
              </span>
              <span className="flex items-center gap-2">
                <span className="stat-figure text-sm">
                  {String(h.value)}
                  {param.unit ? ` ${param.unit}` : ""}
                </span>
                {h.upcoming && <Badge variant="secondary">Futura</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection
        title="Nueva vigencia"
        description="Desde la fecha que pongas, el sistema usará este valor."
      >
        <FieldGrid cols={2}>
          <Field
            id="pm-value"
            label="Valor"
            hint={param.unit ? `En ${param.unit}.` : undefined}
          >
            {param.valueType === "boolean" ? (
              <NativeSelect
                id="pm-value"
                value={value}
                onChange={setValue}
                options={[
                  { value: "true", label: "Sí" },
                  { value: "false", label: "No" },
                ]}
              />
            ) : (
              <Input
                id="pm-value"
                type={param.valueType === "text" ? "text" : "number"}
                inputMode={param.valueType === "text" ? undefined : "numeric"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </Field>
          <Field id="pm-from" label="Desde">
            <Input
              id="pm-from"
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
