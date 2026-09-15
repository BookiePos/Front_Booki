/**
 * Qué trae la última versión, para contárselo a quien abre el sistema.
 *
 * Nadie lee un `CHANGELOG.md` en GitHub: quien usa esto está detrás de un
 * mostrador. Si una función nueva no se anuncia dentro de la aplicación,
 * sencillamente no existe — se queda ahí sin que nadie la encuentre.
 *
 * Hasta la 1.2.0 esto era una sola lista de cinco párrafos en letra pequeña, y
 * el dueño dijo lo que había que oír: en una sola página todo se veía muy
 * pequeño y no se entendía. Una pared de texto no se lee, se cierra. Así que la
 * novedad ya no es una lista: son páginas. Una idea por página, una frase corta
 * por punto, un dibujo que explique el cambio sin tener que leerlo y un botón
 * que lleve directo a la pantalla donde está esa función.
 *
 * Para anunciar una versión nueva: cambia `NOVEDADES` por la de esa versión y
 * ya. La tarjeta sale sola al iniciar sesión.
 */

/** Icono de la cabecera de cada página. El componente decide cuál pinta. */
export type IconoNovedad = "cobro" | "inventario" | "cifras"

/**
 * Qué esquema se dibuja en la página.
 *
 * Es una palabra y no un dibujo a propósito: este archivo lo edita quien
 * redacta el anuncio de la versión, y aquí no debe haber nada de pintura. El
 * componente traduce la palabra al SVG que le corresponde.
 */
export type IlustracionNovedad =
  | "columnas-cobro"
  | "orden-inventario"
  | "cifras-claras"

export interface PuntoNovedad {
  /** Dónde está, con el nombre que sale en el menú: "Inventario → Conteo". */
  donde: string
  /** Qué hace. Una frase corta y sin jerga; si pide tres renglones, sobra. */
  texto: string
  /**
   * A dónde lleva el botón del punto. Siempre ruta absoluta: la tarjeta sale
   * igual en el panel y en el terminal, y una ruta relativa acabaría en sitios
   * distintos según desde dónde se abra.
   */
  ruta?: string
  /** Texto del botón. Sin `ruta` no se pinta ningún botón. */
  etiquetaRuta?: string
}

export interface PaginaNovedad {
  titulo: string
  /** Por qué importa, en una frase. Es lo primero que se lee de la página. */
  gancho: string
  icono: IconoNovedad
  ilustracion: IlustracionNovedad
  /** Tres como mucho: con cuatro la página vuelve a ser una lista apretada. */
  puntos: PuntoNovedad[]
}

export interface Novedad {
  version: string
  /** Legible, no ISO: se muestra tal cual. */
  fecha: string
  titulo: string
  /** Una frase que resuma por qué vale la pena mirar. */
  resumen: string
  paginas: PaginaNovedad[]
}

export const NOVEDADES: Novedad = {
  version: "1.5.0",
  fecha: "15 de septiembre de 2026",
  titulo: "Los empaques, por fin en su sitio",
  resumen:
    "Las bolsas y los vasos ya no están revueltos entre los insumos: tienen sección propia, foto, y en la caja eliges con cuáles sale cada pedido.",
  paginas: [
    {
      titulo: "Una sección solo para tus empaques",
      gancho:
        "Con foto, porque nadie reconoce una bolsa leyendo “BOL-KRAFT-22”.",
      icono: "inventario",
      ilustracion: "orden-inventario",
      puntos: [
        {
          donde: "Inventario → Empaques",
          texto:
            "Bolsas, vasos, cajas y cubiertos viven aquí, cada uno con su foto. Se compran y se cuentan como todo lo demás.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ir a Empaques",
        },
        {
          donde: "Inventario → ficha de cualquier insumo",
          texto:
            "Toda ficha admite foto ahora, y una casilla “Es un empaque” que lo mueve a esa sección.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Abrir Inventario",
        },
        {
          donde: "Inventario → Empaques",
          texto:
            "Si ya tenías bolsas configuradas en las fichas de tus productos, un botón las trae aquí de una vez.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ver cómo quedó",
        },
      ],
    },
    {
      titulo: "En la caja eliges con qué sale el pedido",
      gancho:
        "Y el sistema se va acordando de con qué sueles despachar cada cosa.",
      icono: "cobro",
      ilustracion: "columnas-cobro",
      puntos: [
        {
          donde: "Terminal → Cobrar → Empaques",
          texto:
            "Marcas las bolsas con su foto, o dejas el pedido sin ninguna. Lo que quede marcado es lo que baja del inventario.",
          ruta: "/pos",
          etiquetaRuta: "Ir al terminal",
        },
        {
          donde: "Terminal → Cobrar → Empaques",
          texto:
            "Abre con lo que usaste las últimas veces que vendiste eso mismo. Si nunca lo has vendido, con lo que diga la ficha.",
          ruta: "/pos",
          etiquetaRuta: "Probarlo en una venta",
        },
        {
          donde: "Terminal → el pedido",
          texto:
            "Cada línea del pedido muestra la foto del producto, para revisar de un vistazo lo que se está cobrando.",
          ruta: "/pos",
          etiquetaRuta: "Abrir la caja",
        },
      ],
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
