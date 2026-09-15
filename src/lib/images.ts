/**
 * Preparación de imágenes en el navegador antes de subirlas.
 *
 * Una foto de celular pesa entre 3 y 8 MB. Para una tarjeta de producto de
 * 300 px eso es absurdo, y además el API —que corre en funciones de Vercel—
 * rechaza cuerpos de más de 4.5 MB. Reescalar aquí convierte esa foto en unos
 * cientos de KB antes de que salga del dispositivo.
 *
 * Si algo falla (formato que el navegador no decodifica, canvas bloqueado por
 * privacidad), se devuelve el archivo original: el backend valida igual y dirá
 * lo suyo. Preferimos subir de más a perder la foto. La excepción son las
 * fotos HEIC del iPhone y los TIFF: esos el backend nunca los acepta, así que
 * si no se pueden convertir se avisa aquí, con un mensaje que diga qué hacer.
 */

/** Formatos que aceptamos subir (los mismos que valida el backend). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]

/**
 * Formatos de foto del iPhone (HEIC/HEIF).
 *
 * Se aceptan en el selector de archivos pero NO llegan así al servidor: aquí
 * se convierten a JPEG. El OCR de facturas no lee HEIC y la mayoría de los
 * navegadores tampoco sabrían mostrarlo en la ficha del producto.
 *
 * Van también las extensiones porque en Windows el navegador suele entregar
 * estos archivos con `type` vacío, y sin la extensión el selector los ocultaba.
 */
export const HEIC_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]
const HEIC_EXTENSIONS = [".heic", ".heif"]

/**
 * Imágenes de escáner y formatos viejos (TIFF, BMP, GIF). Como el HEIC, se
 * convierten a JPEG antes de subirse.
 */
const SCAN_IMAGE_TYPES = ["image/tiff", "image/bmp", "image/gif"]
const SCAN_IMAGE_EXTENSIONS = [".tif", ".tiff", ".bmp", ".gif"]

/** Valor para el `accept` del input de archivo (solo imágenes). */
export const IMAGE_ACCEPT = [
  ...ACCEPTED_IMAGE_TYPES,
  ...HEIC_TYPES,
  ...HEIC_EXTENSIONS,
  ...SCAN_IMAGE_TYPES,
  ...SCAN_IMAGE_EXTENSIONS,
].join(",")

/**
 * `accept` para documentos de compra: imágenes, PDF, la factura electrónica
 * (ZIP o XML) y Word o Excel.
 *
 * Nada de eso se sube tal cual: `lib/invoice-files.ts` lo convierte antes en
 * una imagen de soporte más el texto o el XML, así que aguas abajo todo sigue
 * siendo una imagen.
 */
export const DOCUMENT_ACCEPT = [
  IMAGE_ACCEPT,
  "application/pdf",
  ".pdf",
  "application/zip",
  "application/x-zip-compressed",
  ".zip",
  "application/xml",
  "text/xml",
  ".xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsx",
].join(",")

/** Tamaño máximo que acepta el backend (4 MB). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const HEIC_ERROR =
  "No se pudo abrir la foto del iPhone (HEIC). Vuelve a intentarlo o compártela como JPG (en el iPhone: Ajustes → Cámara → Formatos → Más compatible)."

const TIFF_ERROR =
  "No se pudo abrir la imagen TIFF. Ábrela en el computador y guárdala como JPG o PDF."

export type FileKind =
  | "pdf"
  | "heic"
  | "tiff"
  /** Imagen que el navegador decodifica solo (JPEG, PNG, WebP, AVIF, BMP, GIF). */
  | "image"
  /** ZIP: factura electrónica, o un Word/Excel moderno. */
  | "zip"
  | "xml"
  /** Word o Excel antiguos (.doc, .xls). */
  | "ole"
  /** Referencia del iPhone a un archivo dentro de un ZIP: no trae el archivo. */
  | "iphone-ref"
  | "unknown"

/** Marcas `ftyp` de HEIF/HEIC (las mismas que reconoce libheif). */
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]

