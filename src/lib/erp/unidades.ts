/**
 * Las unidades de medida del sistema, con nombre de persona.
 *
 * Antes esto era una lista suelta de seis abreviaturas —`["und","kg","g","lb","l","ml"]`—
 * escrita dentro de la pantalla de inventario. Tenía dos problemas:
 *
 * 1. **Se leía en clave.** En el desplegable salía "g" y "lb", y quien da de
 *    alta un insumo tiene que adivinar si "lb" es libra o litro. Aquí cada
 *    unidad trae su nombre completo y su abreviatura: "Gramo (g)".
 * 2. **Le faltaba la arroba**, que es como se compra media Colombia —la panela,
 *    la papa, el queso— y no estaba por ningún lado.
 *
 * La diferencia que hay que tener clara, porque es la que confunde:
 *
 * - **Unidad de consumo** (esta lista): cómo se CUENTA el insumo por dentro.
 *   La harina en gramos, porque así la piden las recetas.
 * - **Presentación de compra** (`PRESENTACIONES_SUGERIDAS`): cómo LLEGA del
 *   proveedor. Bultos, cajas, canastas. Ver `purchase-unit.ts`.
 *
 * Por eso el **bulto no está en esta lista y sí en la otra**: un bulto no es
 * una medida, es un empaque. Un bulto de harina trae 25 kg, uno de papa trae
 * 50 kg y uno de arroz trae 12,5. Si se guardara como unidad de consumo, el
 * sistema no sabría cuánta harina hay: sabría "tres bultos" y ya. Se escribe
 * como presentación, con su contenido al lado, y el sistema convierte.
 *
 * La **arroba sí es una medida** —12,5 kg exactos— así que está en las dos: se
 * puede llevar el inventario en arrobas y también comprar por arrobas.
 */

/** Una unidad de medida tal como se ofrece y se lee en pantalla. */
export interface Unidad {
  /** Lo que se guarda en el producto. No se traduce ni se cambia nunca. */
  value: string
  /** Abreviatura para tablas y cifras apretadas: "g", "kg", "arr". */
  corta: string
  /** Nombre en singular, para frases: "gramo". */
  singular: string
  /** Nombre en plural: "gramos". */
  plural: string
  /** Cómo sale en el desplegable: "Gramo (g)". */
  label: string
  /** Para agrupar el desplegable y saber qué se convierte con qué. */
  familia: "conteo" | "masa" | "volumen"
  /** Pista corta bajo el desplegable, con un ejemplo del negocio. */
  ejemplo: string
}

/**
 * Las unidades en que se puede llevar el inventario, en el orden en que se
 * ofrecen: primero la unidad suelta, que es la que usa casi todo el mundo;
 * después masa y volumen, de la medida chica a la grande.
 */
export const UNIDADES: Unidad[] = [
  {
    value: "und",
    corta: "und",
    singular: "unidad",
    plural: "unidades",
    label: "Unidad (und)",
    familia: "conteo",
    ejemplo: "Lo que se cuenta de a uno: una galleta, una gaseosa, una bolsa.",
  },
  {
    value: "g",
    corta: "g",
    singular: "gramo",
    plural: "gramos",
    label: "Gramo (g)",
    familia: "masa",
    ejemplo: "Lo que las recetas piden en gramos: harina, azúcar, mantequilla.",
  },
  {
    value: "kg",
    corta: "kg",
    singular: "kilogramo",
    plural: "kilogramos",
    label: "Kilogramo (kg)",
    familia: "masa",
    ejemplo: "1 kg = 1.000 gramos.",
  },
  {
    value: "lb",
    corta: "lb",
    singular: "libra",
    plural: "libras",
    label: "Libra (lb)",
    familia: "masa",
    ejemplo: "1 libra = 500 gramos, como se pide en la plaza.",
  },
  {
    value: "arroba",
    corta: "arr",
    singular: "arroba",
    plural: "arrobas",
    label: "Arroba (@)",
    familia: "masa",
    ejemplo: "1 arroba = 12,5 kilos. Panela, papa, queso, café.",
  },
  {
    value: "ml",
    corta: "ml",
    singular: "mililitro",
    plural: "mililitros",
    label: "Mililitro (ml)",
    familia: "volumen",
    ejemplo: "Lo que se mide líquido y en poca cantidad: esencias, colorantes.",
  },
  {
    value: "l",
    corta: "L",
    singular: "litro",
    plural: "litros",
    label: "Litro (L)",
    familia: "volumen",
    ejemplo: "1 litro = 1.000 mililitros. Leche, aceite, jugo.",
  },
]

