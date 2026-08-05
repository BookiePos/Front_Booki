"use client"

import * as React from "react"
import {
  Calculator,
  ShieldOff,
  MapPin,
  Lock,
  Unlock,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldMinus,
  Banknote,
  Coins,
  Receipt as ReceiptIcon,
  Wallet,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  getCurrentCaja,
  openCaja,
  closeCaja,
  addCajaMovement,
  listCajaSessions,
  CAJA_MOVEMENT_LABELS,
  type CurrentCaja,
  type CajaSession,
  type CajaMovementType,
} from "@/lib/pos/api-caja"
import { money, dateTime, timeOnly } from "@/lib/pos/format"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { MoneyInput } from "@/components/ui/money-input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

const MOVEMENT_ICONS: Record<CajaMovementType, React.ElementType> = {
  in: ArrowDownCircle,
  out: ArrowUpCircle,
  sangria: ShieldMinus,
}

export default function CajaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission("pos.sell")
  const canOpen = hasPermission("caja.open")
  const canClose = hasPermission("caja.close")
  const canMove = hasPermission("caja.movement")
  const canSangria = hasPermission("caja.sangria")
  const { sedeId, sede } = useSede()

  const [data, setData] = React.useState<CurrentCaja | null>(null)
  const [history, setHistory] = React.useState<CajaSession[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const [current, sessions] = await Promise.all([
        getCurrentCaja(sedeId),
        listCajaSessions(sedeId, 1, 10),
      ])
      setData(current)
      setHistory(sessions.rows)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (!canView) {
    return (
      <Guard
        icon={ShieldOff}
        title="Sin acceso"
        text="No tienes permiso para ver la caja. Contacta al administrador."
      />
    )
  }
  if (!sedeId) {
    return (
      <Guard
        icon={MapPin}
        title="Sin sede"
        text="Selecciona una sede para operar su caja."
      />
    )
  }

  const session = data?.session ?? null
  const totals = data?.totals ?? null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Caja</h1>
        <p className="text-sm text-muted-foreground">
          Turno y arqueo de efectivo{sede ? ` en ${sede.name}` : ""}.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : session ? (
        <OpenCaja
          session={session}
          totals={totals}
          data={data!}
          canClose={canClose}
          canMove={canMove}
          canSangria={canSangria}
          onChanged={load}
        />
      ) : (
        <ClosedCaja canOpen={canOpen} sedeId={sedeId} onOpened={load} />
      )}

      {/* Historial de turnos */}
      {!loading && history.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-lg">Turnos anteriores</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {history
                  .filter((s) => s.status === "closed")
                  .map((s) => (
                    <li
                      key={s._id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Calculator className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.closedAt ? dateTime(s.closedAt) : "—"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.closedByEmail ?? s.openedByEmail} ·{" "}
                          {s.salesCount ?? 0} venta(s)
                        </p>
                        {(s.countedBills != null ||
                          s.countedCoins != null) && (
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Banknote className="size-3" />
                              {money(s.countedBills ?? 0)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Coins className="size-3" />
                              {money(s.countedCoins ?? 0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <DifferenceBadge value={s.difference} />
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Caja cerrada: formulario de apertura ────────────────────────────────────

function ClosedCaja({
  canOpen,
  sedeId,
  onOpened,
}: {
  canOpen: boolean
  sedeId: string
  onOpened: () => void
}) {
  const [bills, setBills] = React.useState<number | null>(null)
  const [coins, setCoins] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const base = (bills ?? 0) + (coins ?? 0)
  const canSubmit = bills !== null || coins !== null

  async function handleOpen() {
    setSaving(true)
    setError(null)
    try {
      await openCaja(sedeId, base, note || undefined, {
        bills: bills ?? undefined,
        coins: coins ?? undefined,
      })
      onOpened()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-xl">Caja cerrada</p>
          <p className="text-sm text-muted-foreground">
            {canOpen
              ? "Cuenta el efectivo base y ábrela para empezar el turno."
              : "No hay un turno abierto. Pide a un responsable que abra la caja."}
          </p>
        </div>

        {canOpen && (
          <div className="flex w-full max-w-xs flex-col gap-3 text-left">
            <p className="text-sm font-medium text-foreground">
              Base inicial en efectivo
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caja-base-billetes" className="gap-1.5">
                <Banknote className="size-4 text-muted-foreground" />
                Billetes
              </Label>
              <MoneyInput
                id="caja-base-billetes"
                value={bills}
                onValueChange={setBills}
                placeholder="$0"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caja-base-monedas" className="gap-1.5">
                <Coins className="size-4 text-muted-foreground" />
                Monedas
              </Label>
              <MoneyInput
                id="caja-base-monedas"
                value={coins}
                onValueChange={setCoins}
                placeholder="$0"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">Total base</span>
              <span className="stat-figure text-base">{money(base)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caja-note">Nota (opcional)</Label>
              <Input
                id="caja-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Turno mañana…"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              data-tour="pos-caja-abrir"
              size="lg"
              className="gap-2"
              disabled={saving || !canSubmit}
              onClick={() => void handleOpen()}
            >
              <Unlock className="size-4" />
              {saving ? "Abriendo…" : "Abrir caja"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Caja abierta: arqueo, movimientos y cierre ──────────────────────────────

function OpenCaja({
  session,
  totals,
  data,
  canClose,
  canMove,
  canSangria,
  onChanged,
}: {
  session: CajaSession
  totals: CurrentCaja["totals"]
  data: CurrentCaja
  canClose: boolean
  canMove: boolean
  canSangria: boolean
  onChanged: () => void
}) {
  const [closeOpen, setCloseOpen] = React.useState(false)
  const expected = totals?.expectedCash ?? session.openingAmount

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado del turno */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-success/10 text-success">
            <Unlock className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg">Caja abierta</p>
            <p className="text-xs text-muted-foreground">
              Abierta {dateTime(session.openedAt)} · {session.openedByEmail}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Base</p>
            <p className="stat-figure text-lg">
              {money(session.openingAmount)}
            </p>
            {(session.openingBills != null ||
              session.openingCoins != null) && (
              <p className="text-xs text-muted-foreground">
                {money(session.openingBills ?? 0)} en billetes ·{" "}
                {money(session.openingCoins ?? 0)} en monedas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Arqueo en vivo */}
      <div data-tour="pos-caja-arqueo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={ReceiptIcon}
          label="Ventas del turno"
          value={String(totals?.salesCount ?? 0)}
        />
        <Stat
          icon={Banknote}
          label="Ventas en efectivo"
          value={money(totals?.cashSalesTotal ?? 0)}
        />
        <Stat
          icon={ArrowUpCircle}
          label="Salidas / sangrías"
          value={money(totals?.movementsOut ?? 0)}
        />
        <Stat
          icon={Wallet}
          label="Esperado en caja"
          value={money(expected)}
          highlight
        />
      </div>

      {/* Movimientos */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg">Movimientos</p>
            {canClose && (
              <Button
                data-tour="pos-caja-cerrar"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setCloseOpen(true)}
              >
                <Lock className="size-4" />
                Cerrar caja
              </Button>
            )}
          </div>

          {canMove && (
            <MovementForm
              sedeId={session.sedeId}
              canSangria={canSangria}
              onAdded={onChanged}
            />
          )}

          {data.movements.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Sin movimientos manuales en este turno.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.movements.map((m) => {
                const Icon = MOVEMENT_ICONS[m.type]
                const isIn = m.type === "in"
                return (
                  <li key={m._id} className="flex items-center gap-3 py-2.5">
                    <Icon
                      className={cn(
                        "size-5 shrink-0",
                        isIn ? "text-success" : "text-destructive",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {CAJA_MOVEMENT_LABELS[m.type]}
                        {m.reason ? ` · ${m.reason}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeOnly(m.createdAt)} · {m.userEmail}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "stat-figure text-base",
                        isIn ? "text-success" : "text-destructive",
                      )}
                    >
                      {isIn ? "+" : "−"}
                      {money(m.amount)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <CloseCajaSheet
        open={closeOpen}
        onOpenChange={setCloseOpen}
        sedeId={session.sedeId}
        expected={expected}
        onClosed={() => {
          setCloseOpen(false)
          onChanged()
        }}
      />
    </div>
  )
}

function MovementForm({
  sedeId,
  canSangria,
  onAdded,
}: {
  sedeId: string
  canSangria: boolean
  onAdded: () => void
}) {
  const [type, setType] = React.useState<CajaMovementType>("out")
  const [amount, setAmount] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const types: CajaMovementType[] = canSangria
    ? ["in", "out", "sangria"]
    : ["in", "out"]

  async function handleAdd() {
    if (!(amount != null && amount > 0)) return
    setSaving(true)
    setError(null)
    try {
      await addCajaMovement({
        sedeId,
        type,
        amount,
        reason: reason || undefined,
      })
      setAmount(null)
      setReason("")
      onAdded()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-tour="pos-caja-mov"
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3"
    >
      <div
        className={cn(
          "grid gap-1 rounded-lg border border-border bg-muted p-1",
          canSangria ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              type === t
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {CAJA_MOVEMENT_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <MoneyInput
          value={amount}
          onValueChange={setAmount}
          placeholder="Monto"
          className="w-32"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          className="flex-1"
        />
        <Button
          className="gap-1.5"
          disabled={saving || !(amount != null && amount > 0)}
          onClick={() => void handleAdd()}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function CloseCajaSheet({
  open,
  onOpenChange,
  sedeId,
  expected,
  onClosed,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sedeId: string
  expected: number
  onClosed: () => void
}) {
  const [bills, setBills] = React.useState<number | null>(null)
  const [coins, setCoins] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setBills(null)
      setCoins(null)
      setNote("")
      setError(null)
    }
  }, [open])

  const hasCount = bills !== null || coins !== null
  const countedNum = hasCount ? (bills ?? 0) + (coins ?? 0) : undefined
  const diff =
    countedNum === undefined
      ? undefined
      : Math.round((countedNum - expected) * 100) / 100

  async function handleClose() {
    if (countedNum === undefined) return
    setSaving(true)
    setError(null)
    try {
      await closeCaja(sedeId, countedNum, note || undefined, {
        bills: bills ?? undefined,
        coins: coins ?? undefined,
      })
      onClosed()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">Cerrar caja</SheetTitle>
          <SheetDescription>
            Cuenta el efectivo físico para cuadrar el turno.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="flex items-center justify-between rounded-xl bg-muted p-4">
            <span className="text-sm text-muted-foreground">
              Esperado en caja
            </span>
            <span className="stat-figure text-xl">{money(expected)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              Efectivo contado
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caja-counted-billetes" className="gap-1.5">
                <Banknote className="size-4 text-muted-foreground" />
                Billetes
              </Label>
              <MoneyInput
                id="caja-counted-billetes"
                value={bills}
                onValueChange={setBills}
                placeholder="$0"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caja-counted-monedas" className="gap-1.5">
                <Coins className="size-4 text-muted-foreground" />
                Monedas
              </Label>
              <MoneyInput
                id="caja-counted-monedas"
                value={coins}
                onValueChange={setCoins}
                placeholder="$0"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">
                Total contado
              </span>
              <span className="stat-figure text-base">
                {money(countedNum ?? 0)}
              </span>
            </div>
          </div>

          {diff !== undefined && (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                diff === 0
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span>
                {diff === 0
                  ? "Caja cuadrada"
                  : diff > 0
                    ? "Sobrante"
                    : "Faltante"}
              </span>
              <span className="stat-figure text-base">
                {diff > 0 ? "+" : ""}
                {money(diff)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caja-close-note">Nota (opcional)</Label>
            <Input
              id="caja-close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observaciones del cierre…"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={saving || countedNum === undefined}
              onClick={() => void handleClose()}
            >
              {saving ? "Cerrando…" : "Cerrar turno"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            highlight
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="stat-figure truncate text-lg">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function DifferenceBadge({ value }: { value?: number }) {
  if (value === undefined) return <Badge variant="outline">—</Badge>
  if (value === 0)
    return <Badge className="border-transparent bg-success/10 text-success">Cuadró</Badge>
  return (
    <Badge variant="destructive">
      {value > 0 ? "+" : ""}
      {money(value)}
    </Badge>
  )
}

function Guard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType
  title: string
  text: string
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <p className="font-display text-lg text-foreground">{title}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}
