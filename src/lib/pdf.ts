/**
 * Conversión de PDF a imágenes, en el navegador.
 *
 * La factura electrónica llega por correo en PDF, así que obligar a hacerle una
 * captura de pantalla sería pedirle al usuario que degrade a mano su mejor
 * fuente. Aquí se rasteriza cada página y a partir de ahí el flujo es el mismo
 * que el de una foto.
 *
 * **Se hace aquí y no en el servidor a propósito.** Los dos modelos aceptan PDF,
 * pero por caminos distintos —GLM-OCR lo recibe en el mismo campo que una
 * imagen; Qwen lo maneja en otra API—, así que delegarlo ataría la
 * funcionalidad a un proveedor concreto y rompería la razón de ser de la
 * interfaz intercambiable. Rasterizando aquí, el PDF funciona con cualquier
 * modelo y reutiliza la compresión que ya existe.
 */

/**
 * Tope de páginas que se convierten.
 *
 * Una factura de proveedor tiene una o dos hojas; un PDF de cien páginas es
 * otra cosa (un extracto, un catálogo) y procesarlo entero solo gastaría cuota
 * y tiempo. Se avisa en vez de hacerlo en silencio.
 */
export const MAX_PDF_PAGES = 10

/** Ancho al que se rasteriza cada página, en píxeles. */
const RENDER_WIDTH = 2000

/** Una página del PDF: su imagen y, si el PDF la traía, su texto exacto. */
export interface PdfPage {
  image: File
  /**
   * Capa de texto de la página, si el PDF la tenía y es suficiente.
   *
   * Cuando existe, el backend lee la factura de aquí y **no usa OCR**: los
   * caracteres ya son exactos y reconocerlos otra vez solo puede estropear un
   * precio. Las facturas electrónicas que llegan por correo siempre la traen;
   * un PDF escaneado, no.
   */
  text?: string
}

export interface PdfPagesResult {
  pages: PdfPage[]
  /** Páginas que tenía el PDF, aunque solo se hayan convertido las primeras. */
  totalPages: number
}

/**
 * Caracteres mínimos para fiarse de la capa de texto.
 *
 * Un PDF escaneado suele traer una capa vacía o con cuatro caracteres sueltos
 * del membrete. Por debajo de este umbral no compensa arriesgarse: mejor OCR.
 */
const MIN_TEXT_CHARS = 120

export function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

/**
 * Convierte un PDF en una imagen JPEG por página.
 *
 * `pdfjs-dist` se importa de forma perezosa: pesa lo suyo y solo hace falta
 * cuando alguien sube un PDF, no en cada carga del panel.
 */
export async function pdfToImages(file: File): Promise<PdfPagesResult> {
  const pdfjs = await import("pdfjs-dist")
  // El worker se resuelve desde el propio paquete: así lo empaqueta el bundler
  // y no depende de una copia servida a mano en /public que se desactualice.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>
  try {
    doc = await pdfjs.getDocument({ data }).promise
  } catch (err) {
    throw readablePdfError(err)
  }
  const totalPages = doc.numPages
  const pages: PdfPage[] = []
  const base = file.name.replace(/\.[^.]+$/, "") || "factura"

  try {
    for (let n = 1; n <= Math.min(totalPages, MAX_PDF_PAGES); n += 1) {
      const page = await doc.getPage(n)
      const inicial = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({
        scale: RENDER_WIDTH / inicial.width,
      })

      const canvas = document.createElement("canvas")
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext("2d")
      if (!ctx) break

      // Fondo blanco: un PDF con fondo transparente saldría negro en JPEG.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      )
      if (blob) {
        // La imagen se sube siempre: es el soporte contable de la compra y lo
        // que se ve en la pantalla de revisión. El texto solo decide CÓMO se
        // lee, no si se guarda o no.
        const text = await readPageText(page)
        pages.push({
          image: new File([blob], `${base}-p${n}.jpg`, { type: "image/jpeg" }),
          text,
        })
      }
      page.cleanup()
    }
  } finally {
    // `cleanup` libera los recursos del documento; en esta versión de pdfjs no
    // hay `destroy` en el tipo público.
    doc.cleanup()
  }

  return { pages, totalPages }
}

/**
 * Traduce los errores de pdf.js a algo que la persona pueda resolver.
 *
 * "Invalid PDF structure" (con el aviso "Indexing all PDF objects" en la
 * consola) sale cuando el archivo no tiene la estructura de un PDF: llegó
 * cortado —una descarga a medias, un reenvío por WhatsApp—, lo generó mal un
 * programa, o no es un PDF aunque se llame así. Ninguno se arregla
 * reintentando, y el mensaje en inglés no le dice a nadie qué hacer.
 */
function readablePdfError(err: unknown): Error {
  const name = (err as { name?: string } | null)?.name ?? ""
  const message = err instanceof Error ? err.message : String(err)
  if (name === "PasswordException" || /password/i.test(message)) {
    return new Error(
      "El PDF tiene contraseña. Ábrelo, guárdalo sin contraseña y vuelve a subirlo, o sube una foto de la factura.",
    )
  }
  if (
    name === "InvalidPDFException" ||
    /invalid pdf structure|missing pdf|unexpected server response/i.test(message)
  ) {
    return new Error(
      "El PDF está dañado o incompleto y no se puede abrir. Descárgalo otra vez del correo, o ábrelo en el computador y vuelve a guardarlo como PDF. También puedes subir una foto de la factura.",
    )
  }
  return err instanceof Error ? err : new Error(message)
}

/** Texto de la página, o `undefined` si la capa no da para fiarse. */
async function readPageText(page: {
  getTextContent: () => Promise<{ items: unknown[] }>
}): Promise<string | undefined> {
  try {
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => (item as { str?: string }).str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
    return text.length >= MIN_TEXT_CHARS ? text : undefined
  } catch {
    // Sin capa de texto legible se sigue por OCR, que es el camino normal.
    return undefined
  }
}
