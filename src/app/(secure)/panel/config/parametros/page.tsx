"use client"

import * as React from "react"
import { ShieldOff, SlidersHorizontal, RefreshCw, History, Loader2 } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

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
        description="Tarifas, recargos y topes versionados por fecha de vigencia."
        actions={
          <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
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
        <div className="grid gap-4 md:grid-cols-2">
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

      <ParamDetailSheet param={detail} onClose={() => setDetail(null)} onSaved={load} />
    </>
  )
}

function ParamDetailSheet({
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
    <Sheet open={!!param} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{param.label}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{param.key}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="size-3.5" /> Histórico de vigencias
            </p>
            <div className="flex flex-col gap-1.5">
              {param.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{fmtDate(h.effectiveFrom)}</span>
                  <span className="tnum font-medium">
                    {String(h.value)}
                    {param.unit ? ` ${param.unit}` : ""}
                    {h.upcoming && <Badge variant="secondary" className="ml-2">Futura</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium text-foreground">Nueva vigencia</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Valor</Label>
                {param.valueType === "boolean" ? (
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <Input
                    type={param.valueType === "text" ? "text" : "number"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </div>
            </div>
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
            <Button className="mt-3 w-full" onClick={() => void addVersion()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Publicar vigencia
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
