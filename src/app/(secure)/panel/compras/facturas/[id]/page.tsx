"use client"

import * as React from "react"
import { SearchableSelect } from "@/components/ui/searchable-select"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  GitMerge,
  History,
  Loader2,
  PackagePlus,
  Plus,
  Receipt,
  Save,
  ScanLine,
  ShieldOff,
  Split,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import {
  applyInvoiceScan,
  applyInvoiceScanAsExpense,
  getInvoiceScan,
  splitInvoiceScan,
  updateInvoiceScan,
  LINE_TARGET_LABELS,
  type ApplyAsExpensePayload,
  type ExtractedInvoice,
  type InvoiceScan,
  type ExtractedLine,
  type LineDecision,
  type LineTarget,
  type NewProductDraft,
} from "@/lib/erp/api-invoice-scans"
import {
  listSedes,
  listProducts,
  listCategories as listInventoryCategories,
  type InvCategory,
  type InvProduct,
  type Sede,
} from "@/lib/erp/api-inventory"
import {
  describirContenido,
  presentacionDeCompra,
} from "@/lib/erp/purchase-unit"
import {
  PRESENTACIONES_SUGERIDAS,
  unidad,
  unidadCorta,
  unidadDesdeTexto,
  unidadNombre,
} from "@/lib/erp/unidades"
import {
  PresentacionCompraPicker,
  UnidadSelect,
  ejemploDeUnidad,
} from "@/components/erp/unidad-fields"
import {
  SKU_ERROR,
  normalizarSku,
  skuParaRenglon,
  skuValido,
} from "@/lib/erp/sku"
import { rankBySimilarity } from "@/lib/erp/product-match"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { listCategories as listFinanceCategories, type FinanceCategory } from "@/lib/erp/api-finance"
import { errorMessage, fmtDate, money } from "@/lib/erp/finance-format"

import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/erp/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FormAlert, FormDialog, FormSection } from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { ApplyExpenseDialog } from "./apply-expense-dialog"

/** Diferencia aceptable entre la suma de las líneas y el total impreso. */
const TOLERANCIA = 100

const TARGETS: LineTarget[] = ["inventory", "expense", "ignore"]

/** Tarifas de IVA que acepta un renglón de compra. */
const IVA_OPCIONES = [
  { value: "", label: "—" },
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "19", label: "19%" },
]

/** Etiqueta de cómo se emparejó la línea, para que se vea de dónde sale. */
const MATCH_LABELS: Record<string, string> = {
  alias: "Emparejado por historial",
  barcode: "Por código de barras",
  sku: "Por SKU",
  name: "Por nombre parecido",
  manual: "Elegido a mano",
  none: "Sin emparejar",
}

/**
 * La unidad de consumo que se deduce de lo que el modelo leyó en el renglón.
 *
 * Solo vale si el papel trae una medida de verdad. El proveedor factura en lo
 * que despacha —"BLT", "CJ", "PACA"— y eso NO es unidad de consumo sino
 * presentación: si entrara como unidad, el insumo quedaría medido en bultos y
 * ninguna receta podría descontarlo. Lo que no se reconozca se deja en blanco
 * para que la persona lo elija; abajo, en la presentación, es donde encaja.
 */
function unidadDelRenglon(line: ExtractedLine | null): string {
  const traducida = unidadDesdeTexto(line?.unit)
  return unidad(traducida) ? traducida : ""
}

/** Si lo que el papel llama "unidad" es en realidad un empaque, va aquí. */
function presentacionDelRenglon(line: ExtractedLine | null): string {
  const texto = unidadDesdeTexto(line?.unit).toLowerCase()
  if (!texto || unidad(texto)) return ""
  return PRESENTACIONES_SUGERIDAS.some((p) => p.nombre === texto) ? texto : ""
}

interface NewProductDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  line: ExtractedLine | null
  value: NewProductDraft | undefined
  categories: InvCategory[]
  /** El catálogo entero, con inactivos: con él se caza el SKU repetido. */
  productos: InvProduct[]
  /** SKU ya apartados por OTROS renglones de esta misma factura. */
  skusDeLaFactura: string[]
  onSave: (draft: NewProductDraft) => void
  /** "Ese SKU ya es de otro producto": enlazar el renglón a ese en vez de crear. */
  onUsarExistente: (productId: string) => void
}

/**
 * Datos que llegan prellenados desde la factura y hay que confirmar.
 *
 * El **nombre ya no está** en la lista. Estaba, y obligaba a tocarlo o
 * confirmarlo en cada renglón para poder seguir; es el campo que se lee entero
 * de un vistazo en la primera línea de la ficha —y es la descripción del papel,
 * literal—, así que pedir el clic solo costaba tiempo. Lo que sí sigue
 * marcado es lo que se lee mal sin que salte a la vista: un cero de más en el
 * costo o una unidad equivocada no se ven, y quedan en el catálogo para
 * siempre.
 */
type DatoLeido = "sku" | "unit" | "cost" | "barcode"

const DATO_LEIDO_LABELS: Record<DatoLeido, string> = {
  sku: "SKU",
  unit: "unidad",
  cost: "costo",
  barcode: "código de barras",
}

/**
 * Aviso bajo un campo que vino de la factura y nadie ha revisado todavía.
 *
 * Tocarlo es decir "lo comparé con el papel y está bien"; corregir el campo
 * también cuenta. No hay un "confirmar todo": justamente es lo que se quiere
 * evitar, que un SKU inventado o un costo mal leído pase sin que nadie lo mire.
 */
function LeidoDeLaFactura({
  pendiente,
  onConfirmar,
}: {
  pendiente: boolean
  onConfirmar: () => void
}) {
  if (!pendiente) return null
  return (
    <button
      type="button"
      onClick={onConfirmar}
      className="inline-flex items-center gap-1.5 self-start rounded-md bg-warning/10 px-2 py-1 text-left text-xs text-warning-ink hover:bg-warning/20"
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      Leído de la factura: compáralo con el papel y toca aquí si está bien
    </button>
  )
}

/**
 * Ficha para crear el producto que la factura trae y el inventario no tiene.
 *
 * Nada se crea con datos a medias: tipo, SKU, nombre, unidad, categoría, costo,
 * stock mínimo y precio de venta (o "no se vende en el POS") son obligatorios.
 * Y lo que la foto leyó y no salta a la vista —el código del proveedor usado
 * como SKU, la unidad, el costo, el código de barras— viene marcado hasta que
 * la persona lo confirma o lo corrige, uno por uno. El servidor vuelve a
 * verificarlo al aplicar.
 *
 * Aquí se decide también **cómo se compra** el producto (bulto, caja, bolsa):
 * la factura es el momento en que se sabe, y con eso el renglón puede entrar en
 * bultos sin traducir nada a mano.
 *
 * El padre la monta con `key` por renglón: cada apertura parte de la ficha
 * guardada o de la factura, sin rehidratar estado en un efecto.
 */
