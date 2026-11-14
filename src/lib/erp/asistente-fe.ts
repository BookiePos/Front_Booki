import { ApiError } from "@/lib/api"
import type {
  ConfigurarFacturaPayload,
  EmisorVista,
  EstadoEmisor,
  ResolutionRow,
} from "@/lib/erp/api-einvoicing"

/** Portal de la DIAN donde se registra el software y se obtiene el TestSetId. */
export const URL_PORTAL_DIAN = "https://catalogo-vpfe-hab.dian.gov.co"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const esUuid = (v: string): boolean => UUID.test(v.trim())

// ── Checklist ────────────────────────────────────────────────────────────────

export type EstadoPaso = "hecho" | "pendiente" | "sin_dato" | "cargando"

/** A dónde lleva el paso para corregirlo. */
export type DestinoPaso = "sede" | "dian" | "certificado" | "credenciales" | "resoluciones" | "pruebas"

export interface PasoAsistente {
  id: "datos" | "registro" | "certificado" | "credenciales" | "resolucion" | "pruebas" | "produccion"
  titulo: string
  estado: EstadoPaso
  /** Qué falta (vacío si está hecho). */
  detalle: string
  destino: DestinoPaso
}

/**
 * Arma el checklist de puesta en marcha a partir del emisor, su estado y la
 * resolución de la sede. Función pura: la pantalla solo pinta lo que sale de aquí.
 * `resolucion` es `undefined` si no se pudo leer (sin permiso) y `null` si la
 * sede no aparece.
 */
export function pasosAsistente(
  emisor: EmisorVista | null,
  estado: EstadoEmisor | null,
  resolucion: ResolutionRow | null | undefined,
  cargandoResolucion = false,
): PasoAsistente[] {
  const faltanDatos = estado?.datosFiscalesFaltantes ?? []
  const datosOk = !!emisor && faltanDatos.length === 0
  const registroOk = !!emisor?.facturaSoftwareId
  const certOk = !!emisor?.certificadoVigente
  const credOk = !!emisor?.facturaSoftwareId && !!emisor.tieneFacturaPin
  const habilitado = !!emisor?.habilitado
  const produccion = habilitado && emisor?.tipoAmbiente === "1"

  let resolucionPaso: Pick<PasoAsistente, "estado" | "detalle">
  if (cargandoResolucion) {
    resolucionPaso = { estado: "cargando", detalle: "Consultando la resolución…" }
  } else if (resolucion === undefined) {
    resolucionPaso = {
      estado: "sin_dato",
      detalle: "No se pudo leer la resolución (se necesita el permiso de emitir).",
    }
  } else if (!resolucion || resolucion.status.estado === "sin_configurar") {
    resolucionPaso = { estado: "pendiente", detalle: "Registra la resolución de numeración de la DIAN." }
  } else if (resolucion.status.puedeEmitir) {
    resolucionPaso = { estado: "hecho", detalle: "" }
  } else {
    resolucionPaso = {
      estado: "pendiente",
      detalle: resolucion.status.alertas[0] ?? "La resolución no permite emitir ahora.",
    }
  }

  const faltanCred = [
    ...(emisor?.facturaSoftwareId ? [] : ["SoftwareID"]),
    ...(emisor?.tieneFacturaPin ? [] : ["PIN"]),
  ]

  return [
    {
      id: "datos",
      titulo: "Datos fiscales de la sede",
      estado: datosOk ? "hecho" : "pendiente",
      detalle: !emisor
        ? "La sede aún no tiene emisor fiscal: completa NIT y razón social."
        : datosOk
          ? ""
          : `Falta: ${faltanDatos.join(", ")}.`,
      destino: "sede",
    },
    {
      id: "registro",
      titulo: "Registro del software en la DIAN",
      estado: registroOk ? "hecho" : "pendiente",
      detalle: registroOk
        ? ""
        : "Registra tu software en el portal de la DIAN (habilitación) para obtener el SoftwareID y el PIN.",
      destino: "dian",
    },
    {
      id: "certificado",
      titulo: "Certificado de firma (.p12)",
      estado: certOk ? "hecho" : "pendiente",
      detalle: certOk
        ? emisor?.certAviso === "por-vencer"
          ? "Vigente, pero vence pronto: renuévalo."
          : ""
        : emisor?.tieneCertificado
          ? "El certificado cargado está vencido o sin fecha: sube uno vigente."
          : "Sube el .p12 con su contraseña.",
      destino: "certificado",
    },
    {
      id: "credenciales",
      titulo: "SoftwareID, PIN y TestSetId de factura",
      estado: credOk ? "hecho" : "pendiente",
      detalle: credOk
        ? emisor?.tieneFacturaTestSetId
          ? ""
          : "Falta el TestSetId para correr el set de pruebas."
        : `Falta: ${faltanCred.join(", ")}.`,
      destino: "credenciales",
    },
    { id: "resolucion", titulo: "Resolución de numeración", destino: "resoluciones", ...resolucionPaso },
    {
      id: "pruebas",
      titulo: "Set de pruebas de habilitación",
      estado: habilitado ? "hecho" : "pendiente",
      detalle: habilitado
        ? ""
        : emisor?.tieneFacturaTestSetId
          ? "Aún sin aprobar: envía el set de pruebas desde esta pantalla."
          : "Guarda el TestSetId y envía el set de pruebas a la DIAN.",
      destino: !habilitado && emisor?.tieneFacturaTestSetId ? "pruebas" : "credenciales",
    },
    {
      id: "produccion",
      titulo: "Paso a producción",
      estado: produccion ? "hecho" : "pendiente",
      detalle: produccion
        ? ""
        : habilitado
          ? "Habilitada: falta pasar el emisor al ambiente de producción."
          : "Se activa cuando el set de pruebas esté aprobado.",
      destino: "dian",
    },
  ]
}

