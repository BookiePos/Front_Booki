"use client"

import * as React from "react"
import {
  ShieldOff,
  Target,
  Plus,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  listCategories,
  getBudgetVsActual,
  BUDGET_SCENARIO_LABELS,
  CATEGORY_KIND_LABELS,
  MONTHS_SHORT,
  type FinanceBudget,
  type FinanceCategory,
  type BudgetScenario,
  type BudgetLine,
  type BudgetPayload,
  type BudgetVsActual,
} from "@/lib/erp/api-finance"
import { money, errorMessage, numOr } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
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
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function emptyMonths(): number[] {
  return Array.from({ length: 12 }, () => 0)
}

export default function MetasPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("finance.manage")

  const nowYear = new Date().getFullYear()
  const [year, setYear] = React.useState(nowYear)
  const [budgets, setBudgets] = React.useState<FinanceBudget[]>([])
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newOpen, setNewOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!canView) return
    let active = true
    Promise.all([listSedes(), listCategories()])
      .then(([sd, cats]) => {
        if (!active) return
        setSedes(sd.filter((s) => s.active))
        setCategories(cats)
      })
      .catch((err) => active && setError(errorMessage(err)))
    return () => {
      active = false
    }
  }, [canView])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBudgets(await listBudgets(year))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [year])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Metas" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver las metas.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  if (editingId) {
    return (
      <BudgetEditor
        budgetId={editingId}
        categories={categories}
        sedes={sedes}
        canManage={canManage}
        onBack={() => {
          setEditingId(null)
          void load()
        }}
      />
    )
  }

  const years = [nowYear + 1, nowYear, nowYear - 1, nowYear - 2]
  const sedeName = (id?: string) =>
    id ? (sedes.find((s) => s._id === id)?.name ?? "—") : "Consolidado"

  const actions = (
    <div className="flex items-center gap-2">
      <select
        className={`${inputClass} w-28`}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      {canManage && (
        <Button
          data-tour="metas-nuevo"
          className="gap-1.5"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="size-4" />
          Nueva meta
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Metas"
        description="Metas anuales por categoría y escenario, base del comparativo vs Real."
        actions={actions}
      />

      <Card data-tour="metas-lista">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Target className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay metas para {year}.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Escenario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((b) => {
                  const total = b.lines.reduce(
                    (s, l) => s + l.monthly.reduce((x, m) => x + m, 0),
                    0,
                  )
                  return (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="tabular-nums">{b.fiscalYear}</TableCell>
                      <TableCell>{sedeName(b.sedeId)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {BUDGET_SCENARIO_LABELS[b.scenario]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {b.status === "active" ? (
                          <Badge className="border-success/30 bg-success/10 text-success-ink">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Borrador
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money.format(total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(b._id)}
                          >
                            {canManage ? "Editar" : "Ver"}
                          </Button>
                          {canManage && (
                            <DeleteBudgetButton
                              id={b._id}
                              onDeleted={() => void load()}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <NewBudgetSheet
          open={newOpen}
          onOpenChange={setNewOpen}
          sedes={sedes}
          defaultYear={year}
          onCreated={(b) => {
            setNewOpen(false)
            void load()
            setEditingId(b._id)
          }}
        />
      )}
    </>
  )
}

function DeleteBudgetButton({
  id,
  onDeleted,
}: {
  id: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = React.useState(false)
  const confirm = useConfirm()
  async function remove() {
    if (!(await confirm({ title: "¿Eliminar esta meta?", destructive: true }))) return
    setBusy(true)
    try {
      await deleteBudget(id)
      onDeleted()
    } catch {
      /* no-op */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={busy}
      onClick={() => void remove()}
      title="Eliminar"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  )
}

function NewBudgetSheet({
  open,
  onOpenChange,
  sedes,
  defaultYear,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedes: Sede[]
  defaultYear: number
  onCreated: (b: FinanceBudget) => void
}) {
  const [name, setName] = React.useState("")
  const [fiscalYear, setFiscalYear] = React.useState(String(defaultYear))
  const [sedeId, setSedeId] = React.useState("")
  const [scenario, setScenario] = React.useState<BudgetScenario>("base")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setName("")
    setFiscalYear(String(defaultYear))
    setSedeId("")
    setScenario("base")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: BudgetPayload = {
      name,
      fiscalYear: numOr(fiscalYear, defaultYear),
      sedeId: sedeId || undefined,
      scenario,
    }
    try {
      const b = await createBudget(payload)
      onCreated(b)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = name.trim().length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">Nueva meta</SheetTitle>
            <SheetDescription>
              Define año, sede y escenario. Las líneas se editan después.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Metas 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Año fiscal</Label>
              <Input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Escenario</Label>
              <select
                className={inputClass}
                value={scenario}
                onChange={(e) => setScenario(e.target.value as BudgetScenario)}
              >
                {(Object.keys(BUDGET_SCENARIO_LABELS) as BudgetScenario[]).map((k) => (
                  <option key={k} value={k}>
                    {BUDGET_SCENARIO_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className={inputClass}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value="">Consolidado</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Crear y editar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Editor tipo hoja de cálculo ──────────────────────────────────────────────
function BudgetEditor({
  budgetId,
  categories,
  sedes,
  canManage,
  onBack,
}: {
  budgetId: string
  categories: FinanceCategory[]
  sedes: Sede[]
  canManage: boolean
  onBack: () => void
}) {
  const [view, setView] = React.useState<"plan" | "real">("plan")
  const [budget, setBudget] = React.useState<FinanceBudget | null>(null)
  const [lines, setLines] = React.useState<BudgetLine[]>([])
  const [status, setStatus] = React.useState<"draft" | "active">("draft")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [addCatId, setAddCatId] = React.useState("")

  React.useEffect(() => {
    let active = true
    setLoading(true)
    getBudget(budgetId)
      .then((b) => {
        if (!active) return
        setBudget(b)
        setLines(b.lines.map((l) => ({ ...l, monthly: [...l.monthly] })))
        setStatus(b.status)
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [budgetId])

  const usedIds = new Set(lines.map((l) => l.categoryId))
  const available = categories.filter((c) => c.active && !usedIds.has(c._id))

  function setCell(lineIdx: number, monthIdx: number, value: string) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === lineIdx
          ? {
              ...l,
              monthly: l.monthly.map((m, j) => (j === monthIdx ? numOr(value) : m)),
            }
          : l,
      ),
    )
  }

  function addLine() {
    const cat = categories.find((c) => c._id === addCatId)
    if (!cat) return
    setLines((prev) => [
      ...prev,
      {
        categoryId: cat._id,
        categoryName: cat.name,
        kind: cat.kind,
        monthly: emptyMonths(),
      },
    ])
    setAddCatId("")
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setBusy(true)
    setError(null)
    setMsg(null)
    const payload: BudgetPayload = {
      status,
      lines: lines.map((l) => ({
        categoryId: l.categoryId,
        categoryName: l.categoryName,
        kind: l.kind,
        monthly: l.monthly,
      })),
    }
    try {
      const b = await updateBudget(budgetId, payload)
      setBudget(b)
      setMsg("Meta guardada.")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const grandTotal = lines.reduce(
    (s, l) => s + l.monthly.reduce((x, m) => x + m, 0),
    0,
  )

  return (
    <>
      <PageHeader
        section="Finanzas"
        title={budget ? budget.name : "Meta"}
        description={
          budget
            ? `Año ${budget.fiscalYear} · ${BUDGET_SCENARIO_LABELS[budget.scenario]}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Volver
            </Button>
            {canManage && view === "plan" && (
              <Button className="gap-2" disabled={busy || loading} onClick={() => void save()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-1">
        {(
          [
            { v: "plan", l: "Planeación" },
            { v: "real", l: "Ejecución vs Real" },
          ] as const
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setView(t.v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === t.v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {view === "real" ? (
        <BudgetVsActualView budgetId={budgetId} sedes={sedes} />
      ) : null}

      {view === "plan" &&
        (loading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : error && !budget ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : (
        <>
          {canManage && (
            <Card className="mb-4">
              <CardContent className="flex flex-wrap items-end gap-3 py-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Agregar categoría</Label>
                  <select
                    className={`${inputClass} w-64`}
                    value={addCatId}
                    onChange={(e) => setAddCatId(e.target.value)}
                    disabled={available.length === 0}
                  >
                    <option value="">
                      {available.length === 0 ? "Sin categorías disponibles" : "Selecciona…"}
                    </option>
                    {available.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({CATEGORY_KIND_LABELS[c.kind]})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!addCatId}
                  onClick={addLine}
                >
                  <Plus className="size-4" />
                  Agregar fila
                </Button>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Estado</Label>
                  <select
                    className={`${inputClass} w-36`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "draft" | "active")}
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="overflow-x-auto p-0">
              {lines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <Target className="size-9 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Agrega categorías para empezar a definir tus metas.
                  </p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                        Categoría
                      </th>
                      {MONTHS_SHORT.map((m) => (
                        <th key={m} className="px-1 py-2 text-right font-medium">
                          {m}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      {canManage && <th className="px-2 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const rowTotal = l.monthly.reduce((s, m) => s + m, 0)
                      return (
                        <tr key={l.categoryId} className="border-b border-border/60">
                          <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium">
                            {l.categoryName}
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {CATEGORY_KIND_LABELS[l.kind]}
                            </span>
                          </td>
                          {l.monthly.map((m, j) => (
                            <td key={j} className="px-0.5 py-1">
                              <input
                                type="number"
                                disabled={!canManage}
                                className="h-7 w-16 rounded-md border border-input bg-transparent px-1.5 text-right text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-70"
                                value={m === 0 ? "" : String(m)}
                                placeholder="0"
                                onChange={(e) => setCell(i, j, e.target.value)}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1 text-right font-medium tabular-nums">
                            {money.format(rowTotal)}
                          </td>
                          {canManage && (
                            <td className="px-2 py-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => removeLine(i)}
                                title="Quitar fila"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2">Total anual</td>
                      <td colSpan={12} />
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money.format(grandTotal)}
                      </td>
                      {canManage && <td />}
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>

          {error && budget && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}
          {msg && <p className="mt-3 text-sm text-success-ink">{msg}</p>}
        </>
      ))}
    </>
  )
}

// ── Comparativo Metas vs Real ────────────────────────────────────────────────
function BudgetVsActualView({
  budgetId,
  sedes,
}: {
  budgetId: string
  sedes: Sede[]
}) {
  const ALL = "all"
  const [sedeId, setSedeId] = React.useState<string>(ALL)
  const [data, setData] = React.useState<BudgetVsActual | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getBudgetVsActual(budgetId, sedeId === ALL ? undefined : sedeId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [budgetId, sedeId])

  React.useEffect(() => {
    void load()
  }, [load])

  const totalBudget = data?.totals.budget ?? 0
  const totalActual = data?.totals.actual ?? 0
  const variance = totalActual - totalBudget
  const execPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0

  return (
    <>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Sede</Label>
            <select
              className={`${inputClass} w-48`}
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              <option value={ALL}>Consolidado (todas)</option>
              {sedes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <p className="pb-1.5 text-xs text-muted-foreground">
            El &quot;Real&quot; se calcula de tus ventas, nómina y gastos ya
            registrados. No hay que digitar nada.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : error ? (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      ) : !data || data.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <Target className="size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Esta meta no tiene categorías para comparar.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <VsKpi label="Meta (año)" value={money.format(totalBudget)} />
            <VsKpi label="Real (año)" value={money.format(totalActual)} />
            <VsKpi
              label="Variación"
              value={`${variance >= 0 ? "+" : ""}${money.format(variance)}`}
              tone={variance > 0 ? "up" : variance < 0 ? "down" : undefined}
            />
            <VsKpi label="Ejecución" value={`${execPct}%`} />
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs">
                    <th className="px-3 py-2 text-left font-medium">Categoría</th>
                    <th className="px-3 py-2 text-right font-medium">Meta</th>
                    <th className="px-3 py-2 text-right font-medium">Real</th>
                    <th className="px-3 py-2 text-right font-medium">Variación</th>
                    <th className="px-3 py-2 text-right font-medium">Ejec.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => {
                    const v = l.totalActual - l.totalBudget
                    const pct =
                      l.totalBudget > 0
                        ? Math.round((l.totalActual / l.totalBudget) * 100)
                        : 0
                    // Para ingresos, quedar por debajo es malo; para gastos, sobrepasar es malo.
                    const bad =
                      l.kind === "income" ? v < 0 : v > 0
                    return (
                      <tr key={l.categoryId} className="border-b border-border/60">
                        <td className="px-3 py-2 font-medium">
                          {l.categoryName}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {CATEGORY_KIND_LABELS[l.kind]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {money.format(l.totalBudget)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {money.format(l.totalActual)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            v === 0
                              ? "text-muted-foreground"
                              : bad
                                ? "text-destructive"
                                : "text-success-ink"
                          }`}
                        >
                          {v >= 0 ? "+" : ""}
                          {money.format(v)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {l.totalBudget > 0 ? `${pct}%` : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money.format(totalBudget)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money.format(totalActual)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        variance === 0 ? "" : variance > 0 ? "text-success-ink" : "text-destructive"
                      }`}
                    >
                      {variance >= 0 ? "+" : ""}
                      {money.format(variance)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{execPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

function VsKpi({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "up" | "down"
}) {
  const color =
    tone === "up" ? "text-success-ink" : tone === "down" ? "text-destructive" : "text-foreground"
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {tone === "up" && <TrendingUp className="size-3.5" />}
          {tone === "down" && <TrendingDown className="size-3.5" />}
          {label}
        </span>
        <span className={`font-display text-xl leading-tight ${color}`}>{value}</span>
      </CardContent>
    </Card>
  )
}
