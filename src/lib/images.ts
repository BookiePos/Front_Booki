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
 * lo suyo. Preferimos subir de más a perder la foto.
 */

/** Formatos que aceptamos subir (los mismos que valida el backend). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]

/** Valor para el `accept` del input de archivo (solo imágenes). */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",")

/**
 * `accept` para documentos de compra: imágenes y PDF.
 *
 * El PDF no se sube tal cual: se rasteriza antes en el navegador (ver
 * `lib/pdf.ts`), así que aguas abajo todo sigue siendo una imagen.
 */
export const DOCUMENT_ACCEPT = [...ACCEPTED_IMAGE_TYPES, "application/pdf"].join(
  ",",
)

/** Tamaño máximo que acepta el backend (4 MB). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

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
 * Deja la imagen lista para subir: la reescala al preset y, si aún pesa
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

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const escala = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      // Una imagen ya pequeña y ligera se deja tal cual: recomprimirla solo
      // perdería calidad a cambio de nada.
      if (escala === 1 && file.size <= maxBytes / 4) return file

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
      return blob ? named(blob, file.name) : file
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
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
