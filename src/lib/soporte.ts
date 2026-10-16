/**
 * Canales de soporte (ítems 2.12 y 7.3). Una sola fuente: la web pública, la
 * página de estado y el panel leen de aquí. Lo que no está definido no se
 * muestra: el número de WhatsApp, el horario y el tiempo de respuesta son
 * compromisos con el cliente y los fija el dueño, no el código.
 */
function limpiar(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

/** Deja solo dígitos; un número fuera de 8-15 dígitos (E.164) se descarta. */
export function normalizarNumero(v: string | undefined): string | undefined {
  const d = v?.replace(/\D/g, "")
  return d && d.length >= 8 && d.length <= 15 ? d : undefined
}

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
  // Next solo incrusta `process.env.NEXT_PUBLIC_X` escrito literal: no usar
  // acceso dinámico aquí. Vacío o ausente = no se muestra (ver .env.example).
  whatsapp: normalizarNumero(process.env.NEXT_PUBLIC_SOPORTE_WHATSAPP),
  horario: limpiar(process.env.NEXT_PUBLIC_SOPORTE_HORARIO),
  tiempoRespuesta: limpiar(process.env.NEXT_PUBLIC_SOPORTE_TIEMPO_RESPUESTA),
}

/** Enlace de WhatsApp con un mensaje inicial, si hay número configurado. */
export function enlaceWhatsapp(
  mensaje = "Hola, necesito ayuda con BookiPos",
  numero: string | undefined = SOPORTE.whatsapp,
): string | null {
  const n = normalizarNumero(numero)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`
}