/**
 * Qué es de verdad un archivo, por sus primeros bytes y no por su nombre.
 *
 * Existe porque el nombre miente más de lo que parece: fotos de WhatsApp
 * guardadas como `.pdf`, HEIC del iPhone con `type` vacío en Windows, o una
 * página web descargada con extensión de PDF. Decidir por la extensión
 * mandaba esos archivos al lector de PDF, que respondía "Invalid PDF
 * structure" sin que nadie entendiera por qué.
 */
export async function detectFileKind(file: Blob): Promise<FileKind> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  let ascii = ""
  for (const byte of head) ascii += String.fromCharCode(byte)

  // Primero las firmas que van en el byte 0. El orden importa: un ZIP con un
  // PDF sin comprimir adentro también contiene "%PDF-" en sus primeros bytes.
  if (ascii.startsWith("PK\x03\x04")) return "zip"
  if (ascii.startsWith("\xd0\xcf\x11\xe0")) return "ole"
  // Al abrir un ZIP en la app Archivos del iPhone y compartir un archivo de
  // adentro SIN descomprimir, iOS entrega una lista de propiedades de ~200
  // bytes (nombre + carpeta temporal) con el nombre del PDF, no el PDF. Era el
  // "Invalid PDF structure" de las facturas electrónicas subidas desde iPhone.
  if (ascii.startsWith("bplist00")) return "iphone-ref"
  if (ascii.slice(4, 8) === "ftyp") {
    const brand = ascii.slice(8, 12)
    if (HEIC_BRANDS.includes(brand)) return "heic"
    if (brand === "avif" || brand === "avis") return "image"
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image"
  if (head[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "image"
  if (ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP") return "image"
  if (ascii.startsWith("GIF8") || ascii.startsWith("BM")) return "image"
  if (ascii.startsWith("II*\0") || ascii.startsWith("MM\0*")) return "tiff"
  // pdf.js acepta la cabecera en cualquier punto de los primeros 1024 bytes.
  if (ascii.includes("%PDF-")) return "pdf"
  if (/^(\xef\xbb\xbf)?\s*<(\?xml|[\w.-]+[\s:>])/.test(ascii)) return "xml"
  return "unknown"
}

/**
 * Qué conversión necesita la imagen. HEIC por tipo o extensión además del
 * contenido: Windows entrega esas fotos con `type` vacío.
 */
async function imageKind(file: File): Promise<FileKind> {
  const kind = await detectFileKind(file).catch(() => "unknown" as const)
  if (kind !== "unknown") return kind
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return "heic"
  if (HEIC_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return "heic"
  }
  return kind
}

/**
 * Decodifica la imagen a un bitmap.
 *
 * Safari (iPhone, Mac) decodifica HEIC y TIFF por su cuenta, así que primero se
 * intenta con el navegador: no hace falta descargar nada. Chrome y Windows no
 * saben, y ahí entran `heic-to` (libheif, ~3 MB) o `utif2`, que se cargan solo
 * en ese momento. Una imagen de otro tipo que no se puede decodificar devuelve
 * `null`: se sube tal cual y el backend decide.
 */
async function decode(file: File, kind: FileKind): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file)
  } catch {
    if (kind !== "heic" && kind !== "tiff") return null
  }
  if (kind === "tiff") {
    try {
      const { decodeTiff } = await import("@/lib/tiff")
      const { pages } = await decodeTiff(file, 1)
      return await createImageBitmap(pages[0]!)
    } catch {
      throw new Error(TIFF_ERROR)
    }
  }
  try {
    const { heicTo } = await import("heic-to")
    return await heicTo({ blob: file, type: "bitmap" })
  } catch {
    throw new Error(HEIC_ERROR)
  }
}

/**
 * Presets según para qué es la imagen.
 *
 * `documento` va a mucha más resolución que `producto` porque de una factura
 * hay que poder LEER el texto: a 1200 px, un renglón de precios impreso en
 * cuerpo 8 se convierte en una mancha y el OCR se inventa los números.
 */
