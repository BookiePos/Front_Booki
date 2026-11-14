/**
 * Cliente HTTP de facturación electrónica (documentos DIAN) para el admin.
 * Reutiliza authFetch (refresh automático) de api-admin.
 */
import { authFetch, parseResponse } from "@/lib/api-admin"
import type { ContingenciaDoc } from "@/lib/contingencia-fe"

export type DocType =
  | "invoice"
  | "pos"
  | "credit_note"
  | "debit_note"
  | "payroll"
  | "payroll_adjustment"
export type DianStatus =
  | "draft"
  | "signed"
  | "sent"
  | "accepted"
  | "rejected"
  | "contingency"

/** Etiqueta en español de cada estado ante la DIAN. */
export const DIAN_STATUS_LABELS: Record<DianStatus, string> = {
  draft: "Borrador",
  signed: "Firmado",
  sent: "Enviado a la DIAN",
  accepted: "Aceptado",
  rejected: "Rechazado",
  contingency: "Contingencia",
}

/** Texto corto para el sello del documento: lo no aceptado dice en qué va. */
export function dianStatusSello(status: DianStatus): string {
  if (status === "accepted") return "Validada DIAN"
  if (status === "draft") return "Sin validar DIAN"
  return `${DIAN_STATUS_LABELS[status]} · sin validar`
}

export interface DocEmisor {
  name?: string
  nit?: string
  nitDv?: string
  tipoPersona?: string
  responsabilidadFiscal?: string
  ciiu?: string
  address?: string
  departamento?: string
  ciudad?: string
  phone?: string
  email?: string
}

export interface DocAdquiriente {
  docType?: string
  docNumber?: string
  name?: string
  phone?: string
  email?: string
}

export interface DocLine {
  code?: string
  description: string
  qty: number
  unitCode: string
  unitPrice: number
  discountAmount: number
  base: number
  ivaRate: number
  ivaAmount: number
  /** Tributo de la línea: 01 IVA, 04 INC. Ausente: sin tributo (o documento anterior a la Fase 2). */
  taxScheme?: "01" | "04"
  /** Tarifa en %. 01 al 0 % es exento. */
  taxRate?: number
  taxAmount?: number
  /** INC de bolsas (tributo 22), por unidad. */
  perUnitTax?: DocPerUnitTax
  total: number
}

export interface DocPerUnitTax {
  codigo: "22"
  unidades: number
  valorUnitario: number
  valor: number
}

/** Cargo de documento no gravado (la propina). */
export interface DocCharge {
  chargeIndicator: boolean
  reason: string
  amount: number
}

export interface DocResolucion {
  numero?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
}

export interface ElectronicDocument {
  _id: string
  type: DocType
  saleId?: string
  sedeId: string
  prefix?: string
  number: number
  fullNumber: string
  issueDate: string
  issueTime: string
  emisor?: DocEmisor
  adquiriente?: DocAdquiriente
  lines: DocLine[]
  taxableBase: number
  ivaTotal: number
  discountTotal: number
  /** Campos de la Fase 2: ausentes en documentos anteriores. */
  incTotal?: number
  icaTotal?: number
  bagTaxTotal?: number
  charges?: DocCharge[]
  chargeTotal?: number
  /** Lo que paga el cliente (incluye bolsas, domicilio y propina). */
  payableAmount?: number
  /** Algo que revisar sin bloquear la emisión. */
  aviso?: string
  total: number
  formaPago: string
  medioPago?: string
  resolution?: DocResolucion
  reason?: string
  referenceNumber?: string
  referenceCufe?: string
  cufe?: string
  qrUrl?: string
  signature?: string
  dianStatus: DianStatus
  /** Fase 9: presente solo en documentos de contingencia (03/04/07/08). */
  contingencia?: ContingenciaDoc
  technicalProvider?: string
  xmlUrl?: string
  createdByEmail: string
  createdAt: string
}

export async function listDocuments(
  sedeId: string,
): Promise<ElectronicDocument[]> {
  const res = await authFetch(
    `/einvoicing?sedeId=${encodeURIComponent(sedeId)}`,
  )
  return parseResponse<ElectronicDocument[]>(res)
}

