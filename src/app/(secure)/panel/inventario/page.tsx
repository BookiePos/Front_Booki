"use client"

import * as React from "react"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  Check,
  X,
  ShieldOff,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  TriangleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Download,
  Upload,
  FileUp,
  CheckCircle2,
  Search,
  CircleAlert,
  Minus,
  Loader2,
  SlidersHorizontal,
  FolderTree,
  Boxes as BoxesIcon,
  Package,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  ScanSearch,
  Wrench,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  listSedes,
  listProducts,
  createProduct,
  createProductVariants,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getStock,
  getLots,
  listLots,
  getAlerts,
  getMovements,
  createEntry,
  createAdjustment,
  createTransfer,
  importProducts,
  importStock,
  applyStockCount,
  type ImportProductRow,
  type ImportResult,
  type ImportStockRow,
  type ImportStockResult,
  ADJUST_REASON_LABELS,
  MOVEMENT_TYPE_LABELS,
  ITEM_TYPE_LABELS,
  type ItemType,
  type Sede,
  type InvProduct,
  type InvCategory,
  type StockRow,
  type InvLot,
  type InvLotRow,
  type LotStatus,
  type InvAlerts,
  type MovementsPage,
  type AdjustReason,
  type MovementType,
  type StockCountResult,
} from "@/lib/erp/api-inventory"
import {
  convertUnits,
  costoPorUnidad,
  describirContenido,
  precioDePresentacion,
  presentacionDeCompra,
  sugerirPresentacion,
} from "@/lib/erp/purchase-unit"
import { unidad, unidadCorta, unidadNombre } from "@/lib/erp/unidades"
import {
  PresentacionCompraPicker,
  UnidadSelect,
} from "@/components/erp/unidad-fields"
import { TrazabilidadDialog } from "@/components/erp/trazabilidad-dialog"
import { ReporteMermaDialog } from "@/components/erp/reporte-merma-dialog"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { serializeCsv, parseCsv, downloadCsv } from "@/lib/erp/csv"

import { PageHeader } from "@/components/erp/page-header"
import { Button, ButtonLabel } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FormDialog,
  FormDivider,
  FormSection,
  FormAlert,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"
import { Segmented } from "@/components/ui/segmented"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Enlaza el botón Guardar del pie del diálogo con el <form> del cuerpo. */
const VARIANTS_FORM_ID = "ficha-producto-variantes"
const PRODUCT_FORM_ID = "ficha-producto-inventario"
const ENTRY_FORM_ID = "ficha-entrada-mercancia"
const ADJUST_FORM_ID = "ficha-ajuste-inventario"
const TRANSFER_FORM_ID = "ficha-traslado-sedes"

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
// Totales en plata: la caja colombiana no maneja centavos.
const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})
// Para costos unitarios pequeños (tras conversión de unidades) que se
// distorsionarían al redondear a 0 decimales (ej. $8,33 por gramo).
const moneyUnit = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Muestra un costo unitario en la presentación en que se COMPRA el insumo:
 * $3,80 el gramo guardado se lee como "$95.000 / bulto", que es el número que
 * el dueño reconoce. Sin presentación definida se muestra por su unidad.
 */
function formatUnitCost(
  cost: number,
  p: Pick<InvProduct, "unit" | "purchaseUnit" | "purchaseFactor">,
): string {
  const pres = presentacionDeCompra(p)
  return `${moneyUnit.format(precioDePresentacion(cost, pres.factor))} / ${pres.unidad}`
}
const df = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" })
// Los vencimientos se guardan como fecha pura (medianoche UTC); se formatean
// en UTC para que no se corran un día por la zona horaria local.
const dfUTC = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "UTC",
})
const dtf = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeStyle: "short",
})

/** Normaliza para comparar nombres: minúsculas, sin tildes ni espacios extra. */
function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

// ─── CSV de inventario (importar / exportar) ──────────────────────────────────

