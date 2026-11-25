"use client"

import * as React from "react"
import { Minus, Plus, RotateCcw } from "lucide-react"

import { cn, quien } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { money } from "@/lib/pos/format"
import { listCajaSessions, type CajaSession } from "@/lib/pos/api-caja"
import { type Sede } from "@/lib/pos/api-inventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Segmented } from "@/components/ui/segmented"

/**
 * Denominaciones en circulación en Colombia. El billete de $1.000 ya casi no
 * se ve y la moneda de $1.000 lo reemplazó, así que va con las monedas.
 */
const BILLETES = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000] as const
const MONEDAS = [1_000, 500, 200, 100, 50] as const
const TODAS = [...BILLETES, ...MONEDAS]

type Modo = "conteo" | "total"
type Conteo = Record<number, number | null>

export interface AperturaValores {
  bills: number
  coins: number
  note?: string
}

interface AperturaCajaProps {
  sede: Sede | undefined
  sedeId: string
  /** Abre la caja. Si falla debe lanzar: el mensaje se muestra aquí. */
  onAbrir: (valores: AperturaValores) => Promise<void>
  /** Texto del botón principal. */
  accion?: string
  /** Sin permiso `caja.open` se explica a quién pedirlo en vez del conteo. */
  puedeAbrir?: boolean
  /** Pide una nota del turno (la pestaña Caja la guarda; la venta no). */
  conNota?: boolean
}

/** "hoy, 3:08 p. m.", "ayer, 9:12 p. m." o "lun 17 nov, 9:12 p. m.". */
export function cuando(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const dia = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(hoy) - dia(d)) / 86_400_000)
  const hora = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d)
  if (dias === 0) return `hoy, ${hora}`
  if (dias === 1) return `ayer, ${hora}`
  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
  return `${fecha}, ${hora}`
}

function suma(conteo: Conteo, lista: readonly number[]): number {
  return lista.reduce((acc, d) => acc + d * (conteo[d] ?? 0), 0)
}

/**
 * Apertura del turno de caja.
 *
 * Es lo primero que ve el cajero cada día, así que se arma como el mostrador
 * de verdad: a la izquierda cuenta lo que tiene en la mano, billete por
 * billete; a la derecha ve el total que va a declarar, cómo cerró el turno
 * anterior y un único botón. Contar por denominación es como se hace el
 * arqueo en papel, y deja el desglose billetes/monedas que luego usa el
 * cierre. Quien ya trae la cuenta hecha cambia a "Solo el total".
 */
