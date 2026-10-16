import {
  type ImportProductRow,
  type ImportStockRow,
  type InvProduct,
  type StockRow,
} from "@/lib/erp/api-inventory"
import { unidadDesdeTexto } from "@/lib/erp/unidades"
import { serializeCsv } from "@/lib/erp/csv"

// ─── CSV de inventario (importar / exportar) ──────────────────────────────────

/** Columnas del CSV, en orden. Se usan como encabezado al exportar. */
export const CSV_COLUMNS = [
  "sku",
  "name",
  "itemType",
  "category",
  "unit",
  "purchaseUnit",
  "purchaseFactor",
  "barcode",
  "brand",
  "supplier",
  "description",
  "weight",
  "perishable",
  "trackLots",
  "shelfLifeDays",
  "minStock",
  "cost",
  "salePrice",
  "active",
] as const
export type CsvKey = (typeof CSV_COLUMNS)[number]

/** Normaliza un encabezado para comparar (minúsculas, sin tildes ni símbolos). */
export function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

/** Alias aceptados de cada columna (encabezado normalizado → clave canónica). */
export const HEADER_ALIASES: Record<string, CsvKey> = {
  sku: "sku",
  codigo: "sku",
  cod: "sku",
  name: "name",
  nombre: "name",
  producto: "name",
  itemtype: "itemType",
  tipo: "itemType",
  category: "category",
  categoria: "category",
  unit: "unit",
  unidad: "unit",
  um: "unit",
  purchaseunit: "purchaseUnit",
  presentacion: "purchaseUnit",
  unidadcompra: "purchaseUnit",
  unidaddecompra: "purchaseUnit",
  purchasefactor: "purchaseFactor",
  factor: "purchaseFactor",
  factorcompra: "purchaseFactor",
  contenidopresentacion: "purchaseFactor",
  barcode: "barcode",
  codigobarras: "barcode",
  codigodebarras: "barcode",
  ean: "barcode",
  brand: "brand",
  marca: "brand",
  supplier: "supplier",
  proveedor: "supplier",
  description: "description",
  descripcion: "description",
  weight: "weight",
  peso: "weight",
  contenido: "weight",
  perishable: "perishable",
  perecedero: "perishable",
  tracklots: "trackLots",
  lotes: "trackLots",
  controlalotes: "trackLots",
  shelflifedays: "shelfLifeDays",
  vidautil: "shelfLifeDays",
  diasvida: "shelfLifeDays",
  minstock: "minStock",
  stockminimo: "minStock",
  minimo: "minStock",
  existenciaminima: "minStock",
  cost: "cost",
  costo: "cost",
  saleprice: "salePrice",
  precio: "salePrice",
  precioventa: "salePrice",
  preciodeventa: "salePrice",
  pvp: "salePrice",
  active: "active",
  activo: "active",
  estado: "active",
}

/**
 * Sinónimos de unidad que se aceptan al importar.
 *
 * Lo que se GUARDA sigue siendo el código de siempre (`g`, `kg`, `arroba`) —el
 * CSV que se exporta no cambia ni una letra— pero quien arma la planilla en
 * Excel escribe "kilos" o "@", no "kg". Antes esas filas entraban con la
 * unidad literal y el insumo quedaba medido en algo que el sistema no sabe
 * convertir. Cualquier palabra que no esté en la tabla pasa tal cual, que es
 * como se respetan las unidades raras que alguien ya tenía escritas.
 *
 * La tabla vive en `lib/erp/unidades.ts` desde que la revisión de la factura
 * por foto necesitó traducir lo mismo: lo que el modelo lee del papel es
 * "UND", "KGS" o "LITROS", nunca el código del sistema.
 */
export const normalizeUnitValue = unidadDesdeTexto

export const NUMERIC_KEYS = new Set<CsvKey>([
  "weight",
  "purchaseFactor",
  "shelfLifeDays",
  "minStock",
  "cost",
  "salePrice",
])
export const BOOLEAN_KEYS = new Set<CsvKey>([
  "perishable",
  "trackLots",
  "active",
])
export const VALID_ITEM_TYPES = new Set(["product", "ingredient", "assembly"])

export function parseCsvNumber(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".")
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function parseCsvBool(raw: string): boolean | undefined {
  const s = normHeader(raw)
  if (
    ["true", "1", "si", "x", "yes", "y", "verdadero", "activo", "v"].includes(s)
  )
    return true
  if (["false", "0", "no", "n", "inactivo", "f"].includes(s)) return false
  return undefined
}

/** Convierte los productos a filas CSV (incluye inactivos para respaldo). */
export function productsToCsv(products: InvProduct[]): string {
  const rows = products.map((p) => [
    p.sku,
    p.name,
    p.itemType,
    p.categoryId?.name ?? "",
    p.unit,
    p.purchaseUnit ?? "",
    p.purchaseFactor ?? "",
    p.barcode ?? "",
    p.brand ?? "",
    p.supplier ?? "",
    p.description ?? "",
    p.weight ?? "",
    p.perishable,
    p.trackLots,
    p.shelfLifeDays ?? "",
    p.minStock,
    p.cost,
    p.salePrice ?? "",
    p.active,
  ])
  return serializeCsv([...CSV_COLUMNS], rows)
}

