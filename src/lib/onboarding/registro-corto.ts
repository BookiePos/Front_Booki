import type { BusinessPlan, BusinessType, RegisterPayload } from "@/lib/api"

/**
 * Registro corto (ítem 6.5). El alta pide solo lo que hace falta para crear la
 * cuenta: nombre del negocio, giro, plan, nombre y correo del dueño y la
 * contraseña. NIT, régimen, dirección y demás datos fiscales se piden después
 * (checklist de primeros pasos y sede); mientras tanto la sede nace sin ellos
 * y el backend aplica los valores por defecto del perfil fiscal.
 */
export interface RegistroCortoForm {
  businessName: string
  plan: BusinessPlan
  tipoNegocio: BusinessType
  ownerName: string
  ownerEmail: string
  password: string
  /** «¿Cobras IVA?»: "si", "no", "no_se" o vacío (sin responder). */
  cobraIva?: string
}

export function armarPayloadRegistro(form: RegistroCortoForm): RegisterPayload {
  return {
    businessName: form.businessName.trim(),
    plan: form.plan,
    tipoNegocio: form.tipoNegocio,
    ownerName: form.ownerName.trim(),
    ownerEmail: form.ownerEmail.trim(),
    password: form.password,
    // «No sé» o vacío no se manda: la sede queda con el default del backend.
    ...(form.cobraIva === "si" || form.cobraIva === "no"
      ? { cobraIva: form.cobraIva }
      : {}),
  }
}

export interface SedeFiscal {
  _id?: string
  nit?: string
  responsabilidadFiscal?: string
  address?: string
  ciudad?: string
}

const vacio = (v?: string) => !v || v.trim().length === 0

/** Datos fiscales de la sede que aún faltan (etiquetas para mostrar). */
export function datosFiscalesPendientes(sede: SedeFiscal): string[] {
  const falta: string[] = []
  if (vacio(sede.nit)) falta.push("NIT")
  if (vacio(sede.responsabilidadFiscal)) falta.push("Responsabilidad fiscal")
  if (vacio(sede.address)) falta.push("Dirección")
  if (vacio(sede.ciudad)) falta.push("Ciudad")
  return falta
}

/** ¿La sede aún no declara su responsabilidad fiscal? (`undefined`: no hay sede). */
export function sinResponsabilidadFiscal(sede?: SedeFiscal): boolean {
  return !!sede && vacio(sede.responsabilidadFiscal)
}

/** Primera sede a la que le faltan datos fiscales. */
export function primeraSedeConDatosPendientes<T extends SedeFiscal>(
  sedes: T[],
): T | undefined {
  return sedes.find((s) => datosFiscalesPendientes(s).length > 0)
}
