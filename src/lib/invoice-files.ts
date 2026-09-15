/**
 * De cualquier archivo que llegue a "Cargar facturas" a lo que entiende el API.
 *
 * El API recibe siempre una IMAGEN —es el soporte contable que se ve en la
 * revisión— y, cuando se puede, algo mejor que la imagen para leerla:
 *
 *  - el **XML de la factura electrónica** (suelto o dentro del ZIP que llega por
 *    correo): el backend lo lee con los datos exactos que se reportaron a la
 *    DIAN, sin IA;
 *  - el **texto** del documento (PDF con capa de texto, Word, Excel): se lee sin
 *    OCR, que es más exacto y más barato;
 *  - nada más, para fotos y escaneos: ahí trabaja el OCR.
 *
 * Todo se convierte aquí, en el navegador, por la misma razón que el PDF (ver
 * `lib/pdf.ts`): el backend sigue hablando de imágenes y el formato de entrada
 * no ata la funcionalidad a ningún proveedor de IA. Las librerías de cada
 * formato se cargan solo cuando llega un archivo de ese tipo.
 */
import { bitmapToJpegFile, detectFileKind } from "@/lib/images"
import { MAX_PDF_PAGES, pdfToImages } from "@/lib/pdf"
import { decodeTiff } from "@/lib/tiff"

/** Un documento listo para subir: una llamada al API, una factura. */
export interface UploadItem {
  /** Imagen de soporte (se reescala después con `prepareImageForUpload`). */
  image: File
  /** Texto exacto del documento: se lee sin OCR. */
  text?: string
  /** XML de la factura electrónica DIAN: se lee sin IA. */
  xml?: string
  /** Archivo del que salió, para los mensajes de error. */
  source: string
}

export interface ExpandResult {
  items: UploadItem[]
  /** Avisos que no impiden seguir (páginas de más, archivos ignorados). */
  warnings: string[]
}

/**
 * Peso máximo de la imagen cuando viaja con su XML. El XML firmado puede pesar
 * más de 1 MB y la función de Vercel no acepta cuerpos de más de 4.5 MB; con
 * el XML la imagen es solo soporte, así que se comprime más.
 */
export const XML_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024

/** Tope del XML que acepta el API (el campo de texto del formulario). */
const MAX_XML_CHARS = 2_800_000

/** Tope del texto de Word/Excel: una factura no llega ni cerca. */
const MAX_TEXT_CHARS = 60_000

/** Por debajo de esto un Word o Excel no trae una factura legible. */
const MIN_TEXT_CHARS = 40

/**
 * Límites del ZIP. Una factura electrónica trae dos o tres archivos pequeños;
 * lo que pase de aquí no es una factura y descomprimirlo entero podría tumbar
 * la pestaña (un "zip bomb" pesa kilobytes y se expande a gigas).
 */
const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024
const MAX_ZIP_ENTRIES = 40

const DOCUMENT_ROOT = /<([\w.-]+:)?(Invoice|CreditNote|DebitNote)[\s>]/

export async function expandUpload(file: File, depth = 0): Promise<ExpandResult> {
  const kind = await detectFileKind(file).catch(() => "unknown" as const)
  const name = file.name.toLowerCase()

  // Una página web descargada con extensión .pdf empieza con "<" y parecería
  // XML: se avisa como lo que la persona cree que subió, un PDF dañado.
  if (kind === "xml" && name.endsWith(".pdf")) {
    throw new Error(
      "No es un PDF válido (está dañado, incompleto o es otro tipo de archivo). Descárgalo otra vez o sube una foto de la factura.",
    )
  }

  switch (kind) {
    case "image":
    case "heic":
      return { items: [{ image: file, source: file.name }], warnings: [] }
    case "pdf":
      return expandPdf(file)
    case "tiff":
      return expandTiff(file)
    case "xml":
      return expandXml(await file.text(), file.name)
    case "zip":
      return expandZip(file, depth)
    case "iphone-ref":
      throw new Error(
        "Este archivo no es la factura: es un acceso directo que crea el iPhone al abrir un ZIP sin descomprimirlo. Sube el ZIP completo tal como llegó al correo, o en la app Archivos toca el ZIP para descomprimirlo y sube el PDF de la carpeta que se crea.",
      )
    case "ole":
      throw new Error(
        "Los archivos .doc y .xls antiguos no se pueden leer. Ábrelo y guárdalo como .docx, .xlsx o PDF.",
      )
    default:
      if (name.endsWith(".pdf")) {
        throw new Error(
          "No es un PDF válido (está dañado, incompleto o es otro tipo de archivo). Descárgalo otra vez o sube una foto de la factura.",
        )
      }
      throw new Error(
        "Este tipo de archivo no se puede leer. Sube una foto, un PDF, el ZIP o XML de la factura electrónica, un Word o un Excel.",
      )
  }
}

