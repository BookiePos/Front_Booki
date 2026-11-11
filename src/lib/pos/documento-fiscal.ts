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
import {
  DIAN_DOC_TYPE_LABELS,
  calcularDvNit,
  type DianDocType,
} from "@/lib/erp/datos-fiscales"
import type { Sale } from "@/lib/pos/api-sales"

/** Denominación completa que exige el art. 19 num. 1 (§4.1 del anexo). */
export const DENOMINACION_POS =
  "Documento equivalente electrónico tiquete de máquina registradora con sistema P.O.S."

/** Leyenda de la contingencia 08: se expidió sin validación previa (§4, D6). */
export const LEYENDA_CONTINGENCIA_DIAN =
  "Documento expedido sin validación previa de la DIAN por falla en sus servicios (contingencia)."

/**
 * Título del papel cuando la venta pidió documento fiscal pero aún no lo tiene
 * (en proceso, error o sin conexión): no se puede llamar «factura» a algo que no
 * lo es (art. 617 ET, art. 19 num. 1 Res. 165/2023).
 */
export const TITULO_SIN_DOCUMENTO = [
  "COMPROBANTE DE VENTA",
  "No es factura ni documento equivalente",
]

/** Documento que la DIAN rechazó: el papel no vale como soporte. */
export const LEYENDA_RECHAZADO =
  "DOCUMENTO RECHAZADO POR LA DIAN: no es válido como soporte. Se corrige y se expide de nuevo."

/** Ley 1935 de 2018: la propina es voluntaria y así debe decirlo el papel. */
export const ETIQUETA_PROPINA = "Propina (voluntaria)"

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
    descripcion:
      "Tiquete POS a nombre del cliente. Le sirve para soportar costos, gastos e IVA descontable si cumple los demás requisitos.",
  },
  {
    value: "fev",
    label: "Quiero factura",
    descripcion: "Factura electrónica a un cliente registrado con sus datos fiscales completos.",
  },
]

/** Tipos DIAN cuyo número es solo dígitos (espejo de `DOC_TYPES_NUMERICOS`). */
const DOC_TYPES_NUMERICOS = ["11", "12", "13", "91"]

/**
 * Lo que falta para poder pedir esa salida, en una frase para el pie del cobro;
 * `null` si está completo. Se valida ANTES de cobrar: descubrir el faltante
 * después dejaría la venta cobrada y sin su documento.
 */
/** Lo de la ficha del cliente registrado que usa el documento fiscal. */
export interface FichaFiscal {
  docNumber: string
  dianDocType?: string
  nitDv?: string
  tipoPersona?: string
  responsabilidadesFiscales?: string[]
  municipioDane?: string
  address?: string
  email?: string
  emailFacturacion?: string
}

/**
 * Lo que le falta a la ficha del cliente registrado, con las reglas de
 * `validarAdquirienteParaFactura` / `adquirientePos` del backend. Con cliente
 * registrado el backend REEMPLAZA lo tecleado por la ficha (si el número
 * coincide), así que es la ficha la que tiene que estar completa.
 */
export function faltaEnFicha(
  salida: DocumentoFiscalSolicitado,
  ficha: FichaFiscal,
  numeroTecleado: string | undefined,
  /** El correo que escribió el cajero: el backend lo prefiere al de la ficha. */
  correoTecleado?: string,
): string | null {
  if (salida === "pos_anonimo") return null
  const numero = numeroTecleado?.trim()
  if (numero && numero !== ficha.docNumber) {
    // El backend descarta la ficha si el número no es el suyo.
    return salida === "fev"
      ? `El número no es el de la ficha del cliente (${ficha.docNumber}): déjalo igual para facturar.`
      : null
  }
  const faltan: string[] = []
  if (!ficha.dianDocType) faltan.push("tipo de documento DIAN")
  // El DV que valida el backend es el de la ficha (`errorDvCliente`), no el
  // que haya en el formulario.
  if (ficha.dianDocType === "31") {
    const dv = errorDv(ficha.docNumber, ficha.nitDv)
    if (dv) faltan.push(`DV del NIT (${dv})`)
  }
  if (salida === "fev") {
    if (ficha.tipoPersona !== "1" && ficha.tipoPersona !== "2") faltan.push("tipo de persona")
    if (!ficha.responsabilidadesFiscales?.length) faltan.push("responsabilidades fiscales")
    if (!/^\d{5}$/.test(ficha.municipioDane ?? "")) faltan.push("municipio (código DANE)")
    if (!ficha.address?.trim()) faltan.push("dirección")
    if (!(ficha.emailFacturacion || correoTecleado || ficha.email)?.trim()) {
      faltan.push("correo de facturación")
    }
  }
  if (faltan.length === 0) return null
  return `A la ficha del cliente le falta: ${faltan.join(", ")}. Complétala en Clientes antes de cobrar.`
}

