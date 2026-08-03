"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ShieldOff,
  ChevronLeft,
  Loader2,
  Scale,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Link2,
  FileWarning,
  Landmark,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  listAccounts,
  listAccountMovements,
  listCategories,
  reconcileAccount,
  type FinanceAccount,
  type FinanceMovement,
  type FinanceCategory,
  type ReconcilePayload,
  type ReconciliationResult,
} from "@/lib/erp/api-finance"
import { money, todayLocal, fmtDate, errorMessage, numOr } from "@/lib/erp/finance-format"

import { PageHeader } from "@/components/erp/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/** Línea de extracto ya normalizada. `amount` con signo (negativo = salida). */
interface StmtLine {
  id: string
  date: string
  description: string
  amount: number
}

const COMMISSION_RE = /comis|dat[aá]fono|4\s*x\s*1000|gmf|impuesto|cuota manejo/i

function signed(m: { direction: "in" | "out"; amount: number }): number {
  return m.direction === "in" ? m.amount : -m.amount
}

/** Normaliza una fecha a YYYY-MM-DD (acepta DD/MM/AAAA y DD-MM-AAAA). */
function normDate(s: string): string | null {
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const d = m[1] ?? ""
    const mo = m[2] ?? ""
    const y0 = m[3] ?? ""
    const y = y0.length === 2 ? `20${y0}` : y0
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}

/** Convierte un monto de texto (formato COP) a entero con signo. */
function parseAmount(s: string): number | null {
  let t = s.trim()
  if (!t) return null
  const negative = /^-|-$|^\(.*\)$/.test(t)
  t = t.replace(/[()]/g, "").replace(/[^0-9.,-]/g, "")
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".")
  else if (t.includes(",")) t = t.replace(",", ".")
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return null
  const val = Math.round(Math.abs(n))
  return negative && val > 0 ? -val : val
}

function splitRow(row: string): string[] {
  if (row.includes("\t")) return row.split("\t")
  if (row.includes(";")) return row.split(";")
  return row.split(",")
}

/** Parsea el texto pegado del extracto a líneas normalizadas. */
function parseStatement(text: string): StmtLine[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
  const out: StmtLine[] = []
  rows.forEach((row, i) => {
    const cols = splitRow(row).map((c) => c.trim())
    const first = cols[0]
    const last = cols[cols.length - 1]
    if (cols.length < 2 || first === undefined || last === undefined) return
    const date = normDate(first)
    const amount = parseAmount(last)
    if (date === null || amount === null) return // encabezado o fila inválida
    const description = cols.slice(1, -1).join(" ").trim() || "(sin descripción)"
    out.push({ id: `s${i}`, date, description, amount })
  })
  return out
}

/** Empareja líneas de extracto con movimientos por monto igual y fecha ≤7 días. */
function autoMatch(
  lines: StmtLine[],
  movements: FinanceMovement[],
): { byStmt: Record<string, string>; matchedMovIds: string[] } {
  const byStmt: Record<string, string> = {}
  const used = new Set<string>()
  for (const l of lines) {
    const lt = new Date(`${l.date}T00:00:00`).getTime()
    const hit = movements.find((m) => {
      if (used.has(m._id)) return false
      if (signed(m) !== l.amount) return false
      const mt = new Date(`${m.date.slice(0, 10)}T00:00:00`).getTime()
      return Math.abs(mt - lt) <= 7 * 86_400_000
    })
    if (hit) {
      byStmt[l.id] = hit._id
      used.add(hit._id)
    }
  }
  return { byStmt, matchedMovIds: [...used] }
}

