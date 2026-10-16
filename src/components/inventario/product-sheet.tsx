"use client"

import * as React from "react"
import {
  PackagePlus,
  Boxes,
  TriangleAlert,
  Loader2,
  Package,
} from "lucide-react"
import { ApiError } from "@/lib/api"
import {
  listProducts,
  createProduct,
  updateProduct,
  uploadProductImage,
  deleteProductImage,
  type ItemType,
  type InvProduct,
  type InvCategory,
} from "@/lib/erp/api-inventory"
import { describirContenido } from "@/lib/erp/purchase-unit"
import { unidad, unidadCorta, unidadNombre } from "@/lib/erp/unidades"
import { SKU_ERROR, skuValido } from "@/lib/erp/sku"
import {
  PresentacionCompraPicker,
  UnidadSelect,
} from "@/components/erp/unidad-fields"
import { toast } from "sonner"
import { ProductImageField } from "@/components/erp/product-image-field"
import { type Supplier } from "@/lib/erp/api-suppliers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import { FormDialog, FormSection, FormAlert } from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
  CheckboxField,
} from "@/components/ui/field"
import { Segmented } from "@/components/ui/segmented"
import {
  PRODUCT_FORM_ID,
  normalizeName,
  errorMessage,
} from "@/components/inventario/helpers"
import {
  initialSupplierSel,
  SupplierSelect,
  localDateStr,
  FormError,
} from "@/components/inventario/ui-comunes"

// ─── Product sheet ───────────────────────────────────────────────────────────

export interface ProductSheetProps {
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
  /** Al crear desde la sección de Empaques, la ficha nace marcada como empaque. */
  defaultPackaging?: boolean
}

