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
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { listSedes, type Sede } from "@/lib/erp/api-inventory"
import {
  listAccounts,
  createAccount,
  listAccountMovements,
  createAccountMovement,
  listCategories,
  getOverview,
  ACCOUNT_TYPE_LABELS,
  type FinanceAccount,
  type FinanceMovement,
  type FinanceCategory,
  type AccountType,
  type AccountPayload,
  type MovementPayload,
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
  const [cashToday, setCashToday] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [newAccOpen, setNewAccOpen] = React.useState(false)
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
      const [accs, ov] = await Promise.all([
        listAccounts(),
        getOverview().catch(() => null),
      ])
      setAccounts(accs)
      setCashToday(ov ? ov.cashToday : null)
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

  const totalBalance = accounts.reduce(
    (s, a) => s + (a.balance ?? a.openingBalance),
    0,
  )
  const sedeName = (id?: string) =>
    id ? (sedes.find((s) => s._id === id)?.name ?? "—") : "Consolidada"

  function openAccount(a: FinanceAccount) {
    setSelected(a)
  }

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => void load()} title="Actualizar">
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
      {canManage && (
        <Button
          data-tour="bancos-nueva"
          className="gap-1.5"
          onClick={() => setNewAccOpen(true)}
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
        description="Cuentas de efectivo, bancos y billeteras con su saldo y movimientos."
        actions={actions}
      />

      <div
        data-tour="bancos-saldo"
        className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <Kpi
          icon={CircleDollarSign}
          label="Saldo total"
          value={money.format(totalBalance)}
        />
        {cashToday !== null && (
          <Kpi
            icon={Banknote}
            label="Efectivo de hoy"
            value={money.format(cashToday)}
          />
        )}
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
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Landmark className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No hay cuentas registradas.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
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
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {money.format(a.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money.format(a.balance ?? a.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManage && a.type === "bank" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              render={<Link href={`/finanzas/bancos/${a._id}/conciliar`} />}
                            >
                              <Scale className="size-3.5" />
                              Conciliar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAccount(a)}
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
        <NewAccountSheet
          open={newAccOpen}
          onOpenChange={setNewAccOpen}
          sedes={sedes}
          onSaved={() => {
            setNewAccOpen(false)
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

function NewAccountSheet({
  open,
  onOpenChange,
  sedes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedes: Sede[]
  onSaved: () => void
}) {
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<AccountType>("bank")
  const [sedeId, setSedeId] = React.useState("")
  const [openingBalance, setOpeningBalance] = React.useState("")
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setName("")
    setType("bank")
    setSedeId("")
    setOpeningBalance("")
    setNote("")
  }, [open])

  async function save() {
    setBusy(true)
    setError(null)
    const payload: AccountPayload = {
      name,
      type,
      sedeId: sedeId || undefined,
      openingBalance: numOr(openingBalance),
      note: note || undefined,
    }
    try {
      await createAccount(payload)
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
            <SheetTitle className="font-display text-lg">Nueva cuenta</SheetTitle>
            <SheetDescription>Efectivo, banco o billetera digital.</SheetDescription>
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

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Saldo inicial</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
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
              Crear cuenta
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
                  Nuevo movimiento
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
            <SheetTitle className="font-display text-lg">Nuevo movimiento</SheetTitle>
            <SheetDescription>Ingreso o egreso de la cuenta.</SheetDescription>
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
              placeholder="Ej. Retiro de caja"
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
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p className="font-display text-2xl leading-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
