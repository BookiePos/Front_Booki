"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Boxes,
  ChefHat,
  ImageOff,
  ShieldOff,
  X,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"
import {
  listProducts,
  listCategories,
  type InvProduct,
  type InvCategory,
} from "@/lib/erp/api-inventory"
import {
  listCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  uploadCatalogProductImage,
  deleteCatalogProductImage,
  SOURCE_TYPE_LABELS,
  IVA_OPTIONS,
  ivaKey,
  type CatalogProduct,
  type CatalogSourceType,
  type CatalogProductPayload,
} from "@/lib/erp/api-catalog"

import { PageHeader } from "@/components/erp/page-header"
import { ProductImageField } from "@/components/erp/product-image-field"
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
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const nf = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 })

/** Normaliza para buscar: minúsculas y sin tildes. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  )
}

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
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

function SourceBadge({ type }: { type: CatalogSourceType }) {
  return (
    <Badge variant="secondary" className="gap-1">
      {type === "recipe" ? (
        <ChefHat className="size-3.5" />
      ) : (
        <Boxes className="size-3.5" />
      )}
      {SOURCE_TYPE_LABELS[type]}
    </Badge>
  )
}

// ─── Product sheet ───────────────────────────────────────────────────────────

interface RecipeRow {
  productId: string
  qty: string
}

interface ProductSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  product?: CatalogProduct
  invProducts: InvProduct[]
  categories: InvCategory[]
  onSuccess: () => void
  /** Retail no maneja recetas: se oculta el selector de origen. */
  isRetail?: boolean
}