export function ProductSheet({
  open,
  onOpenChange,
  mode,
  product,
  products,
  categories,
  suppliers,
  onSuccess,
  onRegisterEntry,
  defaultPackaging = false,
}: ProductSheetProps) {
  const [sku, setSku] = React.useState("")
  const [itemType, setItemType] = React.useState<ItemType>("ingredient")
  /**
   * Es empaque: la bolsa, el vaso, la caja. No es un tipo más al lado de
   * "Producto" y "Montaje" sino una marca aparte, porque un empaque se compra,
   * se cuenta y se merma igual que cualquier insumo: lo único que cambia es en
   * qué sección se administra y que el POS puede ofrecerlo al cobrar.
   */
  const [isPackaging, setIsPackaging] = React.useState(false)
  /** Foto elegida y pendiente de subir (se sube al guardar la ficha). */
  const [imageFile, setImageFile] = React.useState<File | Blob | null>(null)
  /** El usuario quitó la foto que ya tenía guardada. */
  const [imageRemoved, setImageRemoved] = React.useState(false)
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
  const [purchaseFactor, setPurchaseFactor] = React.useState<number | null>(
    null,
  )
  const [barcode, setBarcode] = React.useState("")
  const [perishable, setPerishable] = React.useState(false)
  const [expiresAt, setExpiresAt] = React.useState("")
  const [minStock, setMinStock] = React.useState<number | null>(null)
  const [salePrice, setSalePrice] = React.useState<number | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** Producto existente confirmado por el backend (409) al intentar crear. */
  const [conflictProduct, setConflictProduct] =
    React.useState<InvProduct | null>(null)
  /**
   * Todos los productos, incluidos los inactivos. La lista de la página solo
   * trae los activos, pero el SKU no se puede repetir con ninguno: con un SKU
   * de un producto desactivado la ficha no avisaba nada y el guardado fallaba
   * con un error arriba del formulario, fuera de la vista.
   */
  const [allProducts, setAllProducts] = React.useState<InvProduct[] | null>(
    null,
  )

  // Detección en vivo de duplicados (solo al crear). El SKU exacto es la
  // señal fuerte; el nombre por prefijo de palabra es solo una pista.
  const skuNormalizado = sku.trim().toUpperCase()
  const skuClash =
    mode === "create" && skuNormalizado
      ? (allProducts ?? products).find((p) => p.sku === skuNormalizado)
      : undefined
  // El aviso va EN el campo, donde se está escribiendo: es lo primero que se
  // ve y explica por qué "Guardar" no se deja pulsar.
  const skuError = skuClash
    ? skuClash.active
      ? `Este SKU ya lo tiene "${skuClash.name}". Usa otro SKU.`
      : `Este SKU ya lo tiene "${skuClash.name}", que está inactivo. Usa otro SKU o reactiva ese producto.`
    : conflictProduct
      ? `Este SKU ya lo tiene "${conflictProduct.name}". Usa otro SKU.`
      : null
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
  // Registrar una entrada solo se ofrece para productos activos: uno inactivo
  // no aparece en el diálogo de entradas.
  const duplicate =
    conflictProduct ?? (skuClash?.active ? skuClash : undefined) ?? nameClash
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
      setImageFile(null)
      setImageRemoved(false)
      if (mode === "edit" && product) {
        setSku(product.sku)
        setItemType(product.itemType ?? "product")
        setIsPackaging(product.isPackaging ?? false)
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
        setSalePrice(product.salePrice ?? null)
      } else {
        setSku("")
        setItemType("ingredient")
        // Abrir la ficha desde la sección de Empaques ya la deja marcada: si
        // estás ahí, lo que vas a registrar es una bolsa.
        setIsPackaging(defaultPackaging)
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
        setSalePrice(null)
      }
      setError(null)
      setConflictProduct(null)
      if (mode === "create") {
        try {
          setAllProducts(await listProducts(true))
        } catch {
          // Sin la lista completa se compara con los activos; el backend
          // rechaza igual el SKU repetido.
          setAllProducts(null)
        }
      }
    }
    void reset()
  }, [open, mode, product, suppliers, defaultPackaging])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === "create" && !skuValido(sku)) {
      setError(SKU_ERROR)
      return
    }
    if (perishable && expiresAt && expiresAt < localDateStr(new Date())) {
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
        chosenSupplier?.name ?? (supplierSel === "legacy" ? legacySupplier : "")
      const payload = {
        sku,
        itemType,
        isPackaging,
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
        // `cost` NO viaja desde esta ficha, ni en alta ni en edición. Lo pone
        // la entrada de mercancía, con la factura delante. Mandarlo en la
        // edición era además peligroso: al no haber ya casilla, habría salido
        // un 0 que borraría el costo que las entradas llevaban construido.
        salePrice: isIngredient && salePrice ? salePrice : undefined,
      }
      let saved: InvProduct
      if (mode === "create") {
        saved = await createProduct({
          ...payload,
          categoryId: catId || undefined,
          expiresAt: payload.expiresAt || undefined,
        })
      } else if (product) {
        // En edición la cadena vacía sí viaja: significa quitar el proveedor.
        saved = await updateProduct(product._id, {
          ...payload,
          supplier: supplierText,
          supplierId: chosenSupplier?._id ?? "",
        })
      } else {
        return
      }
      // La foto va después de guardar: al crear, el producto todavía no tiene
      // id cuando se elige el archivo. Si la subida falla, la ficha YA está
      // guardada, así que se avisa y no se deshace nada: volver a entrar y
      // elegir la foto otra vez es mejor que perder lo escrito.
      try {
        if (imageFile) await uploadProductImage(saved._id, imageFile)
        else if (imageRemoved && product?.imageUrl)
          await deleteProductImage(saved._id)
      } catch (err) {
        toast.error("Se guardó la ficha, pero la foto no subió", {
          description: errorMessage(err),
        })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      // SKU repetido al crear: en vez del error crudo, ofrecer registrar
      // una entrada del producto existente.
      if (mode === "create" && err instanceof ApiError && err.status === 409) {
        // Otro usuario pudo crearlo mientras se llenaba la ficha: se recarga
        // la lista para que el aviso aparezca en el campo del SKU.
        const fresh = await listProducts(true).catch(
          () => allProducts ?? products,
        )
        setAllProducts(fresh)
        const clash = fresh.find((p) => p.sku === sku.trim().toUpperCase())
        if (clash) {
          if (clash.active) setConflictProduct(clash)
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
          {/* La marca de empaque va aquí y no como un tipo más arriba porque no
              es otra clase de cosa: una bolsa se compra, se cuenta y se merma
              igual que la harina. Lo que cambia es dónde se administra. */}
          <CheckboxField
            id="p-packaging"
            label="Es un empaque"
            hint="Bolsas, vasos, cajas, cubiertos. Se administran en “Empaques” y el POS los ofrece al cobrar."
            checked={isPackaging}
            onCheckedChange={setIsPackaging}
          />
        </FormSection>

        <FormSection
          title="Foto"
          description="Para reconocerlo de un vistazo. En los empaques es lo que se ve en la caja al cobrar."
        >
          <ProductImageField
            currentUrl={product?.imageUrl}
            file={imageFile}
            onPick={setImageFile}
            removed={imageRemoved}
            onRemovedChange={setImageRemoved}
            disabled={saving}
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
              hint="Numérico, mínimo 5 dígitos, y que no se repita."
              error={skuError}
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
            {/* Aquí YA NO se escribe el precio de compra, y quitarlo arregló un
                descuadre de plata de verdad.

                Lo que pasaba: en esta ficha se escribía un costo —muchas veces
                a ojo, porque al dar de alta el insumo todavía no se tiene la
                factura delante—. Después, al registrar la entrada de mercancía,
                el formulario traía ESE número ya escrito en la casilla del
                costo. Quien recibía una factura de $680 veía un $500 puesto de
                antemano, lo daba por bueno y guardaba: la mercancía entraba
                valorada a $500 y el valor del inventario nunca cuadraba con lo
                que se había pagado.

                El costo lo pone ahora la entrada, que es el único momento en
                que alguien tiene la factura en la mano. Ver `EntrySheet`. */}
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