export async function getDocument(id: string): Promise<ElectronicDocument> {
  const res = await authFetch(`/einvoicing/${id}`)
  return parseResponse<ElectronicDocument>(res)
}

export async function createInvoiceFromSale(
  saleId: string,
): Promise<ElectronicDocument> {
  const res = await authFetch("/einvoicing/from-sale", {
    method: "POST",
    body: JSON.stringify({ saleId }),
  })
  return parseResponse<ElectronicDocument>(res)
}

export async function createCreditNote(
  invoiceId: string,
  reason: string,
): Promise<ElectronicDocument> {
  const res = await authFetch(`/einvoicing/${invoiceId}/credit-note`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  return parseResponse<ElectronicDocument>(res)
}

// ─── Resoluciones de numeración ──────────────────────────────────────────────

/** Del más grave al más tranquilo: así se ordenan las sedes en la pantalla. */
export type EstadoResolucion =
  | "sin_configurar"
  | "incompleta"
  | "vencida"
  | "rango_agotado"
  | "aun_no_vigente"
  | "por_vencer"
  | "rango_bajo"
  | "ok"

export const ESTADO_RESOLUCION_LABELS: Record<EstadoResolucion, string> = {
  sin_configurar: "Sin registrar",
  incompleta: "Incompleta",
  vencida: "Vencida",
  rango_agotado: "Rango agotado",
  aun_no_vigente: "Aún no vigente",
  por_vencer: "Por vencer",
  rango_bajo: "Quedan pocos números",
  ok: "Al día",
}

export interface ResolutionStatus {
  estado: EstadoResolucion
  alertas: string[]
  /** ¿Se puede emitir ahora mismo con esta resolución? */
  puedeEmitir: boolean
  claveTecnicaOk: boolean
  consecutivo: {
    siguiente?: number
    usados: number
    restantes?: number
    total?: number
    /** 0 a 1. */
    consumido?: number
  }
  vigencia: {
    diasRestantes?: number
    vencida: boolean
    aunNoVigente: boolean
  }
}

/** Tipos de documento que pueden tener resolución de numeración propia. */
export type TipoResolucion =
  | "invoice"
  | "pos"
  | "credit_note"
  | "debit_note"
  | "contingency"

export const TIPOS_RESOLUCION: readonly TipoResolucion[] = [
  "invoice",
  "pos",
  "credit_note",
  "debit_note",
  "contingency",
]

export const TIPO_RESOLUCION_LABELS: Record<TipoResolucion, string> = {
  invoice: "Factura de venta",
  pos: "Documento equivalente POS",
  credit_note: "Nota crédito",
  debit_note: "Nota débito",
  contingency: "Contingencia",
}

/** Todo tipo que no sea factura necesita prefijo propio (lo exige el backend). */
export function tipoExigePrefijo(tipo: TipoResolucion): boolean {
  return tipo !== "invoice"
}

export interface ResolutionData {
  numero?: string
  fechaResolucion?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
  /** Solo contingencia: último número del talonario de papel guardado. */
  corteTalonario?: number
}

/** Resolución de un tipo distinto de factura, con su estado. */
export interface ResolutionTipoRow {
  tipoDocumento: TipoResolucion
  resolucion: ResolutionData
  status: ResolutionStatus
}

export interface ResolutionRow {
  sedeId: string
  sedeCode: string
  sedeName: string
  /** La fila principal es siempre la de factura. */
  tipoDocumento: "invoice"
  resolucion?: ResolutionData
  status: ResolutionStatus
  /** Resoluciones de los demás tipos de documento de la sede. */
  otras: ResolutionTipoRow[]
}

/** La resolución (y su estado) de una sede para un tipo de documento. */
export function resolucionDeTipo(
  row: ResolutionRow,
  tipo: TipoResolucion,
): { resolucion?: ResolutionData; status: ResolutionStatus } | undefined {
  if (tipo === "invoice") {
    return { resolucion: row.resolucion, status: row.status }
  }
  return (row.otras ?? []).find((o) => o.tipoDocumento === tipo)
}

export interface RegisterResolutionPayload {
  /** Por defecto `invoice`. */
  tipoDocumento?: TipoResolucion
  numero?: string
  fechaResolucion?: string
  prefijo?: string
  rangoDesde?: number
  rangoHasta?: number
  vigenciaDesde?: string
  vigenciaHasta?: string
  claveTecnica?: string
  /** Número por el que arranca el consecutivo. */
  empezarEn?: number
  /** El servidor lee la clave técnica de la DIAN (no viaja al navegador). */
  traerClaveDeDian?: boolean
  /**
   * Solo contingencia: último número del talonario de papel (del siguiente al
   * final son las ventas sin conexión). Sin enviarlo se conserva el guardado;
   * si no hay, el servidor usa la mitad del rango.
   */
  corteTalonario?: number
}

/** Estado de la resolución de cada sede a la que el usuario tiene acceso. */
export async function listResolutions(): Promise<ResolutionRow[]> {
  const res = await authFetch("/einvoicing/resolutions")
  return parseResponse<ResolutionRow[]>(res)
}

/**
 * Registra o renueva la resolución de una sede.
 *
 * Devuelve el estado actualizado de todas las sedes, no solo la tocada: al
 * anclar el consecutivo cambia lo que queda por emitir, y la pantalla se
 * refresca de una vez.
 */
export async function registerResolution(
  sedeId: string,
  payload: RegisterResolutionPayload,
): Promise<ResolutionRow[]> {
  const res = await authFetch(`/einvoicing/resolutions/${sedeId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return parseResponse<ResolutionRow[]>(res)
}

// ── Nómina electrónica del emisor ────────────────────────────────────────────

/** Lo que el backend revela de la nómina del emisor: nunca el PIN. */
export interface EmisorNominaVista {
  nominaConfigurada: boolean
  nominaSoftwareId?: string
  tieneNominaPin: boolean
  tieneNominaTestSetId?: boolean
}

/** Emisor fiscal de la sede (`null` si la sede aún no lo tiene). */
export async function getEmisorNomina(
  sedeId: string,
): Promise<EmisorNominaVista | null> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor`)
  const data = await parseResponse<{ emisor: EmisorNominaVista | null }>(res)
  return data.emisor
}

export interface ConfigurarNominaPayload {
  softwareId: string
  pin: string
  /** Ausente no toca el guardado; `null` lo borra. */
  testSetId?: string | null
}

/** Guarda SoftwareID, PIN (cifrado en el servidor) y TestSetId de nómina. */
export async function configurarNominaEmisor(
  sedeId: string,
  payload: ConfigurarNominaPayload,
): Promise<EmisorNominaVista | null> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/nomina`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  const data = await parseResponse<{ emisor: EmisorNominaVista | null }>(res)
  return data.emisor
}

// ── Nómina electrónica DIAN: periodo, documentos y habilitación ──────────────

/** Pre-vuelo de un trabajador: qué bloquea o advierte. No emite nada. */
export interface PrevueloTrabajador {
  empleadoId: string
  nombre: string
  ok: boolean
  bloqueos: string[]
  advertencias: string[]
  documentoExistente?: { id: string; fullNumber: string; dianStatus: string }
}

export type EstadoEmisionTrabajador =
  | "existente"
  | "emitido"
  | "en_curso"
  | "bloqueado"
  | "error"

export interface ResultadoTrabajadorEmision {
  empleadoId: string
  nombre: string
  estado: EstadoEmisionTrabajador
  documentoId?: string
  fullNumber?: string
  dianStatus?: string
  mensajes: string[]
}

export interface ResultadoEmisionPeriodo {
  periodo: string
  resultados: ResultadoTrabajadorEmision[]
  /** Ausente cuando ya no quedan trabajadores por procesar. */
  siguienteCursor?: string
  pendientes: number
}

export interface DocumentoNomina {
  id: string
  fullNumber: string
  tipoXml: "102" | "103"
  tipoNota?: 1 | 2
  periodo: string
  empleado: { nombre?: string; documento: string }
  dianStatus: string
  vigente: boolean
  superado: boolean
  issueDate: string
  rechazoMotivo?: string
}

/** Resultado de transmitir, consultar o ajustar un documento. */
export interface ResultadoNominaElectronica {
  documentoId?: string
  fullNumber?: string
  tipoXml?: "102" | "103"
  periodo?: string
  dianStatus?: string
  cune?: string
  transmitido: boolean
  codigo?: string
  mensajes: string[]
  intentos: number
}

export type TipoNotaAjuste = "reemplazar" | "eliminar"

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString()

export async function prepararNominaPeriodo(
  periodo: string,
  sedeId: string,
): Promise<{ periodo: string; trabajadores: PrevueloTrabajador[] }> {
  const res = await authFetch(
    `/einvoicing/nomina/periodos/${periodo}/preparar?${qs({ sedeId })}`,
    { method: "POST" },
  )
  return parseResponse(res)
}

export async function emitirNominaPeriodo(
  periodo: string,
  sedeId: string,
  cursor?: string,
): Promise<ResultadoEmisionPeriodo> {
  const res = await authFetch(
    `/einvoicing/nomina/periodos/${periodo}/emitir?${qs({ sedeId })}`,
    { method: "POST", body: JSON.stringify(cursor ? { cursor } : {}) },
  )
  return parseResponse(res)
}

export async function listarNominaDocumentos(
  periodo: string,
  sedeId: string,
): Promise<DocumentoNomina[]> {
  const res = await authFetch(`/einvoicing/nomina?${qs({ periodo, sedeId })}`)
  return parseResponse(res)
}

export async function transmitirNomina(id: string): Promise<ResultadoNominaElectronica> {
  const res = await authFetch(`/einvoicing/nomina/${id}/transmitir`, { method: "POST" })
  return parseResponse(res)
}

export async function consultarNomina(id: string): Promise<ResultadoNominaElectronica> {
  const res = await authFetch(`/einvoicing/nomina/${id}`)
  return parseResponse(res)
}

export async function ajustarNomina(
  id: string,
  tipoNota: TipoNotaAjuste,
): Promise<ResultadoNominaElectronica> {
  const res = await authFetch(`/einvoicing/nomina/${id}/ajuste`, {
    method: "POST",
    body: JSON.stringify({ tipoNota }),
  })
  return parseResponse(res)
}

export type EstadoDocHabilitacion =
  | "pendiente"
  | "enviando"
  | "enviado"
  | "aceptado"
  | "rechazado"

export interface HabilitacionNominaVista {
  estado: "sin_iniciar" | "en_curso" | "aprobada"
  aprobada: boolean
  mensaje: string
  testSetId?: string
  resumen?: {
    porTipo: Record<
      "nie" | "niae",
      { exigidos: number; aceptados: number; rechazados: number; enCurso: number }
    >
    aprobada: boolean
    aceptados: number
    total: number
  }
  documentos: {
    tipo: "nie" | "niae"
    numero: string
    estado: EstadoDocHabilitacion
    mensaje: string | null
    intentos: number
  }[]
  error?: string
}

export async function iniciarHabilitacionNomina(
  sedeId: string,
): Promise<HabilitacionNominaVista> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/nomina/habilitacion`, {
    method: "POST",
  })
  return parseResponse(res)
}

