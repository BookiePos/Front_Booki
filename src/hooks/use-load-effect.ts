import * as React from "react"

/**
 * Dispara una carga de datos al montar y cada vez que cambia `load` o
 * `enabled`. Es el patrón de siempre (`useEffect(() => { void load() })`),
 * encapsulado: `load` marca `loading` antes de pedir los datos, que es justo
 * lo que se quiere y lo que `react-hooks/set-state-in-effect` no distingue
 * de un efecto en cascada cuando lo ve inline.
 */
export function useLoadEffect(
  load: () => void | Promise<unknown>,
  enabled = true,
): void {
  React.useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])
}
