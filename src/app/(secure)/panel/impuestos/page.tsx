"use client"

import * as React from "react"
import { ShieldOff, Percent, Plus, RefreshCw, History, Loader2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const KIND_OPTIONS: { v: TaxKind; l: string }[] = [
  { v: "iva", l: "IVA" },
  { v: "inc", l: "Impuesto al consumo (INC)" },
  { v: "exento", l: "Exento (0%)" },
  { v: "excluido", l: "Excluido" },
]

const kindTone: Record<string, string> = {
  iva: "text-info",
  inc: "text-warning",
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
        description="Motor de impuestos configurable por vigencia (IVA, INC, exento, excluido)."
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
                <TableHead className="text-right">Tarifa vigente</TableHead>
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

      <NewTaxSheet open={newOpen} onClose={() => setNewOpen(false)} onSaved={load} />
      <TaxDetailSheet tax={detail} onClose={() => setDetail(null)} onSaved={load} />
    </>
  )
}

function NewTaxSheet({
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
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nuevo impuesto</SheetTitle>
          <SheetDescription>Define el código y su primera vigencia.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="IVA_19"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="IVA general 19%" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Tipo</Label>
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as TaxKind)}>
              {KIND_OPTIONS.map((k) => (
                <option key={k.v} value={k.v}>
                  {k.l}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tarifa (%)</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Vigente desde</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || !code || !name}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TaxDetailSheet({
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
    <Sheet open={!!tax} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {tax.code} · {tax.name}
          </SheetTitle>
          <SheetDescription>{tax.kindLabel}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="size-3.5" /> Histórico de vigencias
            </p>
            <div className="flex flex-col gap-1.5">
              {tax.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{fmtDate(h.effectiveFrom)}</span>
                  <span className="tnum font-medium">
                    {h.rate}%{h.upcoming && <Badge variant="secondary" className="ml-2">Futura</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium text-foreground">Nueva vigencia</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tarifa (%)</Label>
                <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
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
