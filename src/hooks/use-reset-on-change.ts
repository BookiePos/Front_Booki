import * as React from "react"

/**
 * Reinicia estado derivado de props (un formulario que se rellena al abrir un
 * diálogo, un paso que vuelve a 0...) durante el render, no en un efecto: así
 * no hay un render intermedio con los valores viejos ni un setState en cascada.
 *
 * Misma firma que `useEffect`: `reset` corre en el primer render y cada vez
 * que cambia algo de `deps`. Solo debe llamar a `setState` del propio
 * componente; para pedir datos o tocar el DOM sigue siendo un efecto.
 */
export function useResetOnChange(
  reset: () => void,
  deps: readonly unknown[],
): void {
  const [prev, setPrev] = React.useState<readonly unknown[] | null>(null)
  if (
    prev === null ||
    prev.length !== deps.length ||
    prev.some((d, i) => !Object.is(d, deps[i]))
  ) {
    setPrev(deps)
    reset()
  }
}