function NewProductDialog({
  open,
  onOpenChange,
  line,
  value,
  categories,
  productos,
  skusDeLaFactura,
  onSave,
  onUsarExistente,
}: NewProductDialogProps) {
  const [itemType, setItemType] = React.useState<
    NewProductDraft["itemType"] | ""
  >(value?.itemType ?? "")
  // El SKU propuesto sigue la numeración del catálogo (10001, 10002…), que es
  // la misma que exige la ficha de inventario. Antes salía de aquí un código
  // hecho con el nombre ("ARROZ-DIANA-500") y el catálogo terminaba con dos
  // criterios distintos según por dónde se hubiera creado el producto.
  const skuPropuesto = React.useMemo(
    () =>
      skuParaRenglon(line?.code, [
        ...productos.map((p) => p.sku),
        ...skusDeLaFactura,
      ]),
    [line?.code, productos, skusDeLaFactura],
  )
  const [sku, setSku] = React.useState(value?.sku ?? skuPropuesto)
  const [name, setName] = React.useState(value?.name ?? line?.description ?? "")
  const [unit, setUnit] = React.useState(
    value?.unit ?? unidadDelRenglon(line),
  )
  // Cómo llega del proveedor: bulto, caja, bolsa. Va aparte de la unidad a
  // propósito (ver `lib/erp/unidades.ts`), y se propone cuando lo que el papel
  // llamó "unidad" era en realidad el empaque.
  const [purchaseUnit, setPurchaseUnit] = React.useState(
    value?.purchaseUnit ?? presentacionDelRenglon(line),
  )
  const [purchaseFactor, setPurchaseFactor] = React.useState<number | null>(
    value?.purchaseFactor ?? null,
  )
  const [categoryId, setCategoryId] = React.useState(value?.categoryId ?? "")
  const [cost, setCost] = React.useState<number | null>(
    value?.cost ?? line?.unitCost ?? null,
  )
  const [notSold, setNotSold] = React.useState(Boolean(value?.notSold))
  const [salePrice, setSalePrice] = React.useState<number | null>(
    value?.salePrice ?? null,
  )
  const [barcode, setBarcode] = React.useState(
    value?.barcode ?? line?.barcode ?? "",
  )
  const [minStock, setMinStock] = React.useState(
    value?.minStock != null ? String(value.minStock) : "",
  )

  // Todo lo que llega prellenado DESDE LA FACTURA, y no viene de una ficha ya
  // revisada, queda pendiente de confirmar. El SKU solo cuenta cuando es el
  // código que traía el papel: el correlativo que propone el sistema no hay
  // nada que compararlo contra.
  const [pendientes, setPendientes] = React.useState<Set<DatoLeido>>(() => {
    if (value?.reviewed) return new Set()
    const prellenados: [DatoLeido, boolean][] = [
      ["sku", sku.trim() !== "" && sku === normalizarSku(line?.code ?? "")],
      ["unit", unit.trim() !== ""],
      ["cost", cost != null],
      ["barcode", barcode.trim() !== ""],
    ]
    return new Set(
      prellenados.filter(([, lleno]) => lleno).map(([dato]) => dato),
    )
  })

  function revisado(dato: DatoLeido) {
    setPendientes((actual) => {
      if (!actual.has(dato)) return actual
      const siguiente = new Set(actual)
      siguiente.delete(dato)
      return siguiente
    })
  }

  const skuNorm = normalizarSku(sku)
  const presentacionNombre = purchaseUnit.trim()
  const factorValido = purchaseFactor != null && purchaseFactor > 0

  // El SKU repetido se caza AQUÍ y no al aplicar. Antes el choque salía del
  // servidor —"Ya existe un producto con el SKU X"— cuando la factura ya se
  // estaba aplicando y con medio trabajo hecho, sin decir siquiera de quién era
  // ese SKU. Ahora se ve mientras se escribe, con el nombre del dueño y el
  // atajo para usar ese producto en vez de crear un duplicado.
  const productoDelSku = skuNorm
    ? productos.find((p) => p.sku === skuNorm)
    : undefined
  const repetidoEnLaFactura =
    !productoDelSku && skuNorm !== ""
      ? skusDeLaFactura.some((s) => normalizarSku(s) === skuNorm)
      : false
  const skuMalFormado = skuNorm !== "" && !skuValido(skuNorm)

  const faltan: string[] = []
  if (!itemType) faltan.push("tipo")
  if (!sku.trim()) faltan.push("SKU")
  if (!name.trim()) faltan.push("nombre")
  if (!unit.trim()) faltan.push("unidad")
  if (!categoryId) faltan.push("categoría")
  if (!(cost != null && cost > 0)) faltan.push("costo de compra")
  if (minStock.trim() === "" || !Number.isFinite(Number(minStock))) {
    faltan.push("stock mínimo")
  }
  if (!notSold && !(salePrice != null && salePrice > 0)) {
    faltan.push("precio de venta")
  }
  // La presentación va con su contenido o no va: "bulto" sin cuánto trae deja
  // al sistema sin la cuenta con la que convierte la compra al consumo.
  if (presentacionNombre !== "" && !factorValido) {
    faltan.push(`cuánto trae un ${presentacionNombre}`)
  }
  const porRevisar = [...pendientes].map((dato) => DATO_LEIDO_LABELS[dato])
  const lista =
    faltan.length === 0 &&
    porRevisar.length === 0 &&
    !productoDelSku &&
    !repetidoEnLaFactura &&
    !skuMalFormado

  function handleSave() {
    if (!lista) return
    onSave({
      sku: skuNorm,
      name: name.trim(),
      unit: unit.trim(),
      categoryId,
      cost: cost ?? undefined,
      salePrice: notSold ? undefined : (salePrice ?? undefined),
      notSold,
      barcode: barcode.trim() || undefined,
      minStock: Number(minStock),
      itemType: itemType || undefined,
      purchaseUnit: presentacionNombre || undefined,
      purchaseFactor: presentacionNombre ? (purchaseFactor ?? undefined) : undefined,
      reviewed: true,
    })
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      icon={PackagePlus}
      title="Producto nuevo"
      description="No existe en tu inventario. Completa lo que falta y revisa uno por uno los datos que se leyeron de la factura: el producto se crea exactamente así al aplicar."
      footer={
        <>
          {!lista && (
            <p className="text-xs text-muted-foreground sm:mr-auto">
              {faltan.length > 0 && `Falta: ${faltan.join(", ")}.`}{" "}
              {porRevisar.length > 0 &&
                `Por revisar: ${porRevisar.join(", ")}.`}{" "}
              {(productoDelSku || repetidoEnLaFactura || skuMalFormado) &&
                "Arregla el SKU para poder guardar."}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:min-w-28"
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!lista} className="sm:min-w-44">
            <CheckCircle2 />
            Guardar ficha revisada
          </Button>
        </>
      }
    >
      <FormSection
        title="Identificación"
        description="Con qué lo reconoces tú y con qué lo reconoce la caja."
      >
        <FieldGrid cols={3}>
          <Field
            id="np-type"
            label="Tipo"
            required
            hint="Producto: se compra y se guarda. Montaje: se arma con otros productos y lleva lotes."
          >
            <NativeSelect
              id="np-type"
              value={itemType ?? ""}
              onChange={(v) => setItemType(v as NewProductDraft["itemType"] | "")}
              placeholder="Elige el tipo"
              options={[
                { value: "ingredient", label: "Producto" },
                { value: "assembly", label: "Montaje" },
              ]}
            />
          </Field>
          <FieldSpan span={2}>
            <Field
              id="np-sku"
              label="SKU"
              required
              help={{ term: "sku" }}
              error={skuMalFormado ? SKU_ERROR : null}
              hint="Numérico, mínimo 5 dígitos, como en el resto del inventario. Se propone el siguiente libre; si la factura traía el código del proveedor y sirve, se propone ese para que la próxima empareje sola."
            >
              <Input
                id="np-sku"
                value={sku}
                inputMode="numeric"
                aria-invalid={
                  skuMalFormado || Boolean(productoDelSku) || repetidoEnLaFactura
                }
                className={cn(pendientes.has("sku") && "border-warning")}
                onChange={(e) => {
                  setSku(e.target.value.toUpperCase())
                  revisado("sku")
                }}
                placeholder="10001"
              />
              <LeidoDeLaFactura
                pendiente={pendientes.has("sku")}
                onConfirmar={() => revisado("sku")}
              />
            </Field>
          </FieldSpan>
          <FieldSpan span={3}>
            <Field id="np-name" label="Nombre" required>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </FieldSpan>
          {productoDelSku && (
            <FieldSpan span={3}>
              <FormAlert tone="warning" icon={TriangleAlert}>
                El SKU {skuNorm} ya es de{" "}
                <span className="font-semibold">{productoDelSku.name}</span>
                {productoDelSku.active
                  ? ". Cambia el número —o, si es el mismo producto, enlaza el renglón con él y la mercancía se le suma al que ya tienes."
                  : ", que está dado de baja. Su SKU sigue ocupado en la base: ponle otro número, o reactiva ese producto en Inventario si es el mismo."}
                {productoDelSku.active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 flex"
                    onClick={() => {
                      onUsarExistente(productoDelSku._id)
                      onOpenChange(false)
                    }}
                  >
                    <GitMerge className="size-4" aria-hidden />
                    Usar {productoDelSku.name}
                  </Button>
                )}
              </FormAlert>
            </FieldSpan>
          )}
          {repetidoEnLaFactura && (
            <FieldSpan span={3}>
              <FormAlert tone="warning" icon={TriangleAlert}>
                Otro renglón de esta misma factura ya va a crear un producto con
                el SKU {skuNorm}. Ponle uno distinto.
              </FormAlert>
            </FieldSpan>
          )}
          <FieldSpan span={3}>
            <Field
              id="np-barcode"
              label="Código de barras"
              help={{ term: "codigoBarras" }}
              hint="Opcional. Si la factura lo trae, confírmalo contra el empaque."
            >
              <Input
                id="np-barcode"
                value={barcode}
                className={cn(pendientes.has("barcode") && "border-warning")}
                onChange={(e) => {
                  setBarcode(e.target.value)
                  revisado("barcode")
                }}
                placeholder="Opcional"
              />
              <LeidoDeLaFactura
                pendiente={pendientes.has("barcode")}
                onConfirmar={() => revisado("barcode")}
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Clasificación y existencias"
        description="Cómo se mide y cuándo te avisamos de que se está acabando."
      >
        <FieldGrid cols={3}>
          <Field
            id="np-unit"
            label="Unidad"
            required
            help={{ term: "unidad" }}
            hint={ejemploDeUnidad(unit) ?? "En qué se cuenta por dentro."}
          >
            <UnidadSelect
              id="np-unit"
              value={unit}
              vacio="Elige la unidad"
              className={cn(pendientes.has("unit") && "[&_select]:border-warning")}
              onChange={(v) => {
                setUnit(v)
                revisado("unit")
              }}
            />
            <LeidoDeLaFactura
              pendiente={pendientes.has("unit")}
              onConfirmar={() => revisado("unit")}
            />
          </Field>
          <Field
            id="np-min"
            label="Stock mínimo"
            required
            help={{ term: "stockMinimo" }}
            hint="Te avisamos al llegar aquí. Pon 0 si no quieres aviso."
          >
            <Input
              id="np-min"
              inputMode="numeric"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field
            id="np-cat"
            label="Categoría"
            required
            help={{ term: "categoria" }}
            hint={
              categories.length === 0
                ? "No hay categorías: créalas en Inventario → Categorías."
                : undefined
            }
          >
            <NativeSelect
              id="np-cat"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Elige la categoría"
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Precios"
        description="El costo viene de la factura: revísalo. El de venta lo pones tú."
      >
        <FieldGrid cols={2}>
          <Field
            id="np-cost"
            label="Costo de compra"
            required
            help={{ term: "costo" }}
            hint={
              presentacionNombre !== ""
                ? `Lo que cuesta un ${presentacionNombre}, tal como está en la factura. El costo por ${unidadCorta(unit || "und")} lo saca el sistema al entrar la mercancía.`
                : undefined
            }
          >
            <MoneyInput
              id="np-cost"
              value={cost}
              className={cn(pendientes.has("cost") && "border-warning")}
              onValueChange={(v) => {
                setCost(v)
                revisado("cost")
              }}
            />
            <LeidoDeLaFactura
              pendiente={pendientes.has("cost")}
              onConfirmar={() => revisado("cost")}
            />
          </Field>
          <Field
            id="np-price"
            label="Precio de venta"
            required={!notSold}
            help={{ term: "precioVenta" }}
            hint={
              notSold
                ? "No aparecerá en el POS."
                : "Con precio, el producto aparece en el POS para venderlo."
            }
          >
            <MoneyInput
              id="np-price"
              value={notSold ? null : salePrice}
              disabled={notSold}
              onValueChange={setSalePrice}
            />
          </Field>
          <FieldSpan span={2}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={notSold}
                onCheckedChange={(v) => setNotSold(v === true)}
              />
              No se vende en el POS (se compra para usarlo, no para venderlo)
            </label>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      {/* La misma sección que la ficha de inventario, y por el mismo motivo:
          la factura del proveedor viene en lo que él despacha —bultos, cajas,
          bolsas— y el insumo se consume en otra cosa. Escrita aquí, el renglón
          puede marcarse como "viene en bultos" y la entrada convierte sola: sin
          ella, "3 BULTOS" entraba al inventario como 3 gramos. */}
      <FormSection
        title="Cómo te llega del proveedor"
        description={`Lo consumes en ${unidadNombre(unit || "und")} y te puede llegar en bultos, cajas, bolsas o canastas. Escríbelo aquí y podrás marcar el renglón como “viene en ${presentacionNombre || "bultos"}”: el sistema convierte la cantidad y el costo.`}
        help={{ term: "presentacionCompra" }}
        boxed
      >
        <PresentacionCompraPicker
          unidadConsumo={unit || "und"}
          presentacion={purchaseUnit}
          onPresentacionChange={setPurchaseUnit}
          factor={purchaseFactor}
          onFactorChange={setPurchaseFactor}
        />
        {factorValido && presentacionNombre !== "" && (
          <p className="text-xs font-medium text-foreground">
            Un {presentacionNombre} ={" "}
            {describirContenido(purchaseFactor!, unit || "und")}.
          </p>
        )}
      </FormSection>
    </FormDialog>
  )
}

