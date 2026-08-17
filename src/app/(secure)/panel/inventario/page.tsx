"use client"

import * as React from "react"
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
  getAlerts,
  getMovements,
  createEntry,
  createAdjustment,
  createTransfer,
  importProducts,
  importStock,
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
  type InvAlerts,
  type MovementsPage,
  type AdjustReason,
  type MovementType,
} from "@/lib/erp/api-inventory"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { serializeCsv, parseCsv, downloadCsv } from "@/lib/erp/csv"

import { PageHeader } from "@/components/erp/page-header"
import { Button } from "@/components/ui/button"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNITS = ["und", "kg", "g", "lb", "l", "ml"]

/** Factores hacia una unidad base por dimensión (masa en g, volumen en ml). */
const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  lb: { base: "g", factor: 453.592 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  und: { base: "und", factor: 1 },
}

/** Convierte entre unidades compatibles; null si no hay conversión posible. */
function convertUnits(value: number, from: string, to: string): number | null {
  if (from === to) return value
  const f = UNIT_FACTORS[from]
  const t = UNIT_FACTORS[to]
  if (!f || !t || f.base !== t.base) return null
  return (value * f.factor) / t.factor
}

const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 })
// Para costos unitarios pequeños (tras conversión de unidades) que se
// distorsionarían al redondear a 0 decimales (ej. $8,33 por gramo).
const moneyUnit = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Muestra un costo unitario en la unidad "mayor" de su dimensión (g→kg,
 * ml→l): $12/g guardado se lee como "$12.000 / kg", que es como se compra.
 */
