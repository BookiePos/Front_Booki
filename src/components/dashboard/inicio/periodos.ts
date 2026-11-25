import type { SalesReport } from "@/lib/erp/api-reports"

/** Periodo de Inicio. Cada uno se compara con su par anterior. */
export type Periodo = "hoy" | "semana" | "mes"

export interface Rango {
  from: string
  to: string
}

/** Fecha local en `YYYY-MM-DD` (no UTC: lo vendido de noche es de hoy). */
export function iso(d: Date): string {
  return d.toLocaleDateString("en-CA")
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * El periodo y el que se le compara:
 * - Hoy contra el mismo día de la semana pasada (un jueves contra un jueves:
 *   comparar con ayer mezcla un fin de semana con un día de semana).
 * - Semana: los últimos 7 días contra los 7 anteriores.
 * - Mes: del 1 a hoy contra el mismo tramo del mes pasado, para que la
 *   comparación sea justa a mitad de mes.
 */
export function rangos(p: Periodo, hoy = new Date()): { actual: Rango; anterior: Rango } {
  if (p === "hoy") {
    const antes = sumarDias(hoy, -7)
    return { actual: { from: iso(hoy), to: iso(hoy) }, anterior: { from: iso(antes), to: iso(antes) } }
  }
  if (p === "semana") {
    return {
      actual: { from: iso(sumarDias(hoy, -6)), to: iso(hoy) },
      anterior: { from: iso(sumarDias(hoy, -13)), to: iso(sumarDias(hoy, -7)) },
    }
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioAntes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  // Mismo día del mes pasado, sin pasarse de su último día (31 → 30).
  const finMesAntes = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate()
  const finAntes = new Date(
    hoy.getFullYear(),
    hoy.getMonth() - 1,
    Math.min(hoy.getDate(), finMesAntes),
  )
  return {
    actual: { from: iso(inicio), to: iso(hoy) },
    anterior: { from: iso(inicioAntes), to: iso(finAntes) },
  }
}

const DIA = new Intl.DateTimeFormat("es-CO", { weekday: "long" })
const DIA_CORTO = new Intl.DateTimeFormat("es-CO", { weekday: "short" })
const MES = new Intl.DateTimeFormat("es-CO", { month: "long" })

/** Cómo se nombra el periodo con el que se compara: "el jueves pasado". */
export function nombreAnterior(p: Periodo, hoy = new Date()): string {
  if (p === "hoy") return `el ${DIA.format(hoy)} pasado`
  if (p === "semana") return "los 7 días anteriores"
  return `el mismo tramo de ${MES.format(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))}`
}

export function nombreActual(p: Periodo): string {
  return p === "hoy" ? "Ventas de hoy" : p === "semana" ? "Ventas de 7 días" : "Ventas del mes"
}

/** Un punto de la curva: su rótulo en el eje y lo vendido. */
export interface Punto {
  rotulo: string
  valor: number
}

/**
 * Las dos series de la curva, alineadas punto a punto.
 *
 * Hoy va por hora. Se muestra desde la primera hora con ventas (en cualquiera
 * de los dos días, nunca después de las 6) hasta la última hora con ventas o
 * la hora actual: un restaurante que abre a las 11 no quiere una curva plana
 * de medianoche a mediodía.
 */
export function series(
  p: Periodo,
  actual: SalesReport | null,
  anterior: SalesReport | null,
  hoy = new Date(),
): { actual: Punto[]; anterior: Punto[]; hastaAhora: number } {
  if (p === "hoy") {
    const h = (r: SalesReport | null) =>
      Array.from({ length: 24 }, (_, i) => r?.hours?.find((x) => x.hour === i)?.revenue ?? 0)
    const a = h(actual)
    const b = h(anterior)
    const conVenta = (xs: number[]) => xs.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
    const horas = [...conVenta(a), ...conVenta(b)]
    const ahora = hoy.getHours()
    const desde = Math.min(6, ...horas)
    const hasta = Math.max(Math.min(23, ahora + 1), ...horas, desde + 6)
    const rot = (i: number) => `${((i + 11) % 12) + 1} ${i < 12 ? "a. m." : "p. m."}`
    const corte = (xs: number[]) =>
      xs.slice(desde, hasta + 1).map((valor, k) => ({ rotulo: rot(desde + k), valor }))
    // La línea de hoy se corta en la hora actual: el futuro no es cero.
    return {
      actual: corte(a).slice(0, Math.max(1, ahora - desde + 1)),
      anterior: corte(b),
      hastaAhora: ahora - desde,
    }
  }

  const porDia = (r: SalesReport | null, rango: Rango): Punto[] => {
    const out: Punto[] = []
    const d = new Date(`${rango.from}T00:00:00`)
    const fin = new Date(`${rango.to}T00:00:00`)
    while (d <= fin) {
      const f = iso(d)
      const valor = r?.days.find((x) => x.date === f)?.revenue ?? 0
      out.push({
        rotulo: p === "semana" ? DIA_CORTO.format(d).replace(".", "") : String(d.getDate()),
        valor,
      })
      d.setDate(d.getDate() + 1)
    }
    return out
  }
  const { actual: ra, anterior: rb } = rangos(p, hoy)
  const a = porDia(actual, ra)
  const b = porDia(anterior, rb)
  return { actual: a, anterior: b, hastaAhora: a.length - 1 }
}

/** Variación en %, o `null` si no hay contra qué comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}
