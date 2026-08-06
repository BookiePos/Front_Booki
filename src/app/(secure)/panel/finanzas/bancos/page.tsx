"use client"

import * as React from "react"
import Link from "next/link"
import {
  ShieldOff,
  Landmark,
  Plus,
  Loader2,
  RefreshCw,
  Banknote,
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Scale,
  Pencil,
  Sparkles,
  Store,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listAccounts,
  createAccount,
  updateAccount,
  listAccountMovements,
  createAccountMovement,
  listCategories,
  getTreasury,
  ACCOUNT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceAccount,
  type FinanceMovement,
  type FinanceCategory,
  type TreasurySummary,
  type AccountType,
  type AccountPayload,
  type MovementPayload,
  type PaymentMethod,
} from "@/lib/erp/api-finance"
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

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/** Medios que pueden auto-alimentar una cuenta (el efectivo vive en la caja del POS). */
const AUTO_METHODS: PaymentMethod[] = ["card", "transfer"]

const TYPE_ICON: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  bank: Landmark,
  cash: Banknote,
  wallet: Wallet,
}

export default function BancosPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("finance.manage")
  const canTx = hasPermission("purchasing.manage")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])
  const [accounts, setAccounts] = React.useState<FinanceAccount[]>([])
  const [treasury, setTreasury] = React.useState<TreasurySummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [accSheet, setAccSheet] = React.useState<{
    open: boolean
    editing: FinanceAccount | null
  }>({ open: false, editing: null })
  const [selected, setSelected] = React.useState<FinanceAccount | null>(null)
  const [movOpen, setMovOpen] = React.useState(false)

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
      const [accs, tr] = await Promise.all([
        listAccounts(),
        getTreasury().catch(() => null),
      ])
      setAccounts(accs)
      setTreasury(tr)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <>
        <PageHeader section="Finanzas" title="Caja y bancos" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver las cuentas.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const accountsBalance =
    treasury?.accountsBalance ??
    accounts.reduce((s, a) => s + (a.balance ?? a.openingBalance), 0)
  const cajaCash = treasury?.cajaCash ?? 0
  const total = treasury?.total ?? accountsBalance + cajaCash

  const sedeName = (id?: string) =>
    id ? (sedes.find((s) => s._id === id)?.name ?? "—") : "Consolidada"

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      {canManage && (
        <Button
          data-tour="bancos-nueva"
          className="gap-1.5"
          onClick={() => setAccSheet({ open: true, editing: null })}
        >
          <Plus className="size-4" />
          Nueva cuenta
        </Button>
      )}
    </div>
  )

  return (
    <>
      <PageHeader
        section="Finanzas"
        title="Caja y bancos"
        description="Tu tesorería en tiempo real: el efectivo lo lleva la caja del POS y los bancos/billeteras se alimentan solos de las ventas, pagos y cobros."
        actions={actions}
      />

      <div
        data-tour="bancos-saldo"
        className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3"
      >
        <Kpi
          icon={CircleDollarSign}
          label="Tesorería total"
          value={money.format(total)}
          hint="Efectivo + bancos/billeteras"
          strong
        />
        <Kpi
          icon={Banknote}
          label="Efectivo en caja (POS)"
          value={money.format(cajaCash)}
          hint="Turnos abiertos ahora"
        />
        <Kpi
          icon={Landmark}
          label="Bancos y billeteras"
          value={money.format(accountsBalance)}
          hint={`${accounts.length} cuenta(s)`}
        />
      </div>

      {/* ── Efectivo en caja (POS) ── */}
      <div className="mb-2 flex items-center gap-2">
        <Store className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Efectivo en caja (POS)</h2>
      </div>
      <Card className="mb-6">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ) : !treasury || treasury.cajaRows.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <Banknote className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay turnos de caja abiertos ahora.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                El efectivo se cuadra por turno en el POS. Cuando un cajero abre
                su turno, el efectivo esperado aparece aquí en vivo.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sede</TableHead>
                  <TableHead>Turno abierto</TableHead>
                  <TableHead className="text-right">Ventas del turno</TableHead>
                  <TableHead className="text-right">Efectivo esperado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treasury.cajaRows.map((r) => (
                  <TableRow key={r.sedeId}>
                    <TableCell className="font-medium">{r.sedeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      desde {fmtDate(r.openedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {money.format(r.salesTotal)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money.format(r.expectedCash)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Bancos y billeteras ── */}
      <div className="mb-2 flex items-center gap-2">
        <Landmark className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Bancos y billeteras</h2>
      </div>
      <Card data-tour="bancos-cuentas">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-14 text-center">
              <Landmark className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay cuentas de banco/billetera.
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Crea una cuenta y marca qué medios de pago la alimentan
                (tarjeta/transferencia) para que las ventas entren solas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Auto-alimenta</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => {
                  const Icon = TYPE_ICON[a.type]
                  return (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          <Icon className="size-4 text-muted-foreground" />
                          {a.name}
                        </span>
                        {a.lastReconciledDate ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-emerald-600">
                            <Scale className="size-3" />
                            Conciliada al {fmtDate(a.lastReconciledDate)}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                            Sin conciliar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[a.type]}</Badge>
                      </TableCell>
                      <TableCell>{sedeName(a.sedeId)}</TableCell>
                      <TableCell>
                        {a.autoMethods.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-1">
                            <Sparkles className="size-3 text-primary" />
                            {a.autoMethods.map((m) => (
                              <Badge key={m} variant="outline" className="text-[11px]">
                                {PAYMENT_METHOD_LABELS[m]}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money.format(a.balance ?? a.openingBalance)}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          inicial {money.format(a.openingBalance)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setAccSheet({ open: true, editing: a })}
                              title="Editar cuenta"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {canManage && a.type === "bank" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              render={<Link href={`/panel/finanzas/bancos/${a._id}/conciliar`} />}
                            >
                              <Scale className="size-3.5" />
                              Conciliar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelected(a)}
                          >
                            Movimientos
                          </Button>
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
        <AccountSheet
          open={accSheet.open}
          editing={accSheet.editing}
          onOpenChange={(v) => setAccSheet((s) => ({ ...s, open: v }))}
          sedes={sedes}
          onSaved={() => {
            setAccSheet({ open: false, editing: null })
            void load()
          }}
        />
      )}

      <AccountMovementsSheet
        account={selected}
        onOpenChange={(v) => !v && setSelected(null)}
        canTx={canTx}
        categories={categories}
        onNewMovement={() => setMovOpen(true)}
        onChanged={() => void load()}
        movOpen={movOpen}
        setMovOpen={setMovOpen}
      />
    </>
  )
}

function AccountSheet({
  open,
  editing,
  onOpenChange,
  sedes,
  onSaved,
}: {
  open: boolean
  editing: FinanceAccount | null
  onOpenChange: (v: boolean) => void
  sedes: Sede[]
  onSaved: () => void
}) {
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<AccountType>("bank")
  const [sedeId, setSedeId] = React.useState("")
  const [openingBalance, setOpeningBalance] = React.useState("")
  const [autoMethods, setAutoMethods] = React.useState<PaymentMethod[]>([])
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setSedeId(editing.sedeId ?? "")
      setOpeningBalance(String(editing.openingBalance))
      setAutoMethods(editing.autoMethods ?? [])
      setNote(editing.note ?? "")
    } else {
      setName("")
      setType("bank")
      setSedeId("")
      setOpeningBalance("")
      setAutoMethods([])
      setNote("")
    }
  }, [open, editing])

  function toggleMethod(m: PaymentMethod) {
    setAutoMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        await updateAccount(editing._id, {
          name,
          autoMethods,
          note: note || undefined,
        })
      } else {
        const payload: AccountPayload = {
          name,
          type,
          sedeId: sedeId || undefined,
          openingBalance: numOr(openingBalance),
          autoMethods,
          note: note || undefined,
        }
        await createAccount(payload)
      }
      onSaved()
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
            <SheetTitle className="font-display text-lg">
              {editing ? "Editar cuenta" : "Nueva cuenta"}
            </SheetTitle>
            <SheetDescription>
              Banco, efectivo o billetera digital. Marca qué medios la alimentan
              automáticamente.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Bancolombia principal"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tipo</Label>
              <select
                className={inputClass}
                value={type}
                disabled={!!editing}
                onChange={(e) => setType(e.target.value as AccountType)}
              >
                {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((k) => (
                  <option key={k} value={k}>
                    {ACCOUNT_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Sede</Label>
              <select
                className={inputClass}
                value={sedeId}
                disabled={!!editing}
                onChange={(e) => setSedeId(e.target.value)}
              >
                <option value="">Consolidada</option>
                {sedes.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!editing && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Saldo inicial</Label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Auto-alimenta con</Label>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              {AUTO_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoMethods.includes(m)}
                    onChange={() => toggleMethod(m)}
                  />
                  {PAYMENT_METHOD_LABELS[m]}
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Las ventas del POS, pagos y cobros por estos medios entran o salen
                de esta cuenta automáticamente. El efectivo se lleva en la caja del
                POS, no aquí.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Nota (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar" : "Crear cuenta"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AccountMovementsSheet({
  account,
  onOpenChange,
  canTx,
  categories,
  onNewMovement,
  onChanged,
  movOpen,
  setMovOpen,
}: {
  account: FinanceAccount | null
  onOpenChange: (v: boolean) => void
  canTx: boolean
  categories: FinanceCategory[]
  onNewMovement: () => void
  onChanged: () => void
  movOpen: boolean
  setMovOpen: (v: boolean) => void
}) {
  const [movements, setMovements] = React.useState<FinanceMovement[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    try {
      setMovements(await listAccountMovements(account._id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [account])

  React.useEffect(() => {
    if (account) void reload()
    else setMovements([])
  }, [account, reload])

  return (
    <Sheet open={account !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {account && (
          <div className="flex flex-col gap-4 px-4 py-2">
            <SheetHeader className="px-0">
              <SheetTitle className="font-display text-lg">{account.name}</SheetTitle>
              <SheetDescription>
                Saldo actual{" "}
                {money.format(account.balance ?? account.openingBalance)} ·{" "}
                {ACCOUNT_TYPE_LABELS[account.type]}
              </SheetDescription>
            </SheetHeader>

            {canTx && (
              <div>
                <Button size="sm" className="gap-1.5" onClick={onNewMovement}>
                  <Plus className="size-4" />
                  Movimiento manual
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <p className="py-6 text-center text-sm text-destructive">{error}</p>
            ) : movements.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <CreditCard className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sin movimientos registrados.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell className="tabular-nums">{fmtDate(m.date)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {m.direction === "in" ? (
                            <ArrowDownLeft className="size-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="size-4 text-destructive" />
                          )}
                          {m.concept}
                          {m.auto && (
                            <Badge variant="outline" className="gap-0.5 text-[10px]">
                              <Sparkles className="size-2.5" />
                              Auto
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          m.direction === "in" ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {m.direction === "in" ? "+" : "−"}
                        {money.format(m.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </SheetContent>

      {account && canTx && (
        <NewMovementSheet
          accountId={account._id}
          open={movOpen}
          onOpenChange={setMovOpen}
          categories={categories}
          onSaved={() => {
            setMovOpen(false)
            void reload()
            onChanged()
          }}
        />
      )}
    </Sheet>
  )
}

function NewMovementSheet({
  accountId,
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  accountId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: FinanceCategory[]
  onSaved: () => void
}) {
  const [date, setDate] = React.useState(todayLocal())
  const [direction, setDirection] = React.useState<"in" | "out">("out")
  const [amount, setAmount] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setDate(todayLocal())
    setDirection("out")
    setAmount("")
    setCategoryId("")
    setConcept("")
  }, [open])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: MovementPayload = {
      date,
      direction,
      amount: numOr(amount),
      categoryId: categoryId || undefined,
      concept,
    }
    try {
      await createAccountMovement(accountId, payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const valid = concept.trim() && numOr(amount) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <div className="flex flex-col gap-4 px-4 py-2">
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-lg">Movimiento manual</SheetTitle>
            <SheetDescription>
              Ingreso o egreso que no viene de una operación (ej. consignación,
              retiro, ajuste).
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Tipo</Label>
              <select
                className={inputClass}
                value={direction}
                onChange={(e) => setDirection(e.target.value as "in" | "out")}
              >
                <option value="in">Ingreso</option>
                <option value="out">Egreso</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Monto</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Categoría (opcional)</Label>
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Consignación de efectivo"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={busy || !valid} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  strong,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  strong?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p
          className={`font-display leading-tight ${
            strong ? "text-2xl text-primary" : "text-2xl text-foreground"
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
