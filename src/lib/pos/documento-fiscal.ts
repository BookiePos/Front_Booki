/**
 * Documento fiscal de la venta en la caja (Fase 7, PR 7C).
 *
 * Lógica pura —sin React ni red— para que la pantalla de cobro, el tiquete en
 * pantalla y la tirilla ESC/POS digan exactamente lo mismo, y para probarla
 * entera con Vitest. Las reglas vienen del anexo POS
 * (documentacion/fe-fase7-anexo-pos.md): §3 (las tres salidas) y §4 (lo que
 * tiene que llevar el tiquete impreso).
 */
import type {
  Customer,
  DocumentoFiscalSolicitado,
  DocumentoFiscalVenta,
} from "@/lib/pos/api-sales"
import type {
  DocAdquiriente,
  DocFabricante,
  DocResolucion,
  ElectronicDocument,
} from "@/lib/pos/api-einvoicing"
import { calcularDvNit } from "@/lib/erp/datos-fiscales"

/** Denominación completa que exige el art. 19 num. 1 (§4.1 del anexo). */
export const DENOMINACION_POS =
  "Documento equivalente electrónico tiquete de máquina registradora con sistema P.O.S."

/** Leyenda de la contingencia 08: se expidió sin validación previa (§4, D6). */
export const LEYENDA_CONTINGENCIA_DIAN =
  "Documento expedido sin validación previa de la DIAN por falla en sus servicios (contingencia)."

/** D3: el POS a consumidor final no soporta costos ni IVA descontable (art. 19 par. 1). */
export const AVISO_CONSUMIDOR_FINAL =
  "A consumidor final: al comprador no le sirve para soportar costos, gastos ni IVA descontable. Si los necesita, que pida «Con mis datos» o factura."

/** Las tres salidas de la caja (D1), en el orden en que se ofrecen. */
export const SALIDAS_FISCALES: {
  value: DocumentoFiscalSolicitado
  label: string
  descripcion: string
}[] = [
  {
    value: "pos_anonimo",
    label: "Tiquete POS",
    descripcion: "Consumidor final, sin datos del cliente.",
  },
  {
    value: "pos_identificado",
    label: "Con mis datos",
    descripcion: "Tiquete POS a nombre del cliente. Le sirve para soportar costos.",
  },
  {
    value: "fev",
    label: "Quiero factura",
    descripcion: "Factura electrónica con los datos fiscales del cliente.",
  },
]

/** Tipos DIAN cuyo número es solo dígitos (espejo de `DOC_TYPES_NUMERICOS`). */
const DOC_TYPES_NUMERICOS = ["11", "12", "13", "91"]

/**
 * Lo que falta para poder pedir esa salida, en una frase para el pie del cobro;
 * `null` si está completo. Se valida ANTES de cobrar: descubrir el faltante
 * después dejaría la venta cobrada y sin su documento.
 */
export function faltaDatoFiscal(
  salida: DocumentoFiscalSolicitado,
  c: Customer | undefined,
): string | null {
  if (salida === "pos_anonimo") return null
  const nombre = c?.name?.trim()
  const numero = c?.idNumber?.replace(/\s/g, "") ?? ""
  if (salida === "fev") {
    if (!nombre || !numero) {
      return "Para la factura electrónica hace falta el nombre y la cédula o NIT del cliente."
    }
    // Sin tipo, la FEV usa la ficha del cliente registrado: el DV solo se
    // revisa si el cajero dijo que es un NIT.
    return c?.docType === "31" ? errorDv(numero, c.nitDv) : null
  }
  if (!nombre) return "Para el tiquete con datos falta el nombre del cliente."
  if (!c?.docType) return "Para el tiquete con datos falta el tipo de documento."
  if (!numero) return "Para el tiquete con datos falta el número de documento."
  if (DOC_TYPES_NUMERICOS.includes(c.docType) && !/\d/.test(numero)) {
    return "El número de documento solo puede llevar dígitos."
  }
  if (c.docType === "31") return errorDv(numero, c.nitDv)
  return null
}

