/**
 * Generador ESC/POS (ítem 6.2). Solo produce bytes: no sabe nada de USB, de
 * puertos seriales ni del navegador, así que se prueba entero con Vitest.
 *
 * Decisiones que no son de gusto:
 *
 * - **Página de códigos CP858 por defecto.** Es CP850 (Europa occidental) con
 *   el euro en 0xD5; trae á é í ó ú ñ Ñ ü ¿ ¡, todo lo que necesita el
 *   español. Las térmicas la cargan con `ESC t 19` (Epson y clones) o, en
 *   las que no tienen la 19, `ESC t 2` (CP850), que se elige en la config.
 * - **Texto en monoespaciado.** Una tirilla térmica no tiene fuentes
 *   proporcionales: el ancho se cuenta en columnas (32 en 58 mm, 48 en
 *   80 mm con la fuente A), y la alineación de totales es relleno de espacios.
 */

export type AnchoPapel = 58 | 80
export type PaginaCodigos = "cp858" | "cp850"

/** Columnas por ancho de papel con la fuente A estándar. */
export const COLUMNAS: Record<AnchoPapel, number> = { 58: 32, 80: 48 }

/** Comandos fijos. */
export const CMD = {
  inicializar: [0x1b, 0x40], // ESC @
  /** GS V 66 3: avanza el papel hasta la cuchilla y hace corte parcial. */
  cortar: [0x1d, 0x56, 0x42, 0x03],
} as const

/** `n` de `ESC t n` para cada página de códigos. */
const TABLA_PAGINA: Record<PaginaCodigos, number> = { cp858: 19, cp850: 2 }

/**
 * Pulso de apertura de cajón: `ESC p m t1 t2`. `m` es el pin del conector
 * RJ11 (0 = pin 2, el habitual; 1 = pin 5); t1/t2 en unidades de 2 ms.
 */
export function pulsoCajon(pin: 0 | 1 = 0): Uint8Array {
  return Uint8Array.from([0x1b, 0x70, pin, 0x19, 0xfa])
}

// Posiciones altas (0x80-0xFF) de CP850/CP858 que usamos. Lo que no esté acá
// se descompone (ã → a) o sale como "?".
const ALTOS_CP850: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87,
  ê: 0x88, ë: 0x89, è: 0x8a, ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, Å: 0x8f,
  É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97,
  ÿ: 0x98, Ö: 0x99, Ü: 0x9a, ø: 0x9b, "£": 0x9c, Ø: 0x9d, "×": 0x9e,
  á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ª: 0xa6, º: 0xa7,
  "¿": 0xa8, "®": 0xa9, "¬": 0xaa, "½": 0xab, "¼": 0xac, "¡": 0xad,
  "«": 0xae, "»": 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, "©": 0xb8, Í: 0xd6,
  Î: 0xd7, Ï: 0xd8, Ó: 0xe0, Ô: 0xe2, Ò: 0xe3, Ú: 0xe9, Û: 0xea, Ù: 0xeb,
  "°": 0xf8, "·": 0xfa, "²": 0xfd,
}

/** Sustituciones previas: caracteres que el navegador/Intl produce y no existen. */
const NORMALIZAR: Record<string, string> = {
  " ": " ", // espacio duro del formateo de moneda
  " ": " ", // espacio fino de Intl en algunas versiones
  "−": "-", // signo menos
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
}

/** Texto → bytes de la página de códigos. Nunca lanza. */
export function codificarTexto(
  texto: string,
  pagina: PaginaCodigos = "cp858",
): Uint8Array {
  const out: number[] = []
  for (const original of texto) {
    const ch = NORMALIZAR[original] ?? original
    for (const c of ch) {
      const code = c.codePointAt(0) ?? 0x3f
      if (code === 0x0a) out.push(0x0a)
      else if (code >= 0x20 && code < 0x7f) out.push(code)
      else if (c === "€") out.push(pagina === "cp858" ? 0xd5 : 0x45)
      else if (c in ALTOS_CP850) out.push(ALTOS_CP850[c])
      else {
        const base = c.normalize("NFD").charAt(0)
        const b = base.codePointAt(0) ?? 0x3f
        out.push(b >= 0x20 && b < 0x7f ? b : 0x3f)
      }
    }
  }
  return Uint8Array.from(out)
}