/** Cuántos pasos están hechos y cuál es el siguiente por resolver. */
export function resumenPasos(pasos: PasoAsistente[]): {
  hechos: number
  total: number
  siguiente: PasoAsistente | null
} {
  return {
    hechos: pasos.filter((p) => p.estado === "hecho").length,
    total: pasos.length,
    siguiente: pasos.find((p) => p.estado !== "hecho") ?? null,
  }
}

// ── Credenciales de factura ──────────────────────────────────────────────────

export interface FormFactura {
  softwareId: string
  pin: string
  testSetId: string
}

/** Igual que nómina: el PIN nunca se muestra, así que cada guardado lo pide. */
export function armarPayloadFactura(
  f: FormFactura,
  quitarTestSetId: boolean,
): { ok: true; payload: ConfigurarFacturaPayload } | { ok: false; error: string } {
  const softwareId = f.softwareId.trim()
  const pin = f.pin.trim()
  const testSetId = f.testSetId.trim()
  if (!esUuid(softwareId)) return { ok: false, error: "El SoftwareID debe ser un UUID." }
  if (!pin) return { ok: false, error: "Escribe el PIN del software de factura." }
  if (!quitarTestSetId && testSetId && !esUuid(testSetId)) {
    return { ok: false, error: "El TestSetId debe ser un UUID." }
  }
  const payload: ConfigurarFacturaPayload = { softwareId, pin }
  if (quitarTestSetId) payload.testSetId = null
  else if (testSetId) payload.testSetId = testSetId
  return { ok: true, payload }
}

// ── Certificado ──────────────────────────────────────────────────────────────

export const CERT_MAX_BYTES = 50 * 1024
export const DIAS_AVISO_CERTIFICADO = 30

export interface FormCertificado {
  archivo: { name: string; size: number } | null
  password: string
}

/** Valida el formulario del .p12 antes de subirlo. */
export function validarCertificado(f: FormCertificado): string | null {
  if (!f.archivo) return "Elige el archivo del certificado (.p12 o .pfx)."
  if (!/\.(p12|pfx)$/i.test(f.archivo.name)) return "El archivo debe ser .p12 o .pfx."
  if (f.archivo.size <= 0) return "El archivo está vacío."
  if (f.archivo.size > CERT_MAX_BYTES) return "El certificado pesa más de 50 KB: no parece un .p12."
  if (!f.password) return "Escribe la contraseña del certificado."
  return null
}

export interface EstadoCertificado {
  tono: "ok" | "aviso" | "error" | "vacio"
  texto: string
  diasRestantes?: number
}

/** Qué decir del certificado: vence en menos de 30 días, venció o está bien. */
export function estadoCertificado(
  emisor: Pick<EmisorVista, "tieneCertificado" | "certVenceAt"> | null,
  ahora: Date = new Date(),
): EstadoCertificado {
  if (!emisor?.tieneCertificado) return { tono: "vacio", texto: "Sin certificado cargado." }
  const vence = emisor.certVenceAt ? new Date(emisor.certVenceAt) : null
  if (!vence || Number.isNaN(vence.getTime())) {
    return { tono: "error", texto: "No se conoce la fecha de vencimiento: vuelve a subir el certificado." }
  }
  const dias = Math.floor((vence.getTime() - ahora.getTime()) / 86_400_000)
  if (vence.getTime() <= ahora.getTime()) {
    return { tono: "error", texto: "El certificado venció: sube uno vigente para poder emitir.", diasRestantes: dias }
  }
  if (dias < DIAS_AVISO_CERTIFICADO) {
    return {
      tono: "aviso",
      texto: dias <= 0 ? "El certificado vence hoy." : `El certificado vence en ${dias} día${dias === 1 ? "" : "s"}: renuévalo.`,
      diasRestantes: dias,
    }
  }
  return { tono: "ok", texto: `Vigente, vence en ${dias} días.`, diasRestantes: dias }
}

export function mensajeErrorEmisor(err: unknown): string {
  if (err instanceof ApiError && err.status === 503) {
    return "Falta la llave de cifrado en el servidor; avisa al soporte."
  }
  if (err instanceof ApiError && err.status === 403) {
    return "No tienes permiso para esta acción."
  }
  if (err instanceof Error) return err.message
  return "Error desconocido"
}
