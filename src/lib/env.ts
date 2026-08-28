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

/** URL base del backend en desarrollo, cuando no hay variable definida. */
const DEV_API_URL = "http://localhost:3001"

/**
 * URL base de la API, sin barra final.
 *
 * A diferencia de SITE_URL, aquí NO se degrada en silencio. Un frontend de
 * producción apuntando a `localhost:3001` no falla al desplegar: falla en el
 * navegador de quien intenta entrar, con un ERR_CONNECTION_REFUSED que no dice
 * nada sobre la causa real (la variable no llegó al build). Preferimos romper
 * el build, que es donde el error se ve y se arregla.
 *
 * Recuerda que `NEXT_PUBLIC_*` se incrusta DURANTE el build: definir la
 * variable en el panel de despliegue no basta, hay que reconstruir después.
 */
export const API_URL = resolveApiUrl()

function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
  const isProd = process.env.NODE_ENV === "production"
  // En el build (y en el render de servidor) sí podemos abortar: el error sale
  // en los logs del despliegue. En el navegador no lanzamos, porque dejaría la
  // app en blanco; ahí basta con dejar el motivo claro en consola.
  const isBuild = typeof window === "undefined"

  if (!raw) {
    if (isProd && isBuild) {
      throw new Error(
        'NEXT_PUBLIC_API_URL no está definida. El frontend de producción no puede ' +
          'apuntar a localhost. Defínela en las variables de entorno del despliegue ' +
          '(ej. https://api.bookipos.com) y VUELVE A CONSTRUIR: las NEXT_PUBLIC_* se ' +
          'incrustan en el bundle durante el build, no se leen en runtime.',
      )
    }
    if (isProd) {
      console.error(
        '[BookiPos] NEXT_PUBLIC_API_URL no llegó al build: las llamadas irán a ' +
          `${DEV_API_URL} y fallarán. Defínela en el despliegue y reconstruye.`,
      )
    }
    return DEV_API_URL
  }

  // Sin esquema, `${API_URL}/auth/login` queda como ruta relativa y las
  // peticiones acaban contra el propio dominio del frontend (un 404), en vez de
  // contra la API. Es un error fácil de cometer al copiar el dominio a mano.
  if (!/^https?:\/\//i.test(raw)) {
    const msg =
      `NEXT_PUBLIC_API_URL="${raw}" no incluye el esquema. Debe ser una URL ` +
      'absoluta, por ejemplo https://api.bookipos.com'
    if (isBuild) throw new Error(msg)
    console.error(`[BookiPos] ${msg}`)
    return DEV_API_URL
  }

  return raw.replace(/\/+$/, "")
}
