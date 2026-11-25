"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight, ShoppingCart } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { getSalesReport, type SalesReport } from "@/lib/erp/api-reports"
import { money } from "@/lib/erp/finance-format"
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data"
import { buildAlertasHoy } from "@/lib/dashboard/alertas-hoy"
import { cn, quien } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Skeleton } from "@/components/ui/skeleton"
import { CurvaVentas } from "./curva-ventas"
import {
  nombreActual,
  nombreAnterior,
  rangos,
  series,
  variacion,
  type Periodo,
} from "./periodos"

const METODO: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "Fiado",
}
/** Medios de pago en tonos de la misma familia: se leen por posición y texto. */
const TONO_METODO = [
  "var(--primary)",
  "color-mix(in oklab, var(--primary) 55%, var(--background))",
  "color-mix(in oklab, var(--primary) 28%, var(--background))",
  "var(--muted-foreground)",
]

const FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" })

/**
 * Cuenta hasta la cifra en 380 ms al cambiar de periodo. Solo la cifra grande:
 * animar las doce del tablero distrae. Sin movimiento si el sistema lo pide.
 */
function useCuenta(valor: number): number {
  const [mostrado, setMostrado] = React.useState(valor)
  const desde = React.useRef(valor)
  React.useEffect(() => {
    const dura = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380
    const ini = desde.current
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const k = dura === 0 ? 1 : Math.min(1, (t - t0) / dura)
      const e = 1 - Math.pow(1 - k, 3)
      setMostrado(ini + (valor - ini) * e)
      if (k < 1) id = requestAnimationFrame(paso)
      else desde.current = valor
    }
    id = requestAnimationFrame(paso)
    // Seguro: el navegador no da cuadros de animación a una pestaña en segundo
    // plano (y a veces tampoco a una ventana que está cargando), y la cifra se
    // quedaba en $ 0 con 36.000 vendidos debajo. Pase lo que pase, al acabar
    // el tiempo de la animación la cifra es la real.
    const seguro = window.setTimeout(() => {
      cancelAnimationFrame(id)
      desde.current = valor
      setMostrado(valor)
    }, dura + 120)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(seguro)
    }
  }, [valor])
  return mostrado
}

function Variacion({ pct, invertir = false }: { pct: number | null; invertir?: boolean }) {
  // Sin periodo anterior no hay variación que mostrar: mejor nada que un
  // "Sin comparación" repetido en cada cifra.
  if (pct == null || !Number.isFinite(pct)) return null
  const sube = pct >= 0
  const bueno = invertir ? !sube : sube
  const Icono = sube ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium tabular-nums",
        bueno ? "text-success-ink" : "text-destructive-ink",
      )}
    >
      <Icono className="size-3.5" aria-hidden />
      {Math.abs(pct).toLocaleString("es-CO", { maximumFractionDigits: pct > -10 && pct < 10 ? 1 : 0 })} %
    </span>
  )
}

/** Título de banda con su enlace a la derecha. */
function Titulo({ children, href, enlace }: { children: React.ReactNode; href?: string; enlace?: string }) {
  return (
    <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold text-foreground">
      {children}
      {href && enlace && (
        <Link href={href} className="text-[13px] font-normal text-muted-foreground transition-colors hover:text-primary">
          {enlace}
        </Link>
      )}
    </h2>
  )
}

/**
 * Inicio (sistema "Libro"). Antes era una rejilla de 25 widgets en tarjetas
 * con pastillas, personalizable pero sin jerarquía: todo pesaba igual y la
 * gráfica de ventas no dibujaba. Ahora la página responde en orden a lo que
 * el dueño pregunta al abrirla:
 *
 * 1. ¿Cómo vamos? — la cifra del periodo contra el periodo comparable y su curva.
 * 2. ¿Qué tengo que resolver? — descuadres, cajas sin abrir, stock bajo…
 * 3. ¿Qué se vende y cómo me pagan? — lo más vendido, medios de pago, el mes.
 *
 * Sin tarjetas: las zonas se separan con aire y una línea de 1 px.
 */
