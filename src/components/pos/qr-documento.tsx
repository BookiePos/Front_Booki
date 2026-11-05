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
  // La imagen va con el contenido que la generó: al cambiar el contenido (la
  // URL del cobro → el bloque §14.3) nunca se ve un instante el QR viejo.
  const [qr, setQr] = React.useState<{ de: string; src: string | null } | null>(null)
  React.useEffect(() => {
    let vivo = true
    QRCode.toDataURL(contenido, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then((url) => vivo && setQr({ de: contenido, src: url }))
      .catch(() => vivo && setQr({ de: contenido, src: null }))
    return () => {
      vivo = false
    }
  }, [contenido])

  const listo = qr?.de === contenido ? qr : null
  // Si no se pudo generar, no se imprime un recuadro de «Generando…»: el
  // tiquete ya lleva el CUDE, con el que se consulta el documento en la DIAN.
  if (listo && !listo.src) return null
  const src = listo?.src
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
