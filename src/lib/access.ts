/**
 * Clasificación de acceso por área. Un "usuario de POS" tiene `pos.sell`; un
 * "usuario de Operación" tiene algún permiso de back-office. Un rol puede
 * calificar para ambas (p. ej. Gerente).
 */

/** Área de trabajo a la que da acceso un usuario/rol. */
export type AccessArea = "pos" | "operacion"

/**
 * Acceso al punto de venta. Se gobierna con `pos.sell`; al darlo como permiso
 * extra se concede también `inventory.view` para que la persona vea la sección
 * de inventario del POS. Lo usan Usuarios y roles y el acceso de empleados: los
 * dos tienen que conceder exactamente lo mismo.
 */
export const POS_PERMISSION = "pos.sell"
export const POS_BUNDLE: readonly string[] = ["pos.sell", "inventory.view"]

/**
 * Permisos de "Operación" (back-office): con cualquiera de ellos el usuario
 * tiene sentido en el panel administrativo. Un cajero puro (solo POS/caja) no
 * tiene ninguno.
 */
export const OPERATION_PERMISSIONS = [
  "sede.manage",
  "reports.view",
  "finance.view",
  "finance.manage",
  "purchasing.manage",
  "users.manage",
  "roles.manage",
  "params.manage",
  "billing.manage",
  "audit.view",
  "tax.manage",
  "inventory.adjust",
  "inventory.transfer",
  "production.manage",
  "payroll.view",
  "payroll.manage",
  "employees.view",
  "employees.manage",
  "einvoicing.configure",
  "einvoicing.certificate",
  "payroll.einvoice",
] as const

/**
 * Permisos de facturación electrónica y nómina electrónica, con su grupo y su
 * etiqueta en español (espejo del catálogo del backend). `einvoicing.certificate`
 * (subir el certificado .p12) es solo del Dueño: el backend no lo reparte a
 * ningún otro rol, y la UI no debe ofrecerlo como si fuera delegable.
 */
export const PERMISOS_FE: readonly {
  key: string
  group: "Facturación electrónica" | "Nómina"
  label: string
  soloDueno?: boolean
}[] = [
  {
    key: "einvoicing.configure",
    group: "Facturación electrónica",
    label:
      "Configurar facturación electrónica (datos fiscales, resoluciones, credenciales DIAN)",
  },
  {
    key: "einvoicing.certificate",
    group: "Facturación electrónica",
    label: "Gestionar el certificado de firma digital (solo el Dueño)",
    soloDueno: true,
  },
  {
    key: "payroll.einvoice",
    group: "Nómina",
    label: "Emitir nómina electrónica ante la DIAN",
  },
]

/** ¿El conjunto de permisos habilita el punto de venta? */
export function permsAllowPos(perms: string[]): boolean {
  return perms.includes("pos.sell")
}

/** ¿El conjunto de permisos habilita la Operación (back-office)? */
export function permsAllowOperation(perms: string[]): boolean {
  return OPERATION_PERMISSIONS.some((p) => perms.includes(p))
}

/** ¿El rol (por sus permisos) sirve para el área indicada? */
export function roleFitsArea(perms: string[], area: AccessArea): boolean {
  return area === "pos" ? permsAllowPos(perms) : permsAllowOperation(perms)
}

// ─── Reglas de jerarquía (espejo de lo que el backend rechaza con 403) ──────
// La UI no es la barrera —el backend responde 403/400—, pero no debe ofrecer lo
// que sabe que se va a rechazar. Fuente: users.service.ts y roles.service.ts.

/** Clave del rol Dueño en el backend. */
export const OWNER_ROLE = "owner"

/** Permiso que habilita ver todas las sedes (el Dueño lo tiene siempre). */
const SEDE_VIEW_ALL = "sede.view_all"

/** Quien actúa en la pantalla de usuarios y roles. */
export interface Actor {
  id: string
  role: string
  permissions: string[]
  sedeIds: string[]
}

export function isOwnerActor(actor: Actor): boolean {
  return actor.role === OWNER_ROLE
}

/** ¿Ve todas las sedes? Dueño o permiso `sede.view_all`. */
export function actorSeesAllSedes(actor: Actor): boolean {
  return isOwnerActor(actor) || actor.permissions.includes(SEDE_VIEW_ALL)
}

/** ¿Puede conceder este permiso? Solo el Dueño concede sin tenerlo. */
export function actorCanGrant(actor: Actor, permission: string): boolean {
  return isOwnerActor(actor) || actor.permissions.includes(permission)
}

/** ¿Puede repartir esta sede? Quien no ve todas solo reparte las suyas. */
export function actorCanGrantSede(actor: Actor, sedeId: string): boolean {
  return actorSeesAllSedes(actor) || actor.sedeIds.includes(sedeId)
}