/** DV del NIT con el módulo 11 de la DIAN (mismo algoritmo del backend). */
function errorDv(numero: string, dv: string | undefined): string | null {
  const base = numero.replace(/\D/g, "")
  const esperado = calcularDvNit(base)
  if (esperado === undefined) return "El NIT solo puede llevar dígitos."
  if (!dv?.trim()) return "Falta el dígito de verificación (DV) del NIT."
  if (dv.trim() !== String(esperado)) {
    return `El DV no corresponde a ese NIT: debería ser ${esperado}.`
  }
  return null
}

/**
 * El cliente que viaja con la venta según la salida. El tipo y el DV solo van
 * cuando hacen falta: así un cobro sin documento fiscal sigue mandando lo de
 * siempre y no tropieza con la validación del backend.
 */
export function clienteParaSalida(
  salida: DocumentoFiscalSolicitado | undefined,
  c: Customer | undefined,
): Customer | undefined {
  if (!c) return c
  const { docType, nitDv, ...resto } = c
  if (salida !== "pos_identificado" && salida !== "fev") return resto
  return {
    ...resto,
    docType: docType || undefined,
    nitDv: docType === "31" ? nitDv?.trim() || undefined : undefined,
  }
}

// ─── Aviso del documento en la pantalla de «venta registrada» ───────────────

export type TonoAviso = "ok" | "progreso" | "atencion" | "error"

export interface AvisoDocumento {
  tono: TonoAviso
  titulo: string
  detalle?: string
}

/**
 * Qué decirle al cajero del documento fiscal. Va APARTE del éxito del cobro a
 * propósito (riesgo del §6 «PR 7C»): la venta está cobrada aunque la DIAN
 * falle, y mezclarlo haría dudar de si se cobró o no.
 */
export function avisoDocumentoFiscal(
  df: DocumentoFiscalVenta | undefined,
): AvisoDocumento | null {
  if (!df) return null
  const nombre =
    df.solicitado === "fev" ? "Factura electrónica" : "Documento POS electrónico"
  switch (df.estado) {
    case "emitido":
      return {
        tono: "ok",
        titulo: `${nombre} emitido${df.fullNumber ? ` · ${df.fullNumber}` : ""}`,
        detalle:
          "La DIAN lo valida en segundo plano: no hace falta esperar para entregar el tiquete.",
      }
    case "en_proceso":
      return {
        tono: "progreso",
        titulo: `${nombre} en proceso`,
        detalle:
          "La venta quedó cobrada. El número y el CUDE aparecen en el detalle de la venta en unos segundos.",
      }
    case "pendiente_contingencia_07":
      return {
        tono: "atencion",
        titulo: `${nombre} pendiente de contingencia`,
        detalle:
          "Venta hecha sin conexión: el documento se transcribe y transmite al volver el servicio.",
      }
    case "error":
      return {
        tono: "error",
        titulo: `La venta quedó cobrada, pero el ${nombre.toLowerCase()} no se emitió`,
        detalle: df.error,
      }
  }
}

// ─── Datos del tiquete (§4) ─────────────────────────────────────────────────

/** Lo que el tiquete necesita del documento fiscal, venga de donde venga. */
export interface TiqueteFiscal {
  tipo: "pos" | "invoice"
  fullNumber: string
  /** CUDE (POS) o CUFE (FEV). */
  cude?: string
  /** Contenido del QR: el bloque del §14.3 o, si faltan datos, la URL. */
  qr?: string
  resolucion?: DocResolucion
  fabricante?: DocFabricante
  /** Solo en el POS con datos del cliente (art. 35 par. 1). */
  adquiriente?: DocAdquiriente
  fecha?: string
  hora?: string
  /** Contingencia 08: lleva la leyenda de «sin validación previa». */
  contingencia: boolean
}

const CONSUMIDOR_FINAL_DOC = "222222222222"

/**
 * Normaliza lo que haya: la respuesta del cobro (`documentoFiscal`) trae número,
 * CUDE y URL; el documento electrónico completo (si se pudo leer) trae además
 * la resolución, el fabricante y lo que pide el QR. Sin número no hay tiquete
 * fiscal: el recibo sale como siempre.
 */
