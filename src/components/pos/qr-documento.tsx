"use client"

import * as React from "react"
import QRCode from "qrcode"

/**
 * QR del documento electrónico, generado en el navegador con `qrcode` (ya es
 * dependencia del repo). Se pinta como imagen de tamaño físico fijo: el anexo
 * pide al menos 2 cm (§14.3) y 2,5 cm caben en el ancho útil de un papel de
 * 58 mm (≈ 48 mm) con margen para que el lector del celular no se pierda.
 */
export function QrDocumento({
  contenido,
  etiqueta,
}: {
  contenido: string
  /** Texto alternativo: qué documento abre el QR. */
  etiqueta: string
}) {
  const [src, setSrc] = React.useState<string | null>(null)
  React.useEffect(() => {
    let vivo = true
    QRCode.toDataURL(contenido, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then((url) => vivo && setSrc(url))
      .catch(() => vivo && setSrc(null))
    return () => {
      vivo = false
    }
  }, [contenido])

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed border-border text-center text-xs text-muted-foreground"
        style={{ width: "2.5cm", height: "2.5cm" }}
      >
        Generando QR…
      </div>
    )
  }
  return (
    // Data URL generada aquí: next/image no aporta nada y exige dominio.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={etiqueta}
      // La imagen ya trae su fondo blanco (opción por defecto de `qrcode`), así
      // que se lee igual en tema oscuro: un QR invertido no lo lee el celular.
      style={{ width: "2.5cm", height: "2.5cm", imageRendering: "pixelated" }}
    />
  )
}
