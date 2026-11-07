/**
 * Contingencia de la factura electrónica y del POS (Fase 9): plazo legal de
 * transmisión y validación del formulario de transcripción. Lógica pura, sin
 * React ni red. Refleja `domain/contingencia.ts` del backend.
 *
 * Tipos: 03 (FEV) y 07 (POS) son de falla del facturador (talonario o venta sin
 * conexión); 04 (FEV) y 08 (POS) son de falla de la DIAN.
 */

export type TipoContingencia = "03" | "04" | "07" | "08"

/** Plazo para transmitir lo expedido en contingencia (art. 37 Res. 165/2023). */
export const PLAZO_TRANSMISION_HORAS = 48
/** «Por vencer» cuando quedan menos de estas horas. */
export const ALERTA_HORAS_ANTES_DEL_PLAZO = 24

const HORA_MS = 3_600_000

/** Subdocumento `contingencia` del documento electrónico. */
export interface ContingenciaDoc {
  tipo: TipoContingencia
  declaradaAt: string
  superadaAt?: string | null
  restablecidoAt?: string | null
  referencia?: { id: string; fecha: string } | null
  cerradaAt?: string | null
  /** La DIAN ya tenía el original: la contingencia no aplicó. */
  noAplico?: boolean
  motivoNoAplico?: string
}

export const TIPO_CONTINGENCIA_LABELS: Record<TipoContingencia, string> = {
  "03": "Factura en contingencia (03)",
  "04": "Factura en contingencia por falla de la DIAN (04)",
  "07": "POS en contingencia (07)",
  "08": "POS en contingencia por falla de la DIAN (08)",
}

export function fallaDe(tipo: TipoContingencia): "dian" | "facturador" {
  return tipo === "04" || tipo === "08" ? "dian" : "facturador"
}

export type FasePlazo =
  | "sin_correr"
  | "en_plazo"
  | "por_vencer"
  | "vencido"

export interface EstadoPlazo {
  fase: FasePlazo
  inicio: Date | null
  venceAt: Date | null
  /** Horas enteras hacia arriba; negativas si ya venció. */
  horasRestantes: number | null
}

function fecha(v?: string | null): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 04/08 corre desde que la DIAN vuelve; 03/07 desde que se superó la falla. */
export function inicioPlazo(c: ContingenciaDoc): Date | null {
  if (fallaDe(c.tipo) === "dian") return fecha(c.restablecidoAt)
  return fecha(c.superadaAt) ?? fecha(c.declaradaAt)
}

export function estadoPlazo(
  c: ContingenciaDoc,
  ahora: Date = new Date(),
): EstadoPlazo {
  const inicio = inicioPlazo(c)
  if (!inicio) {
    return { fase: "sin_correr", inicio: null, venceAt: null, horasRestantes: null }
  }
  const venceAt = new Date(inicio.getTime() + PLAZO_TRANSMISION_HORAS * HORA_MS)
  const restante = venceAt.getTime() - ahora.getTime()
  const horasRestantes = Math.ceil(restante / HORA_MS)
  if (restante <= 0) return { fase: "vencido", inicio, venceAt, horasRestantes }
  if (restante <= ALERTA_HORAS_ANTES_DEL_PLAZO * HORA_MS) {
    return { fase: "por_vencer", inicio, venceAt, horasRestantes }
  }
  return { fase: "en_plazo", inicio, venceAt, horasRestantes }
}

export type TonoPlazo = "ok" | "aviso" | "error" | "neutro"

export interface PlazoVisible {
  fase: FasePlazo | "cerrada" | "no_aplico" | "notas_pendientes"
  tono: TonoPlazo
  texto: string
}

/**
 * Lo que se muestra del plazo de un documento, o `null` si no hay nada que
 * decir (no es de contingencia). Aceptado/cerrado dejan de correr; `noAplico`
 * lo dice aparte.
 */
export function plazoVisible(
  doc: { dianStatus: string; contingencia?: ContingenciaDoc | null },
  ahora: Date = new Date(),
): PlazoVisible | null {
  const c = doc.contingencia
  if (!c?.tipo) return null
  if (c.noAplico) {
    return {
      fase: "no_aplico",
      tono: "neutro",
      texto: "La contingencia no aplicó: queda vigente el documento original.",
    }
  }
  // Cerrada solo con `cerradaAt`: el backend la pone cuando el documento Y todas
  // sus notas están aceptados. Aceptado sin cerrar = faltan notas por transmitir.
  if (c.cerradaAt) {
    return { fase: "cerrada", tono: "ok", texto: "Contingencia cerrada: la DIAN aceptó el documento y sus notas." }
  }
  if (doc.dianStatus === "accepted") {
    return {
      fase: "notas_pendientes",
      tono: "aviso",
      texto: "La DIAN aceptó el documento, pero faltan notas por aceptar. Transmite para terminarlas.",
    }
  }
  const p = estadoPlazo(c, ahora)
  switch (p.fase) {
    case "sin_correr":
      return {
        fase: p.fase,
        tono: "aviso",
        texto: `Plazo de ${PLAZO_TRANSMISION_HORAS} h sin correr: empieza cuando la DIAN vuelva a responder.`,
      }
    case "vencido":
      return {
        fase: p.fase,
        tono: "error",
        texto: `Plazo de ${PLAZO_TRANSMISION_HORAS} h vencido hace ${textoHoras(-(p.horasRestantes ?? 0))}. Transmite ya.`,
      }
    case "por_vencer":
      return {
        fase: p.fase,
        tono: "aviso",
        texto: `Por vencer: quedan ${textoHoras(p.horasRestantes ?? 0)} para transmitir.`,
      }
    default:
      return {
        fase: p.fase,
        tono: "ok",
        texto: `En plazo: quedan ${textoHoras(p.horasRestantes ?? 0)} para transmitir (límite ${PLAZO_TRANSMISION_HORAS} h).`,
      }
  }
}

