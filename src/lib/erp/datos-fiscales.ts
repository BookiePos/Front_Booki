/**
 * Datos fiscales del cliente para la factura electrónica (Anexo técnico FEV
 * 1.9 de la DIAN). Espejo del catálogo del backend
 * (`customers/domain/datos-fiscales.ts`): el backend sigue siendo la fuente de
 * verdad; aquí solo se ofrecen las opciones y una ayuda para el DV.
 */

export const DIAN_DOC_TYPE_LABELS = {
  "11": "Registro civil",
  "12": "Tarjeta de identidad",
  "13": "Cédula de ciudadanía",
  "21": "Tarjeta de extranjería",
  "22": "Cédula de extranjería",
  "31": "NIT",
  "41": "Pasaporte",
  "42": "Documento de identificación extranjero",
  "47": "PEP (Permiso Especial de Permanencia)",
  "48": "PPT (Permiso por Protección Temporal)",
  "50": "NIT de otro país",
  "91": "NUIP",
} as const
export type DianDocType = keyof typeof DIAN_DOC_TYPE_LABELS

export const DIAN_DOC_TYPE_OPTIONS = (
  Object.keys(DIAN_DOC_TYPE_LABELS) as DianDocType[]
).map((v) => ({ value: v, label: `${v} · ${DIAN_DOC_TYPE_LABELS[v]}` }))

export const TIPO_PERSONA_OPTIONS = [
  { value: "1", label: "Persona jurídica" },
  { value: "2", label: "Persona natural" },
] as const

export const RESPONSABILIDADES_OPTIONS = [
  { value: "O-13", label: "O-13 · Gran contribuyente" },
  { value: "O-15", label: "O-15 · Autorretenedor" },
  { value: "O-23", label: "O-23 · Agente de retención de IVA" },
  { value: "O-47", label: "O-47 · Régimen simple de tributación" },
  { value: "R-99-PN", label: "R-99-PN · No responsable" },
] as const

export const REGIMEN_OPTIONS = [
  { value: "responsable_iva", label: "Responsable de IVA" },
  { value: "no_responsable_iva", label: "No responsable de IVA" },
] as const

export const AVISO_SIN_TIPO_DIAN =
  "Sin tipo de documento DIAN, las ventas a este cliente salen como consumidor final"

const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

/**
 * Dígito de verificación del NIT (módulo 11 de la DIAN), mismo algoritmo del
 * backend. Devuelve undefined si no son solo dígitos o pasa de 15.
 */
export function calcularDvNit(nitBase: string): number | undefined {
  const digitos = nitBase.trim()
  if (!/^\d{1,15}$/.test(digitos)) return undefined
  let suma = 0
  for (let i = 0; i < digitos.length; i++) {
    suma += Number(digitos[digitos.length - 1 - i]) * PESOS_DV[i]!
  }
  const resto = suma % 11
  return resto > 1 ? 11 - resto : resto
}

/** Municipio DANE: exactamente 5 dígitos (vacío es válido: es opcional). */
export function municipioDaneValido(v: string): boolean {
  return v.trim() === "" || /^\d{5}$/.test(v.trim())
}

/** Un error 400 del backend que habla del DV va pegado al campo «DV». */
export function esErrorDv(message: string): boolean {
  return /\bDV\b|dígito de verificación/i.test(message)
}

export interface DatosFiscalesForm {
  dianDocType: string
  nitDv: string
  tipoPersona: string
  responsabilidadesFiscales: string[]
  regimen: string
  municipioDane: string
  emailFacturacion: string
  address: string
}

export const DATOS_FISCALES_VACIOS: DatosFiscalesForm = {
  dianDocType: "",
  nitDv: "",
  tipoPersona: "",
  responsabilidadesFiscales: [],
  regimen: "",
  municipioDane: "",
  emailFacturacion: "",
  address: "",
}

/**
 * Arma el fragmento fiscal del payload. En edición se envía la cadena vacía
 * (y `[]` en las responsabilidades) para BORRAR un campo, como espera el
 * backend; al crear, lo vacío se omite. El DV solo viaja con tipo 31.
 */
export function payloadDatosFiscales(f: DatosFiscalesForm, isNew: boolean) {
  const vacio = <T extends string>(v: string): T | undefined =>
    v.trim() ? (v.trim() as T) : isNew ? undefined : ("" as T)
  const esNit = f.dianDocType === "31"
  return {
    dianDocType: vacio(f.dianDocType),
    nitDv: esNit ? vacio(f.nitDv) : isNew ? undefined : "",
    tipoPersona: vacio(f.tipoPersona),
    responsabilidadesFiscales:
      f.responsabilidadesFiscales.length > 0 || !isNew
        ? f.responsabilidadesFiscales
        : undefined,
    regimen: vacio(f.regimen),
    municipioDane: vacio(f.municipioDane),
    emailFacturacion: vacio(f.emailFacturacion),
    address: vacio(f.address),
  }
}
