/**
 * Utilidades CSV mínimas y sin dependencias: serializar, parsear (con comillas y
 * saltos de línea dentro de campos) y disparar la descarga en el navegador.
 */

type CsvCell = string | number | boolean | null | undefined

/** Marca de orden de bytes (BOM) para que Excel abra el CSV como UTF-8. */
const BOM = String.fromCharCode(0xfeff)

/** Escapa un valor para CSV (comillas dobles y separadores). */
function escapeCell(value: CsvCell): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Construye el texto CSV a partir de encabezados y filas. */
export function serializeCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((r) => r.map(escapeCell).join(",")),
  ]
  return lines.join("\r\n")
}

/**
 * Parsea CSV a una matriz de celdas de texto. Soporta comillas dobles,
 * separadores y saltos de línea dentro de campos entre comillas. Descarta el
 * BOM inicial y las filas totalmente vacías.
 */
export function parseCsv(text: string): string[][] {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < t.length; i += 1) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c !== "\r") {
      field += c
    }
  }
  // Último campo/fila pendiente (archivo sin salto de línea final).
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0]?.trim() === ""))
}

/** Dispara la descarga de un archivo CSV (con BOM para Excel en UTF-8). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