export function faltaDatoFiscal(
  salida: DocumentoFiscalSolicitado,
  c: Customer | undefined,
  { ficha }: { ficha?: FichaFiscal } = {},
): string | null {
  if (salida === "pos_anonimo") return null
  const registrado = !!ficha
  if (ficha) {
    const enFicha = faltaEnFicha(salida, ficha, c?.idNumber, c?.email)
    if (enFicha) return enFicha
  }
  const nombre = c?.name?.trim()
  const numero = c?.idNumber?.replace(/\s/g, "") ?? ""
  if (salida === "fev") {
    // La FEV exige del adquiriente tipo de persona, responsabilidades,
    // municipio DANE, dirección y correo, que el cobro no lleva: el backend
    // los copia de la ficha del cliente registrado. Sin ficha, la factura
    // fallaría siempre DESPUÉS de cobrar.
    if (!registrado) {
      return "Para la factura elige un cliente registrado con sus datos fiscales (o regístralo en Clientes)."
    }
    if (!nombre || !numero) {
      return "Para la factura electrónica hace falta el nombre y la cédula o NIT del cliente."
    }
    return c?.docType === "31" ? errorDv(numero, c.nitDv) : null
  }
  if (!nombre) return "Para el tiquete con datos falta el nombre del cliente."
  // Con cliente registrado el backend toma el tipo de su ficha.
  if (!c?.docType && !registrado) return "Para el tiquete con datos falta el tipo de documento."
  if (!numero) return "Para el tiquete con datos falta el número de documento."
  const tipo = c?.docType
  if (tipo && DOC_TYPES_NUMERICOS.includes(tipo) && !/^\d+$/.test(numero)) {
    return "El número de documento solo puede llevar dígitos."
  }
  if (tipo && DOC_TYPES_NUMERICOS.includes(tipo) && !/[1-9]/.test(numero)) {
    return "El número de documento no puede ser solo ceros."
  }
  if (tipo === "31") return errorDv(numero, c?.nitDv)
  return null
}

/**
 * Separa «900123456-7» en base y DV, como `separarNitConDv` del backend: la
 * base es lo que va antes del guion. Quitar todo lo que no es dígito pegaría
 * el DV a la base y daría un falso «DV equivocado».
 */
export function separarNitConDv(
  texto: string | undefined,
): { base: string; dv?: string } | undefined {
  if (!texto) return undefined
  const partes = String(texto).trim().split("-")
  const base = (partes[0] ?? "").replace(/\D/g, "")
  if (!base) return undefined
  if (partes.length === 2) {
    const dv = (partes[1] ?? "").replace(/\D/g, "")
    return dv ? { base, dv } : { base }
  }
  return { base }
}