// ── PDF y TIFF: una imagen por página ────────────────────────────────────────

async function expandPdf(file: File): Promise<ExpandResult> {
  const { pages, totalPages } = await pdfToImages(file)
  if (pages.length === 0) throw new Error("No se pudo leer el PDF")
  return {
    items: pages.map((page) => ({ ...page, source: file.name })),
    warnings: tooManyPages(file.name, totalPages),
  }
}

async function expandTiff(file: File): Promise<ExpandResult> {
  const { pages, totalPages } = await decodeTiff(file, MAX_PDF_PAGES)
  const base = baseName(file.name)
  const items: UploadItem[] = []
  for (const [index, data] of pages.entries()) {
    const bitmap = await createImageBitmap(data)
    try {
      const image = await bitmapToJpegFile(bitmap, `${base}-p${index + 1}`)
      if (image) items.push({ image, source: file.name })
    } finally {
      bitmap.close()
    }
  }
  if (items.length === 0) throw new Error("No se pudo convertir la imagen TIFF")
  return { items, warnings: tooManyPages(file.name, totalPages) }
}

function tooManyPages(fileName: string, totalPages: number): string[] {
  return totalPages > MAX_PDF_PAGES
    ? [
        `${fileName} tiene ${totalPages} páginas: se procesaron las primeras ${MAX_PDF_PAGES}.`,
      ]
    : []
}

// ── XML de la factura electrónica ────────────────────────────────────────────

type XmlInspection =
  | { kind: "invoice"; invoice: Element; inner?: string }
  | { kind: "note" }
  | { kind: "other" }
  | { kind: "broken" }

/**
 * Qué trae el XML. Solo lo necesario para decidir y armar la imagen de
 * soporte: los datos que cuentan los lee el backend (`ubl-invoice.ts`).
 */
function inspectXml(xml: string): XmlInspection {
  const doc = new DOMParser().parseFromString(xml, "application/xml")
  if (doc.getElementsByTagName("parsererror").length > 0) return { kind: "broken" }
  const root = doc.documentElement
  if (root.localName === "Invoice") return { kind: "invoice", invoice: root }
  if (root.localName === "CreditNote" || root.localName === "DebitNote") {
    return { kind: "note" }
  }
  if (root.localName === "AttachedDocument") {
    // El contenedor del correo trae la factura firmada como texto (CDATA).
    for (const el of Array.from(root.getElementsByTagNameNS("*", "Description"))) {
      const content = el.textContent?.trim() ?? ""
      if (!DOCUMENT_ROOT.test(content)) continue
      const inner = inspectXml(content)
      if (inner.kind === "invoice") return { ...inner, inner: content }
      if (inner.kind === "note") return inner
    }
  }
  return { kind: "other" }
}

function xmlError(inspection: XmlInspection, fileName: string): Error | null {
  if (inspection.kind === "note") {
    return new Error(
      `${fileName} es una nota crédito o débito, no una factura de compra.`,
    )
  }
  if (inspection.kind === "broken") {
    return new Error(`${fileName} está dañado y no se puede leer. Descárgalo otra vez del correo.`)
  }
  if (inspection.kind === "other") {
    return new Error(`${fileName} no es una factura electrónica de la DIAN.`)
  }
  return null
}

async function expandXml(
  xml: string,
  fileName: string,
  support?: File,
): Promise<ExpandResult> {
  const inspection = inspectXml(xml)
  const error = xmlError(inspection, fileName)
  if (error || inspection.kind !== "invoice") throw error
  return {
    items: [
      {
        image:
          support ??
          (await textSnapshot(
            "Factura electrónica (XML de la DIAN)",
            invoiceSummary(inspection.invoice),
            fileName,
          )),
        xml: xmlForUpload(xml, inspection.inner),
        source: fileName,
      },
    ],
    warnings: [],
  }
}

/**
 * El contenedor completo pesa el doble que la factura (trae también la
 * respuesta de la DIAN). Si no cabe, se manda solo la factura de adentro, que
 * el backend lee igual.
 */
function xmlForUpload(xml: string, inner?: string): string {
  if (xml.length <= MAX_XML_CHARS) return xml
  if (inner && inner.length <= MAX_XML_CHARS) return inner
  throw new Error("El XML de la factura es demasiado grande para subirlo.")
}

function child(el: Element | undefined, ...path: string[]): Element | undefined {
  let current = el
  for (const name of path) {
    current = current
      ? Array.from(current.children).find((c) => c.localName === name)
      : undefined
  }
  return current
}

