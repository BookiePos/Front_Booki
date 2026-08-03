/**
 * Formateadores compartidos del POS (dinero, cantidades y fechas) para que la
 * venta, el historial y el recibo se vean idénticos.
 */

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const qtyFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })

const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
})

const timeFmt = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
})

/** Monto en pesos colombianos sin decimales (ej. $12.000). */
export function money(value: number): string {
  return moneyFmt.format(value)
}

/** Cantidad con hasta 2 decimales (ej. 1,5). */
export function qty(value: number): string {
  return qtyFmt.format(value)
}

/** Fecha + hora legible (ej. 22 jul 2026, 3:04 p. m.). */
export function dateTime(value: string | Date): string {
  return dateTimeFmt.format(new Date(value))
}

/** Solo la hora (ej. 15:04). */
export function timeOnly(value: string | Date): string {
  return timeFmt.format(new Date(value))
}

/** ¿La fecha cae en el día de hoy (zona local)? */
export function isToday(value: string | Date): boolean {
  const d = new Date(value)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}
