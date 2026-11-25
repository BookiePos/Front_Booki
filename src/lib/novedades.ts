/**
 * Qué trae la última versión, para contárselo a quien abre el sistema.
 *
 * Nadie lee un `CHANGELOG.md` en GitHub: quien usa esto está detrás de un
 * mostrador. Si una función nueva no se anuncia dentro de la aplicación,
 * sencillamente no existe — se queda ahí sin que nadie la encuentre.
 *
 * Hasta la 1.5.0 cada página traía un dibujo esquemático, y el dueño fue claro:
 * parecía a medio construir. Nadie entiende un cambio por un esquema; lo
 * entiende viéndolo. Desde la 1.6.0 cada página muestra el sistema DE VERDAD:
 *
 * - un **video** corto grabado sobre la aplicación real (con datos de prueba),
 *   donde se ve la función funcionando, o
 * - un **antes y ahora** que se arrastra para comparar la misma pantalla.
 *
 * Los archivos viven en `public/novedades/<versión>/`. Se graban con el stack
 * local levantado; el guion de grabación y el armado con ffmpeg están descritos
 * en `public/novedades/README.md`.
 *
 * Para anunciar una versión nueva: cambia `NOVEDADES` por la de esa versión,
 * graba sus clips y ya. La tarjeta sale sola al iniciar sesión.
 */

/** Lo que se ve en la página: el sistema real, nunca un dibujo. */
export type MediaNovedad =
  | {
      tipo: "video"
      /** MP4 (H.264): lo reproduce cualquier navegador, también el de un celular viejo. */
      src: string
      /** Primer cuadro, mientras carga o si la persona pidió menos movimiento. */
      poster: string
      /** Qué se ve en el video, para quien no lo ve. */
      descripcion: string
    }
  | {
      tipo: "comparar"
      /** Varias pantallas para comparar; la primera es la que abre. */
      vistas: { nombre: string; antes: string; ahora: string }[]
      descripcion: string
    }

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
  media: MediaNovedad
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

const R = "/novedades/1.6.0"

