"use client"

import * as React from "react"
import { ShieldOff, ShieldCheck, RefreshCw, CheckCircle2, XCircle } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listAudit,
  listAuditModules,
  type AuditLog,
} from "@/lib/erp/api-audit"
import { errorMessage, todayLocal } from "@/lib/erp/finance-format"

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

const inputClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const ALL = "all"
const METHOD_TONE: Record<string, string> = {
  POST: "text-success-ink",
  PATCH: "text-info",
  PUT: "text-info",
  DELETE: "text-destructive",
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function AuditoriaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("audit.view")

  const [rows, setRows] = React.useState<AuditLog[]>([])
  const [modules, setModules] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [module, setModule] = React.useState(ALL)
  const [method, setMethod] = React.useState(ALL)
  const [userEmail, setUserEmail] = React.useState("")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState(todayLocal())

  React.useEffect(() => {
    if (!canView) return
    listAuditModules()
      .then(setModules)
      .catch(() => setModules([]))
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAudit({
        module: module === ALL ? undefined : module,
        method: method === ALL ? undefined : method,
        userEmail: userEmail.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 300,
      })
      setRows(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [module, method, userEmail, from, to])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Cumplimiento" title="Auditoría" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>audit.view</code>.
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
        title="Auditoría"
        description="Registro inmutable de toda operación de escritura: quién, qué, cuándo y desde dónde."
        actions={
          <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <Card data-tour="auditoria-filtros" className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Módulo</Label>
            <select className={`${inputClass} w-40`} value={module} onChange={(e) => setModule(e.target.value)}>
              <option value={ALL}>Todos</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Acción</Label>
            <select className={`${inputClass} w-32`} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value={ALL}>Todas</option>
              <option value="POST">POST (crear)</option>
              <option value="PATCH">PATCH (editar)</option>
              <option value="DELETE">DELETE (borrar)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Usuario</Label>
            <Input
              className="w-52"
              placeholder="correo@empresa.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={() => void load()}>Filtrar</Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card data-tour="auditoria-tabla">
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading &&
                rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="tnum whitespace-nowrap text-xs text-muted-foreground">
                      {fmtDateTime(r.at)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.userName ?? r.userEmail ?? "—"}</p>
                        {r.role && <p className="text-[11px] text-muted-foreground">{r.role}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono text-xs font-semibold ${METHOD_TONE[r.method] ?? ""}`}>
                        {r.method}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.path}</TableCell>
                    <TableCell className="text-center">
                      {r.success ? (
                        <CheckCircle2 className="mx-auto size-4 text-success-ink" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive" title={r.error}>
                          <XCircle className="size-4" />
                          {r.statusCode}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <ShieldCheck className="mx-auto mb-2 size-8 opacity-40" />
                    Sin eventos de auditoría para estos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
