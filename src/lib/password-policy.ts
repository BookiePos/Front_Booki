/**
 * Política de contraseña. Réplica de `POLITICA_CONTRASENA` del backend
 * (core-auth/application/dto/password-policy.ts): 8 caracteres o más, con
 * minúscula, mayúscula, número y símbolo. El backend la exige en registro,
 * alta y edición de usuario, invitación y recuperación; validarla aquí solo
 * adelanta el mensaje para no mandar un formulario que va a volver con 400.
 */
export const PASSWORD_MIN = 8

export const PASSWORD_REQUISITOS =
  "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo (como ! @ # $ % . -)."

/**
 * Los "símbolos" que cuenta el backend (`isStrongPassword` de validator.js): un
 * conjunto fijo, no cualquier carácter raro. "¿", "¡" o "€" NO cuentan; si aquí
 * contaran, el formulario pasaría y el servidor respondería 400.
 */
const SIMBOLO = /[-#!$@£%^&*()_+|~=`{}[\]:";'<>?,./\\ ]/

/** Devuelve el motivo por el que la contraseña no cumple, o null si cumple. */
export function validarPassword(password: string): string | null {
  const faltan: string[] = []
  if (password.length < PASSWORD_MIN) faltan.push(`al menos ${PASSWORD_MIN} caracteres`)
  if (!/[a-z]/.test(password)) faltan.push("una minúscula")
  if (!/[A-Z]/.test(password)) faltan.push("una mayúscula")
  if (!/[0-9]/.test(password)) faltan.push("un número")
  if (!SIMBOLO.test(password)) faltan.push("un símbolo")
  if (faltan.length === 0) return null
  return `La contraseña necesita ${faltan.join(", ")}.`
}