export function Inicio({ primerosPasos }: { primerosPasos?: React.ReactNode }) {
  const { user, hasPermission, canUsePos } = useAuth()
  const puedeVentas = hasPermission("reports.view")
  const { data, loading } = useDashboardData()
  const alertas = buildAlertasHoy(data)

  const [periodo, setPeriodo] = React.useState<Periodo>("hoy")
  // Mientras llega el periodo nuevo se sigue viendo el anterior: la cifra
  // cuenta desde ahí y la página no parpadea con un esqueleto.
  const [rep, setRep] = React.useState<{
    periodo: Periodo
    actual: SalesReport | null
    anterior: SalesReport | null
  }>({ periodo, actual: null, anterior: null })
  const [errorPara, setErrorPara] = React.useState<Periodo | null>(null)

  React.useEffect(() => {
    if (!puedeVentas) return
    let vigente = true
    const { actual, anterior } = rangos(periodo)
    Promise.all([getSalesReport(actual), getSalesReport(anterior)])
      .then(([a, b]) => {
        if (!vigente) return
        setRep({ periodo, actual: a, anterior: b })
        setErrorPara(null)
      })
      .catch(() => {
        if (vigente) setErrorPara(periodo)
      })
    return () => {
      vigente = false
    }
  }, [periodo, puedeVentas])

  const error = errorPara === periodo
  const cargando = puedeVentas && !error && (rep.periodo !== periodo || !rep.actual)

  const a = rep.actual
  const b = rep.anterior
  const ventas = a?.totalRevenue ?? 0
  const cifra = useCuenta(ventas)
  const curva = series(periodo, a, b)
  const anteriorTxt = nombreAnterior(periodo)
  const hoy = new Date()

  const medios = (a?.byMethod ?? []).filter((m) => m.revenue > 0).sort((x, y) => y.revenue - x.revenue)
  const totalMedios = medios.reduce((s, m) => s + m.revenue, 0) || 1
  const top = (a?.topProducts ?? []).filter((p) => p.revenue > 0).slice(0, 6)
  const cajas = data.caja?.rows ?? []
  const ov = data.overview

  return (
    <div className="flex flex-col">
      {/* Cabecera: título, fecha y periodo en una fila. */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.02em]">
            {user?.name ? `Hola, ${user.name.split(" ")[0]}` : "Inicio"}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
            {FECHA.format(hoy)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {puedeVentas && (
            <Segmented<Periodo>
              ariaLabel="Periodo"
              value={periodo}
              onValueChange={setPeriodo}
              options={[
                { value: "hoy", label: "Hoy" },
                { value: "semana", label: "Semana" },
                { value: "mes", label: "Mes" },
              ]}
            />
          )}
          {canUsePos && (
            <Button className="sm:hidden" render={<Link href="/pos" />}>
              <ShoppingCart />
              Vender
            </Button>
          )}
        </div>
      </div>

      {/* Los primeros pasos de una cuenta nueva van antes que las cifras: sin
          productos ni caja no hay nada que mirar. Se ocultan solos al acabar. */}
      {primerosPasos}

      {/* 1. La cifra del periodo y su curva. */}
      {puedeVentas && (
        <section className="libro-aparece grid gap-8 border-b border-border pb-7 lg:grid-cols-[300px_1fr]">
          <div>
            <p className="text-[13px] text-muted-foreground">{nombreActual(periodo)}</p>
            {cargando && !a ? (
              <Skeleton className="mt-2 h-11 w-52" />
            ) : (
              <p className="mt-1.5 mb-2.5 text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.035em] tabular-nums">
                {money.format(Math.round(cifra))}
              </p>
            )}
            {error ? (
              <p className="text-[13px] text-destructive-ink">No se pudieron cargar las ventas.</p>
            ) : (
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                {b && b.totalRevenue ? (
                  <>
                    <Variacion pct={variacion(ventas, b.totalRevenue)} />
                    <span>frente a{anteriorTxt.startsWith("el ") ? `l ${anteriorTxt.slice(3)}` : ` ${anteriorTxt}`}</span>
                  </>
                ) : (
                  <span className="first-letter:uppercase">{anteriorTxt}: sin ventas para comparar</span>
                )}
              </p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/70 pt-5">
              {[
                { t: "Tiquetes", v: (a?.totalTickets ?? 0).toLocaleString("es-CO"), p: variacion(a?.totalTickets ?? 0, b?.totalTickets ?? 0) },
                { t: "Ticket promedio", v: money.format(a?.avgTicket ?? 0), p: variacion(a?.avgTicket ?? 0, b?.avgTicket ?? 0) },
                { t: "Impuestos cobrados", v: money.format(a?.totalTax ?? 0), p: null as number | null, sin: true },
                { t: "Devoluciones", v: money.format(a?.totalReturns ?? 0), p: variacion(a?.totalReturns ?? 0, b?.totalReturns ?? 0), inv: true },
              ].map((m) => (
                <div key={m.t}>
                  <dt className="text-[13px] text-muted-foreground">{m.t}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tracking-[-0.02em] tabular-nums">{m.v}</dd>
                  {!m.sin && <Variacion pct={m.p} invertir={m.inv} />}
                </div>
              ))}
            </dl>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">
                {periodo === "hoy" ? "Ventas por hora" : "Ventas por día"}
              </p>
              <div className="flex gap-4 text-[12.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-0.5 w-3.5 rounded bg-primary" />
                  {periodo === "hoy" ? "Hoy" : "Este periodo"}
                </span>
                <span className="flex items-center gap-1.5 first-letter:uppercase">
                  <i className="inline-block h-0 w-3.5 border-t-[1.5px] border-dashed border-muted-foreground/60" />
                  <span className="first-letter:uppercase">{anteriorTxt}</span>
                </span>
              </div>
            </div>
            {cargando && !a ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <CurvaVentas
                actual={curva.actual}
                anterior={curva.anterior}
                nombreAnterior={anteriorTxt}
                claveAnimacion={`${periodo}-${a?.from ?? ""}`}
              />
            )}
          </div>
        </section>
      )}

      {/* 2. Lo que hay que resolver y las cajas. */}
      <section
        className="libro-aparece grid gap-10 border-b border-border py-7 lg:grid-cols-[1.35fr_1fr]"
        style={{ animationDelay: "60ms" }}
      >
        <div>
          <Titulo>Para resolver</Titulo>
          {loading && alertas.length === 0 ? (
            <Skeleton className="h-24 w-full" />
          ) : alertas.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nada pendiente. Todo en orden por ahora.</p>
          ) : (
            <ul>
              {alertas.map((al) => (
                <li key={al.id}>
                  <Link
                    href={al.href}
                    className="group -mx-2.5 flex min-h-12 items-center gap-3 rounded-lg border-b border-border/60 px-2.5 py-2 transition-colors last:border-0 hover:bg-muted/70"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        al.nivel === "critica" ? "bg-destructive" : "bg-warning",
                      )}
                    />
                    <span className="flex-1 text-sm first-letter:uppercase">{al.texto}</span>
                    <span className="flex items-center gap-1 text-[13px] font-medium text-primary opacity-80 transition-[gap,opacity] duration-150 group-hover:gap-1.5 group-hover:opacity-100">
                      Revisar
                      <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Titulo href="/panel/caja" enlace="Ir a caja">
            Cajas
          </Titulo>
          {loading && cajas.length === 0 ? (
            <Skeleton className="h-24 w-full" />
          ) : cajas.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No hay sedes con caja.</p>
          ) : (
            <ul>
              {cajas.map((c) => {
                const estado =
                  c.status === "open" ? "Abierta" : c.status === "closed" ? "Cerrada" : "Sin abrir"
                const descuadre = c.status === "closed" && (c.difference ?? 0) !== 0
                return (
                  <li
                    key={c.sedeId}
                    className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.sedeName}</p>
                      <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            c.status === "open" ? "bg-success" : c.status === "closed" ? "bg-muted-foreground/50" : "bg-warning",
                          )}
                        />
                        {estado}
                        {c.openedByEmail && c.status === "open" ? ` · ${quien(c.openedByName, c.openedByEmail)}` : ""}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-sm font-semibold">{money.format(c.salesTotal)}</p>
                      <p className={cn("text-[12px]", descuadre ? "text-destructive-ink" : "text-muted-foreground")}>
                        {descuadre
                          ? `Descuadre ${money.format(c.difference ?? 0)}`
                          : `${c.salesCount} ${c.salesCount === 1 ? "venta" : "ventas"}`}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 3. Qué se vende, cómo pagan y cómo va el mes. */}
      <section
        className="libro-aparece grid gap-10 py-7 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr]"
        style={{ animationDelay: "120ms" }}
      >
        {puedeVentas && (
          <div>
            <Titulo href="/panel/productos" enlace="Productos">
              Lo más vendido
            </Titulo>
            {top.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="w-6 pb-2 text-left font-medium" />
                    <th className="pb-2 text-left font-medium">Producto</th>
                    <th className="pb-2 text-right font-medium">Und</th>
                    <th className="pb-2 text-right font-medium">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((p, i) => (
                    <tr key={`${p.productId}-${i}`} className="h-10 border-b border-border/60 last:border-0">
                      <td className="text-muted-foreground">{i + 1}</td>
                      <td className="max-w-0 truncate pr-3">{p.name}</td>
                      <td className="text-right text-muted-foreground">{p.qty.toLocaleString("es-CO")}</td>
                      <td className="pl-3 text-right font-medium">{money.format(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {puedeVentas && (
          <div>
            <Titulo>Medios de pago</Titulo>
            {medios.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Sin cobros en el periodo.</p>
            ) : (
              <>
                <div className="mt-1 mb-3.5 flex h-2 gap-0.5 overflow-hidden rounded">
                  {medios.map((m, i) => (
                    <span
                      key={m.method}
                      style={{ flexGrow: m.revenue, background: TONO_METODO[i % TONO_METODO.length] }}
                      className="transition-[flex-grow] duration-400 ease-salida"
                    />
                  ))}
                </div>
                <ul className="text-[13px] tabular-nums">
                  {medios.map((m, i) => (
                    <li key={m.method} className="flex h-9 items-center gap-2.5 border-b border-border/60 last:border-0">
                      <i className="size-2 rounded-sm" style={{ background: TONO_METODO[i % TONO_METODO.length] }} />
                      <span className="flex-1">{METODO[m.method] ?? m.method}</span>
                      <span className="w-12 text-right text-muted-foreground">
                        {Math.round((m.revenue / totalMedios) * 100)} %
                      </span>
                      <span className="w-28 text-right font-medium">{money.format(m.revenue)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {ov && (
          <div>
            <Titulo href="/panel/finanzas/pl" enlace="Resultados">
              Este mes
            </Titulo>
            <dl className="text-[13px] tabular-nums">
              {[
                { t: "Ventas", v: ov.salesMonth },
                { t: "Gastos", v: ov.expensesMonth ? -ov.expensesMonth : 0 },
                { t: "Nómina", v: ov.nomina ? -ov.nomina : 0 },
                { t: "Utilidad", v: ov.utilidadMonth, fuerte: true },
              ].map((r) => (
                <div
                  key={r.t}
                  className={cn(
                    "flex h-9 items-center justify-between border-b border-border/60",
                    r.fuerte && "border-b-0 border-t border-t-border font-semibold",
                  )}
                >
                  <dt className={r.fuerte ? "" : "text-muted-foreground"}>{r.t}</dt>
                  <dd className={cn(r.fuerte && r.v < 0 && "text-destructive-ink")}>{money.format(r.v)}</dd>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Te deben</dt>
                  <dd className="mt-0.5 font-semibold">{money.format(ov.receivablesOpen)}</dd>
                  {ov.receivablesOverdue > 0 && (
                    <p className="text-xs text-destructive-ink">{money.format(ov.receivablesOverdue)} vencido</p>
                  )}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Debes</dt>
                  <dd className="mt-0.5 font-semibold">{money.format(ov.payablesOpen)}</dd>
                  {ov.payablesOverdue > 0 && (
                    <p className="text-xs text-destructive-ink">{money.format(ov.payablesOverdue)} vencido</p>
                  )}
                </div>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  )
}
