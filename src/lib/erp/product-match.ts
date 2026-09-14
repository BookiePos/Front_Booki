/**
 * Parecido entre nombres de producto, para no llenar el inventario de
 * duplicados.
 *
 * Es espejo de `Backend/src/modules/inventory/domain/product-similarity.ts`:
 * la sugerencia "¿ya lo tienes?" que ve la persona tiene que salir del mismo
 * cálculo con que el servidor empareja solo. Si cambias uno, cambia el otro.
 */

/** Por debajo de esto, dos nombres no se sugieren como el mismo producto. */
export const SIMILAR_MIN_SCORE = 0.3

const STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "sin",
  "por",
  "para",
  "y",
  "x",
  "und",
  "unidad",
  "unidades",
  "ref",
])

const SHORT_UNITS = new Set(["l", "g"])

const UNIT_WORDS: Record<string, string> = {
  gr: "g",
  grs: "g",
  gramo: "g",
  gramos: "g",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
  mililitro: "ml",
  mililitros: "ml",
  cc: "ml",
}

function parts(value: string): { words: Set<string>; numbers: Set<string> } {
  const raw =
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .match(/\d+(?:[.,]\d+)?|[a-z]+/g) ?? []
  const words = new Set<string>()
  const numbers = new Set<string>()
  for (const token of raw) {
    if (/^\d/.test(token)) {
      numbers.add(String(Number(token.replace(",", "."))))
      continue
    }
    const word = UNIT_WORDS[token] ?? token
    if (STOP_WORDS.has(word)) continue
    if (word.length < 2 && !SHORT_UNITS.has(word)) continue
    words.add(word)
  }
  return { words, numbers }
}

/**
 * Parecido entre dos nombres, de 0 a 1: promedio de Jaccard y contención de
 * sus palabras, partido a la mitad si traen tamaños distintos ("500 g" y
 * "1000 g" son presentaciones distintas).
 */
export function productSimilarity(a: string, b: string): number {
  const left = parts(a)
  const right = parts(b)
  if (left.words.size === 0 || right.words.size === 0) return 0

  let shared = 0
  for (const word of left.words) {
    if (right.words.has(word)) shared += 1
  }
  if (shared === 0) return 0

  const jaccard = shared / (left.words.size + right.words.size - shared)
  const containment = shared / Math.min(left.words.size, right.words.size)
  let score = (jaccard + containment) / 2

  if (left.numbers.size > 0 && right.numbers.size > 0) {
    const sameSize = [...left.numbers].some((n) => right.numbers.has(n))
    if (!sameSize) score /= 2
  }
  return Math.round(score * 100) / 100
}

/** Los más parecidos a `query`, de mayor a menor. */
export function rankBySimilarity<T>(
  query: string,
  items: readonly T[],
  nameOf: (item: T) => string,
  { min = SIMILAR_MIN_SCORE, limit = 5 }: { min?: number; limit?: number } = {},
): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: productSimilarity(query, nameOf(item)) }))
    .filter((candidate) => candidate.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const UNIT_ALIASES: Record<string, string> = {
  u: "und",
  un: "und",
  und: "und",
  unidad: "und",
  unidades: "und",
  niu: "und",
  g: "g",
  gr: "g",
  grs: "g",
  gramo: "g",
  gramos: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  l: "l",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
  mililitro: "ml",
  mililitros: "ml",
}

/**
 * La unidad escrita de una sola forma. Espejo de `canonicalUnit` en
 * `Backend/src/modules/inventory/domain/product-merge.ts`: decide qué
 * productos se pueden fusionar.
 */
export function canonicalUnit(unit?: string | null): string {
  const clean = (unit ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.$/, "")
  return UNIT_ALIASES[clean] ?? clean
}
