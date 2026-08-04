/**
 * Tipos del sistema de recorridos guiados (tours) de onboarding.
 *
 * Un recorrido es una lista de `TourStep`. El motor vive en
 * `components/onboarding/product-tour.tsx`; los recorridos por sección se
 * declaran como `GuideDescriptor` y se registran en `guides/index.ts`.
 */

export interface TourStep {
  /** Atributo `data-tour` del elemento a resaltar, o null para burbuja centrada. */
  target: string | null
  title: string
  body: string
  /** Antes de mostrar el paso, navega a esta ruta si aún no estamos en ella. */
  navigateTo?: string
  /**
   * Paso interactivo: el usuario debe hacer clic en el elemento resaltado (o
   * completar la acción). El fondo deja pasar los clics y no se muestra el
   * botón "Siguiente"; se avanza solo cuando `advanceWhen` se cumple.
   */
  interactive?: boolean
  /** Si devuelve true, el tour avanza automáticamente al siguiente paso. */
  advanceWhen?: (ctx: { pathname: string }) => boolean
}

/**
 * Descriptor de un recorrido por sección. El botón "Guía" del header activa el
 * recorrido cuyo `match` coincide con la ruta actual.
 */
export interface GuideDescriptor {
  /** Identificador estable y único del recorrido (p. ej. "sede", "inventario"). */
  id: string
  /**
   * Ruta(s) en las que el botón "Guía" dispara este recorrido. Poner los
   * descriptores más específicos primero en el registro (p. ej.
   * `/clientes/directorio` antes que `/clientes`).
   */
  match: RegExp
  /** Construye los pasos del recorrido. */
  build: () => TourStep[]
}