export async function getHabilitacionNomina(
  sedeId: string,
): Promise<HabilitacionNominaVista> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/nomina/habilitacion`)
  return parseResponse(res)
}

// ── Detalle del documento (Fase 10): estado, descargas, reintento y correo ───

export interface MotivoLegible {
  regla?: string
  texto: string
  sugerencia?: string
}

export interface DetalleDocumentoFe {
  id: string
  tipo: DocType
  sedeId: string
  numero: string
  fecha: string
  dianStatus: DianStatus
  estadoResumen: string
  cufe?: string
  qrUrl?: string
  ambiente?: string
  total: number
  emisor: { nombre?: string; nit?: string }
  adquiriente: { nombre?: string; documento?: string; email?: string }
  resolucion?: { numero?: string; prefijo?: string }
  referencia?: { numero?: string }
  motivos: MotivoLegible[]
  codigoDian?: string
  intentos: number
  enviadoAt?: string
  puedeReintentar: boolean
  entrega?: { estado?: string; motivo?: string; archivo?: string }
  descargas: { xml: boolean; pdf: boolean; zip: boolean }
  correo: {
    envios: number
    restantes: number
    ultimoAt?: string
    puedeEnviar: boolean
  }
  /** Solo los documentos de contingencia (03/04/07/08). */
  contingencia?: ContingenciaDoc
}

export interface DescargasDocumentoFe {
  venceEn: number
  xml?: string
  pdf?: string
  zip?: string
}

export interface ResultadoTransmisionFe {
  documentoId: string
  fullNumber: string
  dianStatus: DianStatus
  transmitido: boolean
  codigo?: string
  mensajes: string[]
  intentos: number
}

export async function getDetalleDocumento(
  id: string,
): Promise<DetalleDocumentoFe> {
  const res = await authFetch(`/einvoicing/documentos/${id}/detalle`)
  return parseResponse<DetalleDocumentoFe>(res)
}

/** URLs firmadas de vida corta: se piden al hacer clic y no se guardan. */
export async function getDescargasDocumento(
  id: string,
): Promise<DescargasDocumentoFe> {
  const res = await authFetch(`/einvoicing/documentos/${id}/descargas`)
  return parseResponse<DescargasDocumentoFe>(res)
}

export async function transmitirDocumento(
  id: string,
): Promise<ResultadoTransmisionFe> {
  const res = await authFetch(`/einvoicing/documentos/${id}/transmitir`, {
    method: "POST",
  })
  return parseResponse<ResultadoTransmisionFe>(res)
}

export async function enviarDocumentoPorCorreo(
  id: string,
  email?: string,
): Promise<{ enviado: true; para: string; envios: number; restantes: number }> {
  const res = await authFetch(`/einvoicing/documentos/${id}/correo`, {
    method: "POST",
    body: JSON.stringify(email ? { email } : {}),
  })
  return parseResponse(res)
}

// ── Rangos de numeración que la DIAN tiene autorizados al emisor ─────────────

export interface RangoDian {
  prefijo?: string
  desde: number
  hasta: number
  resolucion?: string
  /** YYYY-MM-DD, como los da la DIAN. */
  fechaResolucion?: string
  vigenciaDesde?: string
  vigenciaHasta?: string
  /** Ya hay una resolución registrada en la sede con ese número y prefijo. */
  registrada: boolean
}

export interface RangosDianVista {
  ok: boolean
  codigo?: string
  mensajes: string[]
  ambiente?: string
  rangos: RangoDian[]
}

export async function traerRangosDian(
  sedeId: string,
): Promise<RangosDianVista> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/rangos-dian`)
  return parseResponse<RangosDianVista>(res)
}

