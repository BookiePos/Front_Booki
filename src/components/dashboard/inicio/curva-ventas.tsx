"use client"

import * as React from "react"

import { money } from "@/lib/erp/finance-format"
import type { Punto } from "./periodos"

const ALTO = 220
const MARGEN = { arriba: 12, abajo: 26, izq: 0, der: 8 }

/** Trazo suave que no se pasa de los puntos (monótono): sin picos inventados. */
function trazo(xy: [number, number][]): string {
  if (xy.length === 0) return ""
  if (xy.length === 1) return `M${xy[0][0]},${xy[0][1]}`
  let d = `M${xy[0][0]},${xy[0][1]}`
  for (let i = 0; i < xy.length - 1; i++) {
    const [x0, y0] = xy[i]
    const [x1, y1] = xy[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
  }
  return d
}

function corto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")} M`
  if (n >= 1000) return `${Math.round(n / 1000)} mil`
  return String(Math.round(n))
}

/**
 * Curva de ventas del periodo contra el anterior.
 *
 * SVG a mano, sin librería: son dos líneas y un globo, y una librería de
 * gráficas pesaría más que todo el tablero. Mide su ancho con
 * `ResizeObserver` para dibujar en píxeles reales (el texto del eje no se
 * deforma) y vuelve a trazar la línea solo cuando cambia el periodo, no al
 * redimensionar.
 */
export function CurvaVentas({
  actual,
  anterior,
  nombreAnterior,
  claveAnimacion,
}: {
  actual: Punto[]
  anterior: Punto[]
  nombreAnterior: string
  /** Cambia con el periodo: vuelve a dibujar la línea. */
  claveAnimacion: string
}) {
  const caja = React.useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = React.useState(0)
  const [sobre, setSobre] = React.useState<number | null>(null)

  React.useEffect(() => {
    const el = caja.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = Math.max(actual.length, anterior.length)
  const max = Math.max(1, ...actual.map((p) => p.valor), ...anterior.map((p) => p.valor))
  const w = Math.max(0, ancho - MARGEN.izq - MARGEN.der)
  const h = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) => MARGEN.izq + (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v: number) => MARGEN.arriba + h - (v / max) * h

  const ptsA = actual.map((p, i) => [x(i), y(p.valor)] as [number, number])
  const ptsB = anterior.map((p, i) => [x(i), y(p.valor)] as [number, number])
  const lineaA = trazo(ptsA)
  const area =
    ptsA.length > 1
      ? `${lineaA} L${ptsA[ptsA.length - 1][0]},${MARGEN.arriba + h} L${ptsA[0][0]},${MARGEN.arriba + h} Z`
      : ""

  // Rótulos del eje: unos 6, repartidos.
  const paso = Math.max(1, Math.ceil(n / 7))
  const rotulos = (anterior.length >= actual.length ? anterior : actual)
    .map((p, i) => ({ i, t: p.rotulo }))
    .filter(({ i }) => i % paso === 0)

  const guias = [0.25, 0.5, 0.75, 1].map((f) => ({ y: y(max * f), v: max * f }))

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    if (n === 0 || w === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - r.left - MARGEN.izq) / w
    setSobre(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }

  const pA = sobre != null ? actual[sobre] : undefined
  const pB = sobre != null ? anterior[sobre] : undefined
  const etiqueta = pA?.rotulo ?? pB?.rotulo ?? ""

  return (
    <div ref={caja} className="relative">
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          className="block overflow-visible select-none"
          role="img"
          aria-label={`Ventas del periodo comparadas con ${nombreAnterior}`}
          onPointerMove={mover}
          onPointerLeave={() => setSobre(null)}
        >
          <defs>
            <linearGradient id="inicio-velo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {guias.map((g) => (
            <g key={g.y}>
              <line x1={MARGEN.izq} x2={MARGEN.izq + w} y1={g.y} y2={g.y} className="stroke-border/70" />
              <text x={MARGEN.izq + w} y={g.y - 4} textAnchor="end" className="fill-muted-foreground text-[10.5px]">
                {corto(g.v)}
              </text>
            </g>
          ))}
          <line
            x1={MARGEN.izq}
            x2={MARGEN.izq + w}
            y1={MARGEN.arriba + h}
            y2={MARGEN.arriba + h}
            className="stroke-border"
          />
          {rotulos.map(({ i, t }) => (
            <text
              key={i}
              x={x(i)}
              y={ALTO - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[11px]"
            >
              {t}
            </text>
          ))}

          <path
            d={trazo(ptsB)}
            fill="none"
            className="stroke-muted-foreground/45"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <g key={claveAnimacion} className="inicio-curva">
            {area && <path d={area} fill="url(#inicio-velo)" className="inicio-curva-area" />}
            <path
              d={lineaA}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              className="inicio-curva-linea"
            />
          </g>

          {sobre != null && (
            <g pointerEvents="none">
              <line
                x1={x(sobre)}
                x2={x(sobre)}
                y1={MARGEN.arriba}
                y2={MARGEN.arriba + h}
                className="stroke-foreground/20"
              />
              {pB && <circle cx={x(sobre)} cy={y(pB.valor)} r={3} className="fill-background stroke-muted-foreground" strokeWidth={1.5} />}
              {pA && <circle cx={x(sobre)} cy={y(pA.valor)} r={4} className="fill-background" stroke="var(--primary)" strokeWidth={2} />}
            </g>
          )}
        </svg>
      )}

      {sobre != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md bg-foreground px-2.5 py-2 text-xs whitespace-nowrap text-background shadow-md tabular-nums"
          style={{
            left: Math.min(Math.max(0, x(sobre) + 12), Math.max(0, ancho - 190)),
          }}
        >
          <div className="mb-1 font-medium">{etiqueta}</div>
          <div className="flex justify-between gap-5">
            <span className="opacity-70">Ahora</span>
            <span>{pA ? money.format(pA.valor) : "—"}</span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="opacity-70 first-letter:uppercase">{nombreAnterior}</span>
            <span>{pB ? money.format(pB.valor) : "—"}</span>
          </div>
        </div>
      )}
    </div>
  )
}
