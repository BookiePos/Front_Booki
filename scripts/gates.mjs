#!/usr/bin/env node
/**
 * gates — la puerta de calidad del frontend, igual en Windows, Linux y CI.
 *
 * Una línea por gate: nombre, cifra y estado (OK / FALLA / SIN MEDIR). Si un gate
 * falla, deja el log completo en os.tmpdir() e imprime su ruta.
 *
 * La deuda existente se congela con techos en scripts/techos.json que SOLO bajan:
 *   - cuenta > techo  -> FALLA (deuda nueva)
 *   - cuenta < techo  -> FALLA pidiendo bajar el techo (para que la mejora no se pierda)
 * Un gate que no logra imprimir una cifra es SIN MEDIR y también falla: un chequeo
 * que no mide no protege nada.
 *
 * Uso: node scripts/gates.mjs [--build]
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const TECHOS = JSON.parse(readFileSync(path.join(RAIZ, "scripts", "techos.json"), "utf8"))
const CON_BUILD = process.argv.includes("--build")
const ES_WINDOWS = process.platform === "win32"
const MARCA = `bookipos-gates-${process.pid}`

function rutaLog(nombre) {
  return path.join(os.tmpdir(), `${MARCA}-${nombre}.log`)
}

/** pnpm es un .cmd en Windows: sin shell no se puede lanzar. */
function pnpm(args) {
  return ejecutar("pnpm", args, { shell: ES_WINDOWS })
}

function node(args) {
  return ejecutar(process.execPath, args, {})
}

function ejecutar(cmd, args, opciones) {
  const inicio = Date.now()
  const r = spawnSync(cmd, args, {
    cwd: RAIZ,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: process.env,
    ...opciones,
  })
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `\n[spawn] ${r.error.message}` : ""}`
  return { codigo: r.status ?? 1, salida, segundos: ((Date.now() - inicio) / 1000).toFixed(1) }
}

/** Compara una cuenta con su techo. Devuelve { estado, nota }. */
function contraTecho(cuenta, techo, clave) {
  if (cuenta > techo) return { estado: "FALLA", nota: `supera el techo ${techo} (+${cuenta - techo})` }
  if (cuenta < techo) {
    return { estado: "FALLA", nota: `techo holgado (${techo}): baja "${clave}" a ${cuenta} en scripts/techos.json` }
  }
  return { estado: "OK", nota: `techo ${techo}` }
}

function gateTsc() {
  const r = pnpm(["exec", "tsc", "--noEmit"])
  const errores = (r.salida.match(/error TS\d+/g) ?? []).length
  // Salida no-cero sin errores TS contables = tsc no llegó a medir (p. ej. no instalado).
  if (r.codigo !== 0 && errores === 0) return { cifra: "?", estado: "SIN MEDIR", nota: "tsc falló sin errores TS", log: r.salida }
  const { estado, nota } = contraTecho(errores, TECHOS.tscErrores, "tscErrores")
  return { cifra: `${errores} errores`, estado, nota, log: r.salida }
}

function gateLint() {
  const salidaJson = rutaLog("eslint-json")
  const r = pnpm(["exec", "eslint", ".", "-f", "json", "-o", `"${salidaJson}"`])
  let informe
  try {
    informe = JSON.parse(readFileSync(salidaJson, "utf8"))
  } catch {
    return { cifra: "?", estado: "SIN MEDIR", nota: "eslint no produjo JSON", log: r.salida }
  }
  let errores = 0
  let avisos = 0
  const porRegla = {}
  for (const archivo of informe) {
    errores += archivo.errorCount
    avisos += archivo.warningCount
    for (const m of archivo.messages) {
      if (m.severity !== 2) continue
      const regla = m.ruleId ?? "(parser)"
      porRegla[regla] = (porRegla[regla] ?? 0) + 1
    }
  }
  const detalle = Object.entries(porRegla)
    .sort((a, b) => b[1] - a[1])
    .map(([regla, n]) => `${n}\t${regla}`)
    .join("\n")
  const { estado, nota } = contraTecho(errores, TECHOS.lintErrores, "lintErrores")
  return {
    cifra: `${errores} errores, ${avisos} avisos`,
    estado,
    nota,
    log: `${r.salida}\nJSON completo: ${salidaJson}\n\nErrores por regla:\n${detalle}\n`,
  }
}

function gatePermisos() {
  const r = node([path.join("scripts", "check-permisos.mjs")])
  const m = r.salida.match(/(\d+) archivos, (\d+) literales/)
  if (!m) return { cifra: "?", estado: "SIN MEDIR", nota: "check-permisos no imprimió cifra", log: r.salida }
  return {
    cifra: `${m[2]} literales en ${m[1]} archivos`,
    estado: r.codigo === 0 ? "OK" : "FALLA",
    nota: r.codigo === 0 ? "" : r.salida.trim().split(/\r?\n/).at(-1),
    log: r.salida,
  }
}

function gateSecretos() {
  const script = path.join("scripts", "check-no-secrets.mjs")
  if (!existsSync(path.join(RAIZ, script))) {
    return { cifra: "?", estado: "SIN MEDIR", nota: `${script.split(path.sep).join("/")} no existe`, log: "" }
  }
  const r = node([script, "--arbol"])
  // No conocemos el formato exacto del script: exigimos al menos una cifra en su resumen.
  const lineas = r.salida.trim().split(/\r?\n/).filter(Boolean)
  const resumen = [...lineas].reverse().find((l) => /\d/.test(l))
  if (!resumen) return { cifra: "?", estado: "SIN MEDIR", nota: "check-no-secrets no imprimió cifra", log: r.salida }
  return { cifra: resumen.trim().slice(0, 80), estado: r.codigo === 0 ? "OK" : "FALLA", nota: "", log: r.salida }
}

function gateBuild() {
  const r = pnpm(["build"])
  return {
    cifra: `exit ${r.codigo} en ${r.segundos}s`,
    estado: r.codigo === 0 ? "OK" : "FALLA",
    nota: "",
    log: r.salida,
  }
}

const LISTA = [
  ["tsc", gateTsc],
  ["eslint", gateLint],
  ["permisos", gatePermisos],
  ["secretos", gateSecretos],
  ...(CON_BUILD ? [["build", gateBuild]] : []),
]

let fallos = 0
for (const [nombre, fn] of LISTA) {
  let res
  try {
    res = fn()
  } catch (err) {
    res = { cifra: "?", estado: "SIN MEDIR", nota: err.message, log: String(err.stack ?? err) }
  }
  let linea = `${nombre.padEnd(9)} ${res.estado.padEnd(9)} ${res.cifra}`
  if (res.nota) linea += ` — ${res.nota}`
  if (res.estado !== "OK") {
    fallos++
    if (res.log) {
      const ruta = rutaLog(nombre)
      writeFileSync(ruta, res.log)
      linea += ` [log: ${ruta}]`
    }
  }
  console.log(linea)
}

if (!CON_BUILD) console.log("build     (omitido: usa --build)")
console.log(fallos ? `\n${fallos} gate(s) sin pasar.` : "\nTodos los gates OK.")
process.exit(fallos ? 1 : 0)