// ── Emisor de factura electrónica: asistente y certificado ───────────────────

export type AvisoCertificado = "por-vencer" | "vencido"

/** Emisor fiscal de la sede tal como lo expone el backend. Nunca trae secretos. */
export interface EmisorVista {
  id: string
  razonSocial?: string
  nit: string
  nitDv?: string
  tipoPersona?: string
  responsabilidadFiscal?: string
  direccion?: string
  departamento?: string
  ciudad?: string
  municipioDane?: string
  emailFacturacion?: string
  /** '1' producción, '2' habilitación. */
  tipoAmbiente: string
  habilitado: boolean
  facturaSoftwareId?: string
  certVenceAt?: string
  certTitular?: string
  certHuella?: string
  certificadoVigente: boolean
  certAviso: AvisoCertificado | null
  tieneFacturaPin: boolean
  tieneFacturaTestSetId: boolean
  tieneCertificado: boolean
}

/** Lo que le falta al emisor (espejo de `EstadoConfiguracion` del backend). */
export interface EstadoEmisor {
  faltaParaTransmitir: string[]
  datosFiscalesFaltantes: string[]
  tieneTestSetId: boolean
}

export interface EmisorConEstado {
  emisor: EmisorVista | null
  estado: EstadoEmisor | null
}

export async function getEmisorConEstado(sedeId: string): Promise<EmisorConEstado> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor`)
  return parseResponse<EmisorConEstado>(res)
}

export interface ConfigurarFacturaPayload {
  softwareId: string
  pin: string
  /** Ausente no toca el guardado; `null` lo borra. */
  testSetId?: string | null
}

/** Guarda SoftwareID, PIN (cifrado en el servidor) y TestSetId de factura. */
export async function configurarFacturaEmisor(
  sedeId: string,
  payload: ConfigurarFacturaPayload,
): Promise<EmisorConEstado> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/factura`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return parseResponse<EmisorConEstado>(res)
}

