"use client"

import * as React from "react"
import { Camera, ImagePlus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IMAGE_ACCEPT } from "@/lib/images"

interface InvoiceCaptureProps {
  /** Recibe las fotos elegidas, sin procesar: quien llama decide qué hacer. */
  onFiles: (files: File[]) => void
  busy?: boolean
  /** Texto bajo los botones. */
  hint?: string
}

/**
 * Captura de facturas: cámara o archivos, varias a la vez.
 *
 * Son dos inputs y no uno porque `capture="environment"` obliga a abrir la
 * cámara trasera en el celular —que es el gesto natural en la bodega— pero en
 * un computador no hace nada útil. Teniendo los dos, cada dispositivo ofrece lo
 * que sirve: fotografiar, o elegir las fotos que ya se tomaron.
 */
export function InvoiceCapture({ onFiles, busy = false, hint }: InvoiceCaptureProps) {
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const filesRef = React.useRef<HTMLInputElement>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    // El input se limpia siempre: si no, volver a elegir el mismo archivo no
    // dispara `change` y parece que la app se quedó pasmada.
    event.target.value = ""
    if (files.length > 0) onFiles(files)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => cameraRef.current?.click()}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
          Tomar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => filesRef.current?.click()}
        >
          <ImagePlus className="size-4" aria-hidden />
          Subir imágenes
        </Button>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={filesRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