function ProductSheet({
  open,
  onOpenChange,
  mode,
  product,
  invProducts,
  categories,
  onSuccess,
  isRetail = false,
}: ProductSheetProps) {
  const [sku, setSku] = React.useState("")
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("none")
  const [salePrice, setSalePrice] = React.useState("")
  const [ivaSel, setIvaSel] = React.useState("19")
  const [sourceType, setSourceType] = React.useState<CatalogSourceType>(
    "inventory",
  )
  const [inventoryProductId, setInventoryProductId] = React.useState("")
  const [invQuery, setInvQuery] = React.useState("")
  const [invListOpen, setInvListOpen] = React.useState(false)
  const [qtyPerUnit, setQtyPerUnit] = React.useState("1")
  const [recipe, setRecipe] = React.useState<RecipeRow[]>([
    { productId: "", qty: "" },
  ])
  const [active, setActive] = React.useState(true)
  /** Foto elegida y pendiente de subir (se sube al guardar). */
  const [imageFile, setImageFile] = React.useState<File | Blob | null>(null)
  /** El usuario quitó la foto que ya tenía guardada. */
  const [imageRemoved, setImageRemoved] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const invItems = React.useMemo(
    () =>
      Object.fromEntries(
        invProducts.map((p) => [p._id, `${p.name} · ${p.sku}`]),
      ),
    [invProducts],
  )
  const linkedProduct = invProducts.find((p) => p._id === inventoryProductId)

  const invMatches = React.useMemo(() => {
    const q = norm(invQuery)
    if (!q) return invProducts
    return invProducts.filter(
      (p) => norm(p.name).includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [invProducts, invQuery])

  /** Elige un ítem del inventario: comparte su SKU y autocompleta datos. */
  function pickInvProduct(p: InvProduct) {
    setInventoryProductId(p._id)
    setInvQuery(`${p.name} · ${p.sku}`)
    setInvListOpen(false)
    // El SKU se comparte con el inventario (fuente única de verdad).
    setSku(p.sku)
    // Autocompletar sin pisar lo que el usuario ya haya escrito.
    setName((n) => n || p.name)
    setCategoryId((c) =>
      c === "none" && p.categoryId?._id ? p.categoryId._id : c,
    )
    setSalePrice((sp) =>
      sp || (p.salePrice != null ? String(p.salePrice) : ""),
    )
  }

  React.useEffect(() => {
    async function reset() {
      await Promise.resolve()
      if (!open) return
      if (mode === "edit" && product) {
        setSku(product.sku)
        setName(product.name)
        setDescription(product.description ?? "")
        setCategoryId(product.categoryId?._id ?? "none")
        setSalePrice(String(product.salePrice ?? ""))
        setIvaSel(ivaKey(product.ivaRate ?? 19, product.ivaType ?? "gravado"))
        // Retail nunca usa receta; si por datos viejos llegara una, se trata
        // como "del inventario" para que la ficha sea coherente con el giro.
        setSourceType(isRetail ? "inventory" : product.sourceType)
        const linked =
          typeof product.inventoryProductId === "object"
            ? product.inventoryProductId
            : null
        setInventoryProductId(linked?._id ?? "")
        setInvQuery(linked ? `${linked.name} · ${linked.sku}` : "")
        setQtyPerUnit(String(product.qtyPerUnit ?? 1))
        setRecipe(
          product.recipe.length > 0
            ? product.recipe.map((l) => ({
                productId:
                  typeof l.productId === "object"
                    ? l.productId._id
                    : l.productId,
                qty: String(l.qty),
              }))
            : [{ productId: "", qty: "" }],
        )
        setActive(product.active)
      } else {
        setSku("")
        setName("")
        setDescription("")
        setCategoryId("none")
        setSalePrice("")
        setIvaSel("19")
        setSourceType("inventory")
        setInventoryProductId("")
        setInvQuery("")
        setQtyPerUnit("1")
        setRecipe([{ productId: "", qty: "" }])
        setActive(true)
      }
      setImageFile(null)
      setImageRemoved(false)
      setInvListOpen(false)
      setError(null)
    }
    void reset()
  }, [open, mode, product, isRetail])

  function updateRecipeRow(i: number, patch: Partial<RecipeRow>) {
    setRecipe((rows) =>
      rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    )
  }

  function addRecipeRow() {
    setRecipe((rows) => [...rows, { productId: "", qty: "" }])
  }

  function removeRecipeRow(i: number) {
    setRecipe((rows) =>
      rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Validaciones específicas de la fuente (antes de llamar al backend).
    if (sourceType === "inventory" && !inventoryProductId) {
      setError("Selecciona el ítem de inventario que se venderá")
      return
    }
    let cleanRecipe: { productId: string; qty: number }[] = []
    if (sourceType === "recipe") {
      cleanRecipe = recipe
        .filter((r) => r.productId && Number(r.qty) > 0)
        .map((r) => ({ productId: r.productId, qty: Number(r.qty) }))
      if (cleanRecipe.length === 0) {
        setError("Agrega al menos un ingrediente con cantidad")
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const catId = categoryId === "none" ? "" : categoryId
      const iva = IVA_OPTIONS.find((o) => o.key === ivaSel) ?? IVA_OPTIONS[0]
      const payload: CatalogProductPayload = {
        sku,
        name,
        description: description || undefined,
        categoryId: catId || undefined,
        salePrice: salePrice ? Number(salePrice) : 0,
        ivaRate: iva.rate,
        ivaType: iva.type,
        sourceType,
        inventoryProductId:
          sourceType === "inventory" ? inventoryProductId : undefined,
        qtyPerUnit:
          sourceType === "inventory"
            ? qtyPerUnit
              ? Number(qtyPerUnit)
              : 1
            : undefined,
        recipe: sourceType === "recipe" ? cleanRecipe : undefined,
      }
      // La foto va en una petición aparte (multipart) y DESPUÉS de guardar la
      // ficha: al crear, el id del producto solo existe a partir de aquí.
      let saved: CatalogProduct | undefined
      if (mode === "create") {
        saved = await createCatalogProduct(payload)
      } else if (product) {
        saved = await updateCatalogProduct(product._id, {
          ...payload,
          // En edición la cadena vacía sí viaja: significa quitar la categoría.
          categoryId: catId,
          active,
        })
      }
      if (saved) {
        // Un fallo subiendo la foto no debe deshacer un producto ya guardado:
        // se avisa y se sigue, y la foto se puede reintentar editando la ficha.
        try {
          if (imageFile) {
            await uploadCatalogProductImage(saved._id, imageFile)
          } else if (imageRemoved) {
            await deleteCatalogProductImage(saved._id)
          }
        } catch (err) {
          toast.error(`El producto se guardó, pero la foto no: ${errorMessage(err)}`)
        }
      }
      toast.success(mode === "create" ? "Producto creado" : "Producto actualizado")
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
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
            Define un producto vendible. Al venderlo en el POS, el stock se
            descuenta del inventario según su origen.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-2">
          {/* Origen del producto — retail solo vende ítems del inventario, así
              que se oculta el selector (no maneja recetas). */}
          {!isRetail && (
            <div className="flex flex-col gap-1.5">
              <Label>Origen</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
                {(
                  [
                    ["inventory", "Del inventario"],
                    ["recipe", "Con receta"],
                  ] as [CatalogSourceType, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSourceType(key)
                      // En modo inventario el SKU lo fija el ítem; si aún no hay
                      // ítem elegido, se limpia para no arrastrar el de una receta.
                      if (key === "inventory" && !inventoryProductId) setSku("")
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      sourceType === key
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {sourceType === "inventory"
                  ? "Se vende un ítem del inventario tal cual; cada venta lo descuenta."
                  : "Se arma con varios ingredientes; cada venta descuenta cada uno."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-sku">SKU</Label>
              <Input
                id="c-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder={
                  sourceType === "recipe" ? "p. ej. COMBO-01" : "Se toma del ítem"
                }
                readOnly={sourceType === "inventory"}
                required={sourceType === "recipe"}
                className={sourceType === "inventory" ? "bg-muted" : undefined}
              />
              {sourceType === "inventory" && (
                <p className="text-xs text-muted-foreground">
                  Se comparte con el inventario.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-price">Precio de venta</Label>
              <Input
                id="c-price"
                type="number"
                min="0"
                step="any"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0"
                required
              />
              <p className="text-xs text-muted-foreground">IVA incluido.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-iva">IVA</Label>
              <Select
                value={ivaSel}
                items={Object.fromEntries(
                  IVA_OPTIONS.map((o) => [o.key, o.label]),
                )}
                onValueChange={(v) => {
                  if (v !== null) setIvaSel(v as string)
                }}
              >
                <SelectTrigger id="c-iva" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IVA_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">Nombre</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Hamburguesa clásica"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-desc">Descripción</Label>
            <Input
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <ProductImageField
            currentUrl={product?.imageUrl}
            file={imageFile}
            onPick={setImageFile}
            removed={imageRemoved}
            onRemovedChange={setImageRemoved}
            disabled={saving}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-cat">Categoría</Label>
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
              <SelectTrigger id="c-cat" className="w-full">
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

          <Separator />

          {/* ── Fuente: inventario ── */}
          {sourceType === "inventory" && (
            <div className="flex flex-col gap-3">
              <div className="relative flex flex-col gap-1.5">
                <Label htmlFor="c-inv">
                  Buscar ítem de inventario (SKU o nombre)
                </Label>
                <Input
                  id="c-inv"
                  value={invQuery}
                  onChange={(e) => {
                    setInvQuery(e.target.value)
                    setInvListOpen(true)
                    setInventoryProductId("")
                  }}
                  onFocus={() => setInvListOpen(true)}
                  onBlur={() => setInvListOpen(false)}
                  placeholder="Escribe el SKU o el nombre…"
                  autoComplete="off"
                />
                {invListOpen && invMatches.length > 0 && (
                  <div
                    className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {invMatches.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                        onClick={() => pickInvProduct(p)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {invQuery && invListOpen && invMatches.length === 0 && (
                  <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-border bg-popover p-2 text-sm text-muted-foreground shadow-md">
                    Sin coincidencias. Crea el ítem en Inventario primero.
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-qpu">
                  Consumo por unidad vendida
                  {linkedProduct ? ` (${linkedProduct.unit})` : ""}
                </Label>
                <Input
                  id="c-qpu"
                  type="number"
                  min="0"
                  step="any"
                  value={qtyPerUnit}
                  onChange={(e) => setQtyPerUnit(e.target.value)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Cuánto del ítem descuenta cada unidad vendida. Normalmente 1.
                </p>
              </div>
            </div>
          )}

          {/* ── Fuente: receta ── */}
          {sourceType === "recipe" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Ingredientes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRecipeRow}
                >
                  <Plus />
                  Agregar
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {recipe.map((row, i) => {
                  const ing = invProducts.find((p) => p._id === row.productId)
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Select
                          value={row.productId}
                          items={invItems}
                          onValueChange={(v) => {
                            if (v !== null)
                              updateRecipeRow(i, { productId: v })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {invProducts.map((p) => (
                              <SelectItem key={p._id} value={p._id}>
                                {p.name} · {p.sku}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative w-28 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={row.qty}
                          onChange={(e) =>
                            updateRecipeRow(i, { qty: e.target.value })
                          }
                          placeholder="Cant."
                          aria-label="Cantidad"
                        />
                        {ing && (
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {ing.unit}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Quitar ingrediente"
                        className="mt-0.5"
                        disabled={recipe.length <= 1}
                        onClick={() => removeRecipeRow(i)}
                      >
                        <X />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Cada cantidad es por unidad vendida, en la unidad del
                ingrediente.
              </p>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { hasPermission, isRetail } = useAuth()
  const canView = hasPermission("inventory.view")
  const canManage = hasPermission("inventory.adjust")
  const confirm = useConfirm()

  const [products, setProducts] = React.useState<CatalogProduct[]>([])
  const [invProducts, setInvProducts] = React.useState<InvProduct[]>([])
  const [categories, setCategories] = React.useState<InvCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<CatalogProduct | undefined>()

  const fetchProducts = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await listCatalogProducts(true))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!canView) return
    void fetchProducts()
    void listProducts().then(setInvProducts).catch(() => {})
    void listCategories().then(setCategories).catch(() => {})
  }, [canView, fetchProducts])

  function openCreate() {
    setSheetMode("create")
    setEditing(undefined)
    setSheetOpen(true)
  }

  function openEdit(p: CatalogProduct) {
    setSheetMode("edit")
    setEditing(p)
    setSheetOpen(true)
  }

  async function handleDelete(p: CatalogProduct) {
    if (!(await confirm({ title: `¿Eliminar el producto "${p.name}"?`, destructive: true }))) return
    try {
      await deleteCatalogProduct(p._id)
      void fetchProducts()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  // ── Sin permiso ──────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <>
        <PageHeader
          section="Operación"
          title="Productos"
          description="Catálogo de productos vendibles para el punto de venta."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <ShieldOff className="size-10 text-muted-foreground" />
            <p className="font-display text-lg text-foreground">Sin acceso</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No tienes permiso para ver los productos. Contacta al
              administrador del sistema.
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.categoryId?.name ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <>
      <PageHeader
        section="Operación"
        title="Productos"
        description="Catálogo de productos vendibles para el punto de venta."
        actions={
          canManage ? (
            <Button onClick={openCreate} data-tour="productos-nuevo">
              <Plus />
              Nuevo producto
            </Button>
          ) : undefined
        }
      />

      <Card data-tour="productos-tabla">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Productos</CardTitle>
            <CardDescription>
              {products.length} producto(s) en el catálogo
            </CardDescription>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o categoría…"
            className="sm:w-72"
            data-tour="productos-buscar"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton cols={6} />
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Package className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? isRetail
                    ? "Aún no hay productos. Crea el primero (con su código de barras) para escanearlo en el POS."
                    : "Aún no hay productos. Crea el primero para venderlo en el POS."
                  : "Ningún producto coincide con la búsqueda."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  {!isRetail && <TableHead>Origen</TableHead>}
                  <TableHead>Composición</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const linked =
                    typeof p.inventoryProductId === "object"
                      ? p.inventoryProductId
                      : null
                  return (
                    <TableRow
                      key={p._id}
                      className={cn(!p.active && "opacity-55")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {/* Miniatura: se reconoce el producto de un vistazo,
                              sin gastar una columna entera en ello. */}
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt=""
                              loading="lazy"
                              className="size-10 shrink-0 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                              <ImageOff className="size-4" aria-hidden />
                            </div>
                          )}
                          <div className="flex min-w-0 flex-col">
                            <span className="font-medium">
                              {p.name}
                              {!p.active && (
                                <Badge variant="outline" className="ml-2">
                                  Inactivo
                                </Badge>
                              )}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {p.sku}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.categoryId?.name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {!isRetail && (
                        <TableCell>
                          <SourceBadge type={p.sourceType} />
                        </TableCell>
                      )}
                      <TableCell className="max-w-64 text-sm text-muted-foreground">
                        {p.sourceType === "inventory" ? (
                          linked ? (
                            <span>
                              {linked.name}
                              {p.qtyPerUnit && p.qtyPerUnit !== 1
                                ? ` · ${nf.format(p.qtyPerUnit)} ${linked.unit}`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-destructive">
                              Ítem no disponible
                            </span>
                          )
                        ) : (
                          <span>
                            {p.recipe.length} ingrediente(s):{" "}
                            {p.recipe
                              .map((l) =>
                                typeof l.productId === "object"
                                  ? l.productId.name
                                  : "—",
                              )
                              .join(", ")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {money.format(p.salePrice)}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Editar"
                              title="Editar"
                              onClick={() => openEdit(p)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Eliminar"
                              title="Eliminar"
                              onClick={() => handleDelete(p)}
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

      <ProductSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        product={editing}
        invProducts={invProducts}
        categories={categories}
        onSuccess={fetchProducts}
        isRetail={isRetail}
      />
    </>
  )
}