/**
 * Sube o reemplaza el .p12. FormData sin Content-Type a mano (el navegador
 * agrega el boundary). La contraseña viaja solo en esta petición.
 */
export async function cargarCertificadoEmisor(
  sedeId: string,
  archivo: File,
  password: string,
): Promise<{ emisor: EmisorVista | null; reemplazado: boolean }> {
  const body = new FormData()
  body.append("file", archivo)
  body.append("password", password)
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/certificado`, {
    method: "POST",
    body,
  })
  return parseResponse<{ emisor: EmisorVista | null; reemplazado: boolean }>(res)
}

// ── Set de pruebas de habilitación de la FACTURA ─────────────────────────────

export type TipoDocSetFactura = "fv" | "pos" | "nc" | "nd"

/**
 * `set_aceptado`: la DIAN no juzgó el documento porque el set ya estaba
 * aceptado. No es un rechazo.
 */
export type EstadoDocSetFactura = EstadoDocHabilitacion | "set_aceptado"

export interface ResumenTipoSetFactura {
  exigidos: number
  aceptados: number
  rechazados: number
  enCurso: number
}

/** Espejo de `VistaHabilitacionFactura` del backend. */
export interface HabilitacionFacturaVista {
  clase: "fe" | "pos"
  estado: "sin_iniciar" | "en_curso" | "aprobada"
  aprobada: boolean
  /** La DIAN aceptó el set y el emisor quedó `habilitado` (sigue en ambiente 2). */
  listoParaProduccion: boolean
  mensaje: string
  testSetId?: string
  resumen?: {
    porTipo: Partial<Record<TipoDocSetFactura, ResumenTipoSetFactura>>
    aprobada: boolean
    aceptados: number
    exigidos: number
    total: number
  }
  documentos: {
    tipo: TipoDocSetFactura
    etiqueta: string
    numero: string
    estado: EstadoDocSetFactura
    mensaje: string | null
    intentos: number
  }[]
  /** Algo que el dueño debe corregir (certificado, TestSetId…). */
  error?: string
}

/**
 * Arma, firma y envía lo pendiente del set de pruebas de factura (y reintenta
 * los rechazados). Pide `einvoicing.certificate`; lo que falte llega como 409
 * con el motivo en español. Puede tardar hasta un minuto.
 */
export async function enviarSetPruebasFactura(
  sedeId: string,
): Promise<HabilitacionFacturaVista> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/factura/habilitacion`, {
    method: "POST",
  })
  return parseResponse<HabilitacionFacturaVista>(res)
}

/** Reconsulta en la DIAN el veredicto de lo enviado; no envía nada nuevo. */
export async function getSetPruebasFactura(
  sedeId: string,
): Promise<HabilitacionFacturaVista> {
  const res = await authFetch(`/einvoicing/sedes/${sedeId}/emisor/factura/habilitacion`)
  return parseResponse<HabilitacionFacturaVista>(res)
}

/** Resultado de transmitir un documento de contingencia y sus notas, en orden. */
export interface ResultadoContingenciaFe {
  documento: ResultadoTransmisionFe
  notas: ResultadoTransmisionFe[]
  /** El documento y todas sus notas quedaron aceptados. */
  cerrada: boolean
}

/** Transmite a mano un documento de contingencia (`einvoicing.issue`). */
export async function transmitirContingencia(
  id: string,
): Promise<ResultadoContingenciaFe> {
  const res = await authFetch(`/einvoicing/documentos/${id}/contingencia/transmitir`, {
    method: "POST",
  })
  return parseResponse<ResultadoContingenciaFe>(res)
}
