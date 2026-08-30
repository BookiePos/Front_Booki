/**
 * Preparación de imágenes en el navegador antes de subirlas.
 *
 * Una foto de celular pesa entre 3 y 8 MB, y para una tarjeta de producto de
 * 300 px eso es absurdo: tarda en subir con datos móviles, y el API —que corre
 * en funciones de Vercel— rechaza cuerpos de más de 4.5 MB. Reescalar aquí
 * convierte esa foto en ~200 KB antes de que salga del dispositivo.
 *
 * Si algo falla (formato que el navegador no decodifica, canvas bloqueado por
 * privacidad), se devuelve el archivo original: el backend valida igual y dirá
 * lo suyo. Preferimos subir de más a perder la foto.
 */

/** Lado mayor de la imagen guardada. Suficiente para la ficha y el POS. */
const MAX_SIDE = 1200

/** Calidad JPEG. 0.82 es donde deja de notarse la diferencia en fotos. */
const QUALITY = 0.82

/** Formatos que aceptamos subir (los mismos que valida el backend). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]

/** Valor para el `accept` del input de archivo. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",")

/** Tamaño máximo que acepta el backend (4 MB), para avisar antes de subir. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Reescala la imagen a `MAX_SIDE` como lado mayor y la codifica en JPEG.
 * Devuelve el archivo listo para subir. Las imágenes ya pequeñas se dejan tal
 * cual: recomprimirlas solo perdería calidad.
 */
export async function prepareImageForUpload(file: File): Promise<File | Blob> {
  if (typeof document === "undefined") return file
  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && file.size <= MAX_IMAGE_BYTES / 4) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close()
      return file
    }
    // Fondo blanco: un PNG con transparencia pasa a JPEG, que no la tiene, y
    // sin esto las zonas transparentes salen negras.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    )
    if (!blob) return file
    return new File([blob], renameToJpg(file.name), { type: "image/jpeg" })
  } catch {
    return file
  }
}

function renameToJpg(name: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "imagen"
  return `${base}.jpg`
}
