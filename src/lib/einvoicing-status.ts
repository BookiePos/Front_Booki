/**
 * Cómo se le dice a una persona el estado de un documento ante la DIAN.
 *
 * Vive en un solo lugar porque lo muestran el POS, el panel y las dos
 * representaciones gráficas de la factura: si cada una lo redactara a su modo,
 * la misma factura saldría "validada" en una pantalla y "pendiente" en otra.
 */

/** Lo mínimo del documento que hace falta para describir su estado. */
export interface DianStatusInput {
  dianStatus: "draft" | "pending" | "accepted" | "rejected" | "failed"
  environment?: "habilitacion" | "produccion"
  technicalProvider?: string
}

export type DianTone = "success" | "warning" | "danger" | "muted"

export interface DianStatusInfo {
  /** Etiqueta corta para una insignia. */
  label: string
  tone: DianTone
  /** Frase para el pie de la factura o el detalle. */
  note: string
  /** ¿Tiene validez fiscal? Solo lo aceptado en producción por la DIAN real. */
  fiscal: boolean
  /** ¿Se puede reenviar desde la pantalla? */
  canRetry: boolean
}

/** Clases de color por tono, con los tokens del tema. */
export const DIAN_TONE_CLASS: Record<DianTone, string> = {
  success: "bg-success/10 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
}

export function dianStatusInfo(doc: DianStatusInput): DianStatusInfo {
  const simulado = doc.technicalProvider === "simulado"
  switch (doc.dianStatus) {
    case "accepted":
      if (simulado) {
        return {
          label: "Simulada",
          tone: "warning",
          note: "Simulación: no se envió a la DIAN y no tiene validez fiscal.",
          fiscal: false,
          canRetry: false,
        }
      }
      if (doc.environment === "habilitacion") {
        return {
          label: "Validada DIAN (pruebas)",
          tone: "warning",
          note: "Validada por la DIAN en ambiente de pruebas: no tiene validez fiscal.",
          fiscal: false,
          canRetry: false,
        }
      }
      return {
        label: "Validada DIAN",
        tone: "success",
        note: "Documento validado por la DIAN.",
        fiscal: true,
        canRetry: false,
      }
    case "pending":
      return {
        label: "Pendiente DIAN",
        tone: "warning",
        note: "Enviada: la DIAN aún no confirma. Se reintenta automáticamente con el mismo número.",
        fiscal: false,
        canRetry: true,
      }
    case "rejected":
      return {
        label: "Rechazada DIAN",
        tone: "danger",
        note: "La DIAN la rechazó. Corrige lo que indica y reenvíala: conserva su número.",
        fiscal: false,
        canRetry: true,
      }
    case "failed":
      return {
        label: "Sin enviar",
        tone: "danger",
        note: "No se pudo enviar a la DIAN por la configuración de la conexión. Al arreglarla, reenvíala.",
        fiscal: false,
        canRetry: true,
      }
    default:
      return {
        label: "Sin validar DIAN",
        tone: "muted",
        note: "Documento anterior a la conexión con la DIAN: nunca se envió.",
        fiscal: false,
        canRetry: false,
      }
  }
}
