/**
 * Qué trae la última versión, para contárselo a quien abre el sistema.
 *
 * Nadie lee un `CHANGELOG.md` en GitHub: quien usa esto está detrás de un
 * mostrador. Si una función nueva no se anuncia dentro de la aplicación,
 * sencillamente no existe — se queda ahí sin que nadie la encuentre.
 *
 * Para anunciar una versión nueva: cambia `NOVEDADES` por la de esa versión y
 * ya. El número es la clave de todo: en cuanto no coincide con el que la
 * persona vio, la tarjeta vuelve a salir.
 */

export interface PuntoNovedad {
  /** Dónde está, con el nombre que sale en el menú: "Inventario → Conteo". */
  donde: string
  /** Qué hace, en una frase y sin jerga. */
  texto: string
}

export interface Novedad {
  version: string
  /** Legible, no ISO: se muestra tal cual. */
  fecha: string
  titulo: string
  /** Una frase que resuma por qué vale la pena mirar. */
  resumen: string
  puntos: PuntoNovedad[]
}

export const NOVEDADES: Novedad = {
  version: "1.1.0",
  fecha: "12 de septiembre de 2026",
  titulo: "Diez cosas nuevas",
  resumen:
    "La actualización más grande hasta ahora. Esto es lo que puedes hacer desde hoy.",
  puntos: [
    {
      donde: "Inventario → ficha del insumo",
      texto:
        "Dices cómo compras cada cosa —“bulto de 25 kg”— y de ahí salen solos los precios, las entradas y el costo de tus recetas.",
    },
    {
      donde: "Inventario → Conteo",
      texto:
        "Cuentas toda la bodega en una sola planilla y se ajusta de un golpe. Se puede imprimir en blanco para recorrerla con un lápiz.",
    },
    {
      donde: "Inventario → Rastrear lote",
      texto:
        "Escribes el código de un lote y ves a qué ventas y a qué clientes se fue, aunque haya pasado por producción.",
    },
    {
      donde: "Inventario → Merma",
      texto:
        "Qué se botó, por qué y cuánto costó. Ordenado por la plata perdida, no por la cantidad.",
    },
    {
      donde: "Productos → Listas de precios",
      texto:
        "Precio de mayorista y de detal. Se lo asignas al cliente y se le cobra solo, sin que nadie tenga que acordarse de descontar.",
    },
    {
      donde: "Punto de venta → Ventas",
      texto:
        "Devolver parte de una venta: si se llevó diez y trae dos, devuelves esas dos con su motivo y su plata.",
    },
    {
      donde: "Punto de venta → al cobrar",
      texto:
        "Dividir la cuenta de una mesa, por ítem o en partes iguales. La cuenta queda abierta hasta que no falte nada.",
    },
    {
      donde: "Sedes → ficha de la sede",
      texto:
        "Zonas de domicilio con su tarifa: Laureles $5.000, Belén $7.000. Y una casilla a mano para el pedido raro.",
    },
    {
      donde: "Punto de venta → Domicilios",
      texto:
        "Las entregas del día, con el teléfono para llamar de una, y cuánta plata trae cada repartidor al volver.",
    },
    {
      donde: "Compras → factura por foto",
      texto:
        "Registras la factura tal como está en el papel, en bultos, y el sistema traduce a gramos solo.",
    },
  ],
}

/** Lo que se guarda en el navegador de cada persona. */
export interface VistoNovedades {
  version: string
  /** Marca de tiempo de la última vez que se mostró. */
  vistaEn: number
  /** La cerró con el botón: ya no hay que volver a mostrarla. */
  cerrada: boolean
}

export const CLAVE_NOVEDADES = "bookipos.novedades"

const DIA_EN_MS = 24 * 60 * 60 * 1000

/**
 * Si hay que mostrar la tarjeta.
 *
 * La regla busca el punto medio entre que nadie se entere y que la tarjeta se
 * vuelva un estorbo:
 *
 * - Versión nueva → se muestra, aunque la anterior se hubiera cerrado.
 * - Ya la cerró con el botón → no se vuelve a mostrar esa versión. Cerrarla es
 *   decir "ya la leí", y repetírsela sería castigar a quien sí la leyó.
 * - La vio hace menos de 24 horas → no se repite. Si no, saldría en cada
 *   navegación entre pantallas, que es lo que hace que la gente cierre sin leer.
 * - Si no la cerró y ya pasó un día → vuelve a salir. Quien la despachó sin
 *   leer tiene otra oportunidad al día siguiente.
 */
export function debeMostrarse(
  visto: VistoNovedades | null,
  version: string,
  ahora: number,
): boolean {
  if (!visto || visto.version !== version) return true
  if (visto.cerrada) return false
  return ahora - visto.vistaEn >= DIA_EN_MS
}

/**
 * Lee lo guardado. Devuelve `null` ante cualquier problema — ventana privada,
 * datos borrados, un navegador que bloquea el almacenamiento — porque no poder
 * leer esto nunca debe impedir entrar al sistema.
 */
export function leerVisto(): VistoNovedades | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_NOVEDADES)
    if (!crudo) return null
    const dato = JSON.parse(crudo) as Partial<VistoNovedades>
    if (typeof dato?.version !== "string") return null
    return {
      version: dato.version,
      vistaEn: typeof dato.vistaEn === "number" ? dato.vistaEn : 0,
      cerrada: dato.cerrada === true,
    }
  } catch {
    return null
  }
}

export function guardarVisto(visto: VistoNovedades): void {
  try {
    window.localStorage.setItem(CLAVE_NOVEDADES, JSON.stringify(visto))
  } catch {
    // Sin poder guardar, la tarjeta saldrá otra vez. Es molesto, pero es
    // preferible a romper la pantalla por no poder escribir una preferencia.
  }
}