function textoHoras(h: number): string {
  const n = Math.max(0, Math.round(h))
  return n === 1 ? "1 hora" : `${n} horas`
}

// ─── Formulario de transcripción ─────────────────────────────────────────────

export interface TranscribirPayload {
  talonario?: { numero: number; fecha: string; hora?: string }
  superadaAt?: string
}

export interface FormTranscripcion {
  /** La venta se hizo en el talonario de papel (si no, venta sin conexión). */
  conPapel: boolean
  numero: string
  fecha: string
  hora: string
  /** `datetime-local` (AAAA-MM-DDTHH:mm), hora de Colombia. */
  superadaEn: string
}

export type CampoTranscripcion = "numero" | "fecha" | "hora" | "superadaEn"

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const SUPERADA = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/

/** Instante de una fecha y hora tecleadas en hora de Colombia (UTC-5, sin DST). */
export function instanteColombia(fechaTxt: string, horaTxt = "00:00"): Date | null {
  const h = horaTxt.length === 5 ? `${horaTxt}:00` : horaTxt
  const d = new Date(`${fechaTxt}T${h}-05:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** AAAA-MM-DD de hoy en Colombia. */
export function hoyColombia(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 5 * HORA_MS).toISOString().slice(0, 10)
}

export const FORM_TRANSCRIPCION_VACIO: FormTranscripcion = {
  conPapel: false,
  numero: "",
  fecha: "",
  hora: "",
  superadaEn: "",
}

/**
 * Valida el formulario antes de enviarlo. Es una ayuda: el rango del
 * talonario, su vigencia y el resto los decide el backend (400/409).
 * `momentoVenta` es `soldAt ?? createdAt` de la venta; solo cuenta SIN talonario
 * (con talonario el backend compara contra la fecha y hora del papel). Evita aceptar una superación
 * anterior a ella).
 */
export function validarTranscripcion(
  f: FormTranscripcion,
  opts: { ahora?: Date; momentoVenta?: Date | null } = {},
): { errores: Partial<Record<CampoTranscripcion, string>>; payload?: TranscribirPayload } {
  const ahora = opts.ahora ?? new Date()
  const errores: Partial<Record<CampoTranscripcion, string>> = {}
  const payload: TranscribirPayload = {}
  let momentoPapel: Date | null = null

  if (f.conPapel) {
    const numero = Number(f.numero)
    if (!f.numero.trim() || !Number.isSafeInteger(numero) || numero < 1) {
      errores.numero = "Escribe el número impreso en el papel, un entero positivo y sin prefijo."
    }
    if (!FECHA.test(f.fecha) || !instanteColombia(f.fecha)) {
      errores.fecha = "Escribe la fecha del papel."
    } else if (f.fecha > hoyColombia(ahora)) {
      errores.fecha = "La fecha del papel no puede ser posterior a hoy."
    }
    const hora = f.hora.trim()
    if (hora && !HORA.test(hora)) {
      errores.hora = "La hora va en formato HH:MM."
    }
    if (!errores.numero && !errores.fecha && !errores.hora) {
      payload.talonario = {
        numero,
        fecha: f.fecha,
        ...(hora ? { hora } : {}),
      }
      momentoPapel = instanteColombia(f.fecha, hora || "00:00")
    }
  }

  if (f.superadaEn.trim()) {
    if (!SUPERADA.test(f.superadaEn)) {
      errores.superadaEn = "Escribe la fecha y hora en que se superó la falla."
    } else {
      const [d, h] = f.superadaEn.split("T")
      const inst = instanteColombia(d, h)
      if (!inst) {
        errores.superadaEn = "La fecha de superación no es válida."
      } else if (inst > ahora) {
        errores.superadaEn = "La fecha en que se superó la falla no puede ser futura."
      } else if (!f.conPapel && opts.momentoVenta && inst < opts.momentoVenta) {
        errores.superadaEn = "No puede ser anterior a la venta."
      } else if (momentoPapel && inst < momentoPapel) {
        errores.superadaEn = "No puede ser anterior al papel del talonario."
      } else {
        payload.superadaAt = inst.toISOString()
      }
    }
  }

  return Object.keys(errores).length > 0 ? { errores } : { errores, payload }
}

// ─── Corte del talonario (resolución de contingencia) ────────────────────────

/** Corte por defecto del servidor: la mitad del rango. */
export function corteTalonarioPorDefecto(desde: number, hasta: number): number {
  return desde + Math.floor((hasta - desde + 1) / 2) - 1
}

/**
 * Valida el corte opcional del talonario contra el rango: debe dejar al menos
 * un número en cada serie (talonario de `desde` al corte; ventas sin conexión
 * del corte + 1 a `hasta`). Vacío es válido: se conserva el guardado o rige la
 * mitad. Devuelve el error o `null`.
 */
export function errorCorteTalonario(
  corte: string,
  desde: number | undefined,
  hasta: number | undefined,
): string | null {
  if (!corte.trim()) return null
  const n = Number(corte)
  if (!Number.isSafeInteger(n) || n < 1) return "El corte debe ser un entero positivo."
  if (hasta === undefined) return "Para fijar el corte, primero escribe el rango (Desde y Hasta)."
  const d = desde ?? 1
  if (n < d || n >= hasta) {
    return `El corte debe estar entre ${d} y ${hasta - 1}: así queda al menos un número en cada serie.`
  }
  return null
}
