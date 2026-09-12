import * as React from "react"

/**
 * Buscador del terminal: lo que se escribe arriba y a qué pantalla lleva.
 *
 * El buscador vive en la barra superior y las pantallas (Venta, Ventas,
 * Inventario) tienen cada una su propio filtro. Para que tocar un resultado
 * deje la pantalla de destino YA filtrada, el buscador deja un "pedido" y la
 * pantalla lo recoge al montarse —o al instante, si ya estaba abierta—.
 *
 * Va por `sessionStorage` y no por la URL a propósito: con `?buscar=` en la
 * dirección, Next obliga a envolver cada página en un `Suspense`, y recargar la
 * pantalla volvería a aplicar un filtro que la persona ya había borrado.
 */

/** Minúsculas y sin tildes: "Galletá" y "galleta" tienen que encontrarse. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/**
 * ¿Aparecen TODAS las palabras buscadas en alguno de los textos?
 *
 * Por palabras y no por frase entera: quien busca "galleta chocolate" quiere
 * encontrar "Galleta de chocolate", y con un `includes` de la frase completa no
 * aparecía nada. Esa era la razón de que el buscador pareciera no servir.
 */
export function coincide(
  consulta: string,
  ...textos: (string | null | undefined)[]
): boolean {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const pajar = normalizar(textos.filter(Boolean).join(" "))
  return palabras.every((p) => pajar.includes(p))
}

export interface PedidoBusqueda {
  /** Pantalla que debe recogerlo: "/pos", "/pos/ventas"… */
  href: string
  /** Lo que se escribe en el filtro de esa pantalla. */
  termino: string
  /** Abrir esta cuenta (mesa) al llegar a la venta. */
  cuentaId?: string
  /** Ir a la lista de cuentas abiertas. */
  verCuentas?: boolean
}

const CLAVE = "pos.buscar"
const EVENTO = "bookipos:pos-buscar"

/** Deja el pedido y avisa a la pantalla, por si ya está abierta. */
export function pedirBusqueda(pedido: PedidoBusqueda): void {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify(pedido))
  } catch {
    // Sin almacenamiento se navega igual; solo que llega sin filtrar.
  }
  window.dispatchEvent(new Event(EVENTO))
}

/** Saca el pedido SOLO si es para esta pantalla; si no, lo deja donde está. */
function tomarPedido(href: string): PedidoBusqueda | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    const pedido = JSON.parse(crudo) as Partial<PedidoBusqueda>
    if (pedido?.href !== href) return null
    window.sessionStorage.removeItem(CLAVE)
    return {
      href,
      termino: typeof pedido.termino === "string" ? pedido.termino : "",
      cuentaId: pedido.cuentaId,
      verCuentas: pedido.verCuentas === true,
    }
  } catch {
    return null
  }
}

/**
 * La pantalla `href` recoge lo que pidió el buscador: al montarse (se llegó
 * desde otra) y cada vez que llega el aviso (ya estaba abierta).
 */
export function useBusquedaPendiente(
  href: string,
  aplicar: (pedido: PedidoBusqueda) => void,
): void {
  // La función cambia en cada render; guardarla en una ref evita volver a
  // suscribirse cada vez y, sobre todo, perder un aviso entre medias.
  const aplicarRef = React.useRef(aplicar)
  React.useEffect(() => {
    aplicarRef.current = aplicar
  })

  React.useEffect(() => {
    let vivo = true
    async function revisar() {
      await Promise.resolve()
      if (!vivo) return
      const pedido = tomarPedido(href)
      if (pedido) aplicarRef.current(pedido)
    }
    function alAviso() {
      void revisar()
    }
    void revisar()
    window.addEventListener(EVENTO, alAviso)
    return () => {
      vivo = false
      window.removeEventListener(EVENTO, alAviso)
    }
  }, [href])
}
