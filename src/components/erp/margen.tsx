"use client"

/**
 * Piezas de UI del semáforo de margen. La lógica pura vive en
 * `@/lib/erp/margen`; aquí solo está lo que se pinta.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  ESTILOS_MARGEN,
  guardarMargenMinimo,
  leerMargenMinimo,
  margenMinimoDelServidor,
  nivelMargen,
  suscribirMargenMinimo,
  type NivelMargen,
} from "@/lib/erp/margen"
import { HelpTip } from "@/components/ui/help-tip"
import { Input } from "@/components/ui/input"

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
 * Se edita como texto y no como número a secas para dejar borrar el campo
 * mientras se escribe: con `value={numero}` el input rebota al valor anterior
 * en cuanto queda vacío y es imposible pasar de 35 a 5 sin pelear con él.
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
  const [texto, setTexto] = React.useState(String(minimo))

  // Ajuste durante el render, no en un efecto: si el umbral cambia por fuera
  // (otra pestaña, o el valor guardado que llega tras la hidratación) la
  // casilla tiene que seguirlo sin provocar una segunda pintura.
  const [ultimo, setUltimo] = React.useState(minimo)
  if (minimo !== ultimo) {
    setUltimo(minimo)
    setTexto(String(minimo))
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
      <div className="relative">
        <Input
          id="margen-minimo"
          type="number"
          min="1"
          max="99"
          inputMode="numeric"
          className="h-9 w-20 pr-7 text-right tnum"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            const n = Number(e.target.value)
            if (Number.isFinite(n) && n >= 1 && n <= 99) onChange(Math.round(n))
          }}
          onBlur={() => setTexto(String(minimo))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
          %
        </span>
      </div>
      <HelpTip title="¿Para qué sirve?">
        Es cuánto quieres ganarle a cada producto. Lo que esté por debajo se
        pinta en ámbar y lo que te dé pérdida, en rojo. Solo cambia los colores:
        no toca ningún precio.
      </HelpTip>
    </div>
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
