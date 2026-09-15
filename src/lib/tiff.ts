/**
 * Lectura de imágenes TIFF en el navegador.
 *
 * Los escáneres de oficina y algunos programas de facturación guardan en TIFF,
 * a veces con varias hojas en un mismo archivo. Solo Safari lo decodifica por
 * su cuenta; Chrome, Edge y Firefox no, así que se usa `utif2`, que se carga
 * únicamente cuando alguien sube un TIFF.
 */

/**
 * Tope de píxeles por hoja. Una hoja carta escaneada a 600 ppp ronda los
 * 34 millones; más que eso no es una factura y decodificarlo podría tumbar la
 * pestaña en un celular.
 */
const MAX_PIXELS = 60_000_000

export interface TiffPagesResult {
  pages: ImageData[]
  /** Hojas que tenía el archivo, aunque solo se hayan decodificado las primeras. */
  totalPages: number
}

export async function decodeTiff(
  file: Blob,
  maxPages: number,
): Promise<TiffPagesResult> {
  const mod = await import("utif2")
  const UTIF = (mod as unknown as { default?: typeof mod }).default ?? mod
  const buffer = await file.arrayBuffer()

  // Un TIFF trae también directorios que no son hojas (miniaturas, EXIF): solo
  // cuentan los que declaran ancho de imagen (etiqueta 256).
  const ifds = UTIF.decode(buffer).filter((ifd) => ifd.t256 !== undefined)
  const pages: ImageData[] = []

  for (const ifd of ifds.slice(0, maxPages)) {
    UTIF.decodeImage(buffer, ifd)
    if (!ifd.width || !ifd.height || ifd.width * ifd.height > MAX_PIXELS) continue
    const rgba = UTIF.toRGBA8(ifd)
    pages.push(new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height))
  }
  if (pages.length === 0) {
    throw new Error(
      "No se pudo abrir la imagen TIFF. Ábrela en el computador y guárdala como JPG o PDF.",
    )
  }
  return { pages, totalPages: ifds.length }
}