export function AperturaCaja({
  sede,
  sedeId,
  onAbrir,
  accion = "Abrir caja y vender",
  puedeAbrir = true,
  conNota = false,
}: AperturaCajaProps) {
  const { user } = useAuth()
  const [modo, setModo] = React.useState<Modo>("conteo")
  const [conteo, setConteo] = React.useState<Conteo>({})
  const [billetesTotal, setBilletesTotal] = React.useState<number | null>(null)
  const [monedasTotal, setMonedasTotal] = React.useState<number | null>(null)
  const [nota, setNota] = React.useState("")
  const [abriendo, setAbriendo] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ultimo, setUltimo] = React.useState<CajaSession | null>(null)
  const [ahora] = React.useState(() => new Date())
  const campos = React.useRef<(HTMLInputElement | null)[]>([])

  // El turno anterior sirve de referencia: con qué base abrió y cómo cuadró.
  // Si no se puede leer no pasa nada, la apertura no depende de él.
  React.useEffect(() => {
    let vivo = true
    listCajaSessions(sedeId, 1, 5)
      .then((r) => {
        if (vivo) setUltimo(r.rows.find((s) => s.status === "closed") ?? null)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [sedeId])

  const contado = TODAS.some((d) => conteo[d] != null)
  const billetes =
    modo === "conteo" ? suma(conteo, BILLETES) : (billetesTotal ?? 0)
  const monedas =
    modo === "conteo" ? suma(conteo, MONEDAS) : (monedasTotal ?? 0)
  const base = billetes + monedas
  const listo =
    modo === "conteo"
      ? contado
      : billetesTotal !== null || monedasTotal !== null

  const baseAnterior = ultimo
    ? {
        bills: ultimo.openingBills ?? ultimo.openingAmount,
        coins: ultimo.openingCoins ?? 0,
      }
    : null

  function cambiarModo(siguiente: Modo) {
    // Al pasar del conteo al total se lleva lo contado, para no perderlo.
    if (
      siguiente === "total" &&
      contado &&
      billetesTotal === null &&
      monedasTotal === null
    ) {
      setBilletesTotal(suma(conteo, BILLETES))
      setMonedasTotal(suma(conteo, MONEDAS))
    }
    setModo(siguiente)
  }

  function fijar(d: number, n: number | null) {
    setConteo((c) => ({
      ...c,
      [d]: n === null ? null : Math.max(0, Math.min(n, 9999)),
    }))
  }

  function usarBaseAnterior() {
    if (!baseAnterior) return
    setBilletesTotal(baseAnterior.bills)
    setMonedasTotal(baseAnterior.coins)
    setModo("total")
  }

  async function abrir() {
    if (!listo) {
      setError("Cuenta el efectivo con el que arrancas, aunque sea $0.")
      return
    }
    setAbriendo(true)
    setError(null)
    try {
      await onAbrir({
        bills: billetes,
        coins: monedas,
        note: nota.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la caja.")
      setAbriendo(false)
    }
  }

  const fecha = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ahora)

  return (
    <div className="libro-aparece flex w-full max-w-[1320px] flex-col gap-5">
      {/* Cabecera: qué se va a hacer, dónde y quién. El estado va a la derecha
          como un dato más, no como franja de alarma: abrir es el paso normal. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.01em]">
            Abrir caja
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {sede?.name ?? "Esta sede"}
            </span>
            <span className="first-letter:uppercase"> · {fecha}</span>
            {user?.name ? <> · {user.name}</> : null}
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-warning/40 motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-warning" />
          </span>
          Caja cerrada · sin ventas hasta abrir
        </p>
      </div>

      {!puedeAbrir ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
          <p className="text-[15px] font-semibold">No hay un turno abierto</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Tu usuario no puede abrir la caja. Pide a un responsable que la abra
            y aquí verás el turno en curso.
          </p>
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* ── Conteo ── */}
          <section className="flex min-w-0 flex-col p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">
                Efectivo en el cajón
              </h2>
              <Segmented
                size="sm"
                ariaLabel="Cómo contar la base"
                value={modo}
                onValueChange={cambiarModo}
                options={[
                  { value: "conteo", label: "Por denominación" },
                  { value: "total", label: "Solo el total" },
                ]}
              />
            </div>

            {modo === "conteo" ? (
              <div className="mt-4 grid gap-x-8 gap-y-6 md:grid-cols-2">
                <GrupoConteo
                  titulo="Billetes"
                  lista={BILLETES}
                  desde={0}
                  conteo={conteo}
                  fijar={fijar}
                  campos={campos}
                  alUltimo={() => void abrir()}
                />
                <GrupoConteo
                  titulo="Monedas"
                  lista={MONEDAS}
                  desde={BILLETES.length}
                  conteo={conteo}
                  fijar={fijar}
                  campos={campos}
                  alUltimo={() => void abrir()}
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apertura-billetes">Billetes</Label>
                  <MoneyInput
                    id="apertura-billetes"
                    value={billetesTotal}
                    onValueChange={setBilletesTotal}
                    placeholder="0"
                    className="h-11 text-base"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void abrir()
                      }
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apertura-monedas">Monedas</Label>
                  <MoneyInput
                    id="apertura-monedas"
                    value={monedasTotal}
                    onValueChange={setMonedasTotal}
                    placeholder="0"
                    className="h-11 text-base"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void abrir()
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {conNota && (
              <div className="mt-6 flex flex-col gap-1.5 border-t border-border pt-5">
                <Label htmlFor="apertura-nota">Nota del turno</Label>
                <Input
                  id="apertura-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Opcional. Ej.: turno de la mañana"
                />
              </div>
            )}

            {modo === "conteo" && (
              <p className="mt-auto hidden pt-6 text-xs text-muted-foreground sm:block">
                <Tecla>Enter</Tecla> pasa a la siguiente fila · <Tecla>↑</Tecla>{" "}
                <Tecla>↓</Tecla> suman o restan uno
              </p>
            )}
          </section>

          {/* ── Resumen y acción ── */}
          <aside className="flex flex-col border-t border-border bg-muted/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
            {/* En el celular la cifra va en la barra fija de abajo. */}
            <div className="hidden lg:block">
              <p className="text-sm text-muted-foreground">Base para abrir</p>
              <p
                className="mt-1 text-[2.5rem] font-semibold leading-none tracking-[-0.02em] tabular-nums"
                aria-live="polite"
              >
                {money(base)}
              </p>

              <dl className="mt-5 flex flex-col gap-2 text-sm">
                <Linea etiqueta="Billetes" valor={money(billetes)} />
                <Linea etiqueta="Monedas" valor={money(monedas)} />
              </dl>
            </div>

            {error && (
              <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* En pantallas chicas el botón vive en la barra fija de abajo
                para no obligar a bajar hasta el final después de contar. */}
            <Button
              data-tour="pos-caja-abrir"
              size="lg"
              className="mt-5 hidden h-12 w-full text-[15px] font-semibold lg:inline-flex"
              disabled={abriendo || !listo}
              onClick={() => void abrir()}
            >
              {abriendo ? "Abriendo…" : accion}
            </Button>
            {!listo && (
              <p className="mt-2 hidden text-center text-xs text-muted-foreground lg:block">
                Escribe cuántos billetes y monedas tienes, aunque sea cero.
              </p>
            )}

            {ultimo && (
              <div className="lg:mt-6 lg:border-t lg:border-border lg:pt-5">
                <p className="text-sm font-semibold">Turno anterior</p>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <Linea
                    etiqueta="Cerró"
                    valor={ultimo.closedAt ? cuando(ultimo.closedAt) : "—"}
                  />
                  <Linea
                    etiqueta="Por"
                    valor={
                      ultimo.closedByEmail
                        ? quien(ultimo.closedByName, ultimo.closedByEmail)
                        : quien(ultimo.openedByName, ultimo.openedByEmail)
                    }
                  />
                  <Linea
                    etiqueta="Ventas"
                    valor={`${ultimo.salesCount ?? 0} ${ultimo.salesCount === 1 ? "venta" : "ventas"} · ${money(ultimo.salesTotal ?? 0)}`}
                  />
                  <Linea
                    etiqueta="Arqueo"
                    valor={<Diferencia valor={ultimo.difference} />}
                  />
                </dl>
                {baseAnterior && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full justify-between"
                    onClick={usarBaseAnterior}
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw className="size-3.5" />
                      Usar la misma base
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(baseAnterior.bills + baseAnterior.coins)}
                    </span>
                  </Button>
                )}
              </div>
            )}

            {!conNota && (
              <p className="mt-auto pt-6 text-xs text-muted-foreground">
                El arqueo y el cierre del turno están en Caja.
              </p>
            )}
          </aside>
        </div>
      )}

      {puedeAbrir && (
        <div className="sticky bottom-14 z-30 -mx-4 mt-1 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:hidden">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Base para abrir</p>
            <p className="text-lg font-semibold leading-tight tabular-nums">
              {money(base)}
            </p>
          </div>
          <Button
            size="lg"
            className="ml-auto h-11 px-5 font-semibold"
            disabled={abriendo || !listo}
            onClick={() => void abrir()}
          >
            {abriendo ? "Abriendo…" : accion}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Conteo por billete y moneda, el mismo de la apertura, para el cierre.
 *
 * Antes la caja se abría contando billete por billete y se cerraba pidiendo
 * "Billetes $___ · Monedas $___": el cajero tenía que sumar a mano en una
 * calculadora lo que el sistema ya sabía sumar. Ahora los dos extremos del
 * turno se cuentan igual.
 */
export function ConteoPorDenominacion({
  onCambio,
  alUltimo,
}: {
  onCambio: (v: { bills: number; coins: number; contado: boolean }) => void
  alUltimo?: () => void
}) {
  const [conteo, setConteo] = React.useState<Conteo>({})
  const campos = React.useRef<(HTMLInputElement | null)[]>([])
  function fijar(d: number, n: number | null) {
    const siguiente = { ...conteo, [d]: n === null ? null : Math.max(0, Math.min(n, 9999)) }
    setConteo(siguiente)
    onCambio({
      bills: suma(siguiente, BILLETES),
      coins: suma(siguiente, MONEDAS),
      contado: TODAS.some((x) => siguiente[x] != null),
    })
  }
  const fin = alUltimo ?? (() => {})
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      <GrupoConteo titulo="Billetes" lista={BILLETES} desde={0} conteo={conteo} fijar={fijar} campos={campos} alUltimo={fin} />
      <GrupoConteo titulo="Monedas" lista={MONEDAS} desde={BILLETES.length} conteo={conteo} fijar={fijar} campos={campos} alUltimo={fin} />
    </div>
  )
}

function GrupoConteo({
  titulo,
  lista,
  desde,
  conteo,
  fijar,
  campos,
  alUltimo,
}: {
  titulo: string
  lista: readonly number[]
  /** Posición de la primera fila en el orden global (para Enter). */
  desde: number
  conteo: Conteo
  fijar: (d: number, n: number | null) => void
  campos: React.RefObject<(HTMLInputElement | null)[]>
  alUltimo: () => void
}) {
  const subtotal = suma(conteo, lista)
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between border-b border-border pb-2 text-xs text-muted-foreground">
        <span className="font-medium">{titulo}</span>
        <span className="tabular-nums">{money(subtotal)}</span>
      </div>
      <ul className="divide-y divide-border/70">
        {lista.map((d, i) => {
          const pos = desde + i
          const n = conteo[d]
          const lleno = (n ?? 0) > 0
          return (
            <li key={d} className="flex h-12 items-center gap-3">
              <label
                htmlFor={`den-${d}`}
                className={cn(
                  "w-[4.75rem] shrink-0 text-sm tabular-nums transition-colors",
                  lleno
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {money(d)}
              </label>
              <div className="flex items-center rounded-md border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
                <BotonPaso
                  etiqueta={`Quitar un ${money(d)}`}
                  onClick={() => fijar(d, Math.max(0, (n ?? 0) - 1))}
                  disabled={!n}
                >
                  <Minus className="size-3.5" />
                </BotonPaso>
                <input
                  id={`den-${d}`}
                  ref={(el) => {
                    campos.current[pos] = el
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={pos === 0}
                  value={n ?? ""}
                  placeholder="0"
                  aria-label={`Cantidad de ${money(d)}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, "")
                    fijar(d, limpio === "" ? null : Number(limpio))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault()
                      fijar(d, (n ?? 0) + 1)
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault()
                      fijar(d, Math.max(0, (n ?? 0) - 1))
                    } else if (e.key === "Enter") {
                      e.preventDefault()
                      const siguiente = campos.current[pos + 1]
                      if (siguiente) siguiente.focus()
                      else alUltimo()
                    }
                  }}
                  className="h-8 w-11 bg-transparent text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
                />
                <BotonPaso
                  etiqueta={`Sumar un ${money(d)}`}
                  onClick={() => fijar(d, (n ?? 0) + 1)}
                >
                  <Plus className="size-3.5" />
                </BotonPaso>
              </div>
              <span
                className={cn(
                  "ml-auto text-sm tabular-nums",
                  lleno ? "text-foreground" : "text-muted-foreground/60",
                )}
              >
                {money(d * (n ?? 0))}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function BotonPaso({
  etiqueta,
  onClick,
  disabled,
  children,
}: {
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center sm:size-8 justify-center text-muted-foreground transition-[color,transform] duration-100 ease-salida hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-35 motion-reduce:active:scale-100"
    >
      {children}
    </button>
  )
}

function Linea({
  etiqueta,
  valor,
}: {
  etiqueta: string
  valor: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{valor}</dd>
    </div>
  )
}

export function Diferencia({ valor }: { valor?: number }) {
  if (valor === undefined || valor === null) return <>—</>
  if (valor === 0) return <span className="text-success-ink">Cuadró</span>
  return (
    <span className={valor > 0 ? "text-warning-ink" : "text-destructive"}>
      {valor > 0 ? "Sobraron " : "Faltaron "}
      {money(Math.abs(valor))}
    </span>
  )
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-px font-sans text-[11px] text-foreground">
      {children}
    </kbd>
  )
}
