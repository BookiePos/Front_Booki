"use client"

/**
 * Piezas de UI del semáforo de margen. La lógica pura vive en
 * `@/lib/erp/margen`; aquí solo está lo que se pinta.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  calcularMargenPct,
  ESTILOS_MARGEN,
  guardarMargenMinimo,
  leerMargenMinimo,
  margenMinimoDelServidor,
  nivelMargen,
  suscribirMargenMinimo,
  type NivelMargen,
} from "@/lib/erp/margen"
import { HelpTip } from "@/components/ui/help-tip"
import { QuantityInput } from "@/components/ui/money-input"

/**
 * Umbral de margen del dispositivo.
 *
 * `localStorage` no existe en el servidor, así que el valor guardado no puede
 * leerse durante el render sin romper la hidratación.
 * `useSyncExternalStore` resuelve justo eso: pinta el valor por defecto en el
 * servidor y cambia al del navegador sin efectos ni renders en cascada.
 */
export function useMargenMinimo() {
  const minimo = React.useSyncExternalStore(
    suscribirMargenMinimo,
    leerMargenMinimo,
    margenMinimoDelServidor,
  )

  return [minimo, guardarMargenMinimo] as const
}

/** Punto de color + porcentaje. El rótulo explica qué significa el color. */
export function MargenBadge({
  pct,
  minimo,
  className,
}: {
  pct: number | undefined | null
  minimo: number
  className?: string
}) {
  const nivel = nivelMargen(pct, minimo)
  const estilo = ESTILOS_MARGEN[nivel]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        estilo.texto,
        className,
      )}
      title={`${estilo.etiqueta}. ${estilo.ayuda}`}
    >
      <span className={cn("size-2 shrink-0 rounded-full", estilo.punto)} />
      {nivel === "sinDato" ? estilo.etiqueta : `${pct} %`}
    </span>
  )
}

/**
 * Casilla para fijar el objetivo de margen.
 *
 * El valor del campo puede quedar vacío (`null`) mientras se escribe, y esa es
 * toda la gracia: con un número a secas el input rebota al valor anterior en
 * cuanto se borra, y pasar de 35 a 5 es imposible sin pelear con él. Lo que
 * se guarda solo se guarda cuando el número tiene sentido.
 */
export function MargenMinimoControl({
  minimo,
  onChange,
  className,
}: {
  minimo: number
  onChange: (valor: number) => void
  className?: string
}) {
  const [valor, setValor] = React.useState<number | null>(minimo)

  // Ajuste durante el render, no en un efecto: si el umbral cambia por fuera
  // (otra pestaña, o el valor guardado que llega tras la hidratación) la
  // casilla tiene que seguirlo sin provocar una segunda pintura.
  const [ultimo, setUltimo] = React.useState(minimo)
  if (minimo !== ultimo) {
    setUltimo(minimo)
    setValor(minimo)
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <label htmlFor="margen-minimo" className="whitespace-nowrap">
        Mi margen objetivo
      </label>
      <QuantityInput
        id="margen-minimo"
        className="h-9 w-24 text-right"
        value={valor}
        decimales={0}
        sufijo="%"
        onValueChange={(n) => {
          setValor(n)
          if (n !== null && n >= 1 && n <= 99) onChange(Math.round(n))
        }}
        onBlur={() => setValor(minimo)}
      />
      <HelpTip title="¿Para qué sirve?">
        Es cuánto quieres ganarle a cada producto. Lo que esté por debajo se
        pinta en ámbar y lo que te dé pérdida, en rojo. Solo cambia los colores:
        no toca ningún precio.
      </HelpTip>
    </div>
  )
}

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

/**
 * La cuenta de la ganancia en una línea, bajo el precio de venta.
 *
 * "Te cuesta $1.500 · Ganas $1.000 (40 %)". Es la única frase que responde de
 * verdad la pregunta que se hace quien pone un precio —"¿me está quedando
 * algo?"— y hasta ahora había que sacarla con la calculadora del celular. El
 * color lo pone el mismo semáforo de las demás pantallas, así que un precio
 * puesto por debajo del objetivo se ve ámbar aquí y ámbar allá.
 */
export function LineaGanancia({
  precio,
  costo,
  unidad,
  className,
}: {
  precio: number | null | undefined
  /** Lo que cuesta producir o comprar UNA unidad de lo que se vende. */
  costo: number | null | undefined
  /** Cómo se llama la unidad de venta: "unidad", "porción", "bolsa". */
  unidad?: string
  className?: string
}) {
  const [minimo] = useMargenMinimo()
  if (!precio || precio <= 0 || costo == null) return null

  const pct = calcularMargenPct(precio, costo)
  const ganancia = precio - costo
  const estilo = ESTILOS_MARGEN[nivelMargen(pct, minimo)]

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs",
        className,
      )}
    >
      <span className="text-muted-foreground">
        Te cuesta {pesos.format(costo)} por {unidad ?? "unidad"}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className={cn("font-medium", estilo.texto)}>
        {ganancia >= 0 ? "Ganas" : "Pierdes"} {pesos.format(Math.abs(ganancia))}
        {pct !== undefined ? ` (${pct} %)` : ""}
      </span>
    </p>
  )
}

/** Resumen "3 van bien · 2 por debajo · 1 en pérdida" para la cabecera. */
export function ResumenMargen({
  niveles,
  className,
}: {
  niveles: NivelMargen[]
  className?: string
}) {
  const cuenta = (n: NivelMargen) => niveles.filter((x) => x === n).length
  const partes: { nivel: NivelMargen; n: number; texto: string }[] = [
    { nivel: "bueno", n: cuenta("bueno"), texto: "en tu objetivo" },
    { nivel: "bajo", n: cuenta("bajo"), texto: "por debajo" },
    { nivel: "perdida", n: cuenta("perdida"), texto: "en pérdida" },
  ]
  const visibles = partes.filter((p) => p.n > 0)
  if (visibles.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {visibles.map((p) => (
        <span
          key={p.nivel}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm",
            ESTILOS_MARGEN[p.nivel].texto,
          )}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              ESTILOS_MARGEN[p.nivel].punto,
            )}
          />
          <strong className="tnum font-semibold">{p.n}</strong>
          {p.texto}
        </span>
      ))}
    </div>
  )
}