/** Columnas del CSV, en orden. Se usan como encabezado al exportar. */
const CSV_COLUMNS = [
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
type CsvKey = (typeof CSV_COLUMNS)[number]

/** Normaliza un encabezado para comparar (minúsculas, sin tildes ni símbolos). */
function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

/** Alias aceptados de cada columna (encabezado normalizado → clave canónica). */
const HEADER_ALIASES: Record<string, CsvKey> = {
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
 * convertir. Cualquier palabra que no esté aquí pasa tal cual, que es como se
 * respetan las unidades raras que alguien ya tenía escritas.
 */
const UNIT_VALUE_ALIASES: Record<string, string> = {
  und: "und",
  unidad: "und",
  unidades: "und",
  u: "und",
  gr: "g",
  g: "g",
  gramo: "g",
  gramos: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  lb: "lb",
  libra: "lb",
  libras: "lb",
  arroba: "arroba",
  arrobas: "arroba",
  ar: "arroba",
  arr: "arroba",
  ml: "ml",
  mililitro: "ml",
  mililitros: "ml",
  cc: "ml",
  l: "l",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
}

/** Traduce lo escrito en la columna "unidad" al código que se guarda. */
function normalizeUnitValue(raw: string): string {
  // La arroba se escribe "@" en media Colombia y `normHeader` se come el
  // símbolo entero, así que se atiende antes de normalizar.
  if (raw.trim() === "@") return "arroba"
  return UNIT_VALUE_ALIASES[normHeader(raw)] ?? raw.trim()
}

const NUMERIC_KEYS = new Set<CsvKey>([
  "weight",
  "purchaseFactor",
  "shelfLifeDays",
  "minStock",
  "cost",
  "salePrice",
])
const BOOLEAN_KEYS = new Set<CsvKey>(["perishable", "trackLots", "active"])
const VALID_ITEM_TYPES = new Set(["product", "ingredient", "assembly"])

function parseCsvNumber(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".")
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function parseCsvBool(raw: string): boolean | undefined {
  const s = normHeader(raw)
  if (["true", "1", "si", "x", "yes", "y", "verdadero", "activo", "v"].includes(s))
    return true
  if (["false", "0", "no", "n", "inactivo", "f"].includes(s)) return false
  return undefined
}

/** Convierte los productos a filas CSV (incluye inactivos para respaldo). */
function productsToCsv(products: InvProduct[]): string {
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
function csvToImportRows(matrix: string[][]): ImportProductRow[] {
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
function csvTemplate(): string {
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
const STOCK_EXPORT_COLUMNS = [
  "sku",
  "name",
  "sede",
  "qty",
  "minStock",
  "value",
] as const
/** Columnas de la plantilla de carga (importación = entradas). */
const STOCK_IMPORT_COLUMNS = [
  "sku",
  "sede",
  "qty",
  "unitCost",
  "lotCode",
  "expiresAt",
  "supplier",
  "note",
] as const
type StockCsvKey = (typeof STOCK_IMPORT_COLUMNS)[number]

const STOCK_HEADER_ALIASES: Record<string, StockCsvKey> = {
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

const STOCK_NUMERIC_KEYS = new Set<StockCsvKey>(["qty", "unitCost"])

/** Normaliza una fecha del CSV a YYYY-MM-DD (acepta DD/MM/AAAA). */
function normCsvDate(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s
}

/** Snapshot de existencias (lo que se ve) a CSV. */
function stockToCsv(rows: StockRow[]): string {
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
function csvToStockRows(matrix: string[][]): ImportStockRow[] {
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
function stockTemplate(): string {
  const example = ["SKU-001", "Principal", "20", "1000", "", "", "Proveedor", ""]
  return serializeCsv([...STOCK_IMPORT_COLUMNS], [example])
}

/**
 * Selección inicial del selector de proveedor: prioriza la referencia
 * registrada, luego el texto legado (buscando por nombre) y por último nada.
 */
function initialSupplierSel(
  suppliers: Supplier[],
  supplierId?: string,
  supplierText?: string,
): string {
  if (supplierId && suppliers.some((s) => s._id === supplierId)) {
    return supplierId
  }
  if (supplierText) {
    const byName = suppliers.find(
      (s) => s.name.toLowerCase() === supplierText.toLowerCase(),
    )
    if (byName) return byName._id
    // Texto libre que no corresponde a ningún proveedor: se conserva.
    return "legacy"
  }
  return "none"
}

/** Selector de proveedores activos con opción para el texto legado. */
function SupplierSelect({
  id,
  suppliers,
  value,
  legacyText,
  onChange,
}: {
  id: string
  suppliers: Supplier[]
  value: string
  legacyText: string
  onChange: (v: string) => void
}) {
  const items: Record<string, string> = {
    none: "Sin proveedor",
    ...(legacyText ? { legacy: `${legacyText} (no registrado)` } : {}),
    ...Object.fromEntries(
      suppliers
        .filter((s) => s.active || s._id === value)
        .map((s) => [s._id, s.name]),
    ),
  }
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(v) => {
        if (v !== null) onChange(v)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Sin proveedor" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Días hasta el vencimiento comparando fechas de calendario (no horas). */
function daysUntil(date: string): number {
  const d = new Date(date)
  const expiry = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((expiry - today) / 86400000)
}

/** Fecha local en formato YYYY-MM-DD para inputs type="date". */
function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ExpiryBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const d = daysUntil(date)
  if (d < 0) return <Badge variant="destructive">Vencido</Badge>
  if (d === 0) return <Badge variant="destructive">Vence hoy</Badge>
  if (d <= 7) return <Badge variant="destructive">Vence en {d} d</Badge>
  if (d <= 60) return <Badge variant="outline">Vence en {d} d</Badge>
  // Más de dos meses: se expresa en meses para no mostrar "Vence en 240 d".
  return <Badge variant="outline">Vence en {Math.round(d / 30)} m</Badge>
}

function MovementBadge({ type }: { type: MovementType }) {
  const negative = ["adjust_out", "waste", "transfer_out", "sale"].includes(type)
  return (
    <Badge variant={negative ? "destructive" : "secondary"}>
      {MOVEMENT_TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

function TableSkeleton({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Mapas value→etiqueta para que el Select muestre nombres y no ids. */
function productItems(list: InvProduct[]): Record<string, string> {
  return Object.fromEntries(list.map((p) => [p._id, `${p.name} · ${p.sku}`]))
}

function sedeItems(list: Sede[]): Record<string, string> {
  return Object.fromEntries(list.map((s) => [s._id, s.name]))
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}

// ─── Product sheet ───────────────────────────────────────────────────────────

interface ProductSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  product?: InvProduct
  products: InvProduct[]
  categories: InvCategory[]
  suppliers: Supplier[]
  onSuccess: () => void
  /** Cierra este sheet y abre "Entrada" con el producto preseleccionado. */
  onRegisterEntry: (productId: string) => void
}

function ProductSheet({
  open,
  onOpenChange,
  mode,
  product,
  products,
  categories,
  suppliers,
  onSuccess,
  onRegisterEntry,
}: ProductSheetProps) {
  const [sku, setSku] = React.useState("")
  const [itemType, setItemType] = React.useState<ItemType>("ingredient")
  const [name, setName] = React.useState("")
  const [brand, setBrand] = React.useState("")
  const [supplierSel, setSupplierSel] = React.useState("none")
  const [legacySupplier, setLegacySupplier] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [categoryId, setCategoryId] = React.useState<string>("none")
  const [unit, setUnit] = React.useState("und")
  const [weight, setWeight] = React.useState("")
  // Cómo se COMPRA, cuando no es como se consume. Vacíos = se compra por su
  // propia unidad, que es lo normal en casi todo el catálogo.
  const [purchaseUnit, setPurchaseUnit] = React.useState("")
  const [purchaseFactor, setPurchaseFactor] = React.useState<number | null>(null)
  const [barcode, setBarcode] = React.useState("")
  const [perishable, setPerishable] = React.useState(false)
  const [expiresAt, setExpiresAt] = React.useState("")
  const [minStock, setMinStock] = React.useState<number | null>(null)
  const [cost, setCost] = React.useState<number | null>(null)
  const [salePrice, setSalePrice] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Producto existente confirmado por el backend (409) al intentar crear. */
  const [conflictProduct, setConflictProduct] =
    React.useState<InvProduct | null>(null)

  // Detección en vivo de duplicados (solo al crear). El SKU exacto es la
  // señal fuerte; el nombre por prefijo de palabra es solo una pista.
  const skuClash =
    mode === "create" && sku.trim()
      ? products.find((p) => p.active && p.sku === sku.trim().toUpperCase())
      : undefined
  const nameQuery = normalizeName(name)
  const nameClash =
    mode === "create" && !skuClash && nameQuery.length >= 4
      ? products.find((p) => {
          if (!p.active) return false
          const norm = normalizeName(p.name)
          return (
            norm.startsWith(nameQuery) ||
            norm.split(/\s+/).some((w) => w.startsWith(nameQuery))
          )
        })
      : undefined
  const duplicate = conflictProduct ?? skuClash ?? nameClash
  // Formulario reducido para ingredientes: identidad + unidad + venta.
  // Peso, precio de compra y vencimiento se capturan en cada entrada.
  const isIngredient = itemType === "ingredient"

  // Unidad en la que se CONSUME: la que el formulario deja elegir para los
  // insumos, y `und` para todo lo demás (así lo manda el payload).
  const unidadConsumo = isIngredient ? unit : "und"
  const presentacionNombre = purchaseUnit.trim()
  const factorValido = purchaseFactor != null && purchaseFactor > 0
  // Cómo se lee la unidad en las frases de ayuda: "gramos", "g".
  const unidadPlural = unidadNombre(unidadConsumo)
  const unidadAbrev = unidadCorta(unidadConsumo)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && product) {
        setSku(product.sku)
        setItemType(product.itemType ?? "product")
        setName(product.name)
        setBrand(product.brand ?? "")
        setLegacySupplier(product.supplier ?? "")
        setSupplierSel(
          initialSupplierSel(suppliers, product.supplierId, product.supplier),
        )
        setDescription(product.description ?? "")
        setCategoryId(product.categoryId?._id ?? "none")
        setUnit(product.unit)
        setWeight(product.weight != null ? String(product.weight) : "")
        setPurchaseUnit(product.purchaseUnit ?? "")
        setPurchaseFactor(product.purchaseFactor ?? null)
        setBarcode(product.barcode ?? "")
        setPerishable(product.perishable)
        setExpiresAt(product.expiresAt ? product.expiresAt.slice(0, 10) : "")
        setMinStock(product.minStock ?? 0)
        setCost(product.cost ?? 0)
        setSalePrice(product.salePrice ?? null)
      } else {
        setSku("")
        setItemType("ingredient")
        setName("")
        setBrand("")
        setLegacySupplier("")
        setSupplierSel("none")
        setDescription("")
        setCategoryId("none")
        setUnit("und")
        setWeight("")
        setPurchaseUnit("")
        setPurchaseFactor(null)
        setBarcode("")
        setPerishable(false)
        setExpiresAt("")
        setMinStock(null)
        setCost(null)
        setSalePrice(null)
      }
      setError(null)
      setConflictProduct(null)
    }
    void reset()
  }, [open, mode, product, suppliers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === "create" && !/^\d{5,}$/.test(sku.trim())) {
      setError("El SKU debe ser numérico, mínimo 5 dígitos")
      return
    }
    if (
      perishable &&
      expiresAt &&
      expiresAt < localDateStr(new Date())
    ) {
      setError("La fecha de vencimiento no puede ser anterior a hoy")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const catId = categoryId === "none" ? "" : categoryId
      // Un montaje (menaje, utensilios) no es perecedero ni se vende ni se
      // pesa: siempre va por unidades.
      const perishableFinal = isIngredient ? perishable : false
      // Proveedor: registrado (id + nombre como texto legible) o texto legado.
      const chosenSupplier = suppliers.find((sp) => sp._id === supplierSel)
      const supplierText =
        chosenSupplier?.name ??
        (supplierSel === "legacy" ? legacySupplier : "")
      const payload = {
        sku,
        itemType,
        name,
        brand: brand || undefined,
        supplier: supplierText || undefined,
        supplierId: chosenSupplier?._id,
        description: description || undefined,
        categoryId: catId,
        unit: isIngredient ? unit : "und",
        weight: weight ? Number(weight) : undefined,
        // Cadena vacía = quitar la presentación; el backend la valida como par
        // y devuelve 400 con el motivo si falta una de las dos mitades.
        purchaseUnit: purchaseUnit.trim(),
        purchaseFactor: purchaseFactor ?? undefined,
        barcode: barcode.trim() || undefined,
        perishable: perishableFinal,
        // Los montajes controlan lotes: cada entrada queda registrada.
        trackLots: isIngredient ? perishableFinal : true,
        expiresAt: perishableFinal && expiresAt ? expiresAt : "",
        minStock: minStock ?? 0,
        cost: cost ?? 0,
        salePrice: isIngredient && salePrice ? salePrice : undefined,
      }
      if (mode === "create") {
        await createProduct({
          ...payload,
          categoryId: catId || undefined,
          expiresAt: payload.expiresAt || undefined,
        })
      } else if (product) {
        // En edición la cadena vacía sí viaja: significa quitar el proveedor.
        await updateProduct(product._id, {
          ...payload,
          supplier: supplierText,
          supplierId: chosenSupplier?._id ?? "",
        })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      // SKU repetido al crear: en vez del error crudo, ofrecer registrar
      // una entrada del producto existente.
      if (mode === "create" && err instanceof ApiError && err.status === 409) {
        const clash = products.find(
          (p) => p.sku === sku.trim().toUpperCase(),
        )
        if (clash) {
          setConflictProduct(clash)
          return
        }
      }
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={isIngredient ? Package : Boxes}
      title={mode === "create" ? "Nuevo producto" : "Editar producto"}
      description={
        mode === "create"
          ? "Un producto se compra y se vende. Un montaje es menaje que usas en el negocio y no vendes, como platos o utensilios."
          : "Modifica los datos del producto."
      }
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={PRODUCT_FORM_ID}
            disabled={saving || Boolean(skuClash) || Boolean(conflictProduct)}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Package />}
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        id={PRODUCT_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection
          title="Qué es"
          description="Un producto se vende; un montaje se usa en el negocio y no se vende."
        >
          <Segmented
            fill
            size="lg"
            ariaLabel="Tipo de ítem"
            value={itemType}
            onValueChange={(v) => setItemType(v as ItemType)}
            options={[
              { value: "ingredient", label: "Producto", icon: Package },
              { value: "assembly", label: "Montaje", icon: Boxes },
            ]}
          />
        </FormSection>

        <FormSection
          title="Identificación"
          description="Con qué lo reconoces tú y con qué lo reconoce la caja."
        >
          <FieldGrid cols={3}>
            <Field
              id="p-sku"
              label="SKU"
              required
              help={{ term: "sku" }}
              hint="Corto y que no se repita."
            >
              <Input
                id="p-sku"
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value.toUpperCase())
                  setConflictProduct(null)
                }}
                placeholder="10001"
                required
              />
            </Field>
            <FieldSpan span={2}>
              <Field id="p-name" label="Nombre" required>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isIngredient ? "Harina de trigo x 500 g" : "Cuchillo"
                  }
                  required
                />
              </Field>
            </FieldSpan>

            {!isIngredient && (
              <Field id="p-brand" label="Marca">
                <Input
                  id="p-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Doria (opcional)"
                />
              </Field>
            )}
            <FieldSpan span={2}>
              <Field
                id="p-barcode"
                label="Código de barras"
                help={{ term: "codigoBarras" }}
                hint="Permite agregarlo al carrito escaneándolo en el punto de venta."
              >
                <Input
                  id="p-barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Escanéalo o escríbelo (opcional)"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
            </FieldSpan>

            <FieldSpan span={3}>
              <Field id="p-desc" label="Descripción">
                <Input
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
            </FieldSpan>
          </FieldGrid>

          {duplicate && (
            <FormAlert tone="warning" icon={TriangleAlert}>
              <span className="font-semibold">{duplicate.name}</span> ya está en
              tu inventario (SKU {duplicate.sku}). ¿Te llegó más mercancía? No
              hace falta crearlo de nuevo: registra una entrada y el stock se
              acumula.
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 flex"
                onClick={() => onRegisterEntry(duplicate._id)}
              >
                <PackagePlus />
                Registrar entrada de {duplicate.name}
              </Button>
            </FormAlert>
          )}
        </FormSection>

        <FormSection
          title="Clasificación y precio"
          description="Dónde se agrupa y cuánto cuesta."
        >
          <FieldGrid cols={3}>
            <Field id="p-cat" label="Categoría" help={{ term: "categoria" }}>
              <NativeSelect
                id="p-cat"
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: "none", label: "Sin categoría" },
                  ...categories.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            </Field>
            {!isIngredient && (
              <Field id="p-supplier" label="Proveedor">
                <SupplierSelect
                  id="p-supplier"
                  suppliers={suppliers}
                  value={supplierSel}
                  legacyText={legacySupplier}
                  onChange={setSupplierSel}
                />
              </Field>
            )}
            {isIngredient && (
              <Field
                id="p-unit"
                label="Unidad: cómo lo cuentas"
                help={{ term: "unidad" }}
                hint={unidad(unit)?.ejemplo}
              >
                <UnidadSelect id="p-unit" value={unit} onChange={setUnit} />
              </Field>
            )}

            <Field
              id="p-min"
              label="Stock mínimo"
              help={{ term: "stockMinimo" }}
              hint="Te avisamos al llegar aquí."
            >
              <QuantityInput
                id="p-min"
                value={minStock}
                onValueChange={setMinStock}
                sufijo={unidadAbrev}
                placeholder="3"
              />
            </Field>
            {!isIngredient && (
              <Field
                id="p-cost"
                label="Precio de compra"
                help={{ term: "costo" }}
              >
                <MoneyInput
                  id="p-cost"
                  value={cost}
                  onValueChange={setCost}
                  placeholder="0"
                />
              </Field>
            )}
            {isIngredient && (
              <Field
                id="p-price"
                label="Precio de venta"
                help={{ term: "precioVenta" }}
                hint="Solo si lo vendes tal cual, sin transformarlo."
              >
                <MoneyInput
                  id="p-price"
                  value={salePrice}
                  onValueChange={setSalePrice}
                  placeholder="Opcional"
                />
              </Field>
            )}
          </FieldGrid>
        </FormSection>

        {/* La confusión número uno del inventario, resuelta a la vista: una
            cosa es en qué se CUENTA por dentro y otra en qué LLEGA. El bulto
            vive aquí abajo y no en el desplegable de unidades porque no es una
            medida: un bulto trae lo que traiga, y si se guardara como unidad
            el sistema sabría "tres bultos" y nunca cuántos gramos hay. */}
        <FormSection
          title="Cómo te llega del proveedor"
          description={`Lo consumes en ${unidadPlural} y te puede llegar en bultos, arrobas, cajas o canastas. Escríbelo una vez y ya podrás registrar “3 bultos” y poner el precio del bulto: el costo por ${unidadNombre(unidadConsumo, 1)} lo saca el sistema.`}
          help={{ term: "presentacionCompra" }}
          boxed
        >
          <PresentacionCompraPicker
            unidadConsumo={unidadConsumo}
            presentacion={purchaseUnit}
            onPresentacionChange={setPurchaseUnit}
            factor={purchaseFactor}
            onFactorChange={setPurchaseFactor}
          />
          {factorValido && presentacionNombre !== "" && (
            <p className="text-xs font-medium text-foreground">
              Un {presentacionNombre} ={" "}
              {describirContenido(purchaseFactor!, unidadConsumo)}.
            </p>
          )}
        </FormSection>

        {isIngredient && (
          <CheckboxField
            id="p-perishable"
            label="Producto perecedero"
            help={{ term: "perecedero" }}
            hint="Exige lote y fecha de vencimiento en cada entrada."
            checked={perishable}
            onCheckedChange={setPerishable}
          />
        )}
      </form>
    </FormDialog>
  )
}

// ─── Entry sheet (entrada de mercancía) ──────────────────────────────────────

interface OperationSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  sedes: Sede[]
  onSuccess: () => void
  /** Preselección al abrir desde una fila de existencias. */
  preset?: { productId?: string; sedeId?: string }
  /** Proveedores registrados (solo lo usa la entrada). */
  suppliers?: Supplier[]
}

function EntrySheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
  suppliers = [],
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [productQuery, setProductQuery] = React.useState("")
  const [productListOpen, setProductListOpen] = React.useState(false)
  const [sedeId, setSedeId] = React.useState("")
  const [entryUnit, setEntryUnit] = React.useState("und")
  const [entryWeight, setEntryWeight] = React.useState<number | null>(null)
  const [qty, setQty] = React.useState<number | null>(null)
  const [unitCost, setUnitCost] = React.useState<number | null>(null)
  const [supplierSel, setSupplierSel] = React.useState("none")
  const [legacySupplier, setLegacySupplier] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un montaje (menaje, utensilios) no vence ni se pesa.
  const isAssembly = product?.itemType === "assembly"

  // Cómo llega el insumo. Con presentación definida, la mercancía se cuenta y
  // se cobra en bultos —que es como viene en la factura del proveedor— y la
  // conversión a unidades de consumo la hace el backend.
  const pres = product ? presentacionDeCompra(product) : null
  const enPresentacion = pres?.definida ?? false
  const equivalencia =
    enPresentacion && pres && qty != null && qty > 0
      ? describirContenido(qty * pres.factor, product?.unit ?? "und")
      : null

  const productMatches = React.useMemo(() => {
    const q = normalizeName(productQuery)
    if (!q) return products
    return products.filter(
      (p) =>
        normalizeName(p.name).includes(q) ||
        p.sku.toLowerCase().includes(q),
    )
  }, [products, productQuery])

  // Sugerir vencimiento (fecha del producto o vida útil), costo, unidad y
  // peso al elegir producto.
  const applyProductDefaults = React.useCallback(
    (p: InvProduct | undefined) => {
      if (p?.perishable && p.expiresAt) {
        setExpiresAt(p.expiresAt.slice(0, 10))
      } else if (p?.perishable && p.shelfLifeDays) {
        const d = new Date()
        d.setDate(d.getDate() + p.shelfLifeDays)
        setExpiresAt(localDateStr(d))
      } else {
        setExpiresAt("")
      }
      // El precio se muestra en la presentación en que se compra: para la
      // harina, el del bulto, no el del gramo.
      setUnitCost(
        p?.cost
          ? precioDePresentacion(p.cost, presentacionDeCompra(p).factor)
          : null,
      )
      setEntryUnit(p?.unit ?? "und")
      setEntryWeight(p?.weight != null && p.weight > 0 ? p.weight : null)
      setLegacySupplier(p?.supplier ?? "")
      setSupplierSel(initialSupplierSel(suppliers, p?.supplierId, p?.supplier))
    },
    [suppliers],
  )

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      const presetProduct = preset?.productId
        ? products.find((p) => p._id === preset.productId)
        : undefined
      setProductId(preset?.productId ?? "")
      setProductQuery(
        presetProduct ? `${presetProduct.name} · ${presetProduct.sku}` : "",
      )
      setProductListOpen(false)
      setSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setQty(null)
      setError(null)
      applyProductDefaults(presetProduct)
    }
    void reset()
  }, [open, preset, sedes, products, applyProductDefaults])

  function handlePick(p: InvProduct) {
    setProductId(p._id)
    setProductQuery(`${p.name} · ${p.sku}`)
    setProductListOpen(false)
    applyProductDefaults(p)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (expiresAt && expiresAt < localDateStr(new Date())) {
      setError("La fecha de vencimiento no puede ser anterior a hoy")
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Con presentación definida —"3 bultos a $95.000 el bulto"— la cantidad
      // y el precio viajan tal cual y los convierte el backend, que es donde
      // vive esa cuenta. Sin ella se conserva lo de siempre: la entrada puede
      // venir en otra unidad compatible (kg cuando el producto va en g) y se
      // reexpresa aquí, precio incluido para no inflar el costo.
      const rawQty = qty ?? 0
      const targetUnit = product?.unit ?? entryUnit
      const convertedQty = convertUnits(rawQty, entryUnit, targetUnit)
      const qtyFinal = enPresentacion ? rawQty : (convertedQty ?? rawQty)
      const costFinal = enPresentacion
        ? (unitCost ?? undefined)
        : unitCost && qtyFinal > 0
          ? (unitCost * rawQty) / qtyFinal
          : (unitCost ?? undefined)
      // Proveedor: registrado (id + nombre como texto) o texto legado.
      const chosenSupplier = suppliers.find((sp) => sp._id === supplierSel)
      const supplierText =
        chosenSupplier?.name ??
        (supplierSel === "legacy" ? legacySupplier : "")
      await createEntry({
        productId,
        sedeId,
        qty: qtyFinal,
        unitCost: costFinal,
        inPurchaseUnits: enPresentacion ? true : undefined,
        supplier: supplierText || undefined,
        supplierId: chosenSupplier?._id,
        expiresAt: !isAssembly && expiresAt ? expiresAt : undefined,
      })
      // Si cambió el peso por unidad, se refleja en el producto (convertido).
      const w = !isAssembly && entryWeight ? entryWeight : undefined
      const wFinal =
        w != null && w > 0 ? (convertUnits(w, entryUnit, targetUnit) ?? w) : undefined
      if (product && wFinal != null && wFinal > 0 && wFinal !== product.weight) {
        await updateProduct(product._id, { weight: wFinal }).catch(() => {})
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={PackagePlus}
      title="Entrada de mercancía"
      description="Una recepción de compra o la carga inicial de existencias. Lo que entra forma un lote."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ENTRY_FORM_ID}
            disabled={saving || !productId || !sedeId || !qty}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />}
            {saving ? "Registrando…" : "Registrar entrada"}
          </Button>
        </>
      }
    >
      <form
        id={ENTRY_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué entra y dónde">
          <FieldGrid cols={2}>
            <Field id="e-product" label="Producto" required>
              <div className="relative">
                <Input
                  id="e-product"
                  value={productQuery}
                  onChange={(e) => {
                    setProductQuery(e.target.value)
                    setProductListOpen(true)
                    setProductId("")
                  }}
                  onFocus={() => setProductListOpen(true)}
                  onBlur={() => setProductListOpen(false)}
                  placeholder="Escribe para buscar…"
                  autoComplete="off"
                  required
                />
                {productListOpen && productMatches.length > 0 && (
                  <div
                    className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {productMatches.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => handlePick(p)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field id="e-sede" label="Sede" required help={{ term: "sede" }}>
              <NativeSelect
                id="e-sede"
                value={sedeId}
                onChange={setSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Seleccionar sede"
              />
            </Field>

            {/* Con presentación definida no hay nada que elegir: la mercancía
                se cuenta en bultos y el backend la convierte. El selector solo
                tiene sentido para el insumo que se recibe en su propia unidad
                y a veces llega en kilos en vez de gramos. */}
            {!enPresentacion && (
              <Field
                id="e-unit"
                label="Unidad de medida"
                help={{ term: "unidad" }}
                hint={
                  product && entryUnit !== product.unit
                    ? `Lo llevas en ${unidadNombre(product.unit)}: lo convertimos al guardar.`
                    : unidad(entryUnit)?.ejemplo
                }
              >
                <UnidadSelect
                  id="e-unit"
                  value={entryUnit}
                  onChange={setEntryUnit}
                />
              </Field>
            )}
            {!isAssembly && (
              <Field
                id="e-weight"
                label={`Peso por unidad (${unidadCorta(entryUnit)})`}
                hint="Para productos que se compran por peso."
              >
                <QuantityInput
                  id="e-weight"
                  value={entryWeight}
                  onValueChange={setEntryWeight}
                  sufijo={unidadCorta(entryUnit)}
                  placeholder="500"
                />
              </Field>
            )}
          </FieldGrid>
        </FormSection>

        <FormSection title="Cantidad y costo">
          <FieldGrid cols={2}>
            <Field
              id="e-qty"
              label={enPresentacion ? `Cantidad (${pres!.unidad})` : "Cantidad"}
              required
              hint={
                equivalencia
                  ? `Entran ${equivalencia} al inventario.`
                  : enPresentacion
                    ? `Cada ${pres!.unidad} trae ${pres!.contenido}.`
                    : undefined
              }
            >
              <QuantityInput
                id="e-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={enPresentacion ? pres!.unidad : unidadCorta(entryUnit)}
              />
            </Field>
            <Field
              id="e-cost"
              label="Precio de compra"
              help={{ term: "costo" }}
              hint={
                enPresentacion
                  ? `Lo que te cuesta un ${pres!.unidad} completo.`
                  : `Por ${unidadNombre(entryUnit, 1)}, sin lo que le sumas para ganar.`
              }
            >
              <MoneyInput
                id="e-cost"
                value={unitCost}
                onValueChange={setUnitCost}
                placeholder={
                  enPresentacion
                    ? `Por ${pres!.unidad}`
                    : `Por ${unidadNombre(entryUnit, 1)}`
                }
              />
            </Field>

            <Field id="e-supplier" label="Proveedor">
              <SupplierSelect
                id="e-supplier"
                suppliers={suppliers}
                value={supplierSel}
                legacyText={legacySupplier}
                onChange={setSupplierSel}
              />
            </Field>
            {!isAssembly && (
              <Field
                id="e-exp"
                label="Fecha de vencimiento"
                required={Boolean(product?.perishable)}
                help={{ term: "fefo" }}
                hint={
                  product?.perishable
                    ? "Obligatoria: este producto es perecedero."
                    : "Opcional."
                }
              >
                <Input
                  id="e-exp"
                  type="date"
                  min={localDateStr(new Date())}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={Boolean(product?.perishable)}
                />
              </Field>
            )}
          </FieldGrid>
        </FormSection>
      </form>
    </FormDialog>
  )
}

// ─── Adjust sheet (ajuste / merma) ───────────────────────────────────────────

function AdjustSheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [sedeId, setSedeId] = React.useState("")
  const [direction, setDirection] = React.useState<"add" | "remove">("remove")
  const [qty, setQty] = React.useState<number | null>(null)
  const [reason, setReason] = React.useState<AdjustReason>("conteo")
  const [lotCode, setLotCode] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un ajuste positivo de un producto con lotes crea un lote nuevo.
  const createsLot = direction === "add" && Boolean(product?.trackLots)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setProductId(preset?.productId ?? "")
      setSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setDirection("remove")
      setQty(null)
      setReason("conteo")
      setLotCode("")
      setExpiresAt("")
      setNote("")
      setError(null)
    }
    void reset()
  }, [open, preset, sedes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createAdjustment({
        productId,
        sedeId,
        direction,
        qty: qty ?? 0,
        reason,
        lotCode: createsLot && lotCode ? lotCode : undefined,
        expiresAt: createsLot && expiresAt ? expiresAt : undefined,
        note: note || undefined,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      icon={SlidersHorizontal}
      title="Ajuste de inventario"
      description="Corrige existencias por conteo, daño, vencimiento o merma. Las salidas descuentan primero los lotes más próximos a vencer."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ADJUST_FORM_ID}
            disabled={saving || !productId || !sedeId || !qty}
            className="sm:min-w-36"
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SlidersHorizontal />
            )}
            {saving ? "Aplicando…" : "Aplicar ajuste"}
          </Button>
        </>
      }
    >
      <form
        id={ADJUST_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué se ajusta">
          <FieldGrid cols={2}>
            <Field id="a-product" label="Producto" required>
              <NativeSelect
                id="a-product"
                value={productId}
                onChange={setProductId}
                options={products.map((p) => ({
                  value: p._id,
                  label: `${p.name} · ${p.sku}`,
                }))}
                placeholder="Seleccionar producto"
              />
            </Field>
            <Field id="a-sede" label="Sede" required help={{ term: "sede" }}>
              <NativeSelect
                id="a-sede"
                value={sedeId}
                onChange={setSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Seleccionar sede"
              />
            </Field>

            <Field id="a-dir" label="Tipo">
              <Segmented
                fill
                ariaLabel="Tipo de ajuste"
                value={direction}
                onValueChange={(v) => setDirection(v as "add" | "remove")}
                options={[
                  { value: "remove", label: "Salida (−)", icon: Minus },
                  { value: "add", label: "Entrada (+)", icon: Plus },
                ]}
              />
            </Field>
            <Field
              id="a-qty"
              label={`Cantidad${product ? ` (${unidadCorta(product.unit)})` : ""}`}
              required
            >
              <QuantityInput
                id="a-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={product ? unidadCorta(product.unit) : undefined}
              />
            </Field>

            <FieldSpan span={2}>
              <Field
                id="a-reason"
                label="Razón"
                help={{ term: "merma" }}
                hint="Queda registrada en el kárdex con tu nombre."
              >
                <NativeSelect
                  id="a-reason"
                  value={reason}
                  onChange={(v) => setReason(v as AdjustReason)}
                  options={(
                    Object.entries(ADJUST_REASON_LABELS) as [
                      AdjustReason,
                      string,
                    ][]
                  ).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            </FieldSpan>
          </FieldGrid>
        </FormSection>

        {createsLot && (
          <FormSection
            title="Lote que entra"
            description="Las unidades que entran forman un lote propio, para poder sacar primero lo que se vence antes."
            boxed
          >
            <FieldGrid cols={2}>
              <Field
                id="a-lot"
                label="Código de lote"
                help={{ term: "lote" }}
                hint="Se genera solo si lo dejas vacío."
              >
                <Input
                  id="a-lot"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Auto"
                />
              </Field>
              <Field
                id="a-exp"
                label="Vencimiento"
                required={product?.perishable}
                help={{ term: "fefo" }}
              >
                <Input
                  id="a-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={product?.perishable}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        )}

        <Field id="a-note" label="Nota">
          <Input
            id="a-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detalle del ajuste (opcional)"
          />
        </Field>
      </form>
    </FormDialog>
  )
}
// ─── Ficha de traslado entre sedes ───────────────────────────────────────────

function TransferSheet({
  open,
  onOpenChange,
  products,
  sedes,
  onSuccess,
  preset,
}: OperationSheetProps) {
  const [productId, setProductId] = React.useState("")
  const [fromSedeId, setFromSedeId] = React.useState("")
  const [toSedeId, setToSedeId] = React.useState("")
  const [qty, setQty] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setProductId(preset?.productId ?? "")
      setFromSedeId(preset?.sedeId ?? sedes[0]?._id ?? "")
      setToSedeId("")
      setQty(null)
      setNote("")
      setError(null)
    }
    void reset()
  }, [open, preset, sedes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createTransfer({
        productId,
        fromSedeId,
        toSedeId,
        qty: qty ?? 0,
        note: note || undefined,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={ArrowLeftRight}
      title="Traslado entre sedes"
      description="Mueve existencias de una sede a otra conservando los lotes y sus vencimientos. No es una venta ni una compra."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={TRANSFER_FORM_ID}
            disabled={saving || !productId || !fromSedeId || !toSedeId || !qty}
            className="sm:min-w-36"
          >
            {saving ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
            {saving ? "Trasladando…" : "Trasladar"}
          </Button>
        </>
      }
    >
      <form
        id={TRANSFER_FORM_ID}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <FormError error={error} />

        <FormSection title="Qué se mueve">
          <FieldGrid cols={2}>
            <FieldSpan span={2}>
              <Field id="t-product" label="Producto" required>
                <NativeSelect
                  id="t-product"
                  value={productId}
                  onChange={setProductId}
                  options={products.map((p) => ({
                    value: p._id,
                    label: `${p.name} · ${p.sku}`,
                  }))}
                  placeholder="Seleccionar producto"
                />
              </Field>
            </FieldSpan>

            <Field id="t-from" label="Desde" required help={{ term: "traslado" }}>
              <NativeSelect
                id="t-from"
                value={fromSedeId}
                onChange={setFromSedeId}
                options={sedes.map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Sede origen"
              />
            </Field>
            <Field id="t-to" label="Hacia" required>
              <NativeSelect
                id="t-to"
                value={toSedeId}
                onChange={setToSedeId}
                options={sedes
                  .filter((s) => s._id !== fromSedeId)
                  .map((s) => ({ value: s._id, label: s.name }))}
                placeholder="Sede destino"
              />
            </Field>

            <Field
              id="t-qty"
              label={`Cantidad${product ? ` (${unidadCorta(product.unit)})` : ""}`}
              required
            >
              <QuantityInput
                id="t-qty"
                value={qty}
                onValueChange={setQty}
                sufijo={product ? unidadCorta(product.unit) : undefined}
              />
            </Field>
            <Field id="t-note" label="Nota">
              <Input
                id="t-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo del traslado (opcional)"
              />
            </Field>
          </FieldGrid>
        </FormSection>
      </form>
    </FormDialog>
  )
}
// ─── Lotes de una existencia (dentro del panel desplegable) ──────────────────

/** Carga y muestra los lotes de la existencia expandida (orden FEFO). */
function ExpandedLots({ row }: { row: StockRow }) {
  const [lots, setLots] = React.useState<InvLot[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Dependencias primitivas: el objeto row se recrea en cada refresco de
  // stock y dispararía refetches innecesarios si se usara directamente.
  const productId = row.product._id
  const sedeId = row.sede._id
  const trackLots = row.product.trackLots

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!trackLots) return
      setLots([])
      setLoading(true)
      setError(null)
      try {
        const data = await getLots(productId, sedeId)
        if (!cancelled) setLots(data)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId, sedeId, trackLots])

  if (!row.product.trackLots) {
    return <p className="text-sm text-muted-foreground">Sin lotes</p>
  }
  if (loading) {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Cargando lotes…
      </p>
    )
  }
  if (error) {
    return <FormError error={error} />
  }
  if (lots.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin lotes</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Lotes (FEFO)</p>
      <ul className="flex flex-col gap-1">
        {lots.map((lot) => (
          <li key={lot._id} className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="font-mono text-xs">{lot.lotCode}</span>
            <span>
              <span className="text-muted-foreground">Ingreso: </span>
              {df.format(new Date(lot.receivedAt))}
            </span>
            <span>
              <span className="text-muted-foreground">Proveedor: </span>
              {lot.supplier || row.product.supplier || "—"}
            </span>
            <span>
              <span className="text-muted-foreground">Stock: </span>
              {nf.format(lot.qty)}{" "}
              <span className="text-muted-foreground">
                {unidadCorta(row.product.unit)}
              </span>
            </span>
            {row.product.itemType !== "assembly" && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">Vence:</span>
                {lot.expiresAt ? (
                  <>
                    {dfUTC.format(new Date(lot.expiresAt))}
                    <ExpiryBadge date={lot.expiresAt} />
                  </>
                ) : (
                  "—"
                )}
              </span>
            )}
            <span>
              <span className="text-muted-foreground">Costo: </span>
              {formatUnitCost(lot.unitCost, row.product)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Categories sheet (crear, renombrar, eliminar) ───────────────────────────

interface CategoriesSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: InvCategory[]
  products: InvProduct[]
  onChanged: () => void
}

function CategoriesSheet({
  open,
  onOpenChange,
  categories,
  products,
  onChanged,
}: CategoriesSheetProps) {
  const [newName, setNewName] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const confirm = useConfirm()

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      setNewName("")
      setEditingId(null)
      setEditName("")
      setError(null)
    }
    void reset()
  }, [open])

  // Cuántos ítems usan cada categoría (para avisar antes de eliminar).
  const usage = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const id = p.categoryId?._id
      if (id) map.set(id, (map.get(id) ?? 0) + 1)
    }
    return map
  }, [products])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await createCategory(name)
      setNewName("")
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      await updateCategory(id, name)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(cat: InvCategory) {
    if (!(await confirm({ title: `¿Eliminar la categoría "${cat.name}"?`, destructive: true }))) return
    setBusy(true)
    setError(null)
    try {
      await deleteCategory(cat._id)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={FolderTree}
      title="Categorías"
      description="Los grupos del catálogo: bebidas, aseo, panadería. Solo se pueden eliminar las que no tengan ítems."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Listo
        </Button>
      }
    >
      <FormError error={error} />

      <FormSection title="Agregar una categoría" help={{ term: "categoria" }}>
        <form onSubmit={handleCreate} className="flex items-end gap-2">
          <Field id="cat-new" label="Nombre" className="flex-1">
            <Input
              id="cat-new"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Bebidas, aseo, panadería…"
            />
          </Field>
          <Button type="submit" className="shrink-0" disabled={busy || !newName.trim()}>
            <Plus />
            Agregar
          </Button>
        </form>
      </FormSection>

      <FormSection
        title="Categorías del catálogo"
        description={
          categories.length > 0
            ? `${categories.length} en total.`
            : undefined
        }
      >
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay categorías. Agrega la primera arriba.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {categories.map((cat) => {
              const count = usage.get(cat._id) ?? 0
              const isEditing = editingId === cat._id
              return (
                <li
                  key={cat._id}
                  className="flex items-center gap-2 bg-card px-3.5 py-2.5"
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        aria-label={`Nuevo nombre de ${cat.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void handleRename(cat._id)
                          }
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Guardar nombre"
                        disabled={busy || !editName.trim()}
                        onClick={() => void handleRename(cat._id)}
                      >
                        <Check />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Cancelar edición"
                        onClick={() => setEditingId(null)}
                      >
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {cat.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {count} ítem{count !== 1 ? "s" : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Renombrar ${cat.name}`}
                        onClick={() => {
                          setEditingId(cat._id)
                          setEditName(cat.name)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar ${cat.name}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(cat)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </FormSection>
    </FormDialog>
  )
}
// ─── Panel de lotes (trazabilidad y vencimientos) ────────────────────────────

const LOT_STATUS_OPTIONS: { value: LotStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expired", label: "Vencidos" },
  { value: "expiring", label: "Por vencer" },
  { value: "ok", label: "Al día" },
]

/**
 * Pestaña "Lotes": todos los lotes abiertos del inventario, en orden FEFO.
 *
 * Hasta ahora los lotes solo se veían desplegando una fila de existencias, un
 * producto cada vez. Eso sirve para responder "¿de qué lote es esta caja?",
 * pero no para la pregunta con la que se abre la tienda: "¿qué se me vence
 * esta semana?". Con doscientas referencias, contestarla a mano era imposible,
 * así que en la práctica nadie lo hacía y la merma se descubría en el estante.
 *
 * El orden es FEFO —lo que primero vence, primero se ve— porque es también el
 * orden en el que el sistema los consume al vender: la lista de arriba es
 * literalmente lo que va a salir primero.
 */
function LotsPanel({
  sedes,
  canAdjust,
  onAdjust,
  onEntry,
  refreshKey,
}: {
  sedes: Sede[]
  canAdjust: boolean
  /** Abre el ajuste con el producto y la sede del lote ya puestos. */
  onAdjust: (preset: { productId: string; sedeId: string }) => void
  /** Abre la entrada de mercancía desde el estado vacío. */
  onEntry: () => void
  /** Cambia tras cada operación de stock para forzar la recarga. */
  refreshKey: number
}) {
  const [sedeId, setSedeId] = React.useState("all")
  const [status, setStatus] = React.useState<LotStatus>("all")
  const [search, setSearch] = React.useState("")
  const [rows, setRows] = React.useState<InvLotRow[]>([])
  const [days, setDays] = React.useState(30)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listLots({
          sedeId: sedeId === "all" ? undefined : sedeId,
          status,
        })
        if (cancelled) return
        setRows(data.rows)
        setDays(data.days)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sedeId, status, refreshKey])

  const filtered = rows.filter((lot) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const product = typeof lot.productId === "object" ? lot.productId : null
    return (
      lot.lotCode.toLowerCase().includes(q) ||
      (product?.name ?? "").toLowerCase().includes(q) ||
      (product?.sku ?? "").toLowerCase().includes(q) ||
      (lot.supplier ?? "").toLowerCase().includes(q)
    )
  })

  /** Cuántos lotes hay vencidos, para el aviso de arriba. */
  const vencidos = rows.filter(
    (l) => l.expiresAt && new Date(l.expiresAt) < new Date(),
  ).length

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Lotes en existencia</CardTitle>
          <CardDescription>
            Orden FEFO: lo que primero vence es lo primero que el sistema
            descuenta al vender. Ventana de aviso: {days} días.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lote, producto, proveedor…"
              className="w-60 pl-9"
              aria-label="Buscar lotes"
            />
          </div>
          <Segmented
            value={status}
            onValueChange={setStatus}
            options={LOT_STATUS_OPTIONS}
            size="sm"
            ariaLabel="Filtrar lotes por vencimiento"
          />
          {sedes.length > 1 && (
            <Select
              value={sedeId}
              items={{ all: "Todas las sedes", ...sedeItems(sedes) }}
              onValueChange={(v) => {
                if (v !== null) setSedeId(v)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {sedes.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      {vencidos > 0 && status !== "expired" && (
        <CardContent className="pb-0">
          <button
            type="button"
            onClick={() => setStatus("expired")}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/35 bg-destructive/8 px-4 py-3 text-left text-sm text-destructive-ink transition-colors hover:bg-destructive/12 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
          >
            <CircleAlert className="size-4 shrink-0" />
            <span>
              <span className="font-semibold">{vencidos} lote(s) vencidos</span>{" "}
              siguen con existencias. Sácalos con un ajuste por vencimiento.
            </span>
            <ChevronRight className="ml-auto size-4 shrink-0" />
          </button>
        </CardContent>
      )}

      <CardContent className="p-0">
        {loading ? (
          <TableSkeleton cols={7} />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          rows.length === 0 ? (
            <VacioConSalida
              icon={CalendarClock}
              titulo="Todavía no hay lotes"
              frase="Un lote es cada tanda que entró junta, con su fecha de vencimiento. Solo los llevan las cosas que marcaste como perecederas: márcalo en la ficha y se creará solo en la próxima entrada."
              accion={
                canAdjust
                  ? {
                      texto: "Registrar una entrada",
                      icon: PackagePlus,
                      onClick: onEntry,
                    }
                  : undefined
              }
            />
          ) : (
            <VacioConSalida
              icon={Search}
              titulo="Ningún lote coincide"
              frase="Prueba con otro filtro, o busca por el código del lote, el producto o el proveedor."
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lot) => {
                const product =
                  typeof lot.productId === "object" ? lot.productId : null
                const consumido = lot.initialQty - lot.qty
                return (
                  <TableRow key={lot._id}>
                    <TableCell className="font-mono text-xs">
                      {lot.lotCode}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {product?.name ?? "—"}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {product?.sku ?? ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.sedeId?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tnum font-medium">
                        {nf.format(lot.qty)}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {product ? unidadCorta(product.unit) : ""}
                      </span>
                      {consumido > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          de {nf.format(lot.initialQty)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lot.expiresAt ? (
                        <span className="flex items-center gap-2">
                          {dfUTC.format(new Date(lot.expiresAt))}
                          <ExpiryBadge date={lot.expiresAt} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No caduca
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span>{df.format(new Date(lot.receivedAt))}</span>
                      {lot.supplier && (
                        <span className="block text-xs text-muted-foreground">
                          {lot.supplier}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {product
                        ? formatUnitCost(lot.unitCost, product)
                        : moneyUnit.format(lot.unitCost)}
                    </TableCell>
                    <TableCell>
                      {canAdjust && product && lot.sedeId?._id && (
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Dar de baja este lote con un ajuste"
                            onClick={() =>
                              onAdjust({
                                productId: product._id,
                                sedeId: lot.sedeId._id,
                              })
                            }
                          >
                            <PackageMinus />
                            <ButtonLabel from="lg">Ajustar</ButtonLabel>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = "productos" | "existencias" | "lotes" | "movimientos"

/**
 * Qué se ve en cada pestaña, contado con las palabras del negocio.
 *
 * Las cuatro pestañas se llamaban con una sola palabra cada una y ninguna
 * decía para qué sirve: "Lotes" y "Movimientos" no significan nada para quien
 * no lleva inventarios de oficio. Y la primera se llamaba "Productos", igual
 * que la PANTALLA de Productos del menú, que es otra cosa —lo que se vende—:
 * eran dos sitios distintos con el mismo nombre.
 */
const TAB_INFO: Record<Tab, { label: string; frase: string }> = {
  productos: {
    label: "Insumos y mercancía",
    frase:
      "Todo lo que manejas: las fichas de lo que compras, con su unidad, su presentación y su costo. Todavía no dice cuánto tienes.",
  },
  existencias: {
    label: "Existencias",
    frase: "Cuánto tienes ahora mismo en cada sede, y qué está por acabarse.",
  },
  lotes: {
    label: "Lotes",
    frase:
      "Cada tanda que entró, con su vencimiento. Sirve para sacar primero lo que se vence antes.",
  },
  movimientos: {
    label: "Movimientos",
    frase:
      "La historia: cada entrada, salida, venta y ajuste, con su fecha y quién lo hizo. Aquí se mira cuando no cuadra algo.",
  },
}

/**
 * Una opción del menú "Herramientas", con su frase de qué hace.
 *
 * El nombre solo no basta —"Conteo" o "Merma" no le dicen nada a quien nunca
 * los ha usado— y probarlos para averiguarlo es justo lo que da miedo en una
 * pantalla que toca el inventario.
 */
function HerramientaItem({
  icon: Icon,
  titulo,
  frase,
  onClick,
  disabled,
}: {
  icon: React.ElementType
  titulo: string
  frase: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenuItem
      className="items-start gap-2.5 px-2 py-2"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{titulo}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {frase}
        </span>
      </span>
    </DropdownMenuItem>
  )
}

/**
 * Estado vacío con salida: qué es esto, qué falta y el botón para hacerlo.
 *
 * Una pestaña vacía con "Sin movimientos registrados" y nada más deja a quien
 * empieza sin saber si el programa falló o si le toca hacer algo.
 */
function VacioConSalida({
  icon: Icon,
  titulo,
  frase,
  accion,
}: {
  icon: React.ElementType
  titulo: string
  frase: string
  accion?: { texto: string; icon: React.ElementType; onClick: () => void }
}) {
  const AccionIcon = accion?.icon
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Icon className="size-9 text-muted-foreground" aria-hidden />
      <p className="font-display text-base text-foreground">{titulo}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {frase}
      </p>
      {accion && (
        <Button className="mt-2" onClick={accion.onClick}>
          {AccionIcon && <AccionIcon />}
          {accion.texto}
        </Button>
      )}
    </div>
  )
}

// ─── Tallas y variantes (comercio sin recetas) ───────────────────────────────

interface AxisRow {
  name: string
  /** Valores ya elegidos para el eje ("S", "M", "L"…). */
  values: string[]
}

/**
 * Plantillas de ejes de uso corriente.
 *
 * Escribir "XS, S, M, L, XL, XXL" a mano en cada alta es justo el trabajo que
 * hace que nadie use la función. Con un toque queda el eje montado y luego se
 * quitan los valores que no se manejen.
 */
const AXIS_PRESETS: { label: string; name: string; values: string[] }[] = [
  {
    label: "Tallas de ropa",
    name: "Talla",
    values: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  {
    label: "Tallas numéricas",
    name: "Talla",
    values: ["28", "30", "32", "34", "36", "38", "40"],
  },
  {
    label: "Calzado (CO)",
    name: "Talla",
    values: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
  },
  {
    label: "Colores básicos",
    name: "Color",
    values: ["Negro", "Blanco", "Azul", "Rojo", "Verde", "Gris"],
  },
  {
    label: "Presentación",
    name: "Presentación",
    values: ["Pequeño", "Mediano", "Grande"],
  },
]

/** Cuántas combinaciones se enseñan en la vista previa antes de resumir. */
const PREVIEW_LIMIT = 12

/**
 * Alta de un producto con variantes: una fila de inventario por cada
 * combinación de los ejes (talla × color), con SKU y existencias propias.
 *
 * Está pensada para el comercio que NO trabaja con recetas —ropa, calzado,
 * accesorios—, donde "una camisa" no es un producto sino quince: cada talla se
 * compra, se cuenta y se vende por separado. Darlas de alta una a una era
 * media hora de trabajo y quince oportunidades de equivocarse con el SKU.
 *
 * Los valores se eligen como fichas (no como texto separado por comas) porque
 * así se ve exactamente qué se va a crear y se puede quitar uno sin volver a
 * escribir la lista entera. La vista previa de abajo enseña el SKU real que va
 * a salir, que es lo que después se busca en el POS y se pega en la etiqueta.
 */
function VariantsSheet({
  open,
  onOpenChange,
  categories,
  onSuccess,
  onRegisterEntry,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: InvCategory[]
  onSuccess: () => void
  /** Abre la entrada de mercancía al terminar (el paso natural siguiente). */
  onRegisterEntry?: () => void
}) {
  const [skuPrefix, setSkuPrefix] = React.useState("")
  const [name, setName] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("none")
  const [salePrice, setSalePrice] = React.useState<number | null>(null)
  const [cost, setCost] = React.useState<number | null>(null)
  const [minStock, setMinStock] = React.useState<number | null>(null)
  const [axes, setAxes] = React.useState<AxisRow[]>([
    { name: "Talla", values: [] },
  ])
  const [drafts, setDrafts] = React.useState<string[]>([""])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [doneMsg, setDoneMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSkuPrefix("")
    setName("")
    setCategoryId("none")
    setSalePrice(null)
    setCost(null)
    setMinStock(null)
    setAxes([{ name: "Talla", values: [] }])
    setDrafts([""])
    setError(null)
    setDoneMsg(null)
  }, [open])

  /** Ejes con nombre y al menos un valor: los únicos que generan variantes. */
  const parsedAxes = axes
    .map((a) => ({ name: a.name.trim(), values: a.values }))
    .filter((a) => a.name && a.values.length > 0)

  const willCreate =
    parsedAxes.length > 0
      ? parsedAxes.reduce((n, a) => n * a.values.length, 1)
      : 0

  /**
   * Firma de los ejes. `parsedAxes` se recalcula en cada render, así que como
   * dependencia no vale de nada; lo que de verdad cambia la vista previa es su
   * contenido, y eso es lo que se compara.
   */
  const axesKey = JSON.stringify(parsedAxes)

  /** Todas las combinaciones (producto cartesiano), como las hace el backend. */
  const combos = React.useMemo(() => {
    if (parsedAxes.length === 0) return [] as string[][]
    return parsedAxes.reduce<string[][]>(
      (acc, axis) => acc.flatMap((row) => axis.values.map((v) => [...row, v])),
      [[]],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axesKey])

  function updateAxis(i: number, patch: Partial<AxisRow>) {
    setAxes((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  /** Añade uno o varios valores (acepta "S, M, L" pegado de un tirón). */
  function addValues(i: number, raw: string) {
    const nuevos = raw
      .split(/[,;\n\t]/)
      .map((v) => v.trim())
      .filter(Boolean)
    if (nuevos.length === 0) return
    setAxes((rows) =>
      rows.map((r, idx) => {
        if (idx !== i) return r
        const merged = [...r.values]
        for (const v of nuevos) {
          if (!merged.some((x) => x.toLowerCase() === v.toLowerCase())) {
            merged.push(v)
          }
        }
        return { ...r, values: merged }
      }),
    )
    setDrafts((d) => d.map((v, idx) => (idx === i ? "" : v)))
  }

  function removeValue(i: number, value: string) {
    setAxes((rows) =>
      rows.map((r, idx) =>
        idx === i ? { ...r, values: r.values.filter((v) => v !== value) } : r,
      ),
    )
  }

  function applyPreset(preset: (typeof AXIS_PRESETS)[number]) {
    setAxes((rows) => {
      const at = rows.findIndex(
        (r) => r.name.trim().toLowerCase() === preset.name.toLowerCase(),
      )
      // Si ya hay un eje con ese nombre se rellena; si no, se añade otro.
      if (at >= 0) {
        const merged = [...rows[at].values]
        for (const v of preset.values) {
          if (!merged.some((x) => x.toLowerCase() === v.toLowerCase())) {
            merged.push(v)
          }
        }
        return rows.map((r, idx) =>
          idx === at ? { ...r, name: preset.name, values: merged } : r,
        )
      }
      const vacio = rows.findIndex((r) => !r.name.trim() && r.values.length === 0)
      if (vacio >= 0) {
        return rows.map((r, idx) =>
          idx === vacio ? { name: preset.name, values: preset.values } : r,
        )
      }
      setDrafts((d) => [...d, ""])
      return [...rows, { name: preset.name, values: preset.values }]
    })
  }

  function addAxis() {
    setAxes((rows) => [...rows, { name: "", values: [] }])
    setDrafts((d) => [...d, ""])
  }

  function removeAxis(i: number) {
    setAxes((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows))
    setDrafts((d) => (d.length > 1 ? d.filter((_, idx) => idx !== i) : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!skuPrefix.trim()) {
      setError("Escribe un SKU base para derivar los de cada variante")
      return
    }
    if (!name.trim()) {
      setError("Escribe el nombre del producto")
      return
    }
    if (parsedAxes.length === 0) {
      setError("Agrega al menos un eje (p. ej. Talla) con sus valores")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await createProductVariants({
        skuPrefix: skuPrefix.trim(),
        name: name.trim(),
        categoryId: categoryId === "none" ? undefined : categoryId,
        salePrice: salePrice ?? undefined,
        cost: cost ?? undefined,
        minStock: minStock ?? undefined,
        axes: parsedAxes,
      })
      onSuccess()
      setDoneMsg(
        `Se crearon ${res.variants.length} variante(s). Ya están en el catálogo: registra su entrada de mercancía para poder venderlas.`,
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tallas y variantes"
      description="Una fila de inventario por cada combinación, con su SKU y sus existencias propias. Pensado para ropa, calzado y todo lo que se vende por talla o color."
      icon={Layers}
      size="3xl"
      footer={
        doneMsg ? (
          <>
            {onRegisterEntry && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onRegisterEntry()
                }}
              >
                <PackagePlus />
                Registrar entrada
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </>
        ) : (
          <>
            <FormError error={error} />
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={VARIANTS_FORM_ID}
              disabled={saving || willCreate === 0}
            >
              {saving
                ? "Creando…"
                : willCreate > 0
                  ? `Crear ${willCreate} variante(s)`
                  : "Crear variantes"}
            </Button>
          </>
        )
      }
    >
      {doneMsg ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/8 p-4 text-sm text-success-ink">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <span>{doneMsg}</span>
        </div>
      ) : (
        <form
          id={VARIANTS_FORM_ID}
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <FormSection
            title="Producto base"
            description="Lo común a todas las variantes. Cada una hereda esto y le añade su talla o su color."
            icon={Package}
          >
            <FieldGrid cols={2}>
              <Field
                id="v-name"
                label="Nombre"
                required
                hint="Se le añade la variante al final: “Camisa manga larga · M”."
              >
                <Input
                  id="v-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Camisa manga larga"
                  required
                />
              </Field>
              <Field
                id="v-sku"
                label="SKU base"
                required
                help={{ term: "sku" }}
                hint="De aquí salen los SKU de cada variante (CAMISA-M, CAMISA-L…)."
              >
                <Input
                  id="v-sku"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="p. ej. CAMISA"
                  className="font-mono"
                  required
                />
              </Field>
            </FieldGrid>

            <FieldGrid cols={4}>
              <Field id="v-cat" label="Categoría">
                <Select
                  value={categoryId}
                  items={{
                    none: "Sin categoría",
                    ...Object.fromEntries(categories.map((c) => [c._id, c.name])),
                  }}
                  onValueChange={(val) => {
                    if (val !== null) setCategoryId(val)
                  }}
                >
                  <SelectTrigger id="v-cat" className="w-full">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="v-price"
                label="Precio de venta"
                hint="Con precio, entran solas al POS."
              >
                <MoneyInput
                  id="v-price"
                  value={salePrice}
                  onValueChange={setSalePrice}
                  placeholder="Opcional"
                />
              </Field>
              <Field id="v-cost" label="Costo">
                <MoneyInput
                  id="v-cost"
                  value={cost}
                  onValueChange={setCost}
                  placeholder="Opcional"
                />
              </Field>
              <Field
                id="v-min"
                label="Stock mínimo"
                hint="Por variante, no del total."
              >
                <QuantityInput
                  id="v-min"
                  value={minStock}
                  onValueChange={setMinStock}
                  sufijo="und"
                  placeholder="Opcional"
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormDivider />

          <FormSection
            title="Ejes de variación"
            description="Talla, color, presentación… Se crea una variante por cada combinación."
            icon={Layers}
            action={
              <Button type="button" variant="outline" size="sm" onClick={addAxis}>
                <Plus />
                Otro eje
              </Button>
            }
          >
            {/* Plantillas: montan un eje entero de un toque. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Empezar con:
              </span>
              {AXIS_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-primary/8 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {axes.map((axis, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={axis.name}
                      onChange={(e) => updateAxis(i, { name: e.target.value })}
                      placeholder="Nombre del eje (Talla, Color…)"
                      className="max-w-56 font-semibold"
                      aria-label="Nombre del eje"
                    />
                    <Badge variant="outline" className="ml-auto">
                      {axis.values.length} valor(es)
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar eje"
                      disabled={axes.length <= 1}
                      onClick={() => removeAxis(i)}
                    >
                      <X />
                    </Button>
                  </div>

                  {axis.values.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {axis.values.map((value) => (
                        <span
                          key={value}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pr-1 pl-2.5 text-xs font-semibold text-primary"
                        >
                          {value}
                          <button
                            type="button"
                            aria-label={`Quitar ${value}`}
                            onClick={() => removeValue(i, value)}
                            className="grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      value={drafts[i] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) =>
                          d.map((v, idx) => (idx === i ? e.target.value : v)),
                        )
                      }
                      onKeyDown={(e) => {
                        // Enter añade el valor sin enviar el formulario: aquí
                        // se escriben diez seguidos y enviar en el primero
                        // sería exactamente lo contrario de lo que se quiere.
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          addValues(i, drafts[i] ?? "")
                        }
                      }}
                      onBlur={() => addValues(i, drafts[i] ?? "")}
                      placeholder="Escribe un valor y pulsa Enter (o pega “S, M, L”)"
                      aria-label="Nuevo valor del eje"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Agregar valor"
                      onClick={() => addValues(i, drafts[i] ?? "")}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <FormDivider />

          <FormSection
            title="Se van a crear"
            description="Repásalo antes de guardar: los SKU son los que después se buscan en el POS y se imprimen en la etiqueta."
            icon={CheckCircle2}
            boxed
          >
            {willCreate === 0 ? (
              <p className="text-sm text-muted-foreground">
                Elige al menos un valor —por ejemplo la talla M— y aquí verás la
                lista exacta de variantes.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {combos.slice(0, PREVIEW_LIMIT).map((combo, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-xs"
                    >
                      <span className="font-semibold">{combo.join(" / ")}</span>
                      <span className="font-mono text-[0.6875rem] text-muted-foreground">
                        {(skuPrefix.trim().toUpperCase() || "SKU") +
                          "-" +
                          combo.map(slugPreview).join("-")}
                      </span>
                    </span>
                  ))}
                </div>
                {combos.length > PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground">
                    …y {combos.length - PREVIEW_LIMIT} más. En total{" "}
                    <span className="font-semibold text-foreground">
                      {willCreate} variante(s)
                    </span>
                    .
                  </p>
                )}
              </>
            )}
          </FormSection>
        </form>
      )}
    </FormDialog>
  )
}

/** Vista previa del token de SKU de un valor (igual criterio que el backend). */
function slugPreview(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "")
}

// ─── Actualizar precios de compra ─────────────────────────────────────────────

/** Cuántas filas se pintan de golpe: más allá, la lista se vuelve lenta. */
const LIMITE_FILAS = 120

/**
 * Una fila de la lista de precios. Va memorizada porque al escribir en una
 * casilla se re-renderiza el diálogo entero, y con cien insumos cada tecla se
 * sentiría pegajosa.
 */
const FilaPrecio = React.memo(function FilaPrecio({
  p,
  valor,
  onChange,
}: {
  p: InvProduct
  valor: string
  onChange: (id: string, valor: string) => void
}) {
  const pres = presentacionDeCompra(p)
  const actual = precioDePresentacion(p.cost, pres.factor)

  const n = Number(valor)
  const valido = valor.trim() !== "" && Number.isFinite(n) && n >= 0
  const delta = valido && actual > 0 ? ((n - actual) / actual) * 100 : null
  const cambia = valido && Math.abs(n - actual) >= 0.005

  return (
    <TableRow className={cambia ? "bg-brand-50/60 dark:bg-brand-950/30" : ""}>
      <TableCell className="py-2">
        <p className="font-medium leading-tight">{p.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {p.sku} · por {pres.unidad}
          {pres.contenido ? ` de ${pres.contenido}` : ""}
        </p>
      </TableCell>
      <TableCell className="tnum py-2 text-right text-muted-foreground">
        {moneyUnit.format(actual)}
      </TableCell>
      <TableCell className="py-2">
        {/* El estado de la lista sigue siendo texto —una casilla en blanco
            significa "no lo toqué", que no es lo mismo que cero— así que el
            número que devuelve el campo se vuelve a guardar como texto. */}
        <MoneyInput
          className="h-9 w-36 text-right"
          aria-label={`Nuevo precio de ${p.name}`}
          placeholder={String(Math.round(actual))}
          value={valor.trim() === "" ? null : n}
          onValueChange={(v) => onChange(p._id, v === null ? "" : String(v))}
        />
      </TableCell>
      <TableCell className="tnum py-2 text-right">
        {delta === null || !cambia ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              delta > 0 ? "text-destructive" : "text-success-ink",
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} %
          </span>
        )}
      </TableCell>
    </TableRow>
  )
})

/**
 * Actualización masiva de precios de compra.
 *
 * Es la pantalla que más se pide en un negocio que transforma: los insumos
 * suben cada semana y hasta ahora la única vía era abrir la ficha de cada
 * producto, una por una, o pasar por el Excel. Guarda con el mismo endpoint de
 * importación (upsert por SKU, campos parciales), así que no necesita nada
 * nuevo del backend.
 */
function ActualizarPreciosDialog({
  open,
  onOpenChange,
  products,
  onSaved,
  onExportar,
  onImportar,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  onSaved: () => void
  onExportar: () => void
  onImportar: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [nuevos, setNuevos] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [definiendo, setDefiniendo] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{
    actualizados: number
    subieron: number
    bajaron: number
    errores: ImportResult["errors"]
  } | null>(null)

  // Se limpia al cerrar y no con un efecto sobre `open`: así no queda un
  // render intermedio con los datos de la sesión anterior ya visibles.
  function reiniciar() {
    setSearch("")
    setNuevos({})
    setError(null)
    setResult(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  const onChangeFila = React.useCallback((id: string, valor: string) => {
    setNuevos((prev) => ({ ...prev, [id]: valor }))
  }, [])

  const activos = React.useMemo(
    () =>
      products
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  )

  const visibles = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return activos
    return activos.filter(
      (p) =>
        normalizeName(p.name).includes(q) || normalizeName(p.sku).includes(q),
    )
  }, [activos, search])

  /**
   * Insumos que esta pantalla venía tratando como si se compraran por kilo o
   * por litro sin que nadie lo hubiera dicho: lo adivinaba por la unidad.
   *
   * Ahora que la presentación se guarda en el producto, ya no se adivina, así
   * que estos se muestran por gramo hasta que alguien diga cómo se compran. El
   * botón de abajo deja por escrito justo lo que se venía suponiendo —sin
   * tocar ningún precio— para que nadie tenga que editar cien fichas a mano.
   */
  const porDefinir = React.useMemo(
    () =>
      activos.flatMap((p) => {
        if (presentacionDeCompra(p).definida) return []
        const sug = sugerirPresentacion(p.unit)
        return sug ? [{ p, sug }] : []
      }),
    [activos],
  )

  async function definirPresentaciones() {
    setDefiniendo(true)
    setError(null)
    try {
      // Solo viajan `purchaseUnit` y `purchaseFactor`: el costo por gramo se
      // queda igual, así que el precio que se ve en pantalla es el mismo de
      // siempre —el del kilo— pero ahora porque está escrito, no supuesto.
      await importProducts(
        porDefinir.map(({ p, sug }) => ({
          sku: p.sku,
          name: p.name,
          purchaseUnit: sug.unidad,
          purchaseFactor: sug.factor,
        })),
      )
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDefiniendo(false)
    }
  }

  // Solo viaja lo que cambió de verdad. Reenviar el mismo precio ensuciaría el
  // historial del producto sin que nada haya pasado.
  const cambios = React.useMemo(() => {
    const out: { p: InvProduct; actual: number; nuevo: number }[] = []
    for (const p of activos) {
      const texto = nuevos[p._id]
      if (texto === undefined || texto.trim() === "") continue
      const n = Number(texto)
      if (!Number.isFinite(n) || n < 0) continue
      const actual = precioDePresentacion(p.cost, presentacionDeCompra(p).factor)
      if (Math.abs(n - actual) < 0.005) continue
      out.push({ p, actual, nuevo: n })
    }
    return out
  }, [activos, nuevos])

  async function guardar() {
    if (cambios.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await importProducts(
        cambios.map(({ p, nuevo }) => ({
          sku: p.sku,
          // El nombre viaja porque el endpoint es un upsert: si un SKU se
          // hubiera borrado mientras el diálogo estaba abierto, sin nombre el
          // producto recreado quedaría sin identificar.
          name: p.name,
          cost: costoPorUnidad(nuevo, presentacionDeCompra(p).factor),
        })),
      )
      setResult({
        actualizados: res.updated,
        subieron: cambios.filter((c) => c.nuevo > c.actual).length,
        bajaron: cambios.filter((c) => c.nuevo < c.actual).length,
        errores: res.errors,
      })
      setNuevos({})
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const mostradas = visibles.slice(0, LIMITE_FILAS)

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reiniciar()
      }}
      size="3xl"
      icon={TrendingUp}
      title="Actualizar precios de compra"
      description="Escribe el precio nuevo solo en lo que cambió y guarda todo de una. Lo que no toques se queda igual."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button
            onClick={guardar}
            disabled={cambios.length === 0 || saving}
            className="sm:min-w-44"
          >
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {saving
              ? "Guardando…"
              : cambios.length === 0
                ? "Guardar precios"
                : `Guardar ${cambios.length} cambio${cambios.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {result && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Listo: <strong>{result.actualizados}</strong> precio(s) actualizados
          {result.subieron > 0 && <> · subieron {result.subieron}</>}
          {result.bajaron > 0 && <> · bajaron {result.bajaron}</>}.
          {result.subieron > 0 && (
            <span className="mt-1 block">
              Como subió algún insumo, revisa el semáforo de márgenes en{" "}
              <strong>Producción → Terminados</strong>: ahí se ve de un vistazo
              si algún producto se te salió del objetivo.
            </span>
          )}
          {result.errores.length > 0 && (
            <span className="mt-1 block">
              No se pudieron actualizar {result.errores.length}:{" "}
              {result.errores
                .slice(0, 3)
                .map((e) => e.sku)
                .join(", ")}
              .
            </span>
          )}
        </FormAlert>
      )}

      {porDefinir.length > 0 && (
        <FormAlert tone="warning" icon={TriangleAlert}>
          Hay <strong>{porDefinir.length}</strong> insumo(s) que mides en gramos
          o mililitros y que todavía no dicen cómo los compras, así que aquí
          aparecen por gramo. Si los compras por kilo o por litro —lo normal—,
          déjalo escrito de una vez.
          <span className="mt-2 block">
            <Button
              size="sm"
              variant="outline"
              onClick={definirPresentaciones}
              disabled={definiendo}
            >
              {definiendo ? <Loader2 className="animate-spin" /> : <Package />}
              {definiendo
                ? "Guardando…"
                : `Los compro por kilo o litro (${porDefinir.length})`}
            </Button>
          </span>
          <span className="mt-2 block text-xs">
            No cambia ningún precio: solo deja por escrito lo que esta pantalla
            ya venía suponiendo. Al que te llegue en bulto o en caja, dile cuál
            es su presentación en su propia ficha.
          </span>
        </FormAlert>
      )}

      <FormAlert tone="info" icon={Package}>
        Si registras la compra con la <strong>foto de la factura</strong>, el
        precio se actualiza solo al entrar la mercancía. Esta pantalla es para
        cuando el proveedor te avisa un precio nuevo antes de que llegue el
        pedido.
      </FormAlert>

      <FormSection
        title="Precios"
        description="Cada precio va en la presentación con la que compras ese insumo: el bulto, la caja, el kilo o la unidad."
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead>Precio nuevo</TableHead>
                <TableHead className="text-right">Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mostradas.map((p) => (
                <FilaPrecio
                  key={p._id}
                  p={p}
                  valor={nuevos[p._id] ?? ""}
                  onChange={onChangeFila}
                />
              ))}
              {mostradas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No hay productos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {visibles.length > LIMITE_FILAS && (
          <p className="text-xs text-muted-foreground">
            Se muestran {LIMITE_FILAS} de {visibles.length}. Busca por nombre o
            SKU para llegar al resto; lo que ya escribiste se guarda igual
            aunque deje de verse.
          </p>
        )}
      </FormSection>

      <FormDivider />

      <FormSection
        title="¿Te cambiaron la lista entera?"
        description="Para muchos productos a la vez sale más rápido por Excel: descargas el catálogo, cambias la columna de costo y lo vuelves a subir."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExportar}>
            <Download />
            Descargar el catálogo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              reiniciar()
              onImportar()
            }}
          >
            <Upload />
            Subir el archivo corregido
          </Button>
        </div>
      </FormSection>
    </FormDialog>
  )
}

// ─── Conteo físico ────────────────────────────────────────────────────────────

/**
 * Una fila de la planilla de conteo. Memorizada por lo mismo que las de
 * precios: al escribir en una casilla se re-renderiza el diálogo entero, y con
 * ciento veinte insumos cada tecla se sentiría pegajosa.
 */
const FilaConteo = React.memo(function FilaConteo({
  p,
  esperado,
  valor,
  onChange,
}: {
  p: InvProduct
  esperado: number
  valor: string
  onChange: (id: string, valor: string) => void
}) {
  const n = Number(valor)
  const contado = valor.trim() !== "" && Number.isFinite(n) && n >= 0
  const diferencia = contado ? n - esperado : null
  const cuadra = diferencia !== null && Math.abs(diferencia) < 0.0005

  return (
    <TableRow className={contado && !cuadra ? "bg-brand-50/60 dark:bg-brand-950/30" : ""}>
      <TableCell className="py-2">
        <p className="font-medium leading-tight">{p.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {p.sku} · {unidadCorta(p.unit)}
        </p>
      </TableCell>
      <TableCell className="tnum py-2 text-right text-muted-foreground">
        {nf.format(esperado)}
      </TableCell>
      <TableCell className="py-2">
        {/* Sigue guardándose como texto: una casilla en blanco significa "no
            lo conté", y convertirla a cero vaciaría la sede de un plumazo. */}
        <QuantityInput
          className="h-9 w-32 text-right"
          aria-label={`Cantidad contada de ${p.name}`}
          placeholder="—"
          sufijo={unidadCorta(p.unit)}
          value={valor.trim() === "" ? null : n}
          onValueChange={(v) => onChange(p._id, v === null ? "" : String(v))}
        />
      </TableCell>
      <TableCell className="tnum py-2 text-right">
        {diferencia === null ? (
          <span className="text-muted-foreground">—</span>
        ) : cuadra ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-ink">
            <Check className="size-3.5" />
            Cuadra
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              diferencia > 0 ? "text-success-ink" : "text-destructive",
            )}
          >
            {diferencia > 0 ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {diferencia > 0 ? "+" : ""}
            {nf.format(diferencia)}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
})

/**
 * Conteo físico de una sede: la planilla del domingo al cerrar.
 *
 * Deja la existencia en lo CONTADO. No suma — esa es toda la diferencia con la
 * carga masiva de existencias, que registra cada fila como entrada de
 * mercancía: usar aquella para contar duplica el inventario.
 *
 * La regla que gobierna esta pantalla: **solo viaja lo que alguien escribió**.
 * Una casilla en blanco significa "no lo conté", nunca "hay cero". Mandarlas
 * como cero vaciaría el inventario entero de una sede con un solo clic, y
 * quedaría registrado como un conteo legítimo.
 */
function ConteoFisicoDialog({
  open,
  onOpenChange,
  products,
  sedes,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: InvProduct[]
  sedes: Sede[]
  onSaved: () => void
}) {
  const [sedeId, setSedeId] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [note, setNote] = React.useState("")
  const [contados, setContados] = React.useState<Record<string, string>>({})
  const [esperados, setEsperados] = React.useState<Map<string, number>>(new Map())
  const [cargando, setCargando] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<StockCountResult | null>(null)

  function reiniciar() {
    setSearch("")
    setNote("")
    setContados({})
    setEsperados(new Map())
    setError(null)
    setResult(null)
  }

  function cerrar() {
    onOpenChange(false)
    reiniciar()
  }

  // Con una sola sede no hay nada que elegir: se da por escogida. Derivado y
  // no un efecto que la escriba, para no encadenar un render de más.
  const sedeActiva = sedeId || (sedes.length === 1 ? (sedes[0]?._id ?? "") : "")

  /**
   * Trae lo que el sistema cree que hay en la sede. Se pide aparte de la tabla
   * de existencias de la página porque aquella respeta el filtro de sede de la
   * pantalla, y aquí la sede la manda la planilla.
   */
  React.useEffect(() => {
    let vivo = true
    // El `await` de entrada saca los setState del cuerpo del efecto, que si no
    // encadena renders. Mismo patrón que las fichas de esta pantalla.
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !open || !sedeActiva) return
      setCargando(true)
      setError(null)
      try {
        const rows = await getStock(sedeActiva)
        if (vivo) setEsperados(new Map(rows.map((r) => [r.product._id, r.qty])))
      } catch (err) {
        if (vivo) setError(errorMessage(err))
      } finally {
        if (vivo) setCargando(false)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [open, sedeActiva])

  const onChangeFila = React.useCallback((id: string, valor: string) => {
    setContados((prev) => ({ ...prev, [id]: valor }))
  }, [])

  /**
   * Lo que se puede contar: activos y sin las plantillas de variantes, que no
   * tienen existencias propias (las tienen sus hijas, que sí aparecen).
   */
  const contables = React.useMemo(
    () =>
      products
        .filter((p) => p.active && !p.variantAxes)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [products],
  )

  const visibles = React.useMemo(() => {
    const q = normalizeName(search)
    if (!q) return contables
    return contables.filter(
      (p) =>
        normalizeName(p.name).includes(q) || normalizeName(p.sku).includes(q),
    )
  }, [contables, search])

  /**
   * Solo lo que alguien escribió de verdad. Una casilla en blanco es "no lo
   * conté" y se queda fuera: mandarla como cero vaciaría ese producto.
   */
  const contadas = React.useMemo(() => {
    const out: { p: InvProduct; esperado: number; contado: number }[] = []
    for (const p of contables) {
      const texto = contados[p._id]
      if (texto === undefined || texto.trim() === "") continue
      const n = Number(texto)
      if (!Number.isFinite(n) || n < 0) continue
      out.push({ p, esperado: esperados.get(p._id) ?? 0, contado: n })
    }
    return out
  }, [contables, contados, esperados])

  /** De lo contado, lo que no cuadra: es lo que va a mover existencias. */
  const descuadres = React.useMemo(
    () => contadas.filter((c) => Math.abs(c.contado - c.esperado) >= 0.0005),
    [contadas],
  )

  const sobran = descuadres.filter((c) => c.contado > c.esperado)
  const faltan = descuadres.filter((c) => c.contado < c.esperado)
  // Estimación de lo que vale el faltante, con el costo del producto. Es para
  // que nadie aplique un conteo grande sin ver antes cuánta plata mueve.
  const valorFaltante = faltan.reduce(
    (sum, c) => sum + (c.esperado - c.contado) * (c.p.cost ?? 0),
    0,
  )

  async function guardar() {
    if (contadas.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await applyStockCount({
        sedeId: sedeActiva,
        // Viajan TODAS las contadas, no solo las que descuadran: el conteo es
        // el registro de qué se revisó, y el backend informa cuántas cuadraban.
        rows: contadas.map((c) => ({
          productId: c.p._id,
          counted: c.contado,
          expected: c.esperado,
        })),
        note: note.trim() || undefined,
      })
      setResult(res)
      setContados({})
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /** Planilla en blanco para imprimir y recorrer la bodega con un lápiz. */
  function descargarPlanilla() {
    const sede = sedes.find((s) => s._id === sedeActiva)
    downloadCsv(
      `conteo-${sede?.code ?? "sede"}-${new Date().toLocaleDateString("en-CA")}.csv`,
      serializeCsv(
        ["sku", "nombre", "unidad", "sistema", "contado"],
        contables.map((p) => [
          p.sku,
          p.name,
          p.unit,
          esperados.get(p._id) ?? 0,
          "",
        ]),
      ),
    )
  }

  const mostradas = visibles.slice(0, LIMITE_FILAS)

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reiniciar()
      }}
      size="3xl"
      icon={ClipboardList}
      title="Conteo físico"
      description="Recorre la bodega y escribe lo que de verdad hay. Lo que no cuentes se queda como está."
      footer={
        <>
          <Button variant="outline" onClick={cerrar}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          <Button
            onClick={guardar}
            disabled={contadas.length === 0 || saving || !sedeActiva}
            className="sm:min-w-52"
          >
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {saving
              ? "Aplicando…"
              : descuadres.length === 0
                ? "Aplicar conteo"
                : `Ajustar ${descuadres.length} producto${descuadres.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {result && (
        <FormAlert tone="success" icon={CheckCircle2}>
          Conteo aplicado: <strong>{result.adjusted}</strong> producto(s)
          ajustados y {result.unchanged} que ya cuadraban.
          {result.removedQty > 0 && (
            <span className="mt-1 block">
              Faltaban {nf.format(result.removedQty)} unidad(es), unos{" "}
              <strong>{money.format(result.removedValue)}</strong>.
            </span>
          )}
          {result.addedQty > 0 && (
            <span className="mt-1 block">
              Sobraban {nf.format(result.addedQty)} unidad(es), unos{" "}
              {money.format(result.addedValue)}.
            </span>
          )}
          {result.moved.length > 0 && (
            <span className="mt-1 block">
              Ojo: {result.moved.length} producto(s) se movieron mientras
              contabas ({result.moved.slice(0, 3).map((m) => m.name).join(", ")}
              ). Se ajustaron contra lo que había al aplicar, que es lo
              correcto, pero vale la pena mirar si hubo una venta de por medio.
            </span>
          )}
          {result.errors.length > 0 && (
            <span className="mt-1 block">
              No se pudieron ajustar {result.errors.length}:{" "}
              {result.errors
                .slice(0, 3)
                .map((e) => `${e.name} (${e.message})`)
                .join("; ")}
              .
            </span>
          )}
        </FormAlert>
      )}

      <FormSection title="Dónde cuentas">
        <FieldGrid cols={2}>
          <Field id="cf-sede" label="Sede" required help={{ term: "sede" }}>
            <NativeSelect
              id="cf-sede"
              value={sedeActiva}
              onChange={(v) => {
                setSedeId(v)
                setContados({})
                setResult(null)
              }}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
              placeholder="Seleccionar sede"
            />
          </Field>
          <Field
            id="cf-note"
            label="Nota"
            hint="Queda en cada movimiento del kárdex."
          >
            <Input
              id="cf-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Conteo del domingo"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {sedeActiva && (
        <FormSection
          title="Qué encontraste"
          description="Escribe solo lo que contaste. La casilla en blanco significa que no lo revisaste, no que haya cero."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={descargarPlanilla}
              disabled={cargando || contables.length === 0}
            >
              <Download />
              Planilla para imprimir
            </Button>
          </div>

          {descuadres.length > 0 && (
            <FormAlert tone="warning" icon={TriangleAlert}>
              Vas a ajustar <strong>{descuadres.length}</strong> producto(s):{" "}
              {faltan.length} con faltante y {sobran.length} con sobrante.
              {valorFaltante > 0 && (
                <> El faltante vale unos <strong>{money.format(valorFaltante)}</strong>.</>
              )}{" "}
              Los otros {contadas.length - descuadres.length} que contaste ya
              cuadran y no se tocan.
            </FormAlert>
          )}

          <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Según el sistema</TableHead>
                  <TableHead>Contaste</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!cargando &&
                  mostradas.map((p) => (
                    <FilaConteo
                      key={p._id}
                      p={p}
                      esperado={esperados.get(p._id) ?? 0}
                      valor={contados[p._id] ?? ""}
                      onChange={onChangeFila}
                    />
                  ))}
                {!cargando && mostradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No hay productos que coincidan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibles.length > LIMITE_FILAS && (
            <p className="text-xs text-muted-foreground">
              Se muestran {LIMITE_FILAS} de {visibles.length}. Usa el buscador
              para llegar al resto; lo que ya escribiste no se pierde.
            </p>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}

// ─── Sheet de importación CSV ─────────────────────────────────────────────────

function ImportProductsSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ImportProductRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFileName(null)
    setRows([])
    setParseError(null)
    setResult(null)
    setImporting(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setParseError(null)
    try {
      const matrix = parseCsv(await file.text())
      const parsed = csvToImportRows(matrix)
      setFileName(file.name)
      setRows(parsed)
      if (parsed.length === 0) {
        setParseError(
          "No se detectaron filas válidas. La primera fila debe tener los encabezados (sku, name, …).",
        )
      }
    } catch {
      setParseError("No se pudo leer el archivo CSV.")
      setRows([])
    }
  }

  async function doImport() {
    if (rows.length === 0) return
    setImporting(true)
    setParseError(null)
    try {
      const res = await importProducts(rows)
      setResult(res)
      onImported()
    } catch (err) {
      setParseError(errorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
      size="2xl"
      icon={FileUp}
      title="Importar productos (CSV)"
      description="Se hace match por SKU: crea los nuevos y actualiza los que ya existen. La categoría se resuelve por nombre y se crea si hace falta."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={doImport} disabled={rows.length === 0 || importing}>
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing ? "Importando…" : "Importar"}
            </Button>
          )}
        </>
      }
    >
      {parseError && <FormAlert>{parseError}</FormAlert>}

      <FormSection
        title="El archivo"
        description="Descarga la plantilla, llénala en Excel y vuelve a subirla."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("plantilla-inventario.csv", csvTemplate())
            }
          >
            <Download />
            Descargar plantilla
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp />
          <span className="truncate">{fileName ?? "Elegir archivo CSV…"}</span>
        </Button>

        {rows.length > 0 && !result && (
          <FormAlert tone="info" icon={FileUp}>
            <strong>{rows.length}</strong> fila(s) listas para importar.
          </FormAlert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Columnas: {CSV_COLUMNS.join(", ")}. Solo <code>sku</code> y{" "}
          <code>name</code> son obligatorios; el resto es opcional.
        </p>
      </FormSection>

      {result && (
        <FormSection title="Resultado" boxed>
          <FormAlert tone="success" icon={CheckCircle2}>
            Importación completada. Creados{" "}
            <strong>{result.created}</strong>, actualizados{" "}
            <strong>{result.updated}</strong>, con error{" "}
            <strong>{result.errors.length}</strong>.
          </FormAlert>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
              {result.errors.slice(0, 50).map((er, i) => (
                <li key={i}>
                  Fila {er.row}
                  {er.sku ? ` (${er.sku})` : ""}: {er.message}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}

function StockImportSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImported: () => void
}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ImportStockRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [result, setResult] = React.useState<ImportStockResult | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFileName(null)
    setRows([])
    setParseError(null)
    setResult(null)
    setImporting(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setParseError(null)
    try {
      const parsed = csvToStockRows(parseCsv(await file.text()))
      setFileName(file.name)
      setRows(parsed)
      if (parsed.length === 0) {
        setParseError(
          "No se detectaron filas válidas. La primera fila debe tener los encabezados (sku, sede, qty, …).",
        )
      }
    } catch {
      setParseError("No se pudo leer el archivo CSV.")
      setRows([])
    }
  }

  async function doImport() {
    if (rows.length === 0) return
    setImporting(true)
    setParseError(null)
    try {
      const res = await importStock(rows)
      setResult(res)
      onImported()
    } catch (err) {
      setParseError(errorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
      size="2xl"
      icon={Upload}
      title="Cargar existencias (CSV)"
      description="Cada fila registra una entrada de mercancía del producto (por SKU) en la sede (por nombre o código)."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={doImport} disabled={rows.length === 0 || importing}>
              {importing ? <Loader2 className="animate-spin" /> : <Upload />}
              {importing ? "Cargando…" : "Cargar"}
            </Button>
          )}
        </>
      }
    >
      <FormAlert tone="warning" icon={TriangleAlert}>
        Importar <strong>suma</strong> las cantidades como entradas; no
        reemplaza el stock actual. Úsalo para carga inicial o recepción masiva.
      </FormAlert>

      {parseError && <FormAlert>{parseError}</FormAlert>}

      <FormSection
        title="El archivo"
        description="Descarga la plantilla, llénala en Excel y vuelve a subirla."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("plantilla-existencias.csv", stockTemplate())
            }
          >
            <Download />
            Descargar plantilla
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => inputRef.current?.click()}
        >
          <FileUp />
          <span className="truncate">{fileName ?? "Elegir archivo CSV…"}</span>
        </Button>

        {rows.length > 0 && !result && (
          <FormAlert tone="info" icon={FileUp}>
            <strong>{rows.length}</strong> entrada(s) listas para cargar.
          </FormAlert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Columnas: {STOCK_IMPORT_COLUMNS.join(", ")}. Obligatorias:{" "}
          <code>sku</code>, <code>sede</code> y <code>qty</code>. Los
          perecederos requieren <code>expiresAt</code>.
        </p>
      </FormSection>

      {result && (
        <FormSection title="Resultado" boxed>
          <FormAlert tone="success" icon={CheckCircle2}>
            Carga completada. Entradas <strong>{result.imported}</strong>, con
            error <strong>{result.errors.length}</strong>.
          </FormAlert>
          {result.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-destructive">
              {result.errors.slice(0, 50).map((er, i) => (
                <li key={i}>
                  Fila {er.row}
                  {er.sku ? ` (${er.sku}` : ""}
                  {er.sku && er.sede ? ` · ${er.sede})` : er.sku ? ")" : ""}:{" "}
                  {er.message}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      )}
    </FormDialog>
  )
}

export default function InventarioPage() {
  // Las tallas son cosa del comercio que NO trabaja con recetas (ropa,
  // calzado, accesorios). Se decide por descarte —"no es un restaurante"— y no
  // con `isRetail`: ese exige que el giro esté fijado en el token, así que a
  // cualquier cuenta antigua o recién migrada le desaparecía el botón sin
  // explicación posible. Un restaurante sí queda fuera: allí una camisa talla
  // M no significa nada y el botón solo sería ruido.
  const { hasPermission, isRestaurant } = useAuth()
  const usaTallas = !isRestaurant
  const canView = hasPermission("inventory.view")
  const canAdjust = hasPermission("inventory.adjust")
  const canTransfer = hasPermission("inventory.transfer")
  const confirm = useConfirm()

  const [tab, setTab] = React.useState<Tab>("productos")

  // Data
  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [categories, setCategories] = React.useState<InvCategory[]>([])
  const [stock, setStock] = React.useState<StockRow[]>([])
  const [suppliersList, setSuppliersList] = React.useState<Supplier[]>([])
  /** Stock sin filtrar por sede, para los totales del catálogo. */
  const [allStock, setAllStock] = React.useState<StockRow[]>([])
  const [alerts, setAlerts] = React.useState<InvAlerts | null>(null)
  const [movements, setMovements] = React.useState<MovementsPage | null>(null)

  // Loading / error
  const [productsLoading, setProductsLoading] = React.useState(true)
  const [productsError, setProductsError] = React.useState<string | null>(null)
  const [stockLoading, setStockLoading] = React.useState(true)
  const [stockError, setStockError] = React.useState<string | null>(null)
  const [movsLoading, setMovsLoading] = React.useState(true)
  const [movsError, setMovsError] = React.useState<string | null>(null)

  // Filters
  const [search, setSearch] = React.useState("")
  const [expandedStockId, setExpandedStockId] = React.useState<string | null>(
    null,
  )
  const [stockSede, setStockSede] = React.useState("all")
  const [movSede, setMovSede] = React.useState("all")
  const [movProduct, setMovProduct] = React.useState("all")
  const [movPage, setMovPage] = React.useState(1)

  // Sheets
  const [productSheetOpen, setProductSheetOpen] = React.useState(false)
  const [productSheetMode, setProductSheetMode] = React.useState<
    "create" | "edit"
  >("create")
  const [editingProduct, setEditingProduct] = React.useState<
    InvProduct | undefined
  >()
  const [categoriesOpen, setCategoriesOpen] = React.useState(false)
  const [variantsOpen, setVariantsOpen] = React.useState(false)
  const [entryOpen, setEntryOpen] = React.useState(false)
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [transferOpen, setTransferOpen] = React.useState(false)
  const [opPreset, setOpPreset] = React.useState<
    { productId?: string; sedeId?: string } | undefined
  >()

  // Importar / exportar CSV (catálogo de productos)
  const [importOpen, setImportOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  // Actualización masiva de precios de compra
  const [pricesOpen, setPricesOpen] = React.useState(false)
  // Conteo físico de una sede (planilla del domingo al cerrar)
  const [countOpen, setCountOpen] = React.useState(false)
  // Rastrear a dónde se fue un lote (lo que pregunta el INVIMA)
  const [traceOpen, setTraceOpen] = React.useState(false)
  // Reporte de merma: qué se botó, por qué y cuánto costó
  const [wasteOpen, setWasteOpen] = React.useState(false)
  // Importar / exportar CSV (existencias)
  const [stockImportOpen, setStockImportOpen] = React.useState(false)
  /** Se incrementa tras cada operación de stock: recarga la pestaña de lotes. */
  const [lotsRefresh, setLotsRefresh] = React.useState(0)

  const handleExport = React.useCallback(async () => {
    setExporting(true)
    try {
      // Se exporta todo el catálogo (incluidos inactivos) como respaldo.
      const all = await listProducts(true)
      downloadCsv(
        `inventario-${new Date().toLocaleDateString("en-CA")}.csv`,
        productsToCsv(all),
      )
    } catch {
      // best-effort: si falla, no bloquea la pantalla
    } finally {
      setExporting(false)
    }
  }, [])

  const handleExportStock = React.useCallback(() => {
    // Exporta el snapshot que se está viendo (respeta el filtro de sede).
    downloadCsv(
      `existencias-${new Date().toLocaleDateString("en-CA")}.csv`,
      stockToCsv(stock),
    )
  }, [stock])

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchProducts = React.useCallback(async () => {
    setProductsLoading(true)
    setProductsError(null)
    try {
      setProducts(await listProducts())
    } catch (err) {
      setProductsError(errorMessage(err))
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const fetchStock = React.useCallback(async () => {
    setStockLoading(true)
    setStockError(null)
    try {
      setStock(await getStock(stockSede === "all" ? undefined : stockSede))
    } catch (err) {
      setStockError(errorMessage(err))
    } finally {
      setStockLoading(false)
    }
  }, [stockSede])

  const fetchAllStock = React.useCallback(() => {
    void getStock().then(setAllStock).catch(() => {})
  }, [])

  const fetchAlerts = React.useCallback(async () => {
    try {
      setAlerts(await getAlerts())
    } catch {
      // no crítico
    }
  }, [])

  const refreshCategories = React.useCallback(() => {
    void listCategories()
      .then(setCategories)
      .catch(() => {})
  }, [])

  const fetchMovements = React.useCallback(async () => {
    setMovsLoading(true)
    setMovsError(null)
    try {
      setMovements(
        await getMovements({
          sedeId: movSede === "all" ? undefined : movSede,
          productId: movProduct === "all" ? undefined : movProduct,
          page: movPage,
          limit: 25,
        }),
      )
    } catch (err) {
      setMovsError(errorMessage(err))
    } finally {
      setMovsLoading(false)
    }
  }, [movSede, movProduct, movPage])

  React.useEffect(() => {
    if (!canView) return
    void listSedes().then(setSedes).catch(() => {})
    void listCategories().then(setCategories).catch(() => {})
    void listSuppliers().then(setSuppliersList).catch(() => {})
    void fetchAlerts()
    fetchAllStock()
  }, [canView, fetchAlerts, fetchAllStock])

  React.useEffect(() => {
    if (!canView) return
    void fetchProducts()
  }, [canView, fetchProducts])

  React.useEffect(() => {
    if (!canView) return
    void fetchStock()
  }, [canView, fetchStock])

  React.useEffect(() => {
    if (!canView) return
    void fetchMovements()
  }, [canView, fetchMovements])

  /** Tras cualquier operación de stock se refresca todo lo afectado. */
  function refreshAfterOperation() {
    setLotsRefresh((n) => n + 1)
    void fetchStock()
    fetchAllStock()
    void fetchMovements()
    void fetchAlerts()
    void fetchProducts()
  }

  // ── Sin permiso ────────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <>
        <PageHeader
          section="Operación"
          title="Inventario"
          description="Catálogo de productos, existencias por sede y kardex."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver el inventario. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      (p.categoryId?.name ?? "").toLowerCase().includes(q)
    )
  })

  const alertCount =
    (alerts?.lowStock.length ?? 0) +
    (alerts?.expired.length ?? 0) +
    (alerts?.expiringSoon.length ?? 0)

  async function handleDelete(p: InvProduct) {
    if (
      !(await confirm({
        title: `¿Eliminar "${p.name}" definitivamente?`,
        description:
          "Se borrarán también sus existencias, lotes y movimientos de kardex. Esta acción no se puede deshacer.",
        destructive: true,
      }))
    )
      return
    try {
      await deleteProduct(p._id)
      refreshAfterOperation()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  function openOperation(
    setter: (v: boolean) => void,
    preset?: { productId?: string; sedeId?: string },
  ) {
    setOpPreset(preset)
    setter(true)
  }

  return (
    <>
      <PageHeader
        section="Operación"
        title="Inventario"
        icon={BoxesIcon}
        description={
          <>
            Lo que <strong>compras</strong> y tienes guardado: insumos,
            mercancía, existencias por sede, lotes con su vencimiento y el
            historial de cada movimiento. Lo que <strong>vendes</strong> en la
            caja se arma después, en{" "}
            <Link
              href="/panel/productos"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Productos
            </Link>
            .
          </>
        }
        actions={
          <>
            {/* Antes había once botones en fila, la mitad convertidos en
                iconos sin rótulo en cuanto la pantalla se estrechaba: nadie
                sabía cuál era cuál. Ahora a la vista solo queda lo que se usa
                todos los días —dar de alta, recibir, ajustar— y el resto vive
                en un menú donde cada opción dice con palabras qué hace. */}
            {canAdjust && (
              <>
                <Button
                  variant="outline"
                  data-tour="inv-entrada"
                  aria-label="Registrar entrada de mercancía"
                  onClick={() => openOperation(setEntryOpen)}
                >
                  <PackagePlus />
                  Entrada
                </Button>
                <Button
                  variant="outline"
                  aria-label="Registrar un ajuste de existencias"
                  onClick={() => openOperation(setAdjustOpen)}
                >
                  <PackageMinus />
                  <ButtonLabel from="md">Ajuste</ButtonLabel>
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" aria-label="Herramientas" />}
              >
                <Wrench />
                <ButtonLabel from="sm">Herramientas</ButtonLabel>
                <ChevronDown className="opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {canAdjust && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Cada tanto</DropdownMenuLabel>
                      <HerramientaItem
                        icon={TrendingUp}
                        titulo="Actualizar precios"
                        frase="Subes de un golpe lo que te cobran por los insumos."
                        onClick={() => setPricesOpen(true)}
                      />
                      <HerramientaItem
                        icon={ClipboardList}
                        titulo="Conteo físico"
                        frase="La planilla del domingo: cuentas y el sistema cuadra."
                        onClick={() => setCountOpen(true)}
                      />
                      {canTransfer && sedes.length > 1 && (
                        <HerramientaItem
                          icon={ArrowLeftRight}
                          titulo="Traslado entre sedes"
                          frase="Mueves mercancía de una sede a otra sin vender."
                          onClick={() => openOperation(setTransferOpen)}
                        />
                      )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuGroup>
                  <DropdownMenuLabel>Para revisar</DropdownMenuLabel>
                  <HerramientaItem
                    icon={ScanSearch}
                    titulo="Rastrear un lote"
                    frase="A dónde se fue todo lo que entró de una tanda."
                    onClick={() => setTraceOpen(true)}
                  />
                  <HerramientaItem
                    icon={Trash2}
                    titulo="Reporte de merma"
                    frase="Qué se botó, por qué y cuánta plata se fue en eso."
                    onClick={() => setWasteOpen(true)}
                  />
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuLabel>Organizar</DropdownMenuLabel>
                  {canAdjust && (
                    <HerramientaItem
                      icon={Tags}
                      titulo="Categorías"
                      frase="Los grupos con que ordenas: lácteos, empaques, aseo."
                      onClick={() => setCategoriesOpen(true)}
                    />
                  )}
                  {canAdjust && usaTallas && (
                    <HerramientaItem
                      icon={Layers}
                      titulo="Tallas y variantes"
                      frase="Creas de un tirón la misma cosa en varias tallas o colores."
                      onClick={() => setVariantsOpen(true)}
                    />
                  )}
                  <HerramientaItem
                    icon={Download}
                    titulo="Bajar a Excel"
                    frase="Te llevas todo el listado en un archivo, como respaldo."
                    disabled={exporting}
                    onClick={() => void handleExport()}
                  />
                  {canAdjust && (
                    <HerramientaItem
                      icon={Upload}
                      titulo="Subir desde Excel"
                      frase="Cargas muchos de una vez desde una planilla."
                      onClick={() => setImportOpen(true)}
                    />
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {canAdjust && (
              <Button
                size="lg"
                data-tour="inv-nuevo"
                onClick={() => {
                  setProductSheetMode("create")
                  setEditingProduct(undefined)
                  setProductSheetOpen(true)
                }}
              >
                <Plus />
                Nuevo insumo
              </Button>
            )}
          </>
        }
      />

      {/* Alertas */}
      {alertCount > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {(alerts?.lowStock.length ?? 0) > 0 && (
            <Card className="border-warning/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TriangleAlert className="size-4 text-warning-ink" />
                  Stock bajo
                </CardTitle>
                <CardDescription>
                  {alerts!.lowStock.length} producto(s) en o bajo el mínimo
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {alerts!.lowStock.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {s.product.name}{" "}
                      <span className="text-muted-foreground">
                        · {s.sede?.name}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {nf.format(s.qty)} / mín {nf.format(s.minStock)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {(alerts?.expiringSoon.length ?? 0) > 0 && (
            <Card className="border-warning/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4 text-warning-ink" />
                  Por vencer ({alerts!.days} días)
                </CardTitle>
                <CardDescription>
                  {alerts!.expiringSoon.length} lote(s) próximos a vencer
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {alerts!.expiringSoon.slice(0, 4).map((l) => (
                  <div key={l._id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {l.productId?.name}{" "}
                      <span className="text-muted-foreground">
                        · {l.lotCode}
                      </span>
                    </span>
                    <ExpiryBadge date={l.expiresAt} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {(alerts?.expired.length ?? 0) > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TriangleAlert className="size-4 text-destructive" />
                  Vencidos
                </CardTitle>
                <CardDescription>
                  {alerts!.expired.length} lote(s) vencidos con existencias
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {alerts!.expired.slice(0, 4).map((l) => (
                  <div key={l._id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {l.productId?.name}{" "}
                      <span className="text-muted-foreground">
                        · {l.lotCode} · {l.sedeId?.name}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {nf.format(l.qty)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pestañas del módulo. El contador de lotes en riesgo va en la propia
          pestaña: es la única forma de que se vea sin entrar a buscarlo. */}
      <div className="mb-2 overflow-x-auto pb-1" data-tour="inv-tabs">
        <Segmented
          value={tab}
          onValueChange={setTab}
          ariaLabel="Vista del inventario"
          options={[
            {
              value: "productos",
              label: TAB_INFO.productos.label,
              icon: Package,
            },
            {
              value: "existencias",
              label: TAB_INFO.existencias.label,
              icon: BoxesIcon,
            },
            {
              value: "lotes",
              label: TAB_INFO.lotes.label,
              icon: CalendarClock,
              badge:
                (alerts?.expired.length ?? 0) +
                  (alerts?.expiringSoon.length ?? 0) || undefined,
            },
            {
              value: "movimientos",
              label: TAB_INFO.movimientos.label,
              icon: ArrowLeftRight,
            },
          ]}
        />
      </div>
      {/* La frase de la pestaña activa. Va fuera de la tarjeta, pegada a las
          pestañas, porque lo que explica es la elección que se acaba de hacer. */}
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {TAB_INFO[tab].frase}
      </p>

      {/* ── Tab: Productos ── */}
      {tab === "productos" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Insumos y mercancía</CardTitle>
              <CardDescription>
                {filteredProducts.length} ficha(s) ·{" "}
                <Link
                  href="/panel/productos"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Lo que vendes se arma en Productos
                </Link>
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU, código…"
                className="w-64"
                data-tour="inv-buscar"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {productsLoading ? (
              <TableSkeleton cols={6} />
            ) : productsError ? (
              <p className="p-6 text-sm text-destructive">{productsError}</p>
            ) : filteredProducts.length === 0 ? (
              products.length === 0 ? (
                <VacioConSalida
                  icon={Package}
                  titulo="Todavía no has registrado nada"
                  frase="Aquí va lo que compras: la harina, las bolsas, la gaseosa que revendes. Cada ficha dice en qué lo mides y cómo te llega, y es de donde saldrá después lo que vendes en la caja."
                  accion={
                    canAdjust
                      ? {
                          texto: "Registrar mi primer insumo",
                          icon: Plus,
                          onClick: () => {
                            setProductSheetMode("create")
                            setEditingProduct(undefined)
                            setProductSheetOpen(true)
                          },
                        }
                      : undefined
                  }
                />
              ) : (
                <VacioConSalida
                  icon={Search}
                  titulo="Nada coincide con lo que buscaste"
                  frase="Prueba con parte del nombre o con el SKU."
                />
              )
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Cómo lo mides</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">En stock</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => {
                    const totalQty = allStock
                      .filter((r) => r.product._id === p._id)
                      .reduce((sum, r) => sum + r.qty, 0)
                    const pres = presentacionDeCompra(p)
                    return (
                      <TableRow key={p._id}>
                        <TableCell className="font-mono text-xs">
                          {p.sku}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ITEM_TYPE_LABELS[p.itemType ?? "product"]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 font-medium">
                              {p.name}
                              {p.variantAxes && p.variantAxes.length > 0 && (
                                <Badge variant="secondary" className="gap-1">
                                  <Layers className="size-3" />
                                  Plantilla
                                </Badge>
                              )}
                            </span>
                            {p.variantAttrs &&
                            Object.keys(p.variantAttrs).length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {Object.entries(p.variantAttrs)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </span>
                            ) : (
                              (p.brand || p.description) && (
                                <span className="max-w-56 truncate text-xs text-muted-foreground">
                                  {[p.brand, p.description]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )
                            )}
                          </div>
                        </TableCell>
                        {/* Unidad y presentación juntas: es la pregunta que
                            más se hace al mirar el listado —"¿esto va en
                            gramos o en kilos, y cómo lo compro?"— y hasta
                            ahora había que abrir la ficha para saberlo. */}
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span>{unidadNombre(p.unit)}</span>
                            <span className="text-xs text-muted-foreground">
                              {pres.definida
                                ? `Llega por ${pres.unidad}${pres.contenido ? ` de ${pres.contenido}` : ""}`
                                : "Se compra igual"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.categoryId?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {nf.format(totalQty)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {unidadCorta(p.unit)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {canAdjust && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Editar ${p.name}`}
                                onClick={() => {
                                  setProductSheetMode("edit")
                                  setEditingProduct(p)
                                  setProductSheetOpen(true)
                                }}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Eliminar ${p.name}`}
                                onClick={() => void handleDelete(p)}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Existencias ── */}
      {tab === "existencias" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Existencias</CardTitle>
              <CardDescription>
                Cuánto tienes ahora mismo en cada sede
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportStock}
                disabled={stock.length === 0}
              >
                <Download />
                Exportar
              </Button>
              {canAdjust && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStockImportOpen(true)}
                >
                  <Upload />
                  Cargar
                </Button>
              )}
              <Select
                value={stockSede}
                items={{ all: "Todas las sedes", ...sedeItems(sedes) }}
                onValueChange={(v) => {
                  if (v !== null) setStockSede(v)
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {sedes.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stockLoading ? (
              <TableSkeleton cols={9} />
            ) : stockError ? (
              <p className="p-6 text-sm text-destructive">{stockError}</p>
            ) : stock.length === 0 ? (
              products.length === 0 ? (
                <VacioConSalida
                  icon={Package}
                  titulo="Primero hay que tener fichas"
                  frase="Las existencias son la cantidad de algo, y todavía no hay de qué. Registra en “Insumos y mercancía” lo que compras y vuelve aquí."
                  accion={
                    canAdjust
                      ? {
                          texto: "Ir a registrar un insumo",
                          icon: Package,
                          onClick: () => setTab("productos"),
                        }
                      : undefined
                  }
                />
              ) : (
                <VacioConSalida
                  icon={BoxesIcon}
                  titulo="Las fichas están, la mercancía no"
                  frase="Ya tienes registrado qué manejas, pero nadie ha dicho que haya llegado. Registra una entrada por cada compra que recibas y aquí verás cuánto hay."
                  accion={
                    canAdjust
                      ? {
                          texto: "Registrar una entrada",
                          icon: PackagePlus,
                          onClick: () => openOperation(setEntryOpen),
                        }
                      : undefined
                  }
                />
              )
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead>Lotes</TableHead>
                    <TableHead>Próx. vencimiento</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((row) => {
                    const low = row.minStock > 0 && row.qty <= row.minStock
                    const expanded = expandedStockId === row.id
                    return (
                      <React.Fragment key={row.id}>
                      <TableRow
                        className="cursor-pointer"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedStockId(expanded ? null : row.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setExpandedStockId(expanded ? null : row.id)
                          }
                        }}
                      >
                        <TableCell>
                          <ChevronDown
                            className={`size-4 text-muted-foreground transition-transform ${
                              expanded ? "" : "-rotate-90"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {row.product.name}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {row.product.sku}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.product.categoryId?.name ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.sede?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium",
                              low && "text-destructive",
                            )}
                          >
                            {nf.format(row.qty)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {unidadCorta(row.product.unit)}
                          </span>
                          {low && (
                            <Badge variant="destructive" className="ml-2">
                              Bajo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {row.minStock > 0 ? nf.format(row.minStock) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.product.trackLots ? (
                            <span className="flex items-center gap-1.5">
                              <Layers className="size-4 text-muted-foreground" />
                              {row.lotCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ExpiryBadge date={row.nextExpiresAt} />
                        </TableCell>
                        <TableCell>
                          {canAdjust && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Registrar entrada"
                                title="Entrada"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openOperation(setEntryOpen, {
                                    productId: row.product._id,
                                    sedeId: row.sede?._id,
                                  })
                                }}
                              >
                                <PackagePlus />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Ajustar"
                                title="Ajuste"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openOperation(setAdjustOpen, {
                                    productId: row.product._id,
                                    sedeId: row.sede?._id,
                                  })
                                }}
                              >
                                <PackageMinus />
                              </Button>
                              {canTransfer && sedes.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Trasladar"
                                  title="Traslado"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openOperation(setTransferOpen, {
                                      productId: row.product._id,
                                      sedeId: row.sede?._id,
                                    })
                                  }}
                                >
                                  <ArrowLeftRight />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={9}
                            className="bg-muted/40 px-6 py-4"
                          >
                            <ExpandedLots row={row} />
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Lotes ── */}
      {tab === "lotes" && (
        <LotsPanel
          sedes={sedes}
          canAdjust={canAdjust}
          refreshKey={lotsRefresh}
          onAdjust={(preset) => openOperation(setAdjustOpen, preset)}
          onEntry={() => openOperation(setEntryOpen)}
        />
      )}

      {/* ── Tab: Movimientos (kardex) ── */}
      {tab === "movimientos" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Movimientos</CardTitle>
              <CardDescription>
                {movements
                  ? `${movements.total} movimiento(s) registrado(s)`
                  : "Historial de entradas, salidas y ajustes"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={movSede}
                items={{ all: "Todas las sedes", ...sedeItems(sedes) }}
                onValueChange={(v) => {
                  if (v !== null) {
                    setMovSede(v)
                    setMovPage(1)
                  }
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {sedes.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={movProduct}
                items={{
                  all: "Todos los productos",
                  ...productItems(products),
                }}
                onValueChange={(v) => {
                  if (v !== null) {
                    setMovProduct(v)
                    setMovPage(1)
                  }
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {movsLoading ? (
              <TableSkeleton cols={7} />
            ) : movsError ? (
              <p className="p-6 text-sm text-destructive">{movsError}</p>
            ) : !movements || movements.rows.length === 0 ? (
              <VacioConSalida
                icon={ArrowLeftRight}
                titulo="Todavía no se ha movido nada"
                frase="Aquí se va escribiendo sola la historia: cada entrada de mercancía, cada venta y cada ajuste, con su fecha y su responsable. Empieza a llenarse en cuanto registres la primera entrada."
                accion={
                  canAdjust
                    ? {
                        texto: "Registrar una entrada",
                        icon: PackagePlus,
                        onClick: () => openOperation(setEntryOpen),
                      }
                    : undefined
                }
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Sede</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.rows.map((m) => (
                      <TableRow key={m._id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {dtf.format(new Date(m.createdAt))}
                        </TableCell>
                        <TableCell>
                          <MovementBadge type={m.type} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {m.productId?.name ?? "—"}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {m.productId?.sku}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.sedeId?.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {m.lotId?.lotCode ?? "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            m.delta < 0 ? "text-destructive" : "text-success-ink",
                          )}
                        >
                          {m.delta > 0 ? "+" : ""}
                          {nf.format(m.delta)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {nf.format(m.balanceAfter)}
                        </TableCell>
                        <TableCell className="max-w-48">
                          <div className="flex flex-col">
                            {m.reason && (
                              <span className="text-xs">
                                {ADJUST_REASON_LABELS[
                                  m.reason as AdjustReason
                                ] ?? m.reason}
                              </span>
                            )}
                            {m.note && (
                              <span className="truncate text-xs text-muted-foreground">
                                {m.note}
                              </span>
                            )}
                            {m.userEmail && (
                              <span className="truncate text-xs text-muted-foreground">
                                {m.userEmail}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Página {movements.page} de{" "}
                    {Math.max(1, Math.ceil(movements.total / movements.limit))}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={movements.page <= 1}
                      aria-label="Página anterior"
                      onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={
                        movements.page * movements.limit >= movements.total
                      }
                      aria-label="Página siguiente"
                      onClick={() => setMovPage((p) => p + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sheets */}
      <ProductSheet
        open={productSheetOpen}
        onOpenChange={setProductSheetOpen}
        mode={productSheetMode}
        product={editingProduct}
        products={products}
        categories={categories}
        suppliers={suppliersList}
        onSuccess={() => {
          void fetchProducts()
          refreshCategories()
        }}
        onRegisterEntry={(productId) => {
          setProductSheetOpen(false)
          openOperation(setEntryOpen, { productId })
        }}
      />
      <CategoriesSheet
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        products={products}
        onChanged={() => {
          refreshCategories()
          void fetchProducts()
        }}
      />
      <VariantsSheet
        open={variantsOpen}
        onOpenChange={setVariantsOpen}
        categories={categories}
        onSuccess={() => {
          void fetchProducts()
          fetchAllStock()
        }}
        onRegisterEntry={() => openOperation(setEntryOpen)}
      />
      <ActualizarPreciosDialog
        open={pricesOpen}
        onOpenChange={setPricesOpen}
        products={products}
        onSaved={refreshAfterOperation}
        onExportar={() => void handleExport()}
        onImportar={() => {
          setPricesOpen(false)
          setImportOpen(true)
        }}
      />
      <ConteoFisicoDialog
        open={countOpen}
        onOpenChange={setCountOpen}
        products={products}
        sedes={sedes}
        onSaved={refreshAfterOperation}
      />
      <TrazabilidadDialog open={traceOpen} onOpenChange={setTraceOpen} />
      <ReporteMermaDialog
        open={wasteOpen}
        onOpenChange={setWasteOpen}
        sedes={sedes}
      />
      <ImportProductsSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshAfterOperation}
      />
      <StockImportSheet
        open={stockImportOpen}
        onOpenChange={setStockImportOpen}
        onImported={refreshAfterOperation}
      />
      <EntrySheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        products={products.filter((p) => p.active)}
        sedes={sedes}
        preset={opPreset}
        suppliers={suppliersList}
        onSuccess={refreshAfterOperation}
      />
      <AdjustSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        products={products.filter((p) => p.active)}
        sedes={sedes}
        preset={opPreset}
        onSuccess={refreshAfterOperation}
      />
      <TransferSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        products={products.filter((p) => p.active)}
        sedes={sedes}
        preset={opPreset}
        onSuccess={refreshAfterOperation}
      />
    </>
  )
}