function textOf(el: Element | undefined): string | undefined {
  return el?.textContent?.trim() || undefined
}

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

function amount(el: Element | undefined): string {
  const value = Number(textOf(el))
  return Number.isFinite(value) && textOf(el) ? pesos.format(value) : "—"
}

/** Resumen legible de la factura para la imagen de soporte. */
function invoiceSummary(invoice: Element): string[] {
  const party = child(invoice, "AccountingSupplierParty", "Party")
  const scheme = child(party, "PartyTaxScheme")
  const lines = [
    `Número: ${textOf(child(invoice, "ID")) ?? "—"}`,
    `Fecha: ${textOf(child(invoice, "IssueDate")) ?? "—"}`,
    `Proveedor: ${textOf(child(scheme, "RegistrationName")) ?? textOf(child(party, "PartyName", "Name")) ?? "—"}`,
    `NIT: ${textOf(child(scheme, "CompanyID")) ?? "—"}`,
    `Total a pagar: ${amount(child(invoice, "LegalMonetaryTotal", "PayableAmount"))}`,
    "",
    "Renglones:",
  ]
  for (const line of Array.from(invoice.children).filter(
    (c) => c.localName === "InvoiceLine",
  )) {
    const qty = Number(textOf(child(line, "InvoicedQuantity")))
    lines.push(
      `${Number.isFinite(qty) ? qty : "?"} × ${textOf(child(line, "Item", "Description")) ?? "(sin descripción)"} = ${amount(child(line, "LineExtensionAmount"))}`,
    )
  }
  return lines
}

// ── ZIP: factura electrónica, Word o Excel ───────────────────────────────────

async function expandZip(file: File, depth: number): Promise<ExpandResult> {
  const { unzipSync } = await import("fflate")
  let entries: Record<string, Uint8Array>
  let count = 0
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => {
        count += 1
        return count <= MAX_ZIP_ENTRIES && entry.originalSize <= MAX_ZIP_ENTRY_BYTES
      },
    })
  } catch {
    throw new Error("El ZIP está dañado y no se puede abrir. Descárgalo otra vez del correo.")
  }

  // Word y Excel modernos también son ZIP: se reconocen por su estructura.
  if (entries["word/document.xml"]) return expandDocx(file)
  if (entries["xl/workbook.xml"]) return expandXlsx(file)

  if (depth > 0) {
    return { items: [], warnings: [`${file.name}: se ignoró un ZIP dentro de otro ZIP.`] }
  }

  const files = Object.entries(entries)
    .filter(([path, bytes]) => !path.endsWith("/") && !path.startsWith("__MACOSX") && bytes.length > 0)
    .map(([path, bytes]) => new File([bytes.slice()], path.split("/").pop() ?? path))

  const warnings: string[] = []
  const xmls: { file: File; xml: string }[] = []
  const others: File[] = []
  for (const entry of files) {
    if (entry.name.toLowerCase().endsWith(".xml")) {
      const xml = decodeXml(new Uint8Array(await entry.arrayBuffer()))
      const inspection = inspectXml(xml)
      if (inspection.kind === "invoice") xmls.push({ file: entry, xml })
      else if (inspection.kind === "note") throw xmlError(inspection, entry.name)
      // Otros XML (la respuesta de la DIAN suelta) no son la factura: se omiten.
    } else {
      others.push(entry)
    }
  }

  // Con XML se sube UNA factura por XML, con su PDF como imagen de soporte. El
  // resto de las páginas del PDF no hace falta: el XML trae todos los datos.
  if (xmls.length > 0) {
    const pdfs = others.filter((f) => f.name.toLowerCase().endsWith(".pdf"))
    const items: UploadItem[] = []
    for (const { file: entry, xml } of xmls) {
      const pdf =
        pdfs.find((p) => baseName(p.name) === baseName(entry.name)) ??
        (xmls.length === 1 ? pdfs[0] : undefined)
      const support = pdf ? await firstPdfPage(pdf) : undefined
      const result = await expandXml(xml, `${file.name} › ${entry.name}`, support)
      items.push(...result.items)
    }
    return { items, warnings }
  }

  // Sin XML: lo que haya adentro (PDF, fotos) se procesa como si se hubiera
  // subido suelto.
  const items: UploadItem[] = []
  for (const entry of others) {
    try {
      const result = await expandUpload(entry, depth + 1)
      items.push(...result.items.map((item) => ({ ...item, source: `${file.name} › ${item.source}` })))
      warnings.push(...result.warnings)
    } catch {
      warnings.push(`${file.name}: se omitió ${entry.name}, que no es una factura legible.`)
    }
  }
  if (items.length === 0) {
    throw new Error("El ZIP no trae ninguna factura (XML, PDF o imagen).")
  }
  return { items, warnings }
}