const PRESETS = {
  producto: { maxSide: 1200, quality: 0.82 },
  documento: { maxSide: 2000, quality: 0.9 },
} as const

export type ImagePreset = keyof typeof PRESETS

/**
 * Escalones de compresión, en orden.
 *
 * **Primero baja la calidad y solo al final la resolución**: el OCR sufre mucho
 * más perdiendo píxeles que ganando artefactos de JPEG. Cada escalón se prueba
 * hasta que el archivo entra en el límite.
 */
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6]
const SIDE_STEPS = [1600, 1400]

/**
 * Deja la imagen lista para subir: convierte las fotos HEIC del iPhone y los
 * formatos que el backend no acepta, la reescala al preset y, si aún pesa
 * demasiado, la comprime en pasadas hasta que entra.
 *
 * **Ninguna foto se rechaza por peso.** Decirle a quien está en una bodega con
 * el celular en la mano "prueba con otra foto" no es una respuesta.
 */
export async function prepareImageForUpload(
  file: File,
  preset: ImagePreset = "producto",
  maxBytes: number = MAX_IMAGE_BYTES,
): Promise<File | Blob> {
  if (typeof document === "undefined") return file
  const { maxSide, quality } = PRESETS[preset]
  const kind = await imageKind(file)
  // HEIC y TIFF nunca los acepta el backend: o se convierten, o se avisa.
  const mustConvert = kind === "heic" || kind === "tiff"

  const bitmap = await decode(file, kind)
  if (!bitmap) return file

  try {
    const escala = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    // Una imagen ya pequeña y ligera, en un formato que el backend acepta, se
    // deja tal cual: recomprimirla solo perdería calidad a cambio de nada.
    if (
      !mustConvert &&
      ACCEPTED_IMAGE_TYPES.includes(file.type) &&
      escala === 1 &&
      file.size <= maxBytes / 4
    ) {
      return file
    }

    let blob = await render(bitmap, escala, quality)
    if (blob && blob.size <= maxBytes) return named(blob, file.name)

    // Pasada 1: bajar calidad.
    for (const step of QUALITY_STEPS) {
      if (step >= quality) continue
      blob = await render(bitmap, escala, step)
      if (blob && blob.size <= maxBytes) return named(blob, file.name)
    }

    // Pasada 2: si con calidad mínima sigue sin entrar, bajar resolución.
    for (const side of SIDE_STEPS) {
      const menor = Math.min(
        escala,
        side / Math.max(bitmap.width, bitmap.height),
      )
      blob = await render(bitmap, menor, QUALITY_STEPS[QUALITY_STEPS.length - 1])
      if (blob && blob.size <= maxBytes) return named(blob, file.name)
    }

    // Agotados los escalones se devuelve lo más pequeño que se logró: el
    // backend dirá si no cabe, pero al menos no se pierde el intento.
    if (blob) return named(blob, file.name)
    if (mustConvert) throw new Error(kind === "tiff" ? TIFF_ERROR : HEIC_ERROR)
    return file
  } catch (err) {
    if (mustConvert) {
      throw err instanceof Error
        ? err
        : new Error(kind === "tiff" ? TIFF_ERROR : HEIC_ERROR)
    }
    return file
  } finally {
    bitmap.close()
  }
}

/** Un bitmap a JPEG de buena calidad, sin reescalar (páginas de un TIFF). */
export async function bitmapToJpegFile(
  bitmap: ImageBitmap,
  name: string,
): Promise<File | null> {
  const blob = await render(bitmap, 1, 0.92)
  return blob ? named(blob, name) : null
}

/** Dibuja el bitmap escalado y lo codifica en JPEG. */
async function render(
  bitmap: ImageBitmap,
  escala: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  // Fondo blanco: un PNG con transparencia pasa a JPEG, que no la tiene, y sin
  // esto las zonas transparentes salen negras.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  )
}

function named(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "imagen"
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" })
}