/** DV del NIT con el módulo 11 de la DIAN (mismo algoritmo del backend). */
function errorDv(numero: string, dvCampo: string | undefined): string | null {
  const nit = separarNitConDv(numero)
  const esperado = nit ? calcularDvNit(nit.base) : undefined
  if (esperado === undefined) return "El NIT solo puede llevar dígitos."
  // El DV puede venir en su campo o pegado con guion al número.
  const dv = dvCampo?.trim() || nit?.dv
  if (!dv) return "Falta el dígito de verificación (DV) del NIT."
  if (dv !== String(esperado)) {
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
  /** La DIAN lo rechazó: el papel lleva la leyenda de no válido. */
  rechazado?: boolean
  /** Impuestos por tributo y tarifa (§4.6). Ausente sin el documento completo. */
  impuestos?: ImpuestoTiquete[]
}

/** Una fila del desglose de impuestos del tiquete. */
export interface ImpuestoTiquete {
  etiqueta: string
  base?: number
  valor: number
}

/**
 * Desglose de impuestos por tributo y tarifa (§4.6 del anexo, art. 19): «IVA
 * 19 %», «INC 8 %», exentos y la bolsa. Sale de las líneas del documento, que
 * es lo que valida la DIAN, no de la venta.
 */
export function impuestosDe(doc: ElectronicDocument): ImpuestoTiquete[] {
  const grupos = new Map<string, ImpuestoTiquete>()
  for (const l of doc.lines ?? []) {
    if (!l.taxScheme) continue
    const tarifa = l.taxRate ?? 0
    const nombre = l.taxScheme === "04" ? "INC" : "IVA"
    const etiqueta = tarifa === 0 ? `${nombre} exento` : `${nombre} ${tarifa} %`
    const g = grupos.get(etiqueta) ?? { etiqueta, base: 0, valor: 0 }
    g.base = (g.base ?? 0) + l.base
    g.valor += l.taxAmount ?? 0
    grupos.set(etiqueta, g)
  }
  const filas = [...grupos.values()]
  if ((doc.bagTaxTotal ?? 0) > 0) {
    filas.push({ etiqueta: "INC bolsas", valor: doc.bagTaxTotal ?? 0 })
  }
  return filas
}

/** Cliente que sale en el papel. */
export interface ClienteTiquete {
  name?: string
  identificacion?: string
  phone?: string
}

/**
 * Quién sale como cliente en el papel. Con documento fiscal manda el
 * adquiriente del documento (art. 35 par. 1): en el POS anónimo NO se imprime
 * un nombre tecleado, porque el XML dice consumidor final y el papel haría
 * creer que soporta costos. Sin documento fiscal, lo de siempre.
 */
export function clienteTiquete(
  sale: Pick<Sale, "customer" | "documentoFiscal">,
  fiscal: TiqueteFiscal | null,
): ClienteTiquete | null {
  if (fiscal) {
    const a = fiscal.adquiriente
    if (!a?.docNumber) return null
    const tipo = a.docType
      ? DIAN_DOC_TYPE_LABELS[a.docType as DianDocType]
      : undefined
    // El documento guarda el NIT sin DV; el DV lo dio el cajero (o la ficha).
    const dv =
      a.docType === "31" &&
      separarNitConDv(sale.customer?.idNumber)?.base === a.docNumber
        ? sale.customer?.nitDv
        : undefined
    return {
      name: a.name,
      identificacion: [tipo, `${a.docNumber}${dv ? `-${dv}` : ""}`]
        .filter(Boolean)
        .join(" "),
    }
  }
  if (sale.documentoFiscal?.solicitado === "pos_anonimo") return null
  const c = sale.customer
  if (!c || !(c.name || c.idNumber || c.phone || c.email)) return null
  return { name: c.name, identificacion: c.idNumber, phone: c.phone }
}

/**
 * Título del papel: la denominación del documento, «comprobante» si se pidió
 * uno y aún no existe, o el de siempre si el negocio no factura electrónico.
 */
export function tituloTiquete(
  sale: Pick<Sale, "documentoFiscal">,
  fiscal: TiqueteFiscal | null,
): string[] {
  if (fiscal) {
    return [fiscal.tipo === "pos" ? DENOMINACION_POS : "FACTURA ELECTRÓNICA DE VENTA"]
  }
  if (sale.documentoFiscal) return TITULO_SIN_DOCUMENTO
  return ["FACTURA DE VENTA"]
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
  // El documento solo vale si es EL de esta venta: una lectura tardía de la
  // venta anterior no puede poner su número, CUDE y QR en el tiquete de otra.
  const docValido =
    doc &&
    (doc.type === "pos" || doc.type === "invoice") &&
    !!df?.documentoId &&
    doc._id === df.documentoId
      ? doc
      : null
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
    rechazado: docValido?.dianStatus === "rejected",
    impuestos: docValido ? impuestosDe(docValido) : undefined,
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
    // §14.3: la FEV lleva CUFE; el POS, CUDE.
    `${doc.type === "invoice" ? "CUFE" : "CUDE"}=${doc.cufe}`,
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

/**
 * «Transcribir» sale en las ventas pendientes de contingencia 07 y en las ya
 * emitidas con notas por reintentar (`notasPendientes > 0`). El permiso
 * (`einvoicing.issue`) lo valida quien llama.
 */
export function puedeTranscribir(df?: DocumentoFiscalVenta | null): boolean {
  if (!df) return false
  if (df.estado === "pendiente_contingencia_07") return true
  return df.estado === "emitido" && (df.notasPendientes ?? 0) > 0
}
