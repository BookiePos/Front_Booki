import { MessageCircle } from "lucide-react"
import { enlaceWhatsapp, SOPORTE } from "@/lib/soporte"

/**
 * Botón flotante de soporte por WhatsApp (ítem 7.3). Sin número configurado no
 * renderiza nada. No va en el POS: ahí no puede tapar el cobro. Es un enlace
 * puro (sin JS ni scripts inline), así que no toca la CSP con nonce.
 */
export function SoporteWhatsapp({
  numero = SOPORTE.whatsapp,
  horario = SOPORTE.horario,
  tiempoRespuesta = SOPORTE.tiempoRespuesta,
  mensaje,
}: {
  numero?: string
  horario?: string
  tiempoRespuesta?: string
  mensaje?: string
}) {
  const href = enlaceWhatsapp(mensaje, numero)
  if (!href) return null
  const detalle = [horario, tiempoRespuesta].filter(Boolean).join(" · ")
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Soporte por WhatsApp${detalle ? `. ${detalle}` : ""}`}
      title={detalle || undefined}
      data-testid="soporte-whatsapp"
      className="fixed bottom-20 right-4 z-40 md:bottom-4 inline-flex items-center gap-2 rounded-full bg-[#0e7266] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#0a5a50] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e7266] print:hidden"
    >
      <MessageCircle className="size-4" aria-hidden="true" />
      <span>Soporte por WhatsApp</span>
    </a>
  )
}
