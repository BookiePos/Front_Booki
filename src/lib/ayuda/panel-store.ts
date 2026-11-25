/**
 * Si el panel de Ayuda está abierto. Un almacén mínimo y no un contexto: lo
 * abren botones que viven en sitios distintos (la barra del panel, la del
 * terminal, la invitación de la primera visita) y lo pinta un solo componente
 * por shell. Con un contexto habría que envolver ambos shells sin necesidad.
 */
import * as React from "react"

let abierto = false
const oyentes = new Set<() => void>()

function avisar() {
  for (const o of oyentes) o()
}

export function abrirAyuda(): void {
  abierto = true
  avisar()
}

export function cerrarAyuda(): void {
  abierto = false
  avisar()
}

export function useAyudaAbierta(): boolean {
  return React.useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => abierto,
    () => false,
  )
}
