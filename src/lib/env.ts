/**
 * Variables de entorno del frontend, leídas en un solo sitio.
 *
 * Todo lo que empieza por `NEXT_PUBLIC_` se incrusta en el bundle DURANTE EL
 * BUILD: hay que tenerlas presentes donde corre `pnpm build`, y cambiarlas
 * obliga a reconstruir. Por eso conviene que el resto del código importe estas
 * constantes en vez de tocar `process.env` suelto — así se ve de un vistazo
 * qué necesita el entorno de despliegue.
 */

/** Dominio público por defecto (producción). */
const DEFAULT_SITE_URL = "https://www.bookipos.com"

/**
 * Origen público del sitio, sin barra final.
 *
 * Lo usan los metadatos (`metadataBase`) para resolver las imágenes de Open
 * Graph y los enlaces canónicos. Tiene que ser una URL ABSOLUTA: WhatsApp, X o
 * LinkedIn descargan la imagen desde su propio servidor y una ruta relativa no
 * les dice nada.
 *
 * Se lee del entorno para que un despliegue de preview o de staging no anuncie
 * el dominio de producción en sus tarjetas ni en sus canónicos, que es como se
 * acaba indexando el entorno equivocado.
 */
export const SITE_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
)

/**
 * Valida y limpia el origen. Si la variable llega mal escrita se cae al
 * dominio de producción en vez de reventar el build: un metadato equivocado es
 * mucho menos grave que un despliegue que no compila.
 */
function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return DEFAULT_SITE_URL
  }
}
