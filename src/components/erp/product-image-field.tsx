"use client"

import * as React from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  prepareImageForUpload,
} from "@/lib/images"
import { cn } from "@/lib/utils"

interface ProductImageFieldProps {
  /** Foto ya guardada en el producto, si tiene. */
  currentUrl?: string | null
  /** Archivo elegido y aún sin subir (se sube al guardar la ficha). */
  file: File | Blob | null
  onPick: (file: File | Blob | null) => void
  /** Marca que hay que borrar la foto guardada al guardar la ficha. */
  removed: boolean
  onRemovedChange: (removed: boolean) => void
  disabled?: boolean
}

/**
 * Selector de la foto del producto.
 *
 * No sube nada por su cuenta: deja el archivo elegido en el estado del
 * formulario y la subida ocurre al guardar la ficha. Así crear un producto con
 * foto es UNA sola acción del usuario (el producto todavía no tiene id cuando
 * se elige la imagen), y cancelar el formulario no deja archivos sueltos en el
 * store.
 *
 * El reescalado se hace aquí, al elegir, y no al guardar: si el archivo es
 * enorme conviene saberlo antes de que el usuario llene el resto del formulario.
 */
export function ProductImageField({
  currentUrl,
  file,
  onPick,
  removed,
  onRemovedChange,
  disabled = false,
}: ProductImageFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [working, setWorking] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // La vista previa se crea en el manejador (al elegir el archivo), no en un
  // efecto: aquí el efecto solo REVOCA la URL anterior. Si no se revocara, cada
  // foto elegida dejaría su blob retenido en memoria mientras viva la pestaña.
  React.useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  // `file` manda: cuando el formulario se reinicia (abrir la ficha de otro
  // producto) la vista previa deja de mostrarse aunque su URL siga viva un
  // instante más.
  const shown = file ? preview : removed ? null : (currentUrl ?? null)

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    // El input se limpia siempre: si no, elegir el mismo archivo dos veces
    // seguidas no dispara `change` y parece que la app se quedó pasmada.
    event.target.value = ""
    if (!picked) return

    setError(null)
    setWorking(true)
    try {
      const ready = await prepareImageForUpload(picked)
      if (ready.size > MAX_IMAGE_BYTES) {
        setError("La imagen pesa demasiado incluso reescalada. Prueba con otra.")
        return
      }
      onRemovedChange(false)
      setPreview(URL.createObjectURL(ready))
      onPick(ready)
    } finally {
      setWorking(false)
    }
  }

  function handleRemove() {
    onPick(null)
    setPreview(null)
    setError(null)
    // Solo hay que pedirle al backend que borre si había una foto guardada.
    if (currentUrl) onRemovedChange(true)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Foto</Label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
            !shown && "border-dashed",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || working}
              onClick={() => inputRef.current?.click()}
            >
              {working ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              {shown ? "Cambiar" : "Subir foto"}
            </Button>
            {shown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || working}
                onClick={handleRemove}
              >
                <Trash2 className="size-4" aria-hidden />
                Quitar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG, PNG o WebP. Se reescala sola antes de subir.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleChange}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