export default function ConciliarPage() {
  const params = useParams()
  const accountId = String(params.id)
  const { hasPermission } = useAuth()
  const canManage = hasPermission("finance.manage")

  const [account, setAccount] = React.useState<FinanceAccount | null>(null)
  const [movements, setMovements] = React.useState<FinanceMovement[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [statementText, setStatementText] = React.useState("")
  const [statementDate, setStatementDate] = React.useState(todayLocal())
  const [statementBalance, setStatementBalance] = React.useState("")

  const [parsedLines, setParsedLines] = React.useState<StmtLine[]>([])
  const [matchByStmt, setMatchByStmt] = React.useState<Record<string, string>>({})
  const [reconciledMovs, setReconciledMovs] = React.useState<Set<string>>(new Set())
  const [addState, setAddState] = React.useState<
    Record<string, { add: boolean; categoryId: string }>
  >({})
  const [analyzed, setAnalyzed] = React.useState(false)

  const [saving, setSaving] = React.useState(false)
  const [result, setResult] = React.useState<ReconciliationResult | null>(null)

  const commissionCatId = React.useMemo(
    () => categories.find((c) => /comisi/i.test(c.name))?._id ?? "",
    [categories],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accs, movs, cats] = await Promise.all([
        listAccounts(),
        listAccountMovements(accountId),
        listCategories(),
      ])
      setAccount(accs.find((a) => a._id === accountId) ?? null)
      setMovements(movs)
      setCategories(cats)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [accountId])

  React.useEffect(() => {
    if (canManage) void load()
  }, [canManage, load])

  function handleAnalyze() {
    const lines = parseStatement(statementText)
    const { byStmt, matchedMovIds } = autoMatch(lines, movements)
    const rec = new Set<string>(matchedMovIds)
    for (const m of movements) if (m.reconciled) rec.add(m._id)
    const addInit: Record<string, { add: boolean; categoryId: string }> = {}
    for (const l of lines) {
      if (byStmt[l.id]) continue
      const isComm = l.amount < 0 && COMMISSION_RE.test(l.description)
      addInit[l.id] = { add: isComm, categoryId: isComm ? commissionCatId : "" }
    }
    setParsedLines(lines)
    setMatchByStmt(byStmt)
    setReconciledMovs(rec)
    setAddState(addInit)
    setResult(null)
    setAnalyzed(true)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setStatementText(await f.text())
  }

  const matchByMov = React.useMemo(() => {
    const rev: Record<string, string> = {}
    for (const [s, m] of Object.entries(matchByStmt)) rev[m] = s
    return rev
  }, [matchByStmt])

  const stmtById = React.useMemo(() => {
    const map: Record<string, StmtLine> = {}
    for (const l of parsedLines) map[l.id] = l
    return map
  }, [parsedLines])

  // Grupos
  const matched = movements.filter((m) => matchByMov[m._id])
  const unmatchedLines = parsedLines.filter((l) => !matchByStmt[l.id])
  const outstanding = movements.filter(
    (m) => !matchByMov[m._id] && !m.reconciled,
  )
  const priorReconciledUnmatched = movements.filter(
    (m) => !matchByMov[m._id] && m.reconciled,
  ).length

  // Cuadre en vivo
  const newLinesToAdd = parsedLines.filter((l) => addState[l.id]?.add)
  const reconciledExistingSum = movements
    .filter((m) => reconciledMovs.has(m._id))
    .reduce((s, m) => s + signed(m), 0)
  const newSum = newLinesToAdd.reduce((s, l) => s + l.amount, 0)
  const opening = account?.openingBalance ?? 0
  const liveReconciled = opening + reconciledExistingSum + newSum
  const currentBalance =
    account?.balance ??
    opening + movements.reduce((s, m) => s + signed(m), 0)
  const stmtBal = numOr(statementBalance)
  const difference = stmtBal - liveReconciled
  const cuadra = Math.abs(difference) < 1

  function toggleRec(id: string) {
    setReconciledMovs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleFinalize() {
    if (!account) return
    setSaving(true)
    setError(null)
    const newMovements: ReconcilePayload["newMovements"] = newLinesToAdd.map(
      (l) => ({
        date: l.date,
        direction: l.amount >= 0 ? "in" : "out",
        amount: Math.abs(l.amount),
        concept: l.description,
        categoryId: addState[l.id]?.categoryId || undefined,
        reconciled: true,
      }),
    )
    const payload: ReconcilePayload = {
      statementDate,
      statementBalance: stmtBal,
      reconciledMovementIds: [...reconciledMovs],
      newMovements,
    }
    try {
      const res = await reconcileAccount(account._id, payload)
      setResult(res)
      await load()
      setAnalyzed(false)
      setParsedLines([])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <>
        <PageHeader section="Finanzas" title="Conciliación bancaria" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Necesitas el permiso de configurar finanzas para conciliar.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <div className="mb-2">
        <Button variant="ghost" size="sm" className="gap-1" render={<Link href="/panel/finanzas/bancos" />}>
          <ChevronLeft className="size-4" />
          Caja y bancos
        </Button>
      </div>
      <PageHeader
        section="Finanzas"
        title="Conciliación bancaria"
        description={
          account
            ? `${account.name} · saldo en la app ${money.format(currentBalance)}`
            : "Cuadra el extracto del banco con los movimientos de la app."
        }
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error && !account ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : !account ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Landmark className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cuenta no encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {result && (
            <Card className="border-emerald-200 bg-emerald-50/60">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <CheckCircle2 className="size-8 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-display text-lg">Conciliación guardada</p>
                  <p className="text-sm text-muted-foreground">
                    Saldo conciliado {money.format(result.reconciledBalance)} ·
                    extracto {money.format(result.statementBalance)} ·{" "}
                    {Math.abs(result.difference) < 1 ? (
                      <span className="font-medium text-emerald-700">cuadra ✓</span>
                    ) : (
                      <span className="font-medium text-destructive">
                        diferencia {money.format(result.difference)}
                      </span>
                    )}
                    {result.outstandingCount > 0 &&
                      ` · ${result.outstandingCount} movimiento(s) pendiente(s)`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Importar extracto */}
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center gap-2">
                <Scale className="size-4 text-muted-foreground" />
                <p className="font-medium">Extracto del banco</p>
                {account.lastReconciledDate && (
                  <Badge variant="secondary" className="ml-auto text-emerald-700">
                    Última: {fmtDate(account.lastReconciledDate)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pega las filas del extracto (una por línea) con columnas{" "}
                <b>fecha, descripción, monto</b> (monto negativo = salida). Acepta
                separador coma, punto y coma o tabulación.
              </p>
              <textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                rows={5}
                placeholder={"2026-07-25, Consignación datáfono, 480000\n2026-07-25, Comisión datáfono, -15000\n2026-07-26, Pago proveedor, -200000"}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Fecha del extracto</Label>
                  <Input
                    type="date"
                    className="h-8 w-40"
                    value={statementDate}
                    onChange={(e) => setStatementDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Saldo final del extracto</Label>
                  <Input
                    type="number"
                    className="h-8 w-44"
                    value={statementBalance}
                    onChange={(e) => setStatementBalance(e.target.value)}
                    placeholder="$"
                  />
                </div>
                <label className="flex h-8 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} className="hidden" />
                  <span className="rounded-lg border border-input px-2.5 py-1.5 hover:bg-muted">
                    Cargar archivo…
                  </span>
                </label>
                <Button className="gap-1.5" onClick={handleAnalyze} disabled={!statementText.trim()}>
                  <Scale className="size-4" />
                  Analizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {analyzed && (
            <>
              {/* Panel de cuadre */}
              <Card className={cuadra ? "border-emerald-200" : "border-amber-200"}>
                <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
                  <Metric label="Saldo conciliado" value={money.format(liveReconciled)} />
                  <Metric label="Saldo del extracto" value={money.format(stmtBal)} />
                  <Metric
                    label="Diferencia"
                    value={money.format(difference)}
                    danger={!cuadra}
                    good={cuadra}
                  />
                  <div className="flex items-center">
                    {cuadra ? (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                        <CheckCircle2 className="size-5" /> Cuadra
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
                        <FileWarning className="size-5" /> Hay diferencia
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {parsedLines.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No se reconoció ninguna fila. Revisa el formato (fecha,
                    descripción, monto).
                  </CardContent>
                </Card>
              )}

              {/* Emparejados */}
              {matched.length > 0 && (
                <Section
                  icon={Link2}
                  title={`Emparejados (${matched.length})`}
                  subtitle="Movimientos del extracto que coinciden con la app. Desmarca para excluir."
                >
                  {matched.map((m) => {
                    const stmt = stmtById[matchByMov[m._id]]
                    return (
                      <label
                        key={m._id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={reconciledMovs.has(m._id)}
                          onChange={() => toggleRec(m._id)}
                          className="size-4"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.concept}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {fmtDate(m.date)}
                            {stmt ? ` · extracto: ${stmt.description}` : ""}
                          </p>
                        </div>
                        <AmountTag value={signed(m)} />
                      </label>
                    )
                  })}
                </Section>
              )}

              {/* En el extracto, sin registrar */}
              {unmatchedLines.length > 0 && (
                <Section
                  icon={ArrowDownLeft}
                  title={`En el extracto, sin registrar (${unmatchedLines.length})`}
                  subtitle="Movimientos del banco que no están en la app (p.ej. comisión de datáfono, 4x1000). Agrégalos."
                >
                  {unmatchedLines.map((l) => {
                    const st = addState[l.id] ?? { add: false, categoryId: "" }
                    return (
                      <div
                        key={l.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={st.add}
                            onChange={(e) =>
                              setAddState((p) => ({
                                ...p,
                                [l.id]: { ...st, add: e.target.checked },
                              }))
                            }
                            className="size-4"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {l.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(l.date)} · se creará como{" "}
                              {l.amount >= 0 ? "ingreso" : "egreso"}
                            </p>
                          </div>
                        </label>
                        <select
                          className={`${inputClass} w-44`}
                          value={st.categoryId}
                          onChange={(e) =>
                            setAddState((p) => ({
                              ...p,
                              [l.id]: { ...st, categoryId: e.target.value },
                            }))
                          }
                          disabled={!st.add}
                        >
                          <option value="">Sin categoría</option>
                          {categories
                            .filter((c) => c.active)
                            .map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                        <AmountTag value={l.amount} />
                      </div>
                    )
                  })}
                </Section>
              )}

              {/* En la app, sin extracto */}
              {outstanding.length > 0 && (
                <Section
                  icon={ArrowUpRight}
                  title={`En la app, sin extracto (${outstanding.length})`}
                  subtitle="Registrados en la app pero no en este extracto (pendientes). Márcalos solo si ya deberían estar conciliados."
                >
                  {outstanding.map((m) => (
                    <label
                      key={m._id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={reconciledMovs.has(m._id)}
                        onChange={() => toggleRec(m._id)}
                        className="size-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.concept}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(m.date)}</p>
                      </div>
                      <AmountTag value={signed(m)} />
                    </label>
                  ))}
                </Section>
              )}

              {priorReconciledUnmatched > 0 && (
                <p className="text-xs text-muted-foreground">
                  {priorReconciledUnmatched} movimiento(s) ya conciliado(s) en
                  extractos anteriores se mantienen.
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-3">
                {!cuadra && (
                  <span className="text-xs text-amber-600">
                    Puedes finalizar igual; la diferencia quedará registrada.
                  </span>
                )}
                <Button
                  className="gap-2"
                  disabled={saving || !statementBalance}
                  onClick={() => void handleFinalize()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Finalizar conciliación
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <p className="font-medium">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        <div className="mt-1 flex flex-col gap-1.5">{children}</div>
      </CardContent>
    </Card>
  )
}

function AmountTag({ value }: { value: number }) {
  const isIn = value >= 0
  return (
    <span
      className={`shrink-0 tabular-nums text-sm font-medium ${
        isIn ? "text-emerald-600" : "text-destructive"
      }`}
    >
      {isIn ? "+" : "−"}
      {money.format(Math.abs(value))}
    </span>
  )
}

function Metric({
  label,
  value,
  danger,
  good,
}: {
  label: string
  value: string
  danger?: boolean
  good?: boolean
}) {
  const tone = danger ? "text-destructive" : good ? "text-emerald-600" : "text-foreground"
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-display text-lg leading-tight ${tone}`}>{value}</span>
    </div>
  )
}
