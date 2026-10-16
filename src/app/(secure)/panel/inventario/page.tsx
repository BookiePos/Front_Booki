"use client"

import * as React from "react"
import Image from "next/image"
import { SearchParamSync } from "@/components/erp/search-param-sync"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  ShieldOff,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  CalendarClock,
  TriangleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Download,
  Upload,
  Search,
  Loader2,
  Boxes as BoxesIcon,
  Package,
  TrendingUp,
  ClipboardList,
  ScanSearch,
  Wrench,
  GitMerge,
  ShoppingBag,
  ImageOff,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  listSedes,
  listProducts,
  deleteProduct,
  listCategories,
  getStock,
  getAlerts,
  getMovements,
  adoptPackaging,
  ADJUST_REASON_LABELS,
  ITEM_TYPE_LABELS,
  type Sede,
  type InvProduct,
  type InvCategory,
  type StockRow,
  type InvAlerts,
  type MovementsPage,
  type AdjustReason,
} from "@/lib/erp/api-inventory"
import { presentacionDeCompra } from "@/lib/erp/purchase-unit"
import { unidadCorta, unidadNombre } from "@/lib/erp/unidades"
import { toast } from "sonner"
import { TrazabilidadDialog } from "@/components/erp/trazabilidad-dialog"
import { ReporteMermaDialog } from "@/components/erp/reporte-merma-dialog"
import { MergeProductDialog } from "./merge-product-dialog"
import { listSuppliers, type Supplier } from "@/lib/erp/api-suppliers"
import { downloadCsv } from "@/lib/erp/csv"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Segmented } from "@/components/ui/segmented"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { nf, money, dtf, errorMessage } from "@/components/inventario/helpers"
import {
  productsToCsv,
  stockToCsv,
} from "@/components/inventario/csv-inventario"
import {
  ExpiryBadge,
  MovementBadge,
  TableSkeleton,
  productItems,
  sedeItems,
} from "@/components/inventario/ui-comunes"
import { ProductSheet } from "@/components/inventario/product-sheet"
import { EntrySheet } from "@/components/inventario/entry-sheet"
import { AdjustSheet } from "@/components/inventario/adjust-sheet"
import { TransferSheet } from "@/components/inventario/transfer-sheet"
import { ExpandedLots } from "@/components/inventario/expanded-lots"
import { CategoriesSheet } from "@/components/inventario/categories-sheet"
import { LotsPanel } from "@/components/inventario/lots-panel"
import {
  Tab,
  TAB_INFO,
  HerramientaItem,
  VacioConSalida,
} from "@/components/inventario/pestanas"
import { VariantsSheet } from "@/components/inventario/variants-sheet"
import { ActualizarPreciosDialog } from "@/components/inventario/precios-dialog"
import { ConteoFisicoDialog } from "@/components/inventario/conteo-dialog"
import { ImportProductsSheet } from "@/components/inventario/import-products-sheet"
import { StockImportSheet } from "@/components/inventario/stock-import-sheet"

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
  /** Buscando entre los insumos los que ya se usan de empaque en alguna ficha. */
  const [adoptando, setAdoptando] = React.useState(false)
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
  /** Producto que se queda al fusionar duplicados (null = diálogo cerrado). */
  const [mergeTarget, setMergeTarget] = React.useState<InvProduct | null>(null)
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
    void getStock()
      .then(setAllStock)
      .catch(() => {})
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
    void listSedes()
      .then(setSedes)
      .catch(() => {})
    void listCategories()
      .then(setCategories)
      .catch(() => {})
    void listSuppliers()
      .then(setSuppliersList)
      .catch(() => {})
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

  /** Coincide con lo que se está buscando en la barra de arriba. */
  function coincideBusqueda(p: InvProduct): boolean {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      (p.categoryId?.name ?? "").toLowerCase().includes(q)
    )
  }

  // Las dos secciones se reparten la MISMA lista: los empaques salen de
  // "Insumos y mercancía" y viven en la suya. Se reparte aquí, en el cliente, y
  // no con dos llamadas al backend, porque el resto de la pantalla (existencias,
  // lotes, kardex, conteo) los sigue necesitando juntos: un empaque se cuenta y
  // se merma como cualquier otra cosa.
  const filteredProducts = products.filter(
    (p) => !p.isPackaging && coincideBusqueda(p),
  )
  const filteredPackaging = products.filter(
    (p) => p.isPackaging && coincideBusqueda(p),
  )

  const alertCount =
    (alerts?.lowStock.length ?? 0) +
    (alerts?.expired.length ?? 0) +
    (alerts?.expiringSoon.length ?? 0)

  /**
   * Trae a Empaques los insumos que ya figuran como empaque en la ficha de
   * algún producto vendible. Idempotente: volver a pulsarlo no hace daño.
   */
  async function handleAdoptPackaging() {
    setAdoptando(true)
    try {
      const { marcados } = await adoptPackaging()
      await fetchProducts()
      toast.success(
        marcados === 0
          ? "No se encontró ninguno por marcar"
          : `${marcados} empaque(s) traídos aquí`,
        {
          description:
            marcados === 0
              ? "No hay insumos que ya figuren como empaque en la ficha de un producto."
              : "Estaban entre tus insumos porque alguna ficha de producto ya los usaba de empaque.",
        },
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setAdoptando(false)
    }
  }

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
      <SearchParamSync onValue={setSearch} />
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
              value: "empaques",
              label: TAB_INFO.empaques.label,
              icon: ShoppingBag,
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
                                aria-label={`Fusionar otros productos en ${p.name}`}
                                title="Fusionar duplicados en este producto"
                                onClick={() => setMergeTarget(p)}
                              >
                                <GitMerge />
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

      {/* ── Tab: Empaques ──
          Rejilla con foto y no tabla, a propósito: la gracia de esta sección es
          reconocer la bolsa de un vistazo, y en una tabla de texto una bolsa
          kraft de 22 y una de 25 son dos renglones idénticos. */}
      {tab === "empaques" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Empaques</CardTitle>
              <CardDescription>
                {filteredPackaging.length} empaque(s) · se gastan al vender, y
                en la caja se elige con cuáles sale cada pedido
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empaque…"
                className="w-56"
              />
              {/* Para quien ya venía configurando "cada galleta gasta una
                  bolsa" antes de que los empaques tuvieran sección propia: esas
                  bolsas están registradas, revueltas entre los insumos, y nadie
                  se acuerda de cuáles eran. Va en la cabecera y no solo en el
                  estado vacío porque en el estado vacío dejaría de alcanzarse
                  en cuanto se registre el primer empaque a mano, que es justo
                  cuando todavía faltan los demás. */}
              {canAdjust && (
                <Button
                  variant="outline"
                  disabled={adoptando}
                  onClick={() => void handleAdoptPackaging()}
                >
                  {adoptando ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  Buscar los que ya uso
                </Button>
              )}
              {canAdjust && (
                <Button
                  onClick={() => {
                    setProductSheetMode("create")
                    setEditingProduct(undefined)
                    setProductSheetOpen(true)
                  }}
                >
                  <Plus />
                  Nuevo empaque
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <TableSkeleton cols={4} />
            ) : productsError ? (
              <p className="text-sm text-destructive">{productsError}</p>
            ) : filteredPackaging.length === 0 ? (
              filteredPackaging.length === 0 && search.trim() ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Ningún empaque coincide con “{search.trim()}”.
                </p>
              ) : (
                <VacioConSalida
                  icon={ShoppingBag}
                  titulo="Todavía no has registrado empaques"
                  frase="Aquí van las bolsas, los vasos, las cajas y los cubiertos, con su foto. Se compran y se cuentan como todo lo demás, pero se gastan al vender: en la caja se elige con cuáles sale cada pedido. Si ya tenías bolsas puestas en las fichas de tus productos, “Buscar los que ya uso” las trae aquí."
                  accion={
                    canAdjust
                      ? {
                          texto: "Registrar mi primer empaque",
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
              )
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredPackaging.map((p) => (
                  <div
                    key={p._id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border border-border bg-card",
                      !p.active && "opacity-60",
                    )}
                  >
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        width={240} height={240} sizes="(min-width: 1024px) 220px, 45vw"
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full border-b border-border object-cover"
                      />
                    ) : (
                      <span
                        className="flex aspect-square w-full items-center justify-center border-b border-dashed border-border text-muted-foreground"
                        aria-hidden
                      >
                        <ImageOff className="size-7" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
                      <p className="line-clamp-2 text-sm leading-snug font-medium text-balance">
                        {p.name}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {p.sku}
                      </p>
                      <p className="mt-auto pt-1 text-xs text-muted-foreground">
                        {p.cost > 0
                          ? `${money.format(p.cost)} / ${unidadCorta(p.unit)}`
                          : "Sin costo todavía"}
                      </p>
                      {!p.active && (
                        <Badge variant="outline" className="self-start">
                          Inactivo
                        </Badge>
                      )}
                      {canAdjust && (
                        <div className="flex items-center gap-1 pt-1">
                          <Button
                            variant="outline"
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
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Registrar entrada de ${p.name}`}
                            onClick={() =>
                              openOperation(setEntryOpen, { productId: p._id })
                            }
                          >
                            <PackagePlus />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            aria-label={`Eliminar ${p.name}`}
                            onClick={() => void handleDelete(p)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                            m.delta < 0
                              ? "text-destructive"
                              : "text-success-ink",
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
        defaultPackaging={tab === "empaques"}
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
      <MergeProductDialog
        key={mergeTarget?._id ?? "cerrado"}
        target={mergeTarget}
        products={products}
        stock={allStock}
        onOpenChange={(open) => {
          if (!open) setMergeTarget(null)
        }}
        onMerged={() => {
          setMergeTarget(null)
          refreshAfterOperation()
        }}
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
