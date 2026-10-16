import { numOr } from "@/lib/erp/finance-format"

/**
 * Precio unitario de un ítem de comanda. Campo vacío = "no lo escribió" y se
 * usa el precio del plato del menú; un 0 escrito a propósito (cortesía) se
 * respeta y no se pisa con el del menú.
 */
export function precioDeItem(itemPrice: string, precioMenu?: number): number {
  if (itemPrice.trim() === "") return precioMenu ?? 0
  return numOr(itemPrice, precioMenu ?? 0)
}

/**
 * Nuevo valor del campo de precio al cambiar el nombre. Elegir un plato del
 * menú trae su precio; pasar de un plato del menú a texto libre limpia el
 * precio heredado; en cualquier otro caso se deja lo que escribió el mesero.
 */
export function precioAlCambiarNombre(
  actual: string,
  platoNuevo: { salePrice: number } | undefined,
  habiaPlato: boolean,
): string {
  if (platoNuevo) return String(platoNuevo.salePrice)
  return habiaPlato ? "" : actual
}