/**
 * Convierte la matriz parseada del CSV a filas de importación. La primera fila
 * son encabezados (se mapean por alias). Solo se incluyen los campos con valor,
 * para no sobrescribir con vacío al actualizar.
 */
export function csvToImportRows(matrix: string[][]): ImportProductRow[] {
  if (matrix.length < 2) return []
  const headers = matrix[0]!.map((h) => HEADER_ALIASES[normHeader(h)])
  const out: ImportProductRow[] = []
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r]!
    const row: ImportProductRow = {}
    const target = row as Record<string, unknown>
    headers.forEach((key, c) => {
      if (!key) return
      const raw = (cells[c] ?? "").trim()
      if (!raw) return
      if (NUMERIC_KEYS.has(key)) {
        const n = parseCsvNumber(raw)
        if (n !== undefined) target[key] = n
      } else if (BOOLEAN_KEYS.has(key)) {
        const b = parseCsvBool(raw)
        if (b !== undefined) target[key] = b
      } else if (key === "itemType") {
        if (VALID_ITEM_TYPES.has(raw)) target[key] = raw
      } else if (key === "unit") {
        target[key] = normalizeUnitValue(raw)
      } else {
        target[key] = raw
      }
    })
    // Ignora filas sin ningún dato útil.
    if (row.sku || row.name) out.push(row)
  }
  return out
}

/** CSV de ejemplo (encabezados + una fila) para descargar como plantilla. */
export function csvTemplate(): string {
  const example = [
    "SKU-001",
    "Producto de ejemplo",
    "product",
    "Bebidas",
    "und",
    "caja",
    "12",
    "7701234567890",
    "Marca",
    "Proveedor",
    "Descripción opcional",
    "",
    "false",
    "false",
    "",
    "5",
    "1000",
    "2500",
    "true",
  ]
  return serializeCsv([...CSV_COLUMNS], [example])
}

// ─── CSV de existencias (exportar snapshot / importar carga) ──────────────────

/** Columnas del snapshot de existencias que se exporta. */
export const STOCK_EXPORT_COLUMNS = [
  "sku",
  "name",
  "sede",
  "qty",
  "minStock",
  "value",
] as const
/** Columnas de la plantilla de carga (importación = entradas). */
export const STOCK_IMPORT_COLUMNS = [
  "sku",
  "sede",
  "qty",
  "unitCost",
  "lotCode",
  "expiresAt",
  "supplier",
  "note",
] as const
export type StockCsvKey = (typeof STOCK_IMPORT_COLUMNS)[number]

export const STOCK_HEADER_ALIASES: Record<string, StockCsvKey> = {
  sku: "sku",
  codigo: "sku",
  sede: "sede",
  sucursal: "sede",
  local: "sede",
  qty: "qty",
  cantidad: "qty",
  existencia: "qty",
  existencias: "qty",
  stock: "qty",
  unitcost: "unitCost",
  costo: "unitCost",
  costounitario: "unitCost",
  lotcode: "lotCode",
  lote: "lotCode",
  codigolote: "lotCode",
  expiresat: "expiresAt",
  vencimiento: "expiresAt",
  vence: "expiresAt",
  caducidad: "expiresAt",
  fechavencimiento: "expiresAt",
  supplier: "supplier",
  proveedor: "supplier",
  note: "note",
  nota: "note",
  observacion: "note",
}

export const STOCK_NUMERIC_KEYS = new Set<StockCsvKey>(["qty", "unitCost"])

/** Normaliza una fecha del CSV a YYYY-MM-DD (acepta DD/MM/AAAA). */
export function normCsvDate(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s
}

/** Snapshot de existencias (lo que se ve) a CSV. */
export function stockToCsv(rows: StockRow[]): string {
  const data = rows.map((r) => [
    r.product.sku,
    r.product.name,
    r.sede?.name ?? "",
    r.qty,
    r.minStock,
    r.value,
  ])
  return serializeCsv([...STOCK_EXPORT_COLUMNS], data)
}

/** Convierte la matriz del CSV a filas de carga de existencias. */
export function csvToStockRows(matrix: string[][]): ImportStockRow[] {
  if (matrix.length < 2) return []
  const headers = matrix[0]!.map((h) => STOCK_HEADER_ALIASES[normHeader(h)])
  const out: ImportStockRow[] = []
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r]!
    const row: ImportStockRow = {}
    const target = row as Record<string, unknown>
    headers.forEach((key, c) => {
      if (!key) return
      const raw = (cells[c] ?? "").trim()
      if (!raw) return
      if (STOCK_NUMERIC_KEYS.has(key)) {
        const n = parseCsvNumber(raw)
        if (n !== undefined) target[key] = n
      } else if (key === "expiresAt") {
        target[key] = normCsvDate(raw)
      } else {
        target[key] = raw
      }
    })
    if (row.sku || row.sede || row.qty !== undefined) out.push(row)
  }
  return out
}

/** Plantilla de carga de existencias (encabezados + una fila de ejemplo). */
export function stockTemplate(): string {
  const example = [
    "SKU-001",
    "Principal",
    "20",
    "1000",
    "",
    "",
    "Proveedor",
    "",
  ]
  return serializeCsv([...STOCK_IMPORT_COLUMNS], [example])
}
