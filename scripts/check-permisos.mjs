#!/usr/bin/env node
/**
 * check-permisos — que el front no pida permisos que el backend no conoce.
 *
 * El catálogo vive en el backend (Backend/src/modules/core-auth/domain/permissions.ts).
 * Si el front escribe "caja.abrir" en vez de "caja.open", el chequeo de acceso
 * nunca pasa y la vista queda oculta para todos sin que nada falle en compilación.
 *
 * Qué hace:
 *   1. Lee el snapshot versionado scripts/permisos-backend.json.
 *   2. Si existe ../Backend, compara el snapshot con el catálogo real y falla si
 *      difieren (el CI no tiene el backend: ahí solo valida contra el snapshot).
 *   3. Recorre src/ buscando literales "<modulo>.<accion>" cuyo módulo sea uno del
 *      catálogo y falla si alguno no existe en el snapshot.
 *
 * Uso:
 *   node scripts/check-permisos.mjs              # chequeo
 *   node scripts/check-permisos.mjs --actualizar # regenera el snapshot desde ../Backend
 *
 * Variable opcional BOOKIPOS_BACKEND_DIR para apuntar a otro checkout del backend.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SNAPSHOT = path.join(RAIZ, "scripts", "permisos-backend.json")
const BACKEND = path.resolve(process.env.BOOKIPOS_BACKEND_DIR ?? path.join(RAIZ, "..", "Backend"))
const CATALOGO_REL = "src/modules/core-auth/domain/permissions.ts"
const CATALOGO = path.join(BACKEND, CATALOGO_REL)
const SRC = path.join(RAIZ, "src")
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join("/")
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])

/**
 * Literales con forma de permiso que NO son permisos. Cada entrada justifica por qué.
 * Añadir aquí es la única forma legítima de silenciar un falso positivo.
 */
const EXCLUSIONES = new Map([
  ["pos.buscar", "clave de localStorage del buscador del POS (src/lib/pos/busqueda.ts)"],
  ["pos.sedeId", "clave de localStorage de la sede de trabajo (src/lib/pos/sede-context.tsx)"],
  ["pos.printConfigured", "clave de localStorage de la impresora (src/app/(secure)/pos/page.tsx)"],
])

function leerCatalogoBackend() {
  const texto = readFileSync(CATALOGO, "utf8")
  // Solo el objeto PERMISSIONS: PERMISSION_GROUPS repite las claves por referencia.
  const bloque = texto.match(/export const PERMISSIONS\s*=\s*\{([\s\S]*?)\}\s*as const/)
  if (!bloque) throw new Error(`No encontré "export const PERMISSIONS = { ... } as const" en ${CATALOGO}`)
  const permisos = [...bloque[1].matchAll(/^\s*[A-Z0-9_]+\s*:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1])
  if (permisos.length === 0) throw new Error(`El bloque PERMISSIONS de ${CATALOGO} no tiene permisos legibles`)
  return [...new Set(permisos)].sort()
}

function leerSnapshot() {
  if (!existsSync(SNAPSHOT)) {
    throw new Error(`Falta ${rel(SNAPSHOT)}. Genéralo con --actualizar (requiere ../Backend).`)
  }
  const datos = JSON.parse(readFileSync(SNAPSHOT, "utf8"))
  if (!Array.isArray(datos.permisos) || datos.permisos.length === 0) {
    throw new Error(`${rel(SNAPSHOT)} no tiene una lista "permisos" válida`)
  }
  return datos.permisos
}

function* archivos(dir) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name)
    if (entrada.isDirectory()) yield* archivos(ruta)
    else if (EXTENSIONES.has(path.extname(entrada.name))) yield ruta
  }
}

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function main() {
  const actualizar = process.argv.includes("--actualizar")
  const hayBackend = existsSync(CATALOGO)

  if (actualizar) {
    if (!hayBackend) {
      console.error(`PERMISOS FALLA: --actualizar necesita el backend en ${CATALOGO}`)
      process.exit(1)
    }
    const permisos = leerCatalogoBackend()
    const datos = { fuente: `Backend/${CATALOGO_REL}`, total: permisos.length, permisos }
    writeFileSync(SNAPSHOT, JSON.stringify(datos, null, 2) + "\n")
    console.log(`PERMISOS: snapshot regenerado con ${permisos.length} permisos en ${rel(SNAPSHOT)}`)
    return
  }

  const errores = []
  const snapshot = leerSnapshot()
  const conocidos = new Set(snapshot)

  if (hayBackend) {
    const real = leerCatalogoBackend()
    const sobran = snapshot.filter((p) => !real.includes(p))
    const faltan = real.filter((p) => !conocidos.has(p))
    if (sobran.length || faltan.length) {
      errores.push(
        `El snapshot difiere del backend (${CATALOGO_REL}).` +
          (faltan.length ? `\n  nuevos en backend: ${faltan.join(", ")}` : "") +
          (sobran.length ? `\n  ya no existen en backend: ${sobran.join(", ")}` : "") +
          "\n  Revisa el front y regenera con: node scripts/check-permisos.mjs --actualizar",
      )
    }
  }

  // Módulos = primer segmento de cada permiso. La acción admite mayúsculas a
  // propósito: así "caja.Open" se detecta como error en vez de pasar inadvertido.
  const modulos = [...new Set(snapshot.map((p) => p.split(".")[0]))]
  const patron = new RegExp(
    `(["'\`])((?:${modulos.map(escaparRegex).join("|")})(?:\\.[A-Za-z_][A-Za-z0-9_]*)+)\\1`,
    "g",
  )

  let nArchivos = 0
  let nLiterales = 0
  for (const archivo of archivos(SRC)) {
    nArchivos++
    const lineas = readFileSync(archivo, "utf8").split(/\r?\n/)
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(patron)) {
        const literal = m[2]
        if (EXCLUSIONES.has(literal)) continue
        nLiterales++
        if (!conocidos.has(literal)) {
          errores.push(`${rel(archivo)}:${i + 1} permiso desconocido "${literal}"`)
        }
      }
    })
  }

  const origen = hayBackend ? "snapshot = backend" : "solo snapshot, sin ../Backend"
  const resumen = `${nArchivos} archivos, ${nLiterales} literales, ${snapshot.length} permisos en catálogo (${origen})`
  if (errores.length) {
    for (const e of errores) console.error(e)
    console.error(`PERMISOS FALLA: ${errores.length} problema(s); ${resumen}`)
    process.exit(1)
  }
  console.log(`PERMISOS OK: ${resumen}`)
}

try {
  main()
} catch (err) {
  console.error(`PERMISOS FALLA: ${err.message}`)
  process.exit(1)
}