async function firstPdfPage(pdf: File): Promise<File | undefined> {
  try {
    const { pages } = await pdfToImages(pdf)
    return pages[0]?.image
  } catch {
    // Un PDF dañado no impide nada: el XML tiene los datos y la imagen de
    // soporte se arma con el resumen.
    return undefined
  }
}

/** Texto del XML respetando la codificación que declare (UTF-8 casi siempre). */
function decodeXml(bytes: Uint8Array): string {
  let head = ""
  for (const byte of bytes.slice(0, 200)) head += String.fromCharCode(byte)
  const encoding = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? "utf-8"
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

// ── Word y Excel: se leen de su texto ────────────────────────────────────────

async function expandDocx(file: File): Promise<ExpandResult> {
  const mod = await import("mammoth")
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod
  const { value } = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  })
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  return textItem(file, "Documento de Word", lines)
}

async function expandXlsx(file: File): Promise<ExpandResult> {
  const { default: readXlsxFile } = await import("read-excel-file/browser")
  const sheets = await readXlsxFile(file)
  const lines: string[] = []
  for (const { sheet, data } of sheets.slice(0, 3)) {
    if (sheets.length > 1) lines.push(`Hoja: ${sheet}`)
    for (const row of data) {
      const cells = row
        .map((cell) => {
          const value = cell as unknown
          if (value === null || value === undefined) return ""
          if (value instanceof Date) return value.toISOString().slice(0, 10)
          return String(value).replace(/\s+/g, " ").trim()
        })
        .filter(Boolean)
      if (cells.length > 0) lines.push(cells.join(" | "))
    }
  }
  return textItem(file, "Hoja de Excel", lines)
}

async function textItem(
  file: File,
  title: string,
  lines: string[],
): Promise<ExpandResult> {
  const text = lines.join("\n").slice(0, MAX_TEXT_CHARS)
  if (text.length < MIN_TEXT_CHARS) {
    throw new Error(
      `${title} sin texto legible: si la factura está pegada como imagen, súbela como foto o PDF.`,
    )
  }
  return {
    items: [
      { image: await textSnapshot(title, lines, file.name), text, source: file.name },
    ],
    warnings: [],
  }
}

// ── Imagen de soporte a partir de texto ──────────────────────────────────────

const SNAPSHOT = {
  width: 1400,
  padding: 56,
  fontSize: 24,
  lineHeight: 36,
  maxLines: 80,
} as const

/**
 * Dibuja el contenido como imagen. Un XML, un Word o un Excel no tienen "foto",
 * pero la factura necesita un soporte visible en la revisión y en el historial.
 */
async function textSnapshot(
  title: string,
  lines: string[],
  fileName: string,
): Promise<File> {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar la imagen del documento")

  const { width, padding, fontSize, lineHeight, maxLines } = SNAPSHOT
  const font = `${fontSize}px ui-monospace, Menlo, Consolas, monospace`
  ctx.font = font
  const maxWidth = width - padding * 2
  const wrapped = lines.flatMap((line) => wrap(ctx, line, maxWidth))
  const visible = wrapped.slice(0, maxLines)
  const truncated = wrapped.length > visible.length

  canvas.width = width
  canvas.height =
    padding * 2 + 64 + (visible.length + (truncated ? 1 : 0)) * lineHeight

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#111111"
  ctx.font = "bold 32px system-ui, sans-serif"
  ctx.fillText(title, padding, padding + 32)
  ctx.font = "20px system-ui, sans-serif"
  ctx.fillStyle = "#555555"
  ctx.fillText(fileName, padding, padding + 60, maxWidth)

  ctx.font = font
  ctx.fillStyle = "#111111"
  visible.forEach((line, index) => {
    ctx.fillText(line, padding, padding + 64 + (index + 1) * lineHeight)
  })
  if (truncated) {
    ctx.fillStyle = "#555555"
    ctx.fillText(
      `… y ${wrapped.length - visible.length} línea(s) más`,
      padding,
      padding + 64 + (visible.length + 1) * lineHeight,
    )
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  )
  if (!blob) throw new Error("No se pudo preparar la imagen del documento")
  return new File([blob], `${baseName(fileName)}.jpg`, { type: "image/jpeg" })
}

function wrap(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string[] {
  if (!line) return [""]
  const out: string[] = []
  let current = ""
  for (const word of line.split(" ")) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      out.push(current)
      current = word
    }
  }
  if (current) out.push(current)
  return out
}

function baseName(fileName: string): string {
  const last = fileName.split(/[\\/]/).pop() ?? fileName
  return last.replace(/\.[^.]+$/, "").toLowerCase() || "factura"
}
