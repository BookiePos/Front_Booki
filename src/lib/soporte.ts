/**
 * Canales de soporte (ítems 2.12 y 7.3). Una sola fuente: la web pública, la
 * página de estado y el panel leen de aquí. Lo que no está definido no se
 * muestra: el número de WhatsApp, el horario y el tiempo de respuesta son
 * compromisos con el cliente y los fija el dueño, no el código.
 */
export const SOPORTE: {
  email: string
  ventas: string
  /** Número en formato internacional sin signos, p. ej. "573001234567". */
  whatsapp?: string
  /** P. ej. "Lunes a sábado, 8:00 a. m. a 6:00 p. m." */
  horario?: string
  /** P. ej. "Respondemos en menos de 2 horas hábiles." */
  tiempoRespuesta?: string
} = {
  email: "soporte@bookipos.com",
  ventas: "hola@bookipos.com",
}

/** Enlace de WhatsApp con un mensaje inicial, si hay número configurado. */
export function enlaceWhatsapp(mensaje = "Hola, necesito ayuda con BookiPos"): string | null {
  if (!SOPORTE.whatsapp) return null
  return `https://wa.me/${SOPORTE.whatsapp}?text=${encodeURIComponent(mensaje)}`
}
