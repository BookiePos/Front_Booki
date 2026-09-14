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
  version: "1.3.0",
  fecha: "13 de septiembre de 2026",
  titulo: "Más fácil de cobrar, de ordenar y de escribir",
  resumen:
    "Tres cambios grandes en esta versión. Cada punto trae un botón que te lleva a la pantalla donde está.",
  paginas: [
    {
      titulo: "Cobrar sin perder de vista nada",
      gancho:
        "La pantalla de cobro ahora usa todo el monitor. Lo ves todo junto, sin subir y bajar.",
      icono: "cobro",
      ilustracion: "columnas-cobro",
      puntos: [
        {
          donde: "Punto de venta → al cobrar",
          texto:
            "Tres columnas a la vista: lo que estás cobrando, el pago con la devuelta, y el cliente con el domicilio.",
          ruta: "/pos",
          etiquetaRuta: "Ir al punto de venta",
        },
        {
          donde: "Punto de venta → al cobrar",
          texto:
            "El total y el botón de cobrar se quedan fijos. Por largo que sea el formulario, no se pierden de vista.",
          ruta: "/pos",
          etiquetaRuta: "Ver la pantalla de cobro",
        },
        {
          donde: "Punto de venta → toda la pantalla",
          texto:
            "Menos huecos vacíos y letra más grande. La caja aprovecha lo ancho del monitor.",
          ruta: "/pos",
          etiquetaRuta: "Abrir el terminal",
        },
      ],
    },
    {
      titulo: "El inventario va primero",
      gancho:
        "Primero anotas lo que compras. Después armas lo que vendes. La pantalla te lleva de la mano.",
      icono: "inventario",
      ilustracion: "orden-inventario",
      puntos: [
        {
          donde: "Inventario → al entrar",
          texto:
            "El orden está a la vista: Inventario primero, Productos después, con su botón para pasar al paso siguiente.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ir a Inventario",
        },
        {
          donde: "Inventario → pestañas",
          texto:
            "Cada pestaña dice qué se ve ahí. Los botones sueltos quedaron juntos en un menú de herramientas.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ver las pestañas",
        },
        {
          donde: "Productos → producto nuevo",
          texto:
            "Si no tienes nada en inventario, el sistema te avisa y te lleva a crearlo. Ya no se arman productos vacíos.",
          ruta: "/panel/productos",
          etiquetaRuta: "Ir a Productos",
        },
      ],
    },
    {
      titulo: "Escribir cifras sin contar ceros",
      gancho:
        "Los precios se puntúan solos y cada unidad se llama por su nombre completo.",
      icono: "cifras",
      ilustracion: "cifras-claras",
      puntos: [
        {
          donde: "En todo el sistema → precios y costos",
          texto:
            "Escribes 45000 y aparece $45.000. El punto de los miles lo pone el sistema: se acabó contar ceros.",
          ruta: "/panel/productos",
          etiquetaRuta: "Ir a Productos",
        },
        {
          donde: "Inventario → unidad de medida",
          texto:
            "Se leen completas: Gramo, Kilogramo, Litro, Mililitro, Libra y Arroba. La arroba son 12,5 kilos y antes no estaba.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ir a Inventario",
        },
        {
          donde: "Inventario → presentación de compra",
          texto:
            "El bulto va con su contenido al lado: uno de harina trae 25 kilos y uno de papa trae 50. El sistema hace la cuenta.",
          ruta: "/panel/inventario",
          etiquetaRuta: "Ver las presentaciones",
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