/** Títulos de los grupos del desplegable, en el orden en que van. */
export const FAMILIAS: { familia: Unidad["familia"]; titulo: string }[] = [
  { familia: "conteo", titulo: "Se cuenta de a uno" },
  { familia: "masa", titulo: "Se pesa" },
  { familia: "volumen", titulo: "Se mide líquido" },
]

const POR_VALOR = new Map(UNIDADES.map((u) => [u.value, u]))

/** La unidad completa, o `undefined` si es una que escribió alguien a mano. */
export function unidad(value: string | undefined | null): Unidad | undefined {
  return value ? POR_VALOR.get(value) : undefined
}

/**
 * La abreviatura para pintar al lado de una cifra.
 * Ante una unidad desconocida devuelve lo que venga: en una base vieja puede
 * haber guardado "paquete" a mano y es mejor mostrarlo que borrarlo.
 */
export function unidadCorta(value: string | undefined | null): string {
  return unidad(value)?.corta ?? (value || "und")
}

/** El nombre para frases: "3 gramos", "1 gramo". */
export function unidadNombre(
  value: string | undefined | null,
  cantidad = 2,
): string {
  const u = unidad(value)
  if (!u) return value || "unidad"
  return Math.abs(cantidad) === 1 ? u.singular : u.plural
}

/**
 * Presentaciones que se le sugieren a quien escribe cómo compra un insumo.
 *
 * Es una lista de arranque, NO una camisa de fuerza: el campo sigue admitiendo
 * texto libre porque nadie puede prever cómo despacha un proveedor ("paca",
 * "guacal", "media caneca"). Lo que hace es que quien nunca ha llenado esto
 * vea de qué se está hablando.
 *
 * El `contenido` es lo que se rellena por cortesía cuando ya se sabe cuánto
 * trae; `null` significa "esto lo tiene que escribir la persona, porque
 * depende del proveedor". El bulto es el caso claro: cada producto trae lo
 * suyo.
 */
export interface PresentacionSugerida {
  /** Lo que se guarda en `purchaseUnit`. */
  nombre: string
  /** Para qué familia de unidad tiene sentido ofrecerla. */
  familias: Unidad["familia"][]
  /** Cuánto trae, en la unidad base de su familia (g o ml). */
  contenido: number | null
  /** Nota que se muestra al escogerla. */
  nota: string
}

export const PRESENTACIONES_SUGERIDAS: PresentacionSugerida[] = [
  {
    nombre: "bulto",
    familias: ["masa"],
    contenido: null,
    nota: "Escribe cuánto trae: hay bultos de 25, de 50 y de 12,5 kilos.",
  },
  {
    nombre: "arroba",
    familias: ["masa"],
    contenido: 12_500,
    nota: "Una arroba son 12,5 kilos.",
  },
  {
    nombre: "kilo",
    familias: ["masa"],
    contenido: 1_000,
    nota: "Un kilo son 1.000 gramos.",
  },
  {
    nombre: "libra",
    familias: ["masa"],
    contenido: 500,
    nota: "Una libra son 500 gramos. Una arroba son 25 libras.",
  },
  {
    nombre: "saco",
    familias: ["masa"],
    contenido: null,
    nota: "Escribe cuánto trae el saco.",
  },
  {
    nombre: "garrafa",
    familias: ["volumen"],
    contenido: 20_000,
    nota: "Las garrafas más comunes traen 20 litros. Cámbialo si la tuya no.",
  },
  {
    nombre: "litro",
    familias: ["volumen"],
    contenido: 1_000,
    nota: "Un litro son 1.000 mililitros.",
  },
  {
    nombre: "botella",
    familias: ["volumen"],
    contenido: null,
    nota: "Escribe cuántos mililitros trae la botella.",
  },
  {
    nombre: "caja",
    familias: ["conteo", "masa", "volumen"],
    contenido: null,
    nota: "Escribe cuántas unidades trae la caja.",
  },
  {
    nombre: "paquete",
    familias: ["conteo", "masa", "volumen"],
    contenido: null,
    nota: "Escribe cuántas unidades trae el paquete.",
  },
  {
    nombre: "canasta",
    familias: ["conteo", "volumen"],
    contenido: null,
    nota: "Escribe cuántas unidades trae la canasta.",
  },
  {
    nombre: "docena",
    familias: ["conteo"],
    contenido: 12,
    nota: "Una docena son 12 unidades.",
  },
]

/** Las presentaciones que tiene sentido ofrecerle a un insumo según su unidad. */
export function presentacionesPara(value: string | undefined | null) {
  const familia = unidad(value)?.familia
  if (!familia) return PRESENTACIONES_SUGERIDAS
  return PRESENTACIONES_SUGERIDAS.filter((p) => p.familias.includes(familia))
}
