/**
 * Glosario de términos del negocio, escrito para el comerciante y no para el
 * contador. Cada entrada se muestra dentro de un `<HelpTip>` junto a la
 * etiqueta del campo que la necesita.
 *
 * Reglas de redacción (respétalas al añadir términos):
 * 1. Una o dos frases. Si necesitas tres, el término está mal explicado.
 * 2. Lenguaje llano: nada de "base gravable", "sujeto pasivo" ni "causación".
 * 3. Siempre un ejemplo concreto y colombiano, con plata en pesos si aplica.
 * 4. Di también *para qué le sirve*, no solo qué es.
 */

/** Una entrada del glosario: el nombre corto y su explicación en llano. */
export interface EntradaGlosario {
  /** Nombre del término tal como lo ve el usuario. Corto, sin artículos. */
  titulo: string
  /** Explicación de 1–2 frases con ejemplo. */
  texto: string
}

export const GLOSARIO = {
  sku: {
    titulo: "SKU",
    texto:
      "El código con el que identificas cada producto en tu negocio. Puede ser el que trae de fábrica o uno tuyo, como 1001 para la Coca-Cola de 400 ml; lo importante es que no se repita.",
  },

  iva: {
    titulo: "IVA",
    texto:
      "El impuesto que le cobras al cliente en la venta y que después le entregas a la DIAN. La tarifa general en Colombia es del 19 %, pero hay productos que pagan menos o no pagan nada.",
  },
  ivaGravado: {
    titulo: "IVA gravado",
    texto:
      "El producto sí paga IVA y tú se lo cobras al cliente, casi siempre al 19 %: una gaseosa, un jabón, una cerveza. Es lo más común en una tienda.",
  },
  ivaExento: {
    titulo: "IVA exento",
    texto:
      "El producto está dentro del IVA pero con tarifa de 0 %: no le cobras nada al cliente. Es el caso de la carne, la leche, los huevos y el pescado fresco.",
  },
  ivaExcluido: {
    titulo: "IVA excluido",
    texto:
      "El producto queda por fuera del IVA: ni lo cobras ni lo declaras, como las frutas y verduras frescas. Se parece al exento, pero la DIAN los reporta distinto, así que marca el que sea.",
  },

  unidad: {
    titulo: "Unidad de medida",
    texto:
      "Cómo cuentas ese producto: unidades, kilos, litros o cajas. Usa siempre la unidad con la que lo vendes — si compras la gaseosa por caja de 24 pero la vendes suelta, mide en unidades y no en cajas.",
  },
  stockMinimo: {
    titulo: "Stock mínimo",
    texto:
      "La cantidad a partir de la cual quieres que te avisemos para volver a pedir. Si vendes 10 cajas a la semana y el proveedor se demora 3 días, pon 5.",
  },
  perecedero: {
    titulo: "Producto perecedero",
    texto:
      "El que se vence o se daña con el tiempo, como la leche, el pan o el pollo. Al marcarlo te pedimos la fecha de vencimiento y te avisamos antes de que se te dañe en la nevera.",
  },
  lote: {
    titulo: "Lote",
    texto:
      "Un grupo de unidades que entraron juntas, normalmente con la misma fecha de vencimiento. Sirve para vender primero lo más viejo y para saber qué sacar si el proveedor reporta un problema.",
  },
  codigoBarras: {
    titulo: "Código de barras",
    texto:
      "El código de rayas que trae el empaque y que lee la pistola en la caja, para no buscar el producto a mano. Si el producto no trae ninguno —una empanada, por ejemplo— déjalo vacío.",
  },
  categoria: {
    titulo: "Categoría",
    texto:
      "El grupo al que pertenece el producto: bebidas, aseo, panadería. Te sirve para encontrarlo rápido en el punto de venta y para ver en los reportes qué grupo te deja más plata.",
  },

  costo: {
    titulo: "Costo",
    texto:
      "Lo que a ti te vale el producto, sin lo que le sumas para ganar. Si la caja de 24 gaseosas te cuesta $36.000, el costo de una gaseosa es $1.500.",
  },
  precioVenta: {
    titulo: "Precio de venta",
    texto:
      "Lo que le cobras al cliente, con el IVA ya incluido. La diferencia con el costo es tu ganancia: si la gaseosa te cuesta $1.500 y la vendes en $2.500, ganas $1.000.",
  },

  receta: {
    titulo: "Receta",
    texto:
      "La lista de ingredientes que lleva un plato y cuánto de cada uno. Al vender una bandeja paisa se descuentan solos del inventario los 150 g de carne, el huevo y el chicharrón, sin que apuntes nada.",
  },
  montaje: {
    titulo: "Montaje",
    texto:
      "Lo que usas en el negocio pero no vendes: platos, vasos, cubiertos, uniformes. Se lleva por unidades y con lotes, para saber cuántos tienes y cuántos se te van rompiendo.",
  },

  sede: {
    titulo: "Sede",
    texto:
      "Cada local o punto de venta de tu negocio. Cada sede tiene su propio inventario y su propia caja, y los reportes los puedes ver por separado o todos juntos.",
  },
  variantes: {
    titulo: "Variantes",
    texto:
      "El mismo producto en distintas presentaciones: talla, color o tamaño. La camiseta negra S y la negra M se cuentan y se venden aparte, pero viven bajo un mismo producto.",
  },
} as const satisfies Record<string, EntradaGlosario>

/** Términos válidos del glosario. `HelpTip` lo usa para validar en compilación. */
export type TerminoGlosario = keyof typeof GLOSARIO
