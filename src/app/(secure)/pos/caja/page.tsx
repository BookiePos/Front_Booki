"use client"

import * as React from "react"
import {
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
import { Skeleton } from "@/components/ui/skeleton"
import { MoneyInput } from "@/components/ui/money-input"
import {
  AperturaCaja,
  ConteoPorDenominacion,
  Diferencia,
  cuando,
} from "@/components/pos/caja-cerrada"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import { Field, FieldGrid } from "@/components/ui/field"
import { HelpTip, Termino } from "@/components/ui/help-tip"
import { cn, contar, quien } from "@/lib/utils"
import { KpiCelda } from "@/components/ui/kpi"
import { Segmented } from "@/components/ui/segmented"
import { useLoadEffect } from "@/hooks/use-load-effect"
import { useResetOnChange } from "@/hooks/use-reset-on-change"

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

  useLoadEffect(load, canView)

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
    <div className="flex flex-col gap-5">
      {/* Con la caja cerrada la apertura trae su propia cabecera. */}
      {(loading || error || session) && (
        <div>
          <h1 className="text-[1.375rem] font-semibold leading-tight">Caja</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turno y arqueo de efectivo{sede ? ` en ${sede.name}` : ""}.
          </p>
        </div>
      )}

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
        <AperturaCaja
          key={sedeId}
          sede={sede}
          sedeId={sedeId}
          accion="Abrir caja"
          conNota
          puedeAbrir={canOpen}
          onAbrir={async ({ bills, coins, note }) => {
            try {
              await openCaja(sedeId, bills + coins, note, { bills, coins })
            } catch (err) {
              throw new Error(errorMessage(err))
            }
            await load()
          }}
        />
      )}

      {/* Historial de turnos: una tabla, como el libro de caja en papel. */}
      {!loading && history.some((s) => s.status === "closed") && (
        <section className={cn("flex flex-col gap-2", !session && "max-w-[1320px]")}>
          <h2 className="text-[15px] font-semibold">Turnos anteriores</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[640px] text-[13px] tabular-nums">
              <thead>
                <tr className="h-9 border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 font-medium">Cerró</th>
                  <th className="px-3 font-medium">Por</th>
                  <th className="px-3 text-right font-medium">Ventas</th>
                  <th className="px-3 text-right font-medium">Contado</th>
                  <th className="px-4 text-right font-medium">Arqueo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history
                  .filter((s) => s.status === "closed")
                  .map((s) => (
                    <tr key={s._id} className="h-11">
                      <td className="px-4 whitespace-nowrap">
                        {s.closedAt ? cuando(s.closedAt) : "—"}
                      </td>
                      <td className="max-w-56 truncate px-3 text-muted-foreground">
                        {s.closedByEmail
                          ? quien(s.closedByName, s.closedByEmail)
                          : quien(s.openedByName, s.openedByEmail)}
                      </td>
                      <td className="px-3 text-right whitespace-nowrap">
                        {s.salesCount ?? 0} · {money(s.salesTotal ?? 0)}
                      </td>
                      <td className="px-3 text-right whitespace-nowrap">
                        {s.countedAmount != null ? money(s.countedAmount) : "—"}
                      </td>
                      <td className="px-4 text-right whitespace-nowrap">
                        <Diferencia valor={s.difference} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
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
          <div className="flex size-11 items-center justify-center rounded-xl bg-success/10 text-success-ink">
            <Unlock className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Caja abierta</p>
            <p className="text-xs text-muted-foreground">
              Abierta {dateTime(session.openedAt)} · {quien(session.openedByName, session.openedByEmail)}
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
      <div data-tour="pos-caja-arqueo" className="grid grid-cols-2 gap-px lg:grid-cols-4">
        <KpiCelda
          label="Vendido en el turno"
          value={money(totals?.salesTotal ?? 0)}
          hint={contar(totals?.salesCount ?? 0, "venta")}
        />
        <KpiCelda
          label="Cobrado en efectivo"
          value={money(totals?.cashSalesTotal ?? 0)}
          hint={
            (totals?.salesTotal ?? 0) > (totals?.cashSalesTotal ?? 0)
              ? `${money((totals?.salesTotal ?? 0) - (totals?.cashSalesTotal ?? 0))} por tarjeta, transferencia o fiado`
              : "Todo lo vendido fue en efectivo"
          }
        />
        <KpiCelda
          label="Ingresos y salidas"
          value={money((totals?.movementsIn ?? 0) - (totals?.movementsOut ?? 0))}
          hint={`+${money(totals?.movementsIn ?? 0)} · −${money(totals?.movementsOut ?? 0)}`}
        />
        {/* Lo que tiene que haber en el cajón: es la cifra que el cajero
            compara al contar, por eso es la única en morado. */}
        <KpiCelda
          label="Debe haber en el cajón"
          value={<span className="text-primary">{money(expected)}</span>}
          hint="Base + efectivo + ingresos − salidas"
        />
      </div>

      {/* Movimientos */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">Movimientos</p>
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
                        isIn ? "text-success-ink" : "text-destructive",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {CAJA_MOVEMENT_LABELS[m.type]}
                        {m.reason ? ` · ${m.reason}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeOnly(m.createdAt)} · {quien(m.userName, m.userEmail)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "stat-figure text-base",
                        isIn ? "text-success-ink" : "text-destructive",
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

      <CloseCajaDialog
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

function CloseCajaDialog({
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
  const [modo, setModo] = React.useState<"conteo" | "total">("conteo")
  const [porBillete, setPorBillete] = React.useState({ bills: 0, coins: 0, contado: false })
  const [billsTotal, setBills] = React.useState<number | null>(null)
  const [coinsTotal, setCoins] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  useResetOnChange(() => {
    if (open) {
      setModo("conteo")
      setPorBillete({ bills: 0, coins: 0, contado: false })
      setBills(null)
      setCoins(null)
      setNote("")
      setError(null)
    }
  }, [open])

  const bills = modo === "conteo" ? porBillete.bills : billsTotal
  const coins = modo === "conteo" ? porBillete.coins : coinsTotal
  const hasCount = modo === "conteo" ? porBillete.contado : billsTotal !== null || coinsTotal !== null
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
    <FormDialog
      open={open}
      onOpenChange={(v) => !saving && onOpenChange(v)}
      size="xl"
      icon={Lock}
      title="Cerrar caja"
      description="Cuenta el efectivo del cajón y compáralo con lo que el sistema esperaba. La diferencia queda registrada."
      footer={
        <FormActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleClose()}
          busy={saving}
          disabled={countedNum === undefined}
          destructive
          submitLabel={saving ? "Cerrando…" : "Cerrar turno"}
          // El resultado del arqueo, siempre a la vista junto al botón: en una
          // pantalla baja el conteo ocupa todo y el cajero no veía si cuadraba.
          extra={
            diff === undefined ? (
              <>Debe haber {money(expected)}</>
            ) : (
              <span className="text-sm">
                Contado <span className="font-medium text-foreground tabular-nums">{money(countedNum ?? 0)}</span>
                {" · "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    diff === 0 ? "text-success-ink" : "text-destructive-ink",
                  )}
                >
                  {diff === 0
                    ? "cuadra"
                    : diff > 0
                      ? `sobran ${money(diff)}`
                      : `faltan ${money(-diff)}`}
                </span>
              </span>
            )
          }
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/50 px-4 py-3.5">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Esperado en caja
          <HelpTip term="arqueo" />
        </span>
        <span className="stat-figure text-xl">{money(expected)}</span>
      </div>

      <FormSection
        title="Efectivo contado"
        description="Cuenta igual que al abrir: cuántos billetes de cada uno y el sistema suma."
      >
        <Segmented
          size="sm"
          ariaLabel="Cómo contar el efectivo"
          value={modo}
          onValueChange={setModo}
          options={[
            { value: "conteo", label: "Por denominación" },
            { value: "total", label: "Solo el total" },
          ]}
        />
        {modo === "conteo" ? (
          <ConteoPorDenominacion onCambio={setPorBillete} />
        ) : (
        <FieldGrid cols={2}>
          <Field
            id="caja-counted-billetes"
            label={
              <>
                <Banknote className="size-4 text-muted-foreground" />
                Billetes
              </>
            }
          >
            <MoneyInput
              id="caja-counted-billetes"
              value={billsTotal}
              onValueChange={setBills}
              placeholder="$0"
              autoFocus
            />
          </Field>
          <Field
            id="caja-counted-monedas"
            label={
              <>
                <Coins className="size-4 text-muted-foreground" />
                Monedas
              </>
            }
          >
            <MoneyInput
              id="caja-counted-monedas"
              value={coinsTotal}
              onValueChange={setCoins}
              placeholder="$0"
            />
          </Field>
        </FieldGrid>
        )}

        <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5">
          <span className="text-sm text-muted-foreground">Total contado</span>
          <span className="stat-figure text-base">
            {money(countedNum ?? 0)}
          </span>
        </div>

        {diff !== undefined && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm",
              diff === 0
                ? "border-success/25 bg-success/10 text-success-ink"
                : "border-destructive/25 bg-destructive/10 text-destructive-ink",
            )}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              {diff === 0 ? (
                "Caja cuadrada"
              ) : (
                <>
                  <Termino term="descuadre">
                    {diff > 0 ? "Sobrante" : "Faltante"}
                  </Termino>
                </>
              )}
            </span>
            <span className="stat-figure text-base">
              {diff > 0 ? "+" : ""}
              {money(diff)}
            </span>
          </div>
        )}
      </FormSection>

      {/* Si no cuadra, el sistema pide explicarlo antes de cerrar (pasada la
          tolerancia de la sede). Se avisa aquí y no después del error. */}
      <Field id="caja-close-note" label={diff ? "¿Por qué no cuadra?" : "Nota"}>
        <Input
          id="caja-close-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            diff
              ? "Ej.: se dio mal una devuelta, faltó registrar una salida…"
              : "Observaciones del cierre (opcional)"
          }
        />
      </Field>
    </FormDialog>
  )
}

// ─── Auxiliares ──────────────────────────────────────────────────────────────

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
        <p className="text-[15px] font-semibold text-foreground">{title}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}
