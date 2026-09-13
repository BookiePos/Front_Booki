/**
 * Qué trae la última versión, para contárselo a quien abre el sistema.
 *
 * Nadie lee un `CHANGELOG.md` en GitHub: quien usa esto está detrás de un
 * mostrador. Si una función nueva no se anuncia dentro de la aplicación,
 * sencillamente no existe — se queda ahí sin que nadie la encuentre.
 *
 * Para anunciar una versión nueva: cambia `NOVEDADES` por la de esa versión y
 * ya. La tarjeta sale sola al iniciar sesión.
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
  version: "1.2.0",
  fecha: "12 de septiembre de 2026",
  titulo: "Cobrar más rápido y buscar en todo",
  resumen:
    "Cinco cambios en el punto de venta y en los productos. Esto es lo que puedes hacer desde hoy.",
  puntos: [
    {
      donde: "Punto de venta → al cobrar",
      texto:
        "Escribes con cuánto paga el cliente y sale la devuelta exacta, en grande. Con Enter confirmas el cobro.",
    },
    {
      donde: "Punto de venta → al cobrar → Cliente",
      texto:
        "Consumidor final o cliente registrado, y un botón para agregar un cliente nuevo sin salir del cobro.",
    },
    {
      donde: "Punto de venta → al cobrar → Vendedor",
      texto:
        "Escoges quién atendió. Queda en el recibo y en Ventas, aunque haya cobrado otra persona.",
    },
    {
      donde: "Punto de venta → barra de arriba",
      texto:
        "Un buscador para todo: escribes “galleta” y ves el producto, sus existencias, las ventas que la llevaron y los clientes. Tocas y te lleva. También con Ctrl K.",
    },
    {
      donde: "Productos → ficha del producto → Empaque",
      texto:
        "Dices qué bolsa, caja o vaso gasta cada producto y se descuenta solo al vender, con su costo. La bolsa de más se anota al cobrar, en “Empaque extra”.",
    },
  ],
}

/**
 * Marca de "ya la vio en esta sesión", guardada por pestaña.
 *
 * Va en `sessionStorage` y no en `localStorage` a propósito: se borra al cerrar
 * el navegador y al iniciar sesión, que es justo cuando el dueño pidió verla
 * otra vez. Antes se guardaba para siempre y, cerrada una vez con "Entendido",
 * no volvía a salir nunca para esa versión.
 */
export const CLAVE_NOVEDADES_SESION = "bookipos.novedades.sesion"

/**
 * Si hay que mostrar la tarjeta: cada vez que se inicia sesión o se abre el
 * sistema en un navegador recién abierto, y no otra vez dentro de la misma
 * sesión —si saliera en cada cambio de pantalla, la gente la cerraría sin
 * leer—.
 *
 * Una versión nueva publicada a mitad de sesión también la hace salir: la marca
 * guarda el número de versión, no un sí o un no.
 */
export function debeMostrarse(vistaEnSesion: string | null, version: string): boolean {
  return vistaEnSesion !== version
}

/**
 * Lee la marca. Devuelve `null` ante cualquier problema — ventana privada, un
 * navegador que bloquea el almacenamiento — porque no poder leer esto nunca
 * debe impedir entrar al sistema.
 */
export function leerVistaEnSesion(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_NOVEDADES_SESION)
  } catch {
    return null
  }
}

export function marcarVistaEnSesion(version: string): void {
  try {
    window.sessionStorage.setItem(CLAVE_NOVEDADES_SESION, version)
  } catch {
    // Sin poder guardar, la tarjeta saldrá otra vez al cambiar de pantalla. Es
    // molesto, pero es preferible a romper la pantalla por una preferencia.
  }
}

/** Al iniciar sesión: que la tarjeta vuelva a salir al entrar. */
export function pedirNovedadesAlEntrar(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_NOVEDADES_SESION)
  } catch {
    // Si no se puede borrar tampoco se pudo guardar, así que igual saldrá.
  }
}
