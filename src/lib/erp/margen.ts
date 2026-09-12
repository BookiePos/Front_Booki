/**
 * Semáforo de margen: traduce un porcentaje de utilidad a "voy bien / me estoy
 * saliendo del presupuesto / estoy perdiendo plata".
 *
 * El umbral no viene del backend a propósito. Cuánto hay que ganarle a un
 * producto depende del negocio —una galletería artesanal no aspira al mismo
 * margen que un mayorista— y además es una preferencia de LECTURA: cambiarla no
 * altera ningún dato, solo cómo se pintan las filas. Por eso vive en el
 * dispositivo, igual que el tema claro/oscuro.
 */

/** Margen objetivo por defecto, en % sobre el precio de venta. */
export const MARGEN_MINIMO_POR_DEFECTO = 35

const CLAVE = "bookipos.margenMinimo"

export type NivelMargen = "bueno" | "bajo" | "perdida" | "sinDato"

/**
 * Tres bandas, no cinco, porque la decisión que habilitan es binaria: subir el
 * precio o no. Ámbar = todavía gana, pero menos de lo que el dueño se propuso.
 * Rojo = cada venta cuesta plata.
 */
export function nivelMargen(
  pct: number | undefined | null,
  minimo: number,
): NivelMargen {
  if (pct === undefined || pct === null || Number.isNaN(pct)) return "sinDato"
  if (pct < 0) return "perdida"
  if (pct < minimo) return "bajo"
  return "bueno"
}

/** Clases y rótulo de cada nivel. Solo tokens de color: se ve en ambos temas. */
export const ESTILOS_MARGEN: Record<
  NivelMargen,
  { punto: string; texto: string; etiqueta: string; ayuda: string }
> = {
  bueno: {
    punto: "bg-success",
    texto: "text-success-ink",
    etiqueta: "Va bien",
    ayuda: "El margen está en tu objetivo o por encima.",
  },
  bajo: {
    punto: "bg-warning",
    texto: "text-warning-ink",
    etiqueta: "Por debajo",
    ayuda:
      "Todavía ganas, pero menos de lo que te propusiste. Suele pasar cuando sube un insumo: revisa el precio de venta.",
  },
  perdida: {
    punto: "bg-destructive",
    texto: "text-destructive",
    etiqueta: "Pierdes",
    ayuda: "Te cuesta más fabricarlo de lo que lo vendes. Corrige ya.",
  },
  sinDato: {
    punto: "bg-muted-foreground/40",
    texto: "text-muted-foreground",
    etiqueta: "Sin precio",
    ayuda: "Aún no está publicado en Productos, así que no hay con qué comparar.",
  },
}

/** Margen en % sobre el precio de venta. Devuelve undefined si no hay precio. */
export function calcularMargenPct(
  precioVenta: number | undefined,
  costoUnitario: number | undefined,
): number | undefined {
  if (!precioVenta || precioVenta <= 0) return undefined
  if (costoUnitario === undefined || costoUnitario === null) return undefined
  return Math.round(((precioVenta - costoUnitario) / precioVenta) * 100)
}

function normalizar(valor: unknown): number | null {
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  // 0 y 100 no tienen sentido como objetivo: dejarían el semáforo siempre en
  // verde o siempre en rojo, que es lo mismo que no tenerlo.
  if (n < 1 || n > 99) return null
  return Math.round(n)
}

export function leerMargenMinimo(): number {
  if (typeof window === "undefined") return MARGEN_MINIMO_POR_DEFECTO
  try {
    return (
      normalizar(window.localStorage.getItem(CLAVE)) ??
      MARGEN_MINIMO_POR_DEFECTO
    )
  } catch {
    // Navegador con almacenamiento bloqueado: se sigue con el valor por defecto.
    return MARGEN_MINIMO_POR_DEFECTO
  }
}

/**
 * Oyentes del umbral.
 *
 * Se expone como store suscribible —y no como un `useState` que lee
 * localStorage en un efecto— porque el valor guardado no existe en el servidor:
 * con un efecto, la primera pintura saldría siempre con 35 y el semáforo
 * cambiaría de color medio segundo después. `useSyncExternalStore` deja que
 * React haga esa transición sin cascada de renders.
 */
const oyentes = new Set<() => void>()

export function suscribirMargenMinimo(alCambiar: () => void): () => void {
  oyentes.add(alCambiar)
  // El evento `storage` solo lo disparan LAS OTRAS pestañas: sin él, tener el
  // panel abierto dos veces mostraría dos umbrales distintos.
  const alStorage = (e: StorageEvent) => {
    if (e.key === CLAVE) alCambiar()
  }
  window.addEventListener("storage", alStorage)
  return () => {
    oyentes.delete(alCambiar)
    window.removeEventListener("storage", alStorage)
  }
}

/** Instantánea para el servidor y para la hidratación. */
export function margenMinimoDelServidor(): number {
  return MARGEN_MINIMO_POR_DEFECTO
}

export function guardarMargenMinimo(valor: number): void {
  const limpio = normalizar(valor)
  if (limpio === null || typeof window === "undefined") return
  try {
    window.localStorage.setItem(CLAVE, String(limpio))
  } catch {
    // Sin persistencia el umbral dura lo que la pestaña. No es motivo de error.
  }
  for (const oyente of oyentes) oyente()
}
