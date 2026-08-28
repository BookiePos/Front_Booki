"use client"

import * as React from "react"
import {
  ShieldOff,
  ReceiptText,
  Plus,
  RefreshCw,
  Loader2,
  Check,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listEmployees, type Employee } from "@/lib/erp/api-employees"
import {
  listDeductions,
  createDeduction,
  approveDeduction,
  rejectDeduction,
  DEDUCTION_STATUS_LABELS,
  type PayrollDeduction,
  type DeductionStatus,
} from "@/lib/erp/api-payroll"
import { money, todayLocal, fmtDate, errorMessage, numOr } from "@/lib/erp/finance-format"

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

const ALL = "all"
const inputClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const statusVariant: Record<DeductionStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  applied: "outline",
  rejected: "destructive",
  cancelled: "destructive",
}

export default function DeduccionesPage() {
  const { hasPermission } = useAuth()
  const canApprove = hasPermission("payroll.deduction.approve")
  const canManage = hasPermission("payroll.manage")
  // Ve la cola quien aprueba, gestiona nómina o solo la consulta.
  const canView = hasPermission("payroll.view") || canApprove || canManage

  const [rows, setRows] = React.useState<PayrollDeduction[]>([])
  const [status, setStatus] = React.useState(ALL)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [newOpen, setNewOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await listDeductions({
          status: status === ALL ? undefined : (status as DeductionStatus),
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [status])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (!canView) {
    return (
      <>
        <PageHeader section="Personal" title="Consumos / deducciones" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso <code>payroll.view</code> o{" "}
              <code>payroll.deduction.approve</code>.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const pendientes = rows.filter((r) => r.status === "pending").length
  const totalAprobado = rows
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <PageHeader
        section="Personal"
        title="Consumos / deducciones"
        description="Consumos de empleado (fiado) que se descuentan por nómina. Requieren aprobación para entrar a la colilla."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {canManage && (
              <Button className="gap-1.5" onClick={() => setNewOpen(true)} data-tour="deducciones-nuevo">
                <Plus className="size-4" />
                Nuevo consumo
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4" data-tour="deducciones-kpis">
        <Kpi label="Pendientes de aprobar" value={String(pendientes)} accent />
        <Kpi label="Aprobado por descontar" value={money.format(totalAprobado)} />
      </div>

      <Card className="mb-4" data-tour="deducciones-filtro">
        <CardContent className="flex items-center gap-3 py-3">
          <Label className="text-xs">Estado</Label>
          <select className={`${inputClass} w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ALL}>Todos</option>
            {Object.entries(DEDUCTION_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card data-tour="deducciones-tabla">
        <CardContent className="px-0 sm:px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
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
                rows.map((d) => (
                  <TableRow key={d._id}>
                    <TableCell className="text-muted-foreground">{fmtDate(d.date)}</TableCell>
                    <TableCell className="font-medium">{d.employeeName}</TableCell>
                    <TableCell>
                      {d.concept}
                      {d.source === "sale" && (
                        <Badge variant="outline" className="ml-2 text-[10px]">POS</Badge>
                      )}
                      {d.appliedPeriod && (
                        <span className="ml-2 text-[11px] text-muted-foreground">→ {d.appliedPeriod}</span>
                      )}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">{money.format(d.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant[d.status]}>{DEDUCTION_STATUS_LABELS[d.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {d.status === "pending" && canApprove ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={busyId === d._id}
                            onClick={() => void act(d._id, () => approveDeduction(d._id))}
                          >
                            {busyId === d._id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-destructive"
                            disabled={busyId === d._id}
                            onClick={() => void act(d._id, () => rejectDeduction(d._id))}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <ReceiptText className="mx-auto mb-2 size-8 opacity-40" />
                    No hay consumos ni deducciones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewDeductionSheet open={newOpen} onClose={() => setNewOpen(false)} onSaved={load} />
    </>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`stat-figure mt-1 text-2xl ${accent ? "text-warning-ink" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function NewDeductionSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [employeeId, setEmployeeId] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [date, setDate] = React.useState(todayLocal())
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setEmployeeId("")
    setConcept("")
    setAmount("")
    setDate(todayLocal())
    setErr(null)
    listEmployees()
      .then((e) => setEmployees(e.filter((x) => x.status === "activo")))
      .catch(() => setEmployees([]))
  }, [open])

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      await createDeduction({
        employeeId,
        concept: concept.trim(),
        amount: numOr(amount),
        date,
      })
      await onSaved()
      onClose()
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nuevo consumo de empleado</SheetTitle>
          <SheetDescription>
            Queda pendiente de aprobación; al aprobarse se descuenta en la próxima corrida.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Empleado</Label>
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Selecciona…</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Almuerzo, adelanto…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Monto</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={busy || !employeeId || !concept.trim() || numOr(amount) <= 0}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
