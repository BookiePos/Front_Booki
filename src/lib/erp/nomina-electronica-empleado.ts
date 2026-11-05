/**
 * Datos del empleado para la nómina electrónica DIAN (XSD 1.0.6).
 *
 * Los códigos son EXACTAMENTE los que acepta el backend
 * (constantes de empleados); cualquier otro da 400. Para limpiar un campo de
 * enumeración se envía `''`.
 */

export interface OpcionDian {
  value: string
  label: string
}

export const DIAN_DOC_TYPES: readonly OpcionDian[] = [
  { value: "11", label: "11 — Registro civil" },
  { value: "12", label: "12 — Tarjeta de identidad" },
  { value: "13", label: "13 — Cédula de ciudadanía" },
  { value: "21", label: "21 — Tarjeta de extranjería" },
  { value: "22", label: "22 — Cédula de extranjería" },
  { value: "31", label: "31 — NIT" },
  { value: "41", label: "41 — Pasaporte" },
  { value: "42", label: "42 — Documento de identificación extranjero" },
  { value: "47", label: "47 — PEP" },
  { value: "50", label: "50 — NIT de otro país" },
  { value: "91", label: "91 — NUIP" },
]

export const DIAN_TIPOS_TRABAJADOR: readonly OpcionDian[] = [
  { value: "01", label: "01 — Dependiente" },
  { value: "02", label: "02 — Servicio doméstico" },
  { value: "04", label: "04 — Madre comunitaria" },
  { value: "12", label: "12 — Aprendiz SENA en etapa lectiva" },
  { value: "18", label: "18 — Funcionario público sin tope máximo de IBC" },
  { value: "19", label: "19 — Aprendiz SENA en etapa productiva" },
  { value: "21", label: "21 — Estudiantes de postgrado en salud" },
  { value: "22", label: "22 — Profesor de establecimiento particular" },
  { value: "23", label: "23 — Estudiante, riesgos laborales" },
  { value: "30", label: "30 — Dependiente de entidad pública con régimen especial en salud" },
  { value: "31", label: "31 — Cooperado o precooperativa de trabajo asociado" },
  { value: "47", label: "47 — Dependiente de entidad beneficiaria del SGP, aportes patronales" },
  { value: "51", label: "51 — Trabajador de tiempo parcial" },
  { value: "54", label: "54 — Prepensionado de entidad en liquidación" },
  { value: "56", label: "56 — Prepensionado con aporte voluntario a salud" },
  { value: "58", label: "58 — Estudiantes de prácticas laborales en el sector público" },
]

export const DIAN_SUBTIPOS_TRABAJADOR: readonly OpcionDian[] = [
  { value: "00", label: "00 — No aplica" },
  { value: "01", label: "01 — Dependiente pensionado por vejez activo" },
]

export const DIAN_TIPOS_CONTRATO: readonly OpcionDian[] = [
  { value: "1", label: "1 — Término fijo" },
  { value: "2", label: "2 — Término indefinido" },
  { value: "3", label: "3 — Obra o labor" },
  { value: "4", label: "4 — Aprendizaje" },
  { value: "5", label: "5 — Prácticas o pasantías" },
]

export const DIAN_MEDIOS_PAGO: readonly OpcionDian[] = [
  { value: "1", label: "1 — Instrumento no definido" },
  { value: "10", label: "10 — Efectivo" },
  { value: "20", label: "20 — Cheque" },
  { value: "42", label: "42 — Consignación" },
  { value: "47", label: "47 — Transferencia débito bancaria" },
  { value: "48", label: "48 — Tarjeta crédito" },
  { value: "49", label: "49 — Tarjeta débito" },
]

/** Código DANE de municipio: 5 dígitos. */
export const DANE_MUNICIPIO = /^\d{5}$/

