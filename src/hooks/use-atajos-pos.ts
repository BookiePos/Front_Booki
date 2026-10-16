"use client"

import * as React from "react"

/**
 * Atajos de teclado del punto de venta (ítem 6.7).
 *
 * Dos clases de tecla, y de ahí sale toda la regla:
 *
 * - **Teclas que no escriben** (F2, F4, F6 a F9, Alt+1..4, Esc): funcionan
 *   también con el foco dentro de un campo, porque están pensadas para saltar
 *   desde el buscador o desde el efectivo sin soltar el teclado.
 * - **Teclas que sí escriben** (+, − y ?): solo valen con el foco fuera de un
 *   campo; si no, no se podría teclear "?" ni un descuento en un input.
 *
 * Cualquier combinación con Ctrl o Meta se deja pasar entera (Ctrl+R, Ctrl+W,
 * Ctrl+K de la búsqueda global...), y Alt solo vale con un dígito, de modo que
 * Alt+F4 y Alt+flechas siguen siendo del navegador y del sistema. Solo se
 * llama a `preventDefault` cuando el atajo hizo algo.
 */

/** Orden de los métodos de pago en F6..F9 y Alt+1..4. */
export const METODOS_ATAJO = ["cash", "card", "transfer", "credit"] as const

export type AtajoPosAccion =
  | "buscar"
  | "cobrar"
  | "mas"
  | "menos"
  | "metodo"
  | "cerrar"
  | "ayuda"

export interface AtajoPosAyuda {
  teclas: string[]
  descripcion: string
}

/** Lo que muestra la ayuda: una sola fuente para tecla y descripción. */
export const ATAJOS_POS: AtajoPosAyuda[] = [
  { teclas: ["F2"], descripcion: "Buscar o escanear producto" },
  { teclas: ["F4"], descripcion: "Cobrar (abre el pago)" },
  {
    teclas: ["+", "−"],
    descripcion: "Subir o bajar la cantidad de la última línea",
  },
  { teclas: ["F6", "Alt 1"], descripcion: "Pago en efectivo" },
  { teclas: ["F7", "Alt 2"], descripcion: "Pago con tarjeta" },
  { teclas: ["F8", "Alt 3"], descripcion: "Pago por transferencia" },
  { teclas: ["F9", "Alt 4"], descripcion: "Fiado" },
  { teclas: ["Enter"], descripcion: "Confirmar el cobro" },
  { teclas: ["Esc"], descripcion: "Cerrar el cuadro abierto" },
  { teclas: ["?"], descripcion: "Mostrar u ocultar esta ayuda" },
]

export interface UseAtajosPosOptions {
  /** Apaga todo (otra pantalla u otro diálogo encima). */
  enabled?: boolean
  /** El cuadro de cobro está abierto: valen los métodos de pago. */
  cobroAbierto: boolean
  /** La ayuda está abierta: Esc la cierra primero. */
  ayudaAbierta: boolean
  /** Hay algo que cobrar; sin eso F4 no hace nada. */
  puedeCobrar: boolean
  onBuscar: () => void
  onCobrar: () => void
  /** +1 o -1 sobre la línea seleccionada. */
  onCantidad: (delta: 1 | -1) => void
  /** Índice 0..3 dentro de {@link METODOS_ATAJO}. */
  onMetodo: (indice: number) => void
  /** Esc: cierra la ayuda. El cierre del cobro lo hace su propio escucha. */
  onCerrar: () => void
  onAyuda: () => void
}

/** ¿El foco está en algo donde se teclea texto? */
export function esCampoDeTexto(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true
  if (el.tagName !== "INPUT") return false
  const tipo = (el as HTMLInputElement).type
  return !["checkbox", "radio", "button", "submit", "reset"].includes(tipo)
}

/** Traduce un evento a la acción del POS, o null si no es un atajo nuestro. */
export function accionDeTecla(
  e: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  enCampo: boolean,
): { accion: AtajoPosAccion; indice?: number; delta?: 1 | -1 } | null {
  if (e.ctrlKey || e.metaKey) return null

  if (e.altKey) {
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code ?? "")
    if (m && !e.shiftKey) return { accion: "metodo", indice: Number(m[1]) - 1 }
    return null
  }

  switch (e.key) {
    case "F2":
      return { accion: "buscar" }
    case "F4":
      return { accion: "cobrar" }
    case "F6":
    case "F7":
    case "F8":
    case "F9":
      return { accion: "metodo", indice: Number(e.key.slice(1)) - 6 }
    case "Escape":
      return { accion: "cerrar" }
  }

  if (enCampo) return null
  switch (e.key) {
    case "+":
    case "=":
      return { accion: "mas", delta: 1 }
    case "-":
    case "−":
      return { accion: "menos", delta: -1 }
    case "?":
      return { accion: "ayuda" }
  }
  return null
}

export function useAtajosPos(opts: UseAtajosPosOptions) {
  // Siempre la última versión de las opciones, sin recolgar el escucha en
  // cada render (los callbacks de la página se recrean con cada pulsación).
  const ref = React.useRef(opts)
  React.useEffect(() => {
    ref.current = opts
  })

  const enabled = opts.enabled ?? true
  React.useEffect(() => {
    if (!enabled) return
    function alPulsar(e: KeyboardEvent) {
      if (e.isComposing || e.defaultPrevented) return
      const o = ref.current
      const r = accionDeTecla(e, esCampoDeTexto(e.target))
      if (!r) return

      const libre = !o.cobroAbierto && !o.ayudaAbierta
      let hecho = false
      switch (r.accion) {
        case "buscar":
          if (libre) {
            o.onBuscar()
            hecho = true
          }
          break
        case "cobrar":
          if (!e.repeat && libre && o.puedeCobrar) {
            o.onCobrar()
            hecho = true
          }
          break
        case "mas":
        case "menos":
          if (libre && r.delta) {
            o.onCantidad(r.delta)
            hecho = true
          }
          break
        case "metodo":
          if (o.cobroAbierto && !o.ayudaAbierta && r.indice !== undefined) {
            o.onMetodo(r.indice)
            hecho = true
          }
          break
        case "ayuda":
          o.onAyuda()
          hecho = true
          break
        case "cerrar":
          // Solo cierra la ayuda; el cobro tiene su propio Esc.
          if (o.ayudaAbierta) {
            o.onCerrar()
            hecho = true
          }
          break
      }
      if (hecho) e.preventDefault()
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [enabled])
}
