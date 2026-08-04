/**
 * Clasificación de acceso por área. Un "usuario de POS" tiene `pos.sell`; un
 * "usuario de Operación" tiene algún permiso de back-office. Un rol puede
 * calificar para ambas (p. ej. Gerente).
 */

/** Área de trabajo a la que da acceso un usuario/rol. */
export type AccessArea = "pos" | "operacion"

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
  "audit.view",
  "tax.manage",
  "inventory.adjust",
  "inventory.transfer",
  "payroll.view",
  "payroll.manage",
  "employees.view",
  "employees.manage",
] as const

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
