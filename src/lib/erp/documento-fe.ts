/**
 * Lógica pura de la pantalla de detalle del documento electrónico y de los
 * rangos de la DIAN. Sin React ni red: se prueba aparte.
 */
import type {
  DetalleDocumentoFe,
  DianStatus,
  RangoDian,
  RegisterResolutionPayload,
} from "@/lib/erp/api-einvoicing"

export type TonoEstado = "ok" | "aviso" | "error" | "neutro"

/** Color del badge del estado ante la DIAN. */
export function tonoEstadoDian(status: DianStatus): TonoEstado {
  switch (status) {
    case "accepted":
      return "ok"
    case "rejected":
      return "error"
    case "sent":
    case "signed":
    case "contingency":
      return "aviso"
    default:
      return "neutro"
  }
}

/** Texto del botón de reintento según dónde quedó el documento. */
export function etiquetaReintento(status: DianStatus): string {
  if (status === "sent") return "Consultar estado en la DIAN"
  if (status === "rejected") return "Reenviar a la DIAN"
  return "Enviar a la DIAN"
}

const EMAIL = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,255}\.[A-Za-z]{2,}$/

export function correoValido(v: string): boolean {
  const t = v.trim()
  return t.length <= 254 && EMAIL.test(t)
}

/**
 * ¿Se puede enviar por correo? Devuelve el motivo por el que no, para mostrarlo
 * junto al botón deshabilitado.
 */
export function motivoSinCorreo(d: DetalleDocumentoFe): string | null {
  if (d.dianStatus !== "accepted") {
    return "Solo un documento aceptado por la DIAN se envía por correo."
  }
  if (d.tipo !== "invoice") {
    return "Por ahora solo la factura de venta se envía por correo."
  }
  if (!d.correo.puedeEnviar) return "Ya se envió el máximo de veces."
  return null
}

/** Frase del estado de la entrega al adquiriente (PDF + ZIP). */
export function textoEntrega(d: DetalleDocumentoFe): string | null {
  if (d.dianStatus !== "accepted") return null
  const e = d.entrega
  if (!e?.estado) return "La entrega al cliente (PDF y ZIP) aún no se genera."
  if (e.estado === "completa") return "Entrega lista: XML firmado, PDF y ZIP."
  if (e.estado === "incompleta")
    return "Solo el PDF está listo: falta el XML firmado para el cliente."
  if (e.estado === "fallida")
    return "Falló la generación de los archivos para el cliente."
  return null
}

/** Acorta el CUFE/CUDE para mostrarlo sin romper la pantalla. */
export function cufeCorto(cufe?: string): string {
  if (!cufe) return "—"
  return cufe.length <= 24 ? cufe : `${cufe.slice(0, 12)}…${cufe.slice(-8)}`
}

/** Tramo mostrado de un rango de la DIAN: «FE 1 – 5000». */
export function textoRango(r: RangoDian): string {
  return `${r.prefijo ? `${r.prefijo} ` : ""}${r.desde} – ${r.hasta}`
}

/**
 * Pre-llena el formulario de la resolución con un rango de la DIAN. La clave
 * técnica, las fechas y la fecha de la resolución no vienen en la respuesta:
 * se teclean.
 */
export function payloadDeRango(r: RangoDian): RegisterResolutionPayload {
  return {
    numero: r.resolucion,
    prefijo: r.prefijo,
    rangoDesde: r.desde,
    rangoHasta: r.hasta,
    fechaResolucion: r.fechaResolucion,
    vigenciaDesde: r.vigenciaDesde,
    vigenciaHasta: r.vigenciaHasta,
  }
}

/** ¿El rango de la DIAN ya venció? Compara por día (YYYY-MM-DD). */
export function rangoVencido(r: RangoDian, hoy: Date = new Date()): boolean {
  if (!r.vigenciaHasta) return false
  const h = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
  return r.vigenciaHasta < h
}

/** «Vigente 2026-01-02 a 2028-01-02» o lo que se sepa. */
export function textoVigencia(r: RangoDian): string {
  if (r.vigenciaDesde && r.vigenciaHasta)
    return `Vigente del ${r.vigenciaDesde} al ${r.vigenciaHasta}`
  if (r.vigenciaHasta) return `Vigente hasta ${r.vigenciaHasta}`
  return "Sin fechas de vigencia"
}

/** ¿Los datos del formulario siguen siendo los del rango traído de la DIAN? */
export function coincideConRango(
  f: RegisterResolutionPayload,
  base: RegisterResolutionPayload,
): boolean {
  return (
    (f.numero ?? "") === (base.numero ?? "") &&
    (f.prefijo ?? "").toUpperCase() === (base.prefijo ?? "").toUpperCase() &&
    f.rangoDesde === base.rangoDesde &&
    f.rangoHasta === base.rangoHasta
  )
}

/** Clave estable de un rango en la lista. */
export function claveRango(r: RangoDian): string {
  return `${r.resolucion ?? ""}|${r.prefijo ?? ""}|${r.desde}|${r.hasta}`
}

/** Mensaje al usuario cuando la consulta de rangos no salió bien. */
export function mensajeRangosFallidos(
  r: { ok: boolean; codigo?: string; mensajes: string[] },
): string | null {
  if (r.ok) return null
  if (r.codigo === "CONFIG_FALTANTE") {
    return (
      r.mensajes[0] ??
      "Falta configurar el emisor (certificado, SoftwareID o PIN) para consultar a la DIAN."
    )
  }
  return r.mensajes[0] ?? "La DIAN no respondió los rangos. Inténtalo de nuevo."
}