export interface OpcionesBuilder {
  ancho: AnchoPapel
  paginaCodigos?: PaginaCodigos
}

/** Longitud visual de un texto ya normalizado (1 byte = 1 columna). */
function largo(texto: string): number {
  return codificarTexto(texto).length
}

export class EscposBuilder {
  private partes: Uint8Array[] = []
  readonly columnas: number
  private readonly pagina: PaginaCodigos

  constructor(opciones: OpcionesBuilder) {
    this.columnas = COLUMNAS[opciones.ancho]
    this.pagina = opciones.paginaCodigos ?? "cp858"
  }

  private crudo(bytes: ArrayLike<number>) {
    this.partes.push(Uint8Array.from(bytes))
    return this
  }

  /** ESC @ y selección de la página de códigos. */
  inicializar() {
    return this.crudo([...CMD.inicializar, 0x1b, 0x74, TABLA_PAGINA[this.pagina]])
  }

  alinear(a: "izquierda" | "centro" | "derecha") {
    return this.crudo([0x1b, 0x61, { izquierda: 0, centro: 1, derecha: 2 }[a]])
  }

  negrita(on: boolean) {
    return this.crudo([0x1b, 0x45, on ? 1 : 0])
  }

  /** Texto con salto de línea, partido por palabras al ancho del papel. */
  texto(t: string) {
    for (const l of this.partir(t)) {
      this.partes.push(codificarTexto(l, this.pagina), Uint8Array.of(0x0a))
    }
    return this
  }

  /** Línea con la etiqueta a la izquierda y el valor pegado a la derecha. */
  fila(izquierda: string, derecha: string) {
    const der = codificarTexto(derecha, this.pagina).length
    const maxIzq = Math.max(0, this.columnas - der - 1)
    let izq = izquierda
    while (largo(izq) > maxIzq && izq.length > 0) izq = izq.slice(0, -1)
    const relleno = Math.max(1, this.columnas - largo(izq) - der)
    this.partes.push(
      codificarTexto(izq + " ".repeat(relleno) + derecha, this.pagina),
      Uint8Array.of(0x0a),
    )
    return this
  }

  separador(caracter = "-") {
    return this.crudo([
      ...Array(this.columnas).fill(caracter.charCodeAt(0)),
      0x0a,
    ])
  }

  /** Avanza `n` líneas en blanco. */
  avanzar(n = 1) {
    return this.crudo(Array(n).fill(0x0a))
  }

  cortar() {
    return this.crudo(CMD.cortar)
  }

  abrirCajon(pin: 0 | 1 = 0) {
    return this.crudo(pulsoCajon(pin))
  }

  build(): Uint8Array {
    const total = this.partes.reduce((n, p) => n + p.length, 0)
    const out = new Uint8Array(total)
    let o = 0
    for (const p of this.partes) {
      out.set(p, o)
      o += p.length
    }
    return out
  }

  private partir(t: string): string[] {
    const lineas: string[] = []
    for (const parrafo of t.split("\n")) {
      let actual = ""
      for (let palabra of parrafo.split(/\s+/).filter(Boolean)) {
        // Palabra más larga que la línea: se corta a la fuerza.
        while (largo(palabra) > this.columnas) {
          if (actual) {
            lineas.push(actual)
            actual = ""
          }
          lineas.push(palabra.slice(0, this.columnas))
          palabra = palabra.slice(this.columnas)
        }
        const candidata = actual ? `${actual} ${palabra}` : palabra
        if (largo(candidata) <= this.columnas) actual = candidata
        else {
          lineas.push(actual)
          actual = palabra
        }
      }
      lineas.push(actual)
    }
    return lineas
  }
}
