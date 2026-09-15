/**
 * La regla del SKU, en un solo sitio.
 *
 * El catálogo se da de alta con **SKU numérico de cinco dígitos para arriba**
 * (10001, 10002…). No es un capricho: es lo que la ficha de inventario exige
 * desde siempre —"El SKU debe ser numérico, mínimo 5 dígitos"— y lo que el
 * negocio tiene ya escrito en su catálogo.
 *
 * El problema que resuelve tener la regla aquí: la revisión de una factura por
 * foto proponía SKUs de otra forma, alfanuméricos sacados del nombre
 * ("ARROZ-DIANA-500"). Salían dos catálogos con dos criterios según por dónde
 * se hubiera creado el producto, y un SKU inventado se queda para siempre.
 * Peor: al corregirlo a mano se chocaba con uno ya existente y la factura
 * moría al aplicarse con un "Ya existe un producto con el SKU".
 *
 * Aquí está la regla, la validación y el siguiente número libre. Quien crea
 * productos —la ficha de inventario o la revisión de la factura— tira de esto.
 */

/** Mínimo de dígitos que se le exige a un SKU nuevo. */
export const SKU_MIN_DIGITOS = 5

/** Lo que se acepta al crear: solo dígitos, cinco o más. */
export const SKU_PATRON = /^\d{5,}$/

/** El mismo mensaje en toda la aplicación, para que no suene a dos sistemas. */
export const SKU_ERROR = `El SKU debe ser numérico, mínimo ${SKU_MIN_DIGITOS} dígitos`

/** Por dónde empieza la numeración en un catálogo que arranca de cero. */
export const PRIMER_SKU = 10001

/**
 * Los que cuentan para sacar el siguiente número.
 *
 * Se miran solo los de cinco y seis dígitos a propósito: un SKU de trece
 * dígitos es un código de barras que alguien pegó en la casilla equivocada, y
 * sumarle uno dejaría todo el catálogo numerando en billones.
 */
const CORRELATIVO = /^\d{5,6}$/

/** El SKU tal como se guarda: sin espacios y en mayúsculas. */
export function normalizarSku(sku: string): string {
  return sku.trim().toUpperCase()
}

/** ¿Sirve para crear un producto? */
export function skuValido(sku: string): boolean {
  return SKU_PATRON.test(sku.trim())
}

/**
 * El siguiente SKU libre: el mayor correlativo que ya existe, más uno.
 *
 * `ocupados` tiene que traer TODO lo que no se puede repetir —los productos del
 * inventario, activos e inactivos, y los SKU que ya se les propusieron a otros
 * renglones de la misma factura— porque el choque se descubre si no al aplicar,
 * cuando el servidor devuelve un 409 y la factura se queda a medio aplicar.
 */
export function siguienteSku(ocupados: Iterable<string>): string {
  const tomados = new Set<string>()
  let mayor = PRIMER_SKU - 1
  for (const bruto of ocupados) {
    const sku = normalizarSku(bruto ?? "")
    if (!sku) continue
    tomados.add(sku)
    if (CORRELATIVO.test(sku)) mayor = Math.max(mayor, Number(sku))
  }
  let siguiente = mayor + 1
  // El hueco siguiente puede estar tomado por un SKU largo (un código de
  // barras); se sigue subiendo hasta encontrar uno de verdad libre.
  while (tomados.has(String(siguiente))) siguiente += 1
  return String(siguiente)
}

/**
 * El SKU que se le propone a un renglón de factura.
 *
 * Si el proveedor trae su propio código Y ese código cumple la regla del
 * catálogo y está libre, se usa: la próxima factura del mismo proveedor
 * emparejará sola por SKU. En cualquier otro caso —código con letras, sin
 * código, o uno que ya está en el catálogo— se sigue la numeración de la casa.
 */
export function skuParaRenglon(
  codigoDelProveedor: string | undefined | null,
  ocupados: Iterable<string>,
): string {
  const tomados = new Set(
    [...ocupados].map((s) => normalizarSku(s ?? "")).filter(Boolean),
  )
  const codigo = normalizarSku(codigoDelProveedor ?? "")
  if (codigo && skuValido(codigo) && !tomados.has(codigo)) return codigo
  return siguienteSku(tomados)
}
