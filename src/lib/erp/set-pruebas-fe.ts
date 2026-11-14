import type {
  EmisorVista,
  EstadoDocSetFactura,
  HabilitacionFacturaVista,
} from "@/lib/erp/api-einvoicing"

/**
 * Lógica pura del set de pruebas de habilitación de la FACTURA: qué falta para
 * poder enviarlo y en qué fase está. Espejo de las reglas de
 * `HabilitacionFacturaService` del backend (el servidor vuelve a validarlo todo
 * y contesta 409 con el motivo).
 */

type EmisorParaSet = Pick<
  EmisorVista,
  "tipoAmbiente" | "certificadoVigente" | "facturaSoftwareId" | "tieneFacturaPin" | "tieneFacturaTestSetId"
>

/**
 * Qué le falta a la sede para enviar el set (vacío: se puede enviar).
 * La resolución de numeración NO es requisito: el set usa la resolución pública
 * de habilitación de la DIAN (prefijo SETP), que pone BookiPos.
 */
export function faltantesSetPruebas(emisor: EmisorParaSet | null): string[] {
  if (!emisor) return ["los datos fiscales de la sede (NIT y razón social)"]
  if (emisor.tipoAmbiente !== "2") {
    return ["que la sede esté en el ambiente de habilitación: ya está en producción"]
  }
  return [
    ...(emisor.certificadoVigente ? [] : ["un certificado de firma (.p12) vigente"]),
    ...(emisor.facturaSoftwareId ? [] : ["el SoftwareID"]),
    ...(emisor.tieneFacturaPin ? [] : ["el PIN del software"]),
    ...(emisor.tieneFacturaTestSetId ? [] : ["el TestSetId de factura"]),
  ]
}

/**
 * - `por_confirmar`: todos los documentos quedaron aceptados pero la DIAN no dio
 *   el veredicto del set; el emisor NO queda habilitado hasta que lo dé.
 */
export type FaseSetPruebas = "sin_iniciar" | "en_curso" | "rechazado" | "por_confirmar" | "aceptado"

/** Lo que hace el botón principal (siempre el mismo POST): null si no hay nada que enviar. */
export type AccionSetPruebas = "enviar" | "continuar" | "reintentar" | null

export interface EstadoSetPruebas {
  fase: FaseSetPruebas
  /** Motivos de la DIAN por cada documento rechazado. */
  motivos: string[]
  /** Documentos que aún no han salido (necesitan otro envío). */
  porEnviar: number
  /** Documentos enviados que la DIAN todavía valida. */
  enRevision: number
  aceptados: number
  exigidos: number
  accion: AccionSetPruebas
  /** Hay documentos en revisión: reconsultar puede traer un veredicto. */
  puedeActualizar: boolean
}

export function estadoSetPruebas(vista: HabilitacionFacturaVista | null): EstadoSetPruebas {
  const docs = vista?.documentos ?? []
  const contar = (...e: EstadoDocSetFactura[]) => docs.filter((d) => e.includes(d.estado)).length
  const base = {
    motivos: [] as string[],
    porEnviar: contar("pendiente"),
    enRevision: contar("enviando", "enviado"),
    aceptados: vista?.resumen?.aceptados ?? contar("aceptado"),
    exigidos: vista?.resumen?.exigidos ?? docs.length,
  }
  if (!vista || vista.estado === "sin_iniciar") {
    return { ...base, fase: "sin_iniciar", accion: "enviar", puedeActualizar: false }
  }
  if (vista.aprobada) {
    return {
      ...base,
      fase: vista.listoParaProduccion ? "aceptado" : "por_confirmar",
      accion: null,
      puedeActualizar: false,
    }
  }
  const rechazados = docs.filter((d) => d.estado === "rechazado")
  if (rechazados.length > 0) {
    return {
      ...base,
      fase: "rechazado",
      motivos: rechazados.map((d) => `${d.etiqueta} ${d.numero}: ${d.mensaje ?? "Rechazado por la DIAN"}`),
      accion: "reintentar",
      puedeActualizar: base.enRevision > 0,
    }
  }
  return {
    ...base,
    fase: "en_curso",
    // Sin nada en vuelo ni por enviar (no debería pasar) se deja reenviar para no quedar sin salida.
    accion: base.porEnviar > 0 || base.enRevision === 0 ? "continuar" : null,
    puedeActualizar: base.enRevision > 0,
  }
}

export const ETIQUETA_FASE_SET: Record<FaseSetPruebas, string> = {
  sin_iniciar: "Sin enviar",
  en_curso: "En curso",
  rechazado: "Con rechazos",
  por_confirmar: "Por confirmar",
  aceptado: "Aceptado",
}

export const ETIQUETA_ACCION_SET: Record<Exclude<AccionSetPruebas, null>, string> = {
  enviar: "Enviar set de pruebas",
  continuar: "Continuar envío",
  reintentar: "Reintentar rechazados",
}

export const ETIQUETA_DOC_SET_FACTURA: Record<EstadoDocSetFactura, string> = {
  pendiente: "Por enviar",
  enviando: "Enviando",
  enviado: "Enviado, en revisión",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  set_aceptado: "Set ya aceptado",
}

/** Qué decirle al dueño en cada fase. No promete avisos: el resultado se ve aquí. */
export function textoFaseSet(e: EstadoSetPruebas): string {
  switch (e.fase) {
    case "sin_iniciar":
      return "Aún no se ha enviado. BookiPos arma, firma y envía los documentos de prueba; no toca tu numeración ni tus ventas."
    case "aceptado":
      return "La DIAN aceptó el set de pruebas. La sede quedó lista para producción; el paso a producción lo decides tú."
    case "por_confirmar":
      return "Todos los documentos quedaron aceptados, pero la DIAN no ha dado el veredicto del set. Revisa en el portal de la DIAN que el software figure como habilitado."
    case "rechazado":
      return `La DIAN rechazó ${e.motivos.length === 1 ? "un documento" : `${e.motivos.length} documentos`}. Corrige lo que indica y reintenta: salen de nuevo con otro número.`
    case "en_curso": {
      const partes = [`${e.aceptados} de ${e.exigidos} documentos aceptados.`]
      if (e.enRevision > 0) {
        partes.push(
          `${e.enRevision === 1 ? "1 documento está" : `${e.enRevision} documentos están`} en revisión: la DIAN suele responder en unos minutos; pulsa «Actualizar estado» para traer el resultado.`,
        )
      }
      if (e.porEnviar > 0) {
        partes.push(
          `${e.porEnviar === 1 ? "Queda 1 documento" : `Quedan ${e.porEnviar} documentos`} por enviar (las notas salen cuando la DIAN acepta una factura): pulsa «Continuar envío».`,
        )
      }
      return partes.join(" ")
    }
  }
}