/** Estado del bloque «Datos para nómina electrónica» en el formulario. */
export interface FormNomina {
  secondLastName: string
  otherNames: string
  docTypeDian: string
  tipoTrabajador: string
  subTipoTrabajador: string
  altoRiesgoPension: boolean
  tipoContratoDian: string
  municipioDaneTrabajo: string
  direccionTrabajo: string
  medioPago: string
}

/** Campos DIAN tal como los devuelve el backend (todos opcionales). */
export type EmpleadoNomina = Partial<Omit<FormNomina, "altoRiesgoPension">> & {
  altoRiesgoPension?: boolean
}

export function nominaEnBlanco(): FormNomina {
  return {
    secondLastName: "",
    otherNames: "",
    docTypeDian: "",
    tipoTrabajador: "",
    subTipoTrabajador: "",
    altoRiesgoPension: false,
    tipoContratoDian: "",
    municipioDaneTrabajo: "",
    direccionTrabajo: "",
    medioPago: "",
  }
}

export function nominaDesdeEmpleado(e: EmpleadoNomina): FormNomina {
  return {
    secondLastName: e.secondLastName ?? "",
    otherNames: e.otherNames ?? "",
    docTypeDian: e.docTypeDian ?? "",
    tipoTrabajador: e.tipoTrabajador ?? "",
    subTipoTrabajador: e.subTipoTrabajador ?? "",
    altoRiesgoPension: e.altoRiesgoPension === true,
    tipoContratoDian: e.tipoContratoDian ?? "",
    municipioDaneTrabajo: e.municipioDaneTrabajo ?? "",
    direccionTrabajo: e.direccionTrabajo ?? "",
    medioPago: e.medioPago ?? "",
  }
}

/** Mensaje de error del municipio DANE, o null si está vacío o es válido. */
export function errorMunicipioDane(valor: string): string | null {
  const v = valor.trim()
  if (v === "" || DANE_MUNICIPIO.test(v)) return null
  return "El código DANE del municipio debe tener 5 dígitos."
}

/**
 * Campos DIAN del payload. Los vacíos se envían como `''` (el backend los
 * acepta y así se puede limpiar un valor ya guardado).
 */
export function payloadNomina(f: FormNomina): FormNomina {
  return {
    secondLastName: f.secondLastName.trim(),
    otherNames: f.otherNames.trim(),
    docTypeDian: f.docTypeDian,
    tipoTrabajador: f.tipoTrabajador,
    subTipoTrabajador: f.subTipoTrabajador,
    altoRiesgoPension: f.altoRiesgoPension,
    tipoContratoDian: f.tipoContratoDian,
    municipioDaneTrabajo: f.municipioDaneTrabajo.trim(),
    direccionTrabajo: f.direccionTrabajo.trim(),
    medioPago: f.medioPago,
  }
}

/** Prefijo de la máscara con que el backend devuelve la cuenta (`••••1234`). */
export const MASCARA_CUENTA = "••••"

/**
 * Número de cuenta a enviar: solo lo que el usuario escribió de nuevo. Vacío
 * (o una máscara que se coló) devuelve `undefined` y el campo no viaja: el
 * backend responde 400 si recibe algo que empieza por `••••` distinto de la
 * máscara guardada.
 */
export function cuentaParaEnviar(escrito: string): string | undefined {
  const v = escrito.trim()
  if (v === "" || v.startsWith(MASCARA_CUENTA)) return undefined
  return v
}

/** Texto de ayuda bajo el input de cuenta, o null si no hay cuenta registrada. */
export function textoCuentaRegistrada(
  e: { accountNumber?: string; tieneCuenta?: boolean } | null | undefined,
): string | null {
  if (!e?.tieneCuenta) return null
  const ultimos = (e.accountNumber ?? "").replace(MASCARA_CUENTA, "")
  return ultimos
    ? `Cuenta registrada terminada en ${ultimos}. Escribe otra solo si quieres cambiarla.`
    : "Hay una cuenta registrada. Escribe otra solo si quieres cambiarla."
}