/**
 * Celda de renglón en el celular: la tabla de ocho columnas se vuelve una
 * tarjeta por renglón y cada celda lleva su título encima (`data-label`). Con
 * la tabla había que desplazarse de lado para ver el total de cada renglón y
 * los campos quedaban de 3 cm de ancho.
 */
const CELDA_MOVIL =
  "max-md:block max-md:p-0 max-md:whitespace-normal max-md:before:mb-1 max-md:before:block max-md:before:text-xs max-md:before:font-medium max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)]"

export default function RevisarFacturaPage() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  const confirm = useConfirm()
  const { hasPermission } = useAuth()
  const canView = hasPermission("finance.view")
  const canManage = hasPermission("purchasing.manage")

  const [scan, setScan] = React.useState<InvoiceScan | null>(null)
  const [draft, setDraft] = React.useState<ExtractedInvoice | null>(null)
  const [decisions, setDecisions] = React.useState<LineDecision[]>([])
  const [supplierId, setSupplierId] = React.useState<string>("")
  const [sedeId, setSedeId] = React.useState<string>("")

  const [sedes, setSedes] = React.useState<Sede[]>([])
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [products, setProducts] = React.useState<InvProduct[]>([])
  const [categories, setCategories] = React.useState<FinanceCategory[]>([])
  const [invCategories, setInvCategories] = React.useState<InvCategory[]>([])
  /** Índice del renglón cuya ficha de producto nuevo está abierta. */
  const [newProductLine, setNewProductLine] = React.useState<number | null>(null)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [applying, setApplying] = React.useState(false)
  const [expenseOpen, setExpenseOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [
        data,
        sedeList,
        supplierList,
        productList,
        categoryList,
        invCategoryList,
      ] = await Promise.all([
        getInvoiceScan(id),
        listSedes().catch(() => []),
        listSuppliers().catch(() => []),
        // Con inactivos: el SKU de un producto dado de baja sigue ocupado en la
        // base, así que proponer uno libre y avisar del repetido exige verlos.
        listProducts(true).catch(() => []),
        listFinanceCategories().catch(() => []),
        listInventoryCategories().catch(() => []),
      ])
      setScan(data)
      setDraft(data.draft ?? null)
      setDecisions(data.lineDecisions ?? [])
      setSupplierId(data.supplierId ?? "")
      setSedeId(data.sedeId ?? "")
      setSedes(sedeList)
      setSuppliers(supplierList)
      setProducts(productList)
      // Los ingresos no son destino de un gasto de compra.
      setCategories(categoryList.filter((c) => c.kind !== "income"))
      setInvCategories(invCategoryList)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  // ─── Edición local ────────────────────────────────────────────────────────

  function patchLine(index: number, patch: Record<string, unknown>) {
    setDraft((current) => {
      if (!current) return current
      const lines = current.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      )
      return { ...current, lines }
    })
  }

  /**
   * Cambia cantidad o valor unitario y **rehace el total del renglón al vuelo**.
   *
   * El total dejaba de moverse en cuanto el renglón traía uno leído de la foto:
   * se corregía la cantidad de 1 a 10, o el precio, y abajo seguía la cifra
   * vieja —y con ella la suma de renglones y el aviso de descuadre, que es
   * justo lo que se mira para decidir si la factura está bien—. Peor en un
   * renglón escrito a mano, donde se teclea todo y el total no aparecía nunca.
   *
   * Solo se rehace cuando están las dos mitades de la cuenta. Si falta el
   * unitario, el total leído es el único dato que hay y se respeta.
   */
  function patchImporte(index: number, patch: Partial<ExtractedLine>) {
    setDraft((current) => {
      if (!current) return current
      const lines = current.lines.map((line, i) => {
        if (i !== index) return line
        const actualizada = { ...line, ...patch }
        const { qty, unitCost } = actualizada
        if (typeof qty === "number" && typeof unitCost === "number") {
          return { ...actualizada, lineTotal: Math.round(qty * unitCost) }
        }
        return actualizada
      })
      return { ...current, lines }
    })
  }

  function patchSupplier(patch: Partial<ExtractedInvoice["supplier"]>) {
    setDraft((current) =>
      current
        ? { ...current, supplier: { ...current.supplier, ...patch } }
        : current,
    )
  }

  function patchInvoice(patch: Partial<ExtractedInvoice["invoice"]>) {
    setDraft((current) =>
      current
        ? { ...current, invoice: { ...current.invoice, ...patch } }
        : current,
    )
  }

  function patchTotals(patch: Partial<ExtractedInvoice["totals"]>) {
    setDraft((current) =>
      current ? { ...current, totals: { ...current.totals, ...patch } } : current,
    )
  }

  /**
   * Renglón escrito a mano, para lo que el modelo no leyó. Nace omitido: no
   * entra a inventario ni a gastos hasta que se le elija destino, igual que un
   * renglón leído que no se pudo emparejar.
   */
  function addLine() {
    setDraft((current) =>
      current
        ? { ...current, lines: [...current.lines, { description: "", qty: 1 }] }
        : current,
    )
  }

  /**
   * Quita un renglón. Las decisiones van por índice, así que las de los
   * renglones de abajo se corren uno hacia arriba: sin eso, el destino y el
   * producto de un renglón quedarían pegados al de al lado.
   */
  function removeLine(index: number) {
    setDraft((current) =>
      current
        ? { ...current, lines: current.lines.filter((_, i) => i !== index) }
        : current,
    )
    setDecisions((current) =>
      current
        .filter((d) => d.lineIndex !== index)
        .map((d) =>
          d.lineIndex > index ? { ...d, lineIndex: d.lineIndex - 1 } : d,
        ),
    )
  }

  function patchDecision(lineIndex: number, patch: Partial<LineDecision>) {
    setDecisions((current) => {
      const found = current.find((d) => d.lineIndex === lineIndex)
      if (!found) {
        return [
          ...current,
          { lineIndex, target: "inventory", createProduct: false, ...patch },
        ]
      }
      return current.map((d) =>
        d.lineIndex === lineIndex ? { ...d, ...patch, matchedBy: "manual" } : d,
      )
    })
  }

  function decisionFor(lineIndex: number): LineDecision {
    return (
      decisions.find((d) => d.lineIndex === lineIndex) ?? {
        lineIndex,
        target: "ignore",
        createProduct: false,
      }
    )
  }

  async function handleSave(): Promise<boolean> {
    if (!scan || !draft) return false
    setSaving(true)
    try {
      const updated = await updateInvoiceScan(scan._id, {
        draft,
        supplierId: supplierId || null,
        sedeId: sedeId || null,
        lineDecisions: decisions,
      })
      setScan(updated)
      toast.success("Cambios guardados")
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleApply() {
    if (!scan) return
    const ok = await confirm({
      title: "¿Aplicar esta factura?",
      description:
        "Se creará la compra con su entrada de inventario y su cuenta por pagar, y los gastos de las líneas que no son mercancía.",
      confirmLabel: "Aplicar",
    })
    if (!ok) return

    setApplying(true)
    try {
      // Se guarda antes de aplicar: lo que se aplica es lo que está en el
      // servidor, no lo que se ve en pantalla.
      if (!(await handleSave())) return
      await applyInvoiceScan(scan._id)
      toast.success("Factura aplicada al inventario y a la contabilidad")
      router.push("/panel/compras/facturas")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setApplying(false)
    }
  }

  /**
   * "Aplicar en gastos". Como en Aplicar, primero se guarda: el proveedor y
   * los datos corregidos que valen son los del servidor, no los de pantalla.
   */
  async function handleApplyAsExpense(payload: ApplyAsExpensePayload) {
    if (!scan) return
    setApplying(true)
    try {
      if (!(await handleSave())) return
      await applyInvoiceScanAsExpense(scan._id, payload)
      toast.success(
        payload.status === "payable"
          ? "Factura registrada como gasto y en cuentas por pagar"
          : "Factura registrada como gasto",
      )
      setExpenseOpen(false)
      router.push("/panel/compras/facturas")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setApplying(false)
    }
  }

  async function handleSplit(pageIndex: number) {
    if (!scan) return
    try {
      await splitInvoiceScan(scan._id, pageIndex)
      toast.success("Página separada en una factura aparte")
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  // ─── Cálculos de apoyo ────────────────────────────────────────────────────

  /** Lo que se puede enlazar o sugerir: un producto inactivo no se ofrece. */
  const productosActivos = React.useMemo(
    () => products.filter((p) => p.active),
    [products],
  )

  /** Los SKU que otros renglones de esta factura ya tienen apartados. */
  const skusDeOtrasLineas = React.useMemo(
    () =>
      decisions
        .filter((d) => d.lineIndex !== newProductLine && d.newProduct?.sku)
        .map((d) => d.newProduct!.sku as string),
    [decisions, newProductLine],
  )

  const sumaLineas = React.useMemo(() => {
    if (!draft) return 0
    return draft.lines.reduce((total, line, index) => {
      if (decisionFor(index).target === "ignore") return total
      const valor = line.lineTotal ?? (line.unitCost ?? 0) * (line.qty ?? 1)
      return total + valor
    }, 0)
  }, [draft, decisions]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalLeido = draft?.totals?.total
  const descuadre =
    totalLeido != null && Math.abs(totalLeido - sumaLineas) > TOLERANCIA

  if (!canView) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
          </CardContent>
        </Card>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (!scan || !draft) {
    return (
      <>
        <PageHeader section="Comercial" title="Revisar factura" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ScanLine className="size-9 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Esta factura todavía no se ha leído o no existe.
            </p>
            <Button render={<Link href="/panel/compras/facturas" />}>
              Volver al listado
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const aplicada = scan.status === "applied"
  const editable = canManage && !aplicada
  // Solo activos: el catálogo se carga entero —inactivos incluidos— para poder
  // avisar del SKU repetido, pero un producto dado de baja no se ofrece para
  // enlazarle mercancía.
  const productOptions = productosActivos.map((p) => ({
    value: p._id,
    label: `${p.name} · ${p.sku}`,
  }))

  return (
    <>
      <PageHeader
        section="Comercial"
        title={aplicada ? "Factura aplicada" : "Revisar factura"}
        description={
          aplicada
            ? "Lo que se leyó de la factura y lo que se registró al aplicarla."
            : "Corrige lo que haga falta y aprueba. Nada entra al inventario hasta que lo apliques."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href="/panel/compras/facturas" />}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver
            </Button>
            {editable && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  Guardar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setExpenseOpen(true)}
                  disabled={applying}
                >
                  <Receipt className="size-4" aria-hidden />
                  Aplicar en gastos
                </Button>
                <Button onClick={handleApply} disabled={applying}>
                  {applying ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  Aplicar
                </Button>
              </>
            )}
          </div>
        }
      />

      {aplicada && (
        <Card className="mb-4 border-success/40">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="size-5 text-success-ink" aria-hidden />
            <p className="text-sm">
              Esta factura ya se aplicó. Queda como historial y no se puede
              modificar.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── Proveedor ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Proveedor</CardTitle>
              <CardDescription>
                {scan.supplierMatch === "matched"
                  ? "Reconocido por el NIT de la factura."
                  : draft.supplier?.name
                    ? "No está registrado: al aplicar se creará con estos datos, o elige uno existente."
                    : "No se pudo leer el proveedor: elige uno o completa sus datos."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-supplier">Proveedor registrado</Label>
                <SearchableSelect
                  id="f-supplier"
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder="Crear con los datos leídos"
                  options={suppliers.map((s) => ({
                    value: s._id,
                    label: `${s.name} · ${s.docNumber}`,
                  }))}
                  disabled={!editable}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-sede">Sede de destino</Label>
                <Select
                  value={sedeId || "none"}
                  items={{
                    none: "Elige la sede",
                    ...Object.fromEntries(sedes.map((s) => [s._id, s.name])),
                  }}
                  onValueChange={(v) => {
                    if (v !== null) setSedeId(v === "none" ? "" : v)
                  }}
                  disabled={!editable}
                >
                  <SelectTrigger id="f-sede" className="w-full">
                    <SelectValue placeholder="Elige la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Elige la sede</SelectItem>
                    {sedes.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-supname">Nombre leído</Label>
                <Input
                  id="f-supname"
                  value={draft.supplier?.name ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      supplier: { ...draft.supplier, name: e.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-nit">NIT leído</Label>
                <Input
                  id="f-nit"
                  value={draft.supplier?.docNumber ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      supplier: { ...draft.supplier, docNumber: e.target.value },
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-doctype">Tipo de documento</Label>
                <NativeSelect
                  id="f-doctype"
                  value={draft.supplier?.docType ?? "NIT"}
                  disabled={!editable}
                  onChange={(v) =>
                    patchSupplier({ docType: v as "NIT" | "CC" | "CE" })
                  }
                  options={[
                    { value: "NIT", label: "NIT" },
                    { value: "CC", label: "Cédula (CC)" },
                    { value: "CE", label: "Cédula de extranjería (CE)" },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-phone">Teléfono</Label>
                <Input
                  id="f-phone"
                  value={draft.supplier?.phone ?? ""}
                  disabled={!editable}
                  onChange={(e) => patchSupplier({ phone: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-address">Dirección</Label>
                <Input
                  id="f-address"
                  value={draft.supplier?.address ?? ""}
                  disabled={!editable}
                  onChange={(e) => patchSupplier({ address: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-city">Ciudad</Label>
                <Input
                  id="f-city"
                  value={draft.supplier?.city ?? ""}
                  disabled={!editable}
                  onChange={(e) => patchSupplier({ city: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Datos del documento ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Datos de la factura
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-number">Número</Label>
                <Input
                  id="f-number"
                  value={draft.invoice?.number ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      invoice: { ...draft.invoice, number: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-date">Fecha</Label>
                <Input
                  id="f-date"
                  type="date"
                  value={draft.invoice?.issueDate ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      invoice: { ...draft.invoice, issueDate: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-due">Vence</Label>
                <Input
                  id="f-due"
                  type="date"
                  value={draft.invoice?.dueDate ?? ""}
                  min={draft.invoice?.issueDate || undefined}
                  disabled={!editable}
                  onChange={(e) =>
                    patchInvoice({ dueDate: e.target.value || undefined })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-terms">Pago</Label>
                <Select
                  value={draft.invoice?.paymentTerms ?? "credito"}
                  items={{ contado: "De contado", credito: "A crédito" }}
                  onValueChange={(v) => {
                    if (v !== null) {
                      setDraft({
                        ...draft,
                        invoice: {
                          ...draft.invoice,
                          paymentTerms: v as "contado" | "credito",
                        },
                      })
                    }
                  }}
                  disabled={!editable}
                >
                  <SelectTrigger id="f-terms" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">De contado</SelectItem>
                    <SelectItem value="credito">A crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Líneas ── */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Renglones ({draft.lines.length})
              </CardTitle>
              <CardDescription>
                Lo que va <strong>a inventario</strong> entra como compra y suma
                stock. Lo que va <strong>a gasto</strong> (fletes, servicios) se
                registra en Finanzas. La deuda total queda como cuenta por pagar
                al proveedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {/* En celular son tarjetas (una fila por renglón, sin
                    cabecera). De `md` para arriba vuelve a ser tabla, y ahí el
                    ancho mínimo es lo que impide que comprima las casillas de
                    cifras hasta dejar ver un solo dígito: con `w-full` a secas,
                    cantidad y valor cedían su sitio a la descripción y el
                    precio quedaba ilegible. Antes de aplicar una factura hay
                    que poder leer lo que dice. */}
                <Table className="md:min-w-[64rem] max-md:block max-md:[&_tbody]:block max-md:[&_thead]:hidden">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-52">Descripción</TableHead>
                      <TableHead className="w-32">Cant.</TableHead>
                      <TableHead className="w-40">V/r unitario</TableHead>
                      <TableHead className="w-28">Destino</TableHead>
                      <TableHead className="min-w-56">
                        Producto / categoría
                      </TableHead>
                      <TableHead className="w-20">IVA</TableHead>
                      <TableHead className="w-40 text-right">Total</TableHead>
                      {editable && (
                        <TableHead className="w-12">
                          <span className="sr-only">Quitar</span>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draft.lines.map((line, index) => {
                      const decision = decisionFor(index)
                      const total =
                        line.lineTotal ?? (line.unitCost ?? 0) * (line.qty ?? 1)
                      return (
                        <TableRow
                          key={index}
                          className="max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-3 max-md:px-4 max-md:py-4 max-md:hover:bg-transparent"
                        >
                          <TableCell data-label="Descripción" className={CELDA_MOVIL + " max-md:col-span-2"}>
                            <Input
                              value={line.description}
                              placeholder="Descripción"
                              aria-label="Descripción"
                              disabled={!editable}
                              onChange={(e) =>
                                patchLine(index, { description: e.target.value })
                              }
                            />
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                              <Input
                                value={line.code ?? ""}
                                placeholder="Código"
                                aria-label="Código del proveedor"
                                disabled={!editable}
                                className="h-8 text-xs"
                                onChange={(e) =>
                                  patchLine(index, {
                                    code: e.target.value || undefined,
                                  })
                                }
                              />
                              {/* La unidad se escoge, no se escribe: tecleada a
                                  mano salían "UND", "Und" y "unidad" como tres
                                  cosas distintas. Lo que el papel trajera y no
                                  esté en la lista se conserva al final del
                                  desplegable en vez de borrarse. */}
                              <UnidadSelect
                                value={line.unit ?? ""}
                                vacio="Unidad"
                                aria-label="Unidad"
                                disabled={!editable}
                                className="[&_select]:h-8 [&_select]:text-xs"
                                onChange={(v) =>
                                  patchLine(index, { unit: v || undefined })
                                }
                              />
                            </div>
                            {decision.matchedBy && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {MATCH_LABELS[decision.matchedBy] ??
                                  decision.matchedBy}
                              </p>
                            )}
                          </TableCell>
                          <TableCell data-label="Cantidad" className={CELDA_MOVIL}>
                            {/* Sin `sufijo` a propósito: la unidad ya está en
                                su desplegable, en esta misma fila, y pintarla
                                otra vez dentro del campo se llevaría 56 de los
                                128 px de la columna, que es lo que hay que
                                cuidar aquí para que la cifra se lea entera. */}
                            <QuantityInput
                              value={line.qty ?? null}
                              disabled={!editable}
                              aria-label="Cantidad"
                              onValueChange={(v) =>
                                patchImporte(index, { qty: v ?? undefined })
                              }
                            />
                          </TableCell>
                          <TableCell data-label="Valor unitario" className={CELDA_MOVIL}>
                            {editable ? (
                              <MoneyInput
                                value={line.unitCost ?? null}
                                aria-label="Valor unitario"
                                onValueChange={(v) =>
                                  patchImporte(index, {
                                    unitCost: v ?? undefined,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-sm">
                                {line.unitCost != null
                                  ? money.format(line.unitCost)
                                  : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell data-label="Destino" className={CELDA_MOVIL + " max-md:col-span-2"}>
                            <Select
                              value={decision.target}
                              items={LINE_TARGET_LABELS}
                              onValueChange={(v) => {
                                if (v !== null) {
                                  patchDecision(index, { target: v as LineTarget })
                                }
                              }}
                              disabled={!editable}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TARGETS.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {LINE_TARGET_LABELS[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell data-label="Producto o categoría" className={CELDA_MOVIL + " max-md:col-span-2"}>
                            {decision.target === "inventory" ? (
                              <div className="flex flex-col gap-1.5">
                              <SearchableSelect
                                aria-label="Producto del inventario"
                                value={decision.productId ?? ""}
                                placeholder="Crear producto nuevo"
                                options={productOptions}
                                onChange={(v) =>
                                  patchDecision(index, {
                                    productId: v || null,
                                    createProduct: !v,
                                  })
                                }
                                disabled={!editable}
                              />
                              {!decision.productId && editable && (
                                <SugerenciasProducto
                                  descripcion={line.description}
                                  productos={productosActivos}
                                  onElegir={(productId) =>
                                    patchDecision(index, {
                                      productId,
                                      createProduct: false,
                                    })
                                  }
                                />
                              )}
                              {!decision.productId && (
                                <Button
                                  size="sm"
                                  variant={
                                    decision.newProduct?.reviewed
                                      ? "ghost"
                                      : "outline"
                                  }
                                  disabled={!editable}
                                  onClick={() => setNewProductLine(index)}
                                >
                                  <PackagePlus className="size-4" aria-hidden />
                                  {decision.newProduct?.reviewed
                                    ? `Ficha revisada · ${decision.newProduct.sku}`
                                    : "Completar y revisar ficha"}
                                </Button>
                              )}
                              {/* La factura casi siempre viene en lo que el
                                  proveedor vende —bultos, cajas— y no en la
                                  unidad en que se consume. Se ofrece cuando hay
                                  presentación: la del producto emparejado, o la
                                  que se le acabe de escribir en la ficha al
                                  producto que nace con esta misma factura. */}
                              <PresentacionDeCompra
                                producto={products.find(
                                  (p) => p._id === decision.productId,
                                )}
                                nuevo={decision.newProduct}
                                cantidad={line.qty}
                                marcado={decision.inPurchaseUnits ?? false}
                                editable={editable}
                                onChange={(v) =>
                                  patchDecision(index, { inPurchaseUnits: v })
                                }
                              />
                              </div>
                            ) : decision.target === "expense" ? (
                              <SearchableSelect
                                aria-label="Categoría del gasto"
                                value={decision.categoryId ?? ""}
                                placeholder="Elige la categoría"
                                options={categories.map((c) => ({
                                  value: c._id,
                                  label: c.name,
                                }))}
                                onChange={(v) =>
                                  patchDecision(index, { categoryId: v || null })
                                }
                                disabled={!editable}
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No se registra
                              </span>
                            )}
                          </TableCell>
                          <TableCell data-label="IVA" className={CELDA_MOVIL}>
                            <NativeSelect
                              value={
                                line.ivaRate != null ? String(line.ivaRate) : ""
                              }
                              options={IVA_OPCIONES}
                              disabled={!editable}
                              aria-label="Tarifa de IVA"
                              onChange={(v) =>
                                patchLine(index, {
                                  ivaRate: v === "" ? undefined : Number(v),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell data-label="Total" className={CELDA_MOVIL + " text-right font-medium max-md:text-left"}>
                            {editable ? (
                              <MoneyInput
                                value={line.lineTotal ?? null}
                                placeholder={money.format(total)}
                                aria-label="Total del renglón"
                                onValueChange={(v) =>
                                  patchLine(index, { lineTotal: v ?? undefined })
                                }
                              />
                            ) : (
                              money.format(total)
                            )}
                          </TableCell>
                          {editable && (
                            <TableCell className="max-md:col-span-2 max-md:flex max-md:justify-end max-md:p-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={"Quitar el renglón " + (index + 1)}
                                onClick={() => removeLine(index)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {editable && (
                <div className="border-t border-border p-3">
                  <Button variant="outline" size="sm" onClick={addLine}>
                    <Plus className="size-4" aria-hidden />
                    Agregar renglón
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Cuadre ── */}
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              {/* Los totales del pie también se corrigen a mano: contra ellos se
                  compara la suma de renglones y con ellos se prellena
                  "Aplicar en gastos". */}
              <div className="grid gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["subtotal", "Subtotal"],
                    ["iva", "IVA"],
                    ["retentions", "Retenciones"],
                    ["total", "Total impreso"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label htmlFor={"f-tot-" + key}>{label}</Label>
                    <MoneyInput
                      id={"f-tot-" + key}
                      value={draft.totals?.[key] ?? null}
                      disabled={!editable}
                      onValueChange={(v) =>
                        patchTotals({ [key]: v ?? undefined })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Suma de renglones</span>
                <span className="font-medium">{money.format(sumaLineas)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Total impreso en la factura
                </span>
                <span className="font-medium">
                  {totalLeido != null ? money.format(totalLeido) : "—"}
                </span>
              </div>
              {descuadre && (
                <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  La suma de los renglones no coincide con el total de la
                  factura. Revisa cantidades y valores: puede faltar un renglón o
                  haberse leído mal un número. Puedes aplicarla igual si sabes
                  por qué difiere (descuentos o impuestos del pie).
                </p>
              )}
            </CardContent>
          </Card>

          {/* En el celular los botones de la cabecera quedan varias pantallas
              más arriba después de revisar los renglones: se repiten abajo,
              fijos, donde está el pulgar. */}
          {editable && (
            <div className="sticky bottom-3 z-20 flex gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur md:hidden">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                Guardar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setExpenseOpen(true)}
                disabled={applying}
              >
                <Receipt className="size-4" aria-hidden />
                Gastos
              </Button>
              <Button className="flex-1" onClick={handleApply} disabled={applying}>
                {applying ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden />
                )}
                Aplicar
              </Button>
            </div>
          )}
        </div>

        {/* ── Columna lateral: imágenes e historial ── */}
        {/* En el celular la columna se deshace (`contents`) para que las
            imágenes suban arriba de todo —se revisa mirando la factura— y el
            historial quede al final. */}
        <div className="flex flex-col gap-4 max-lg:contents">
          <Card className="max-lg:order-first">
            <CardHeader>
              <CardTitle className="font-display text-lg">
                Imágenes ({scan.pages.length})
              </CardTitle>
              <CardDescription>
                El soporte queda guardado con la compra.
              </CardDescription>
            </CardHeader>
            {/* En el celular las páginas van en una tira horizontal y con alto
                limitado: apiladas a tamaño completo empujaban los renglones
                varias pantallas hacia abajo. */}
            <CardContent className="flex flex-col gap-3 max-lg:flex-row max-lg:snap-x max-lg:overflow-x-auto">
              {scan.pages.map((page, index) => (
                <div
                  key={page.imagePathname}
                  className={
                    "flex flex-col gap-1 max-lg:snap-start" +
                    (scan.pages.length > 1
                      ? " max-lg:w-[85%] max-lg:shrink-0"
                      : " max-lg:w-full")
                  }
                >
                  <a href={page.imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.imageUrl}
                      alt={`Página ${index + 1} de la factura`}
                      loading="lazy"
                      className="w-full rounded-lg border border-border object-contain max-lg:max-h-[50svh]"
                    />
                  </a>
                  {editable && scan.pages.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSplit(index)}
                    >
                      <Split className="size-4" aria-hidden />
                      Separar esta página
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <History className="size-4" aria-hidden />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {scan.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                [...scan.history].reverse().map((entry, index) => (
                  <div key={index} className="flex flex-col border-l-2 border-border pl-3">
                    <span className="text-sm font-medium">
                      {entry.detail ?? entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(entry.at)} · {entry.userEmail ?? "sistema"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {(scan.appliedTo?.purchaseOrderId ||
            (scan.appliedTo?.expenseIds?.length ?? 0) > 0) && (
            <Card>
              <CardContent className="flex flex-col gap-2 py-4 text-sm">
                <Badge variant="outline" className="w-fit">
                  Resultado
                </Badge>
                {scan.appliedTo.purchaseOrderId && (
                  <Link
                    href="/panel/compras"
                    className="text-primary underline underline-offset-4"
                  >
                    Ver la orden de compra generada
                  </Link>
                )}
                {scan.appliedTo.expenseIds?.length > 0 && (
                  <Link
                    href="/panel/finanzas/gastos"
                    className="text-primary underline underline-offset-4"
                  >
                    Ver los {scan.appliedTo.expenseIds.length} gasto(s)
                    registrados
                  </Link>
                )}
                {scan.appliedTo.payableId && (
                  <Link
                    href="/panel/finanzas/cxp"
                    className="text-primary underline underline-offset-4"
                  >
                    Ver la cuenta por pagar
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ApplyExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        draft={draft}
        sedes={sedes}
        categories={categories}
        defaultSedeId={sedeId}
        sumaLineas={sumaLineas}
        submitting={applying}
        onSubmit={handleApplyAsExpense}
      />

      <NewProductDialog
        key={newProductLine ?? "cerrado"}
        open={newProductLine !== null}
        onOpenChange={(v) => setNewProductLine(v ? newProductLine : null)}
        line={newProductLine !== null ? (draft.lines[newProductLine] ?? null) : null}
        value={
          newProductLine !== null
            ? decisionFor(newProductLine).newProduct
            : undefined
        }
        categories={invCategories}
        productos={products}
        skusDeLaFactura={skusDeOtrasLineas}
        onSave={(nuevo) => {
          if (newProductLine === null) return
          // Con presentación escrita, la cantidad del papel se da por venida en
          // ella —el proveedor factura lo que despacha— igual que se propone
          // para un producto ya emparejado que la tenga. Queda como propuesta:
          // la casilla del renglón sigue ahí para quitarla. Sin esto, declarar
          // "bulto de 25 kg" y olvidar la casilla metía 3 gramos al inventario.
          const enPresentacion = Boolean(
            nuevo.purchaseUnit && (nuevo.purchaseFactor ?? 0) > 0,
          )
          patchDecision(newProductLine, {
            newProduct: nuevo,
            createProduct: true,
            productId: null,
            inPurchaseUnits: enPresentacion,
          })
          toast.success("Ficha revisada. El producto se creará al aplicar la factura.")
        }}
        onUsarExistente={(productId) => {
          if (newProductLine === null) return
          patchDecision(newProductLine, {
            productId,
            createProduct: false,
            newProduct: undefined,
          })
          toast.success("Renglón enlazado al producto que ya tenías.")
        }}
      />
    </>
  )
}

/**
 * "Esta cantidad viene en bultos".
 *
 * La factura del proveedor casi siempre está en lo que él vende —3 BULTOS
 * HARINA— y no en la unidad en que el negocio consume. Sin esta casilla tocaba
 * traducirla a mano antes de registrarla, y ahí es donde se equivoca la gente:
 * 3 en vez de 75.000 deja el inventario en nada, y $95.000 como costo del gramo
 * infla cada receta veinticinco mil veces.
 *
 * Solo aparece cuando hay presentación definida: la del producto emparejado o,
 * desde que la ficha de producto nuevo la pide, la de uno que se crea con esta
 * misma factura. Sin presentación no hay nada que convertir.
 */
function PresentacionDeCompra({
  producto,
  nuevo,
  cantidad,
  marcado,
  editable,
  onChange,
}: {
  producto?: InvProduct
  /** Ficha del producto que nace con esta factura, si el renglón lo crea. */
  nuevo?: NewProductDraft
  cantidad?: number
  marcado: boolean
  editable: boolean
  onChange: (v: boolean) => void
}) {
  const unidadConsumo = producto?.unit ?? nuevo?.unit ?? "und"
  const pres = producto
    ? presentacionDeCompra(producto)
    : nuevo?.purchaseUnit && (nuevo.purchaseFactor ?? 0) > 0
      ? {
          unidad: nuevo.purchaseUnit,
          factor: nuevo.purchaseFactor as number,
          definida: true,
          contenido: describirContenido(
            nuevo.purchaseFactor as number,
            unidadConsumo,
          ),
        }
      : null
  if (!pres?.definida) return null

  const n = Number(cantidad)
  const entra =
    Number.isFinite(n) && n > 0
      ? describirContenido(n * pres.factor, unidadConsumo)
      : null

  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs">
      <Checkbox
        checked={marcado}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={!editable}
        aria-label={`La cantidad viene en ${pres.unidad}`}
      />
      <span className="leading-tight">
        Viene en {pres.unidad}
        <span className="text-muted-foreground">
          {" "}
          (de {pres.contenido})
        </span>
        {marcado && entra && (
          <span className="block text-[11px] text-success-ink">
            Entran {entra} al inventario.
          </span>
        )}
      </span>
    </label>
  )
}

/**
 * "¿Ya lo tienes?": productos del inventario que se parecen al renglón.
 *
 * Aparece antes de crear uno nuevo. Sin esto, "Coca cola regular friopack" de
 * la factura creaba otro producto aunque ya existiera "Coca cola original", y
 * el inventario se llenaba de duplicados que después había que fusionar. No
 * empareja solo: ofrece, y la persona elige.
 */
function SugerenciasProducto({
  descripcion,
  productos,
  onElegir,
}: {
  descripcion: string
  productos: InvProduct[]
  onElegir: (productId: string) => void
}) {
  const sugerencias = React.useMemo(
    () =>
      rankBySimilarity(descripcion, productos, (p) => p.name, {
        limit: 3,
      }),
    [descripcion, productos],
  )
  if (sugerencias.length === 0) return null

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-2">
      <span className="text-xs text-muted-foreground">
        ¿Ya lo tienes? Úsalo y evita un duplicado:
      </span>
      {sugerencias.map(({ item, score }) => (
        <Button
          key={item._id}
          type="button"
          size="sm"
          variant="ghost"
          className="h-auto justify-start whitespace-normal py-1 text-left text-xs"
          onClick={() => onElegir(item._id)}
        >
          <GitMerge className="size-3.5 shrink-0" aria-hidden />
          <span>
            {item.name} · {item.sku}{" "}
            <span className="text-muted-foreground">
              ({Math.round(score * 100)}% parecido)
            </span>
          </span>
        </Button>
      ))}
    </div>
  )
}