function formatUnitCost(cost: number, unit: string): string {
  const displayUnit = unit === "g" ? "kg" : unit === "ml" ? "l" : unit
  const factor =
    displayUnit === unit
      ? 1
      : UNIT_FACTORS[displayUnit].factor / UNIT_FACTORS[unit].factor
  return `${moneyUnit.format(cost * factor)} / ${displayUnit}`
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

const NUMERIC_KEYS = new Set<CsvKey>([
  "weight",
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
  const [barcode, setBarcode] = React.useState("")
  const [perishable, setPerishable] = React.useState(false)
  const [expiresAt, setExpiresAt] = React.useState("")
  const [minStock, setMinStock] = React.useState("")
  const [cost, setCost] = React.useState("")
  const [salePrice, setSalePrice] = React.useState("")
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
        setBarcode(product.barcode ?? "")
        setPerishable(product.perishable)
        setExpiresAt(product.expiresAt ? product.expiresAt.slice(0, 10) : "")
        setMinStock(String(product.minStock ?? 0))
        setCost(String(product.cost ?? 0))
        setSalePrice(product.salePrice != null ? String(product.salePrice) : "")
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
        setBarcode("")
        setPerishable(false)
        setExpiresAt("")
        setMinStock("")
        setCost("")
        setSalePrice("")
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
        barcode: barcode.trim() || undefined,
        perishable: perishableFinal,
        // Los montajes controlan lotes: cada entrada queda registrada.
        trackLots: isIngredient ? perishableFinal : true,
        expiresAt: perishableFinal && expiresAt ? expiresAt : "",
        minStock: minStock ? Number(minStock) : 0,
        cost: cost ? Number(cost) : 0,
        salePrice: isIngredient && salePrice ? Number(salePrice) : undefined,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            {mode === "create" ? "Nuevo producto" : "Editar producto"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Agrega un producto al catálogo de inventario."
              : "Modifica los datos del producto."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de ítem</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
              {(
                [
                  ["ingredient", "Producto"],
                  ["assembly", "Montaje"],
                ] as [ItemType, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setItemType(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    itemType === key
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-sku">SKU</Label>
            <Input
              id="p-sku"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value.toUpperCase())
                setConflictProduct(null)
              }}
              placeholder="p. ej. 10001 (5 dígitos)"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isIngredient ? "Harina de trigo x 500 g" : "p. ej. Cuchillo"
              }
              required
            />
          </div>

          {duplicate && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <p>
                <span className="font-medium">{duplicate.name}</span> ya está
                en tu inventario (SKU {duplicate.sku}). ¿Te llegó más
                mercancía? No hace falta crearlo de nuevo: registra una
                entrada y el stock se acumula.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onRegisterEntry(duplicate._id)}
              >
                <PackagePlus />
                Registrar entrada de {duplicate.name}
              </Button>
            </div>
          )}

          {!isIngredient && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-brand">Marca</Label>
              <Input
                id="p-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="p. ej. Doria (opcional)"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-barcode">Código de barras</Label>
            <Input
              id="p-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Escanéalo o escríbelo (opcional)"
              inputMode="numeric"
              autoComplete="off"
            />
            <span className="text-xs text-muted-foreground">
              Permite agregarlo al carrito escaneándolo en el punto de venta.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">Descripción</Label>
            <Input
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-cat">Categoría</Label>
              <Select
                value={categoryId}
                items={{
                  none: "Sin categoría",
                  ...Object.fromEntries(categories.map((c) => [c._id, c.name])),
                }}
                onValueChange={(v) => {
                  if (v !== null) setCategoryId(v)
                }}
              >
                <SelectTrigger id="p-cat" className="w-full">
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
            </div>
            {!isIngredient && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-supplier">Proveedor</Label>
                <SupplierSelect
                  id="p-supplier"
                  suppliers={suppliers}
                  value={supplierSel}
                  legacyText={legacySupplier}
                  onChange={setSupplierSel}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isIngredient && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-unit">Unidad de medida</Label>
                <Select
                  value={unit}
                  onValueChange={(v) => {
                    if (v !== null) setUnit(v)
                  }}
                >
                  <SelectTrigger id="p-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-min">Stock mínimo (opcional)</Label>
              <Input
                id="p-min"
                type="number"
                min="0"
                step="any"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="p. ej. 3"
              />
            </div>
            {!isIngredient && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-cost">Precio de compra</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {isIngredient && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-price">Precio de venta</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="any"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>

          {isIngredient && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="p-perishable"
                  checked={perishable}
                  onCheckedChange={(v) => setPerishable(Boolean(v))}
                />
                <div className="flex flex-col">
                  <Label htmlFor="p-perishable">Producto perecedero</Label>
                  <span className="text-xs text-muted-foreground">
                    Exige lote y fecha de vencimiento en cada entrada.
                  </span>
                </div>
              </div>
            </div>
          )}

          <FormError error={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || Boolean(skuClash) || Boolean(conflictProduct)}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
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
  const [entryWeight, setEntryWeight] = React.useState("")
  const [qty, setQty] = React.useState("")
  const [unitCost, setUnitCost] = React.useState("")
  const [supplierSel, setSupplierSel] = React.useState("none")
  const [legacySupplier, setLegacySupplier] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const product = products.find((p) => p._id === productId)
  // Un montaje (menaje, utensilios) no vence ni se pesa.
  const isAssembly = product?.itemType === "assembly"

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
      setUnitCost(p?.cost ? String(p.cost) : "")
      setEntryUnit(p?.unit ?? "und")
      setEntryWeight(
        p?.weight != null && p.weight > 0 ? String(p.weight) : "",
      )
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
      setQty("")
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
      // Si la entrada viene en otra unidad compatible (p. ej. kg y el
      // producto va en g), se convierte y se almacena en la del producto.
      const rawQty = Number(qty)
      const targetUnit = product?.unit ?? entryUnit
      const convertedQty = convertUnits(rawQty, entryUnit, targetUnit)
      const qtyFinal = convertedQty ?? rawQty
      // El precio se digita por unidad de la entrada; se reexpresa por
      // unidad del producto para no inflar el costo.
      const costFinal =
        unitCost && qtyFinal > 0
          ? (Number(unitCost) * rawQty) / qtyFinal
          : unitCost
            ? Number(unitCost)
            : undefined
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
        supplier: supplierText || undefined,
        supplierId: chosenSupplier?._id,
        expiresAt: !isAssembly && expiresAt ? expiresAt : undefined,
      })
      // Si cambió el peso por unidad, se refleja en el producto (convertido).
      const w = !isAssembly && entryWeight ? Number(entryWeight) : undefined
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Entrada de mercancía
          </SheetTitle>
          <SheetDescription>
            Registra una recepción de compra o carga inicial de stock.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="relative flex flex-col gap-1.5">
            <Label htmlFor="e-product">Producto</Label>
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
                className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
                onMouseDown={(e) => e.preventDefault()}
              >
                {productMatches.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-sede">Sede</Label>
            <Select
              value={sedeId}
              items={sedeItems(sedes)}
              onValueChange={(v) => {
                if (v !== null) setSedeId(v)
              }}
            >
              <SelectTrigger id="e-sede" className="w-full">
                <SelectValue placeholder="Seleccionar sede" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-unit">Unidad de medida</Label>
              <Select
                value={entryUnit}
                onValueChange={(v) => {
                  if (v !== null) setEntryUnit(v)
                }}
              >
                <SelectTrigger id="e-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isAssembly && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-weight">Peso por unidad ({entryUnit})</Label>
                <Input
                  id="e-weight"
                  type="number"
                  min="0"
                  step="any"
                  value={entryWeight}
                  onChange={(e) => setEntryWeight(e.target.value)}
                  placeholder="p. ej. 500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-qty">Cantidad</Label>
              <Input
                id="e-qty"
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-cost">Precio de compra</Label>
              <Input
                id="e-cost"
                type="number"
                min="0"
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Por unidad"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-supplier">Proveedor (opcional)</Label>
            <SupplierSelect
              id="e-supplier"
              suppliers={suppliers}
              value={supplierSel}
              legacyText={legacySupplier}
              onChange={setSupplierSel}
            />
          </div>

          {!isAssembly && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-exp">
                Fecha de vencimiento
                {product?.perishable ? "" : " (opcional)"}
              </Label>
              <Input
                id="e-exp"
                type="date"
                min={localDateStr(new Date())}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required={Boolean(product?.perishable)}
              />
            </div>
          )}

          <FormError error={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !productId || !sedeId || !qty}
            >
              {saving ? "Registrando…" : "Registrar entrada"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
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
  const [qty, setQty] = React.useState("")
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
      setQty("")
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
        qty: Number(qty),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Ajuste de inventario
          </SheetTitle>
          <SheetDescription>
            Corrige existencias por conteo, daño, vencimiento o merma. Las
            salidas descuentan primero los lotes más próximos a vencer.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-product">Producto</Label>
            <Select
              value={productId}
              items={productItems(products)}
              onValueChange={(v) => {
                if (v !== null) setProductId(v)
              }}
            >
              <SelectTrigger id="a-product" className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} · {p.sku}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-sede">Sede</Label>
            <Select
              value={sedeId}
              items={sedeItems(sedes)}
              onValueChange={(v) => {
                if (v !== null) setSedeId(v)
              }}
            >
              <SelectTrigger id="a-sede" className="w-full">
                <SelectValue placeholder="Seleccionar sede" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-dir">Tipo</Label>
              <Select
                value={direction}
                items={{ remove: "Salida (−)", add: "Entrada (+)" }}
                onValueChange={(v) => {
                  if (v === "add" || v === "remove") setDirection(v)
                }}
              >
                <SelectTrigger id="a-dir" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove">Salida (−)</SelectItem>
                  <SelectItem value="add">Entrada (+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-qty">
                Cantidad{product ? ` (${product.unit})` : ""}
              </Label>
              <Input
                id="a-qty"
                type="number"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-reason">Razón</Label>
            <Select
              value={reason}
              items={ADJUST_REASON_LABELS}
              onValueChange={(v) => {
                if (v !== null) setReason(v as AdjustReason)
              }}
            >
              <SelectTrigger id="a-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(ADJUST_REASON_LABELS) as [AdjustReason, string][]
                ).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {createsLot && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-lot">Código de lote</Label>
                <Input
                  id="a-lot"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Auto si se deja vacío"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a-exp">
                  Vencimiento{product?.perishable ? "" : " (opcional)"}
                </Label>
                <Input
                  id="a-exp"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required={product?.perishable}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-note">Nota</Label>
            <Input
              id="a-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalle del ajuste (opcional)"
            />
          </div>

          <FormError error={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !productId || !sedeId}>
              {saving ? "Aplicando…" : "Aplicar ajuste"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Transfer sheet ──────────────────────────────────────────────────────────

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
  const [qty, setQty] = React.useState("")
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
      setQty("")
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
        qty: Number(qty),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Traslado entre sedes
          </SheetTitle>
          <SheetDescription>
            Mueve stock de una sede a otra conservando lotes y vencimientos.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-product">Producto</Label>
            <Select
              value={productId}
              items={productItems(products)}
              onValueChange={(v) => {
                if (v !== null) setProductId(v)
              }}
            >
              <SelectTrigger id="t-product" className="w-full">
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} · {p.sku}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-from">Desde</Label>
              <Select
                value={fromSedeId}
                items={sedeItems(sedes)}
                onValueChange={(v) => {
                  if (v !== null) setFromSedeId(v)
                }}
              >
                <SelectTrigger id="t-from" className="w-full">
                  <SelectValue placeholder="Sede origen" />
                </SelectTrigger>
                <SelectContent>
                  {sedes.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-to">Hacia</Label>
              <Select
                value={toSedeId}
                items={sedeItems(sedes.filter((s) => s._id !== fromSedeId))}
                onValueChange={(v) => {
                  if (v !== null) setToSedeId(v)
                }}
              >
                <SelectTrigger id="t-to" className="w-full">
                  <SelectValue placeholder="Sede destino" />
                </SelectTrigger>
                <SelectContent>
                  {sedes
                    .filter((s) => s._id !== fromSedeId)
                    .map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-qty">
              Cantidad{product ? ` (${product.unit})` : ""}
            </Label>
            <Input
              id="t-qty"
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-note">Nota</Label>
            <Input
              id="t-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo del traslado (opcional)"
            />
          </div>

          <FormError error={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !productId || !fromSedeId || !toSedeId}
            >
              {saving ? "Trasladando…" : "Trasladar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
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
              <span className="text-muted-foreground">{row.product.unit}</span>
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
              {formatUnitCost(lot.unitCost, row.product.unit)}
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">Categorías</SheetTitle>
          <SheetDescription>
            Crea, renombra o elimina las categorías del catálogo. Solo se
            pueden eliminar las que no tengan ítems asignados.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 py-2">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva categoría"
            />
            <Button type="submit" disabled={busy || !newName.trim()}>
              <Plus />
              Agregar
            </Button>
          </form>

          <FormError error={error} />

          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay categorías.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {categories.map((cat) => {
                const count = usage.get(cat._id) ?? 0
                const isEditing = editingId === cat._id
                return (
                  <div
                    key={cat._id}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
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
                        <span className="flex-1 text-sm font-medium">
                          {cat.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
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
                          disabled={busy}
                          onClick={() => void handleDelete(cat)}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = "productos" | "existencias" | "movimientos"

// ─── Variants sheet (producto con variantes, retail) ─────────────────────────

interface AxisRow {
  name: string
  /** Valores separados por coma, tal como los escribe el usuario. */
  valuesText: string
}

function VariantsSheet({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: InvCategory[]
  onSuccess: () => void
}) {
  const [skuPrefix, setSkuPrefix] = React.useState("")
  const [name, setName] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("none")
  const [salePrice, setSalePrice] = React.useState("")
  const [cost, setCost] = React.useState("")
  const [minStock, setMinStock] = React.useState("")
  const [axes, setAxes] = React.useState<AxisRow[]>([
    { name: "Talla", valuesText: "" },
  ])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [doneMsg, setDoneMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSkuPrefix("")
    setName("")
    setCategoryId("none")
    setSalePrice("")
    setCost("")
    setMinStock("")
    setAxes([{ name: "Talla", valuesText: "" }])
    setError(null)
    setDoneMsg(null)
  }, [open])

  /** Ejes con nombre y al menos un valor, ya parseados. */
  const parsedAxes = axes
    .map((a) => ({
      name: a.name.trim(),
      values: a.valuesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    }))
    .filter((a) => a.name && a.values.length > 0)

  const comboCount = parsedAxes.reduce((n, a) => n * a.values.length, 1)
  const willCreate = parsedAxes.length > 0 ? comboCount : 0

  function updateAxis(i: number, patch: Partial<AxisRow>) {
    setAxes((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addAxis() {
    setAxes((rows) => [...rows, { name: "", valuesText: "" }])
  }
  function removeAxis(i: number) {
    setAxes((rows) => (rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows))
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
        salePrice: salePrice ? Number(salePrice) : undefined,
        cost: cost ? Number(cost) : undefined,
        minStock: minStock ? Number(minStock) : undefined,
        axes: parsedAxes,
      })
      onSuccess()
      setDoneMsg(
        `Se crearon ${res.variants.length} variante(s). Registra sus entradas de stock y publícalas en Productos para venderlas.`,
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">
            Producto con variantes
          </SheetTitle>
          <SheetDescription>
            Define los ejes (talla, color…) y se crea una fila por cada
            combinación, con su SKU y stock propios.
          </SheetDescription>
        </SheetHeader>

        {doneMsg ? (
          <div className="flex flex-col gap-4 px-4 py-6">
            <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <Check className="mt-0.5 size-4 shrink-0" />
              <span>{doneMsg}</span>
            </div>
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-sku">SKU base</Label>
                <Input
                  id="v-sku"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                  placeholder="p. ej. CAMISA"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-price">Precio de venta</Label>
                <Input
                  id="v-price"
                  type="number"
                  min="0"
                  step="any"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v-name">Nombre</Label>
              <Input
                id="v-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="p. ej. Camisa manga larga"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-cat">Categoría</Label>
                <Select
                  value={categoryId}
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
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v-min">Stock mínimo</Label>
                <Input
                  id="v-min"
                  type="number"
                  min="0"
                  step="any"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label>Ejes de variación</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAxis}>
                <Plus />
                Agregar eje
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {axes.map((axis, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={axis.name}
                      onChange={(e) => updateAxis(i, { name: e.target.value })}
                      placeholder="Eje (p. ej. Talla)"
                      className="flex-1"
                      aria-label="Nombre del eje"
                    />
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
                  <Input
                    value={axis.valuesText}
                    onChange={(e) => updateAxis(i, { valuesText: e.target.value })}
                    placeholder="Valores separados por coma: S, M, L"
                    aria-label="Valores del eje"
                  />
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
              Se crearán{" "}
              <span className="font-semibold">{willCreate}</span> variante(s)
              {willCreate > 0 && skuPrefix.trim() && parsedAxes.length > 0 && (
                <>
                  {" "}· ej.{" "}
                  <span className="font-mono">
                    {skuPrefix.trim().toUpperCase()}-
                    {parsedAxes
                      .map((a) => slugPreview(a.values[0]))
                      .join("-")}
                  </span>
                </>
              )}
              .
            </div>

            <FormError error={error} />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || willCreate === 0}>
                {saving ? "Creando…" : `Crear ${willCreate || ""} variante(s)`}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Importar productos (CSV)</SheetTitle>
          <SheetDescription>
            Se hace match por SKU: crea los nuevos y actualiza los existentes. La
            categoría se resuelve por nombre (se crea si no existe).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv("plantilla-inventario.csv", csvTemplate())}
          >
            <Download />
            Descargar plantilla
          </Button>

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

          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}

          {rows.length > 0 && !result && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{rows.length}</strong> fila(s)
              listas para importar.
            </p>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4" />
                Importación completada
              </p>
              <p className="text-muted-foreground">
                Creados:{" "}
                <strong className="text-foreground">{result.created}</strong> ·
                Actualizados:{" "}
                <strong className="text-foreground">{result.updated}</strong> ·
                Errores:{" "}
                <strong
                  className={
                    result.errors.length ? "text-destructive" : "text-foreground"
                  }
                >
                  {result.errors.length}
                </strong>
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                  {result.errors.slice(0, 50).map((er, i) => (
                    <li key={i}>
                      Fila {er.row}
                      {er.sku ? ` (${er.sku})` : ""}: {er.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Columnas: {CSV_COLUMNS.join(", ")}. Solo <code>sku</code> y{" "}
            <code>name</code> son obligatorios; el resto es opcional.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={doImport} disabled={rows.length === 0 || importing}>
              <Upload />
              {importing ? "Importando…" : "Importar"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <SheetContent side="right" className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Cargar existencias (CSV)</SheetTitle>
          <SheetDescription>
            Cada fila registra una ENTRADA de mercancía (suma stock) del producto
            (por SKU) en la sede (por nombre o código).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Importar <strong className="text-foreground">suma</strong> las
              cantidades como entradas; no reemplaza el stock actual. Úsalo para
              carga inicial o recepción masiva.
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv("plantilla-existencias.csv", stockTemplate())
            }
          >
            <Download />
            Descargar plantilla
          </Button>

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

          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}

          {rows.length > 0 && !result && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{rows.length}</strong>{" "}
              entrada(s) listas para cargar.
            </p>
          )}

          {result && (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4" />
                Carga completada
              </p>
              <p className="text-muted-foreground">
                Entradas:{" "}
                <strong className="text-foreground">{result.imported}</strong> ·
                Errores:{" "}
                <strong
                  className={
                    result.errors.length ? "text-destructive" : "text-foreground"
                  }
                >
                  {result.errors.length}
                </strong>
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
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
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Columnas: {STOCK_IMPORT_COLUMNS.join(", ")}. Obligatorias:{" "}
            <code>sku</code>, <code>sede</code> y <code>qty</code>. Los
            perecederos requieren <code>expiresAt</code>.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={doImport} disabled={rows.length === 0 || importing}>
              <Upload />
              {importing ? "Cargando…" : "Cargar"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function InventarioPage() {
  const { hasPermission, isRetail } = useAuth()
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
  // Importar / exportar CSV (existencias)
  const [stockImportOpen, setStockImportOpen] = React.useState(false)

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
        description="Catálogo de productos, existencias por sede y kardex."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              <Download />
              Exportar
            </Button>
            {canAdjust && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload />
                Importar
              </Button>
            )}
            {canAdjust && (
              <>
                <Button
                  variant="outline"
                  data-tour="inv-entrada"
                  onClick={() => openOperation(setEntryOpen)}
                >
                  <PackagePlus />
                  Entrada
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openOperation(setAdjustOpen)}
                >
                  <PackageMinus />
                  Ajuste
                </Button>
              </>
            )}
            {canTransfer && sedes.length > 1 && (
              <Button
                variant="outline"
                onClick={() => openOperation(setTransferOpen)}
              >
                <ArrowLeftRight />
                Traslado
              </Button>
            )}
            {canAdjust && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setCategoriesOpen(true)}
                >
                  <Tags />
                  Categorías
                </Button>
                {isRetail && (
                  <Button
                    variant="outline"
                    onClick={() => setVariantsOpen(true)}
                  >
                    <Layers />
                    Con variantes
                  </Button>
                )}
                <Button
                  data-tour="inv-nuevo"
                  onClick={() => {
                    setProductSheetMode("create")
                    setEditingProduct(undefined)
                    setProductSheetOpen(true)
                  }}
                >
                  <Plus />
                  Nuevo producto
                </Button>
              </>
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
                  <TriangleAlert className="size-4 text-warning" />
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
                  <CalendarClock className="size-4 text-warning" />
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

      {/* Segmented control */}
      <div className="mb-5 flex w-fit gap-1 rounded-lg border border-border bg-muted p-1" data-tour="inv-tabs">
        {(
          [
            ["productos", "Productos"],
            ["existencias", "Existencias"],
            ["movimientos", "Movimientos"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Productos ── */}
      {tab === "productos" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Catálogo</CardTitle>
              <CardDescription>
                {filteredProducts.length} producto(s)
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
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Boxes className="size-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {products.length === 0
                    ? "Aún no hay productos. Crea el primero con “Nuevo producto”."
                    : "Sin resultados para la búsqueda."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ítem</TableHead>
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
                            {p.unit}
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
                Stock consolidado por producto y sede
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
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Boxes className="size-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sin existencias registradas. Usa “Entrada” para recibir
                  mercancía.
                </p>
              </div>
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
                            {row.product.unit}
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

      {/* ── Tab: Movimientos (kardex) ── */}
      {tab === "movimientos" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Kardex</CardTitle>
              <CardDescription>
                {movements ? `${movements.total} movimiento(s)` : "Historial"}
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
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Boxes className="size-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sin movimientos registrados todavía.
                </p>
              </div>
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
                            m.delta < 0 ? "text-destructive" : "text-success",
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