export function tiqueteFiscalDe(
  df: DocumentoFiscalVenta | undefined,
  doc?: ElectronicDocument | null,
): TiqueteFiscal | null {
  const docValido =
    doc && (doc.type === "pos" || doc.type === "invoice") ? doc : null
  const fullNumber = docValido?.fullNumber ?? df?.fullNumber
  if (!fullNumber) return null
  if (!docValido && df?.estado !== "emitido") return null
  const tipo: "pos" | "invoice" =
    docValido?.type === "invoice" || (!docValido && df?.tipo === "invoice")
      ? "invoice"
      : "pos"
  const cude = docValido?.cufe ?? df?.cude
  const qrUrl = docValido?.qrUrl ?? df?.qrUrl
  const adq = docValido?.adquiriente
  return {
    tipo,
    fullNumber,
    cude,
    qr: docValido ? contenidoQr(docValido) ?? qrUrl : qrUrl,
    resolucion: docValido?.resolution,
    fabricante: docValido?.fabricante,
    adquiriente:
      adq && adq.docNumber && adq.docNumber !== CONSUMIDOR_FINAL_DOC ? adq : undefined,
    fecha: docValido?.issueDate,
    hora: docValido?.issueTime,
    contingencia: docValido?.dianStatus === "contingency",
  }
}

/** Valor del QR: punto decimal y dos decimales, como el CUFE/CUDE. */
function valor(n: number | undefined): string {
  return (n ?? 0).toFixed(2)
}

/**
 * Bloque del QR del §14.3 (`NumFac=…` a `QRCode=…`, uno por línea). Es lo que
 * recomienda el anexo para el tiquete (§4.11); queda pendiente confirmar en
 * habilitación si la DIAN acepta solo la URL. Sin CUDE o sin URL no hay QR
 * válido y se devuelve `undefined`.
 */
export function contenidoQr(doc: ElectronicDocument): string | undefined {
  if (!doc.cufe || !doc.qrUrl) return undefined
  const otros = (doc.incTotal ?? 0) + (doc.icaTotal ?? 0) + (doc.bagTaxTotal ?? 0)
  return [
    `NumFac=${doc.fullNumber}`,
    `FecFac=${doc.issueDate}`,
    `HorFac=${doc.issueTime}`,
    `NitFac=${doc.emisor?.nit ?? ""}`,
    `DocAdq=${doc.adquiriente?.docNumber ?? CONSUMIDOR_FINAL_DOC}`,
    `ValFac=${valor(doc.taxableBase)}`,
    `ValIva=${valor(doc.ivaTotal)}`,
    `ValOtroIm=${valor(otros)}`,
    `ValTolFac=${valor(doc.payableAmount ?? doc.total)}`,
    `CUDE=${doc.cufe}`,
    `QRCode=${doc.qrUrl}`,
  ].join("\n")
}

/** «Resolución DIAN 18760000001 del 2026-01-01 · Prefijo SETP del 1 al 5000». */
export function lineasResolucion(r: DocResolucion | undefined): string[] {
  if (!r?.numero) return []
  const lineas = [`Resolución DIAN ${r.numero}`]
  const rango =
    r.rangoDesde !== undefined && r.rangoHasta !== undefined
      ? `del ${r.rangoDesde} al ${r.rangoHasta}`
      : ""
  if (r.prefijo || rango) {
    lineas.push(`${r.prefijo ? `Prefijo ${r.prefijo} ` : ""}${rango}`.trim())
  }
  if (r.vigenciaDesde || r.vigenciaHasta) {
    lineas.push(
      `Vigencia ${fecha(r.vigenciaDesde)} a ${fecha(r.vigenciaHasta)}`,
    )
  }
  return lineas
}

/** «BookiPos · Fabricante: Nombre (NIT 900…)» — art. 19 num. 9. */
export function lineaFabricante(f: DocFabricante | undefined): string | undefined {
  if (!f) return undefined
  const quien = f.razonSocial || f.nombreApellido
  const nit = f.nit ? ` NIT ${f.nit}` : ""
  const software = f.nombreSoftware || "BookiPos"
  return quien ? `Software ${software} · Fabricante ${quien}${nit}` : `Software ${software}`
}

function fecha(iso: string | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  return d && m && y ? `${d}/${m}/${y}` : iso
}