export const NOVEDADES: Novedad = {
  version: "1.6.0",
  fecha: "noviembre de 2026",
  titulo: "BookiPos por dentro, de nuevo",
  resumen:
    "Pantallas más limpias, una caja que se abre contando billetes, el total del cliente imposible de no ver y la nómina por quincenas.",
  paginas: [
    {
      titulo: "Las mismas pantallas, más fáciles de leer",
      gancho: "Arrastra la línea y compara: así se veía y así se ve ahora.",
      media: {
        tipo: "comparar",
        vistas: [
          { nombre: "Inicio", antes: `${R}/inicio-antes.webp`, ahora: `${R}/inicio-ahora.webp` },
          { nombre: "Nómina", antes: `${R}/nomina-antes.webp`, ahora: `${R}/nomina-ahora.webp` },
          { nombre: "Punto de venta", antes: `${R}/pos-antes.webp`, ahora: `${R}/pos-ahora.webp` },
        ],
        descripcion:
          "Comparación de la pantalla de Inicio, de Nómina y del punto de venta antes y después del cambio.",
      },
      puntos: [
        {
          donde: "Todas las pantallas",
          texto: "Menos cajas y sombras, letra más clara y cifras alineadas para leer la plata de un vistazo.",
          ruta: "/panel",
          etiquetaRuta: "Ir al Inicio",
        },
        {
          donde: "Inicio",
          texto: "Lo que vendiste hoy, en grande, frente al mismo día de la semana pasada.",
        },
        {
          donde: "Tema oscuro",
          texto: "Para el turno de noche: un gris suave que no cansa, en el panel y en la caja.",
        },
      ],
    },
    {
      titulo: "Siempre sabes en qué parte estás",
      gancho: "El menú marca tu sección en morado y cada sección tiene su propio fondo.",
      media: {
        tipo: "video",
        src: `${R}/fondo.mp4`,
        poster: `${R}/fondo.jpg`,
        descripcion:
          "Se pasa del Inicio a Inventario y a Gastos desde el menú: la opción elegida queda en morado y las manchas suaves del fondo cambian de lugar.",
      },
      puntos: [
        {
          donde: "Menú de la izquierda",
          texto: "La opción que eliges queda en morado apenas le das clic, sin esperar a que cargue.",
          ruta: "/panel",
          etiquetaRuta: "Probar el menú",
        },
        {
          donde: "El fondo",
          texto: "Unas manchas moradas muy suaves que se mueven al cambiar de sección. Casi no se notan, y así debe ser.",
        },
      ],
    },
    {
      titulo: "Abrir la caja ya es contar billetes",
      gancho: "Escribes cuántos billetes de cada uno tienes y el sistema suma por ti.",
      media: {
        tipo: "video",
        src: `${R}/caja.mp4`,
        poster: `${R}/caja.jpg`,
        descripcion:
          "Se abre la caja de la Sede Norte escribiendo la cantidad de billetes de 100.000, 50.000, 20.000 y 10.000; el total se va sumando solo.",
      },
      puntos: [
        {
          donde: "Terminal → Caja",
          texto: "Cuenta por billete y moneda, o escribe solo el total si ya lo contaste.",
          ruta: "/pos/caja",
          etiquetaRuta: "Abrir la caja",
        },
        {
          donde: "Terminal → Caja",
          texto: "Enter pasa al siguiente billete y las flechas suben o bajan de a uno: no hace falta el ratón.",
        },
        {
          donde: "Terminal → Caja",
          texto: "Te muestra con cuánto cerró el turno anterior y un botón para usar esa misma base.",
        },
      ],
    },
    {
      titulo: "El total del cliente, imposible de no ver",
      gancho: "Grande, en morado y con un brillo suave cada vez que cambia.",
      media: {
        tipo: "video",
        src: `${R}/cobro.mp4`,
        poster: `${R}/cobro.jpg`,
        descripcion:
          "Se agregan una hamburguesa, una gaseosa y unas papas al pedido; el total en morado cambia con cada producto.",
      },
      puntos: [
        {
          donde: "Terminal → Venta",
          texto: "Cada producto que agregas hace pasar un brillo por el total: sabes que sumó sin mirar dos veces.",
          ruta: "/pos",
          etiquetaRuta: "Ir a vender",
        },
        {
          donde: "Terminal → Cobrar",
          texto: "Todos los números tienen el mismo ancho: no bailan al cambiar y se leen desde lejos.",
        },
      ],
    },
    {
      titulo: "Ahora puedes pagar la nómina por quincenas",
      gancho: "El 15 pagas la primera mitad, con sus horas extra; el 30, el resto.",
      media: {
        tipo: "video",
        src: `${R}/quincena.mp4`,
        poster: `${R}/quincena.jpg`,
        descripcion:
          "En Nómina se elige pagar por quincenas y aparece la primera quincena de cada trabajador con sus días, sueldo, horas extra, recargos y descuentos.",
      },
      puntos: [
        {
          donde: "Nómina → Pagar nómina",
          texto: "El 15: sueldo de esos días, horas extra y recargos de esos turnos, menos salud y pensión.",
          ruta: "/panel/nomina",
          etiquetaRuta: "Ir a Nómina",
        },
        {
          donde: "Nómina → Pagar nómina",
          texto: "El 30: lo que falta del mes, con la retención y los descuentos. Lo de la primera quincena ya viene restado.",
        },
        {
          donde: "Nómina → Pagar nómina",
          texto: "Puedes pagarle menos de lo calculado a alguien, nunca más. Si te equivocas, la anulas antes de cerrar el mes.",
        },
      ],
    },
    {
      titulo: "Los valores de ley de 2026, ya cargados",
      gancho: "Salario mínimo, auxilio de transporte y recargos, listos y con su norma.",
      media: {
        tipo: "video",
        src: `${R}/valores.mp4`,
        poster: `${R}/valores.jpg`,
        descripcion:
          "En Nómina → Valores de ley se ven el salario mínimo, el auxilio de transporte y los recargos de 2026; al pulsar Cambiar valores aparece un aviso antes de editarlos.",
      },
      puntos: [
        {
          donde: "Nómina → Valores de ley",
          texto: "Salario mínimo de $1.750.905 y auxilio de $249.095: los de 2026, ya puestos.",
          ruta: "/panel/nomina",
          etiquetaRuta: "Ver los valores",
        },
        {
          donde: "Nómina → Valores de ley",
          texto: "Antes de cambiar uno te pregunta si estás seguro y te dice cuál es el de ley.",
        },
        {
          donde: "Nómina → Valores de ley",
          texto: "Los recargos no te dejan quedar por debajo de la ley; por encima sí, si así lo pactaste.",
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
