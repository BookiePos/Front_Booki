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

export interface PdfPagesResult {
  pages: File[]
  /** Páginas que tenía el PDF, aunque solo se hayan convertido las primeras. */
  totalPages: number
}

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
  const doc = await pdfjs.getDocument({ data }).promise
  const totalPages = doc.numPages
  const pages: File[] = []
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
        pages.push(
          new File([blob], `${base}-p${n}.jpg`, { type: "image/jpeg" }),
        )
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
