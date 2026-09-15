"use client"

import * as React from "react"
import {
  ShieldOff,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  CheckCircle2,
  MapPin,
  PackageX,
  Printer,
  AlertTriangle,
  FileText,
  ClipboardList,
  Check,
  Loader2,
  X,
  UserRound,
  Users,
  ChevronLeft,
  Lock,
  Coins,
  Info,
  Tag,
  HandCoins,
  CalendarClock,
  ImageOff,
  Layers,
  UserPlus,
  Package,
  Split,
  Truck,
  ReceiptText,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  posProducts,
  createSale,
  listOrders,
  pendingOf,
  pendingTotal,
  createOrder,
  updateOrder,
  checkoutOrder,
  voidOrder,
  listDiscounts,
  sugerirEmpaque,
  PAYMENT_METHOD_LABELS,
  type SugerenciaEmpaque,
  type PosProduct,
  type PaymentMethod,
  type Sale,
  type Order,
  type Customer,
  type Discount,
} from "@/lib/pos/api-sales"
import {
  getCurrentCaja,
  openCaja,
  type CajaSession,
} from "@/lib/pos/api-caja"
import {
  listCustomers,
  createCustomer,
  lookupEmployees,
  type Customer as RegCustomer,
  type EmployeeLookup,
} from "@/lib/pos/api-customers"
import { listPriceLists, type PriceList } from "@/lib/erp/api-catalog"
import { resolveUnitPrice } from "@/lib/erp/price-list"
import {
  listDeliveryZones,
  ORDER_TYPE_LABELS,
  type DeliveryZone,
  type OrderType,
} from "@/lib/pos/api-delivery"
import { createInvoiceFromSale } from "@/lib/pos/api-einvoicing"
import { money, qty as fmtQty } from "@/lib/pos/format"
import { Receipt } from "@/components/pos/receipt"
import { coincide, useBusquedaPendiente } from "@/lib/pos/busqueda"
import {
  listProducts as listInvItems,
  type InvProduct,
} from "@/lib/pos/api-inventory"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { MoneyInput, QuantityInput } from "@/components/ui/money-input"
import { Field, NativeSelect } from "@/components/ui/field"
import { FormDialog, FormActions } from "@/components/ui/form-dialog"
import { Termino } from "@/components/ui/help-tip"
import {
  CheckoutColumn,
  CheckoutGroup,
  OptionGroup,
  SummaryRow,
} from "@/components/pos/checkout-layout"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  VariantPicker,
  axesOf,
  axisLabel,
  sortVariants,
  variantLabel,
  type VariantGroup,
} from "@/components/pos/variant-picker"
import { cn } from "@/lib/utils"

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return "Error inesperado"
}

interface CartItem {
  product: PosProduct
  qty: number
  /** Descuento predefinido aplicado a esta línea (id del descuento de la sede). */
  discountId?: string
}

const ALL = "__all__"
const UNCAT = "__uncat__"
/** Umbral para avisar "pocas unidades": solo se muestra el stock si es menor. */
const LOW_STOCK = 10

/** Cantidades de una cuenta dividida: pueden salir fraccionarias al repartir. */
const nfCantidad = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 })

const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  credit: HandCoins,
}

type SaveState = "idle" | "saving" | "saved" | "error"

/**
 * Una casilla de la rejilla: o un producto suelto, o un grupo de variantes
 * (las tallas de una misma camisa) que se abre en el selector.
 */
type GridEntry =
  | { kind: "single"; product: PosProduct }
  | { kind: "group"; group: VariantGroup }

/**
 * Agrupa el catálogo para la rejilla: las variantes de un mismo producto (las
 * tallas de una camisa) se juntan en una sola entrada y el resto pasa tal cual.
 *
 * Sin esto, una tienda de ropa con diez modelos en cinco tallas veía cincuenta
 * tarjetas que solo se distinguen por la última letra del nombre.
 *
 * Va suelta y sin `useMemo`: el compilador de React memoriza la llamada solo, y
 * un memo escrito a mano que él no pueda preservar apagaría la optimización de
 * toda la pantalla.
 */
function buildGridEntries(filtered: PosProduct[]): GridEntry[] {
  const puestos = new Set<string>()
  return filtered.flatMap<GridEntry>((p) => {
    const groupId = p.variantGroupId
    if (!groupId) return [{ kind: "single", product: p }]
    // El grupo ocupa la posición de su primera variante; las demás ya están
    // dentro de esa tarjeta.
    if (puestos.has(groupId)) return []
    puestos.add(groupId)
    const variants = filtered.filter((v) => v.variantGroupId === groupId)
    // Un "grupo" de una sola variante no es un grupo: pedir talla cuando solo
    // hay una es un toque de más.
    return [
      variants.length === 1
        ? { kind: "single", product: variants[0] }
        : {
            kind: "group",
            group: {
              groupId,
              name: p.variantGroupName ?? p.name,
              variants,
            },
          },
    ]
  })
}


/** Convierte las líneas de una cuenta en ítems del carrito (usa el stock real
 * cuando el producto sigue vendible; si no, sintetiza uno mínimo). */
function orderToCart(order: Order, products: PosProduct[]): CartItem[] {
  return order.lines.map((l) => {
    const p = products.find((pp) => pp._id === l.productId)
    if (p) {
      return { product: { ...p, stock: Math.max(p.stock, l.qty) }, qty: l.qty }
    }
    return {
      product: {
        _id: l.productId,
        sku: l.sku,
        name: l.name,
        unit: l.unit,
        salePrice: l.unitPrice,
        stock: l.qty,
        categoryId: null,
        categoryName: null,
      },
      qty: l.qty,
    }
  })
}

/** Montos de efectivo sugeridos, mayores al total (para cobrar rápido). */
function cashSuggestions(total: number): number[] {
  if (total <= 0) return []
  const set = new Set<number>()
  for (const step of [1000, 5000, 10000, 20000, 50000]) {
    const up = Math.ceil(total / step) * step
    if (up > total) set.add(up)
  }
  for (const bill of [2000, 5000, 10000, 20000, 50000, 100000]) {
    if (bill > total) set.add(bill)
  }
  return [...set].sort((a, b) => a - b).slice(0, 4)
}

/**
 * "Consumidor final" es como la DIAN llama a quien compra sin dar sus datos, y
 * 222222222222 el documento que se usa para él. Con esto una venta de mostrador
 * puede salir con factura electrónica sin inventarse una cédula.
 */
const CONSUMIDOR_FINAL: Customer = {
  name: "Consumidor final",
  idNumber: "222222222222",
}

/** Valor del selector de vendedor cuando vende el mismo que cobra. */
const QUIEN_COBRA = "__quien_cobra__"

export default function VentaPage() {
  const { user, hasPermission, isRetail, isRestaurant } = useAuth()
  const canSell = hasPermission("pos.sell")
  // Elegir lista de precios a mano es decidir cobrar menos: mismo permiso que
  // aplicar un descuento. El backend lo vuelve a comprobar.
  const canDiscount = hasPermission("pos.discount.authorize")

  const { sedeId, sede, sedes, loading: sedesLoading } = useSede()
  const confirm = useConfirm()

  const [products, setProducts] = React.useState<PosProduct[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState<string>(ALL)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [flash, setFlash] = React.useState<string | null>(null)

  const [cart, setCart] = React.useState<CartItem[]>([])

  // Propina (restaurante): null = no hay; número = monto en pesos (editable).
  // Es voluntaria: se puede poner y quitar, con el 10% sugerido o un monto libre.
  const [tip, setTip] = React.useState<number | null>(null)

  // Descuentos predefinidos de la sede (activos), para aplicar por línea.
  const [discounts, setDiscounts] = React.useState<Discount[]>([])

  // Vista: lista de cuentas activas ('list') o pantalla de venta ('sell').
  /**
   * Arranca en "sell", no en "list".
   *
   * Antes el POS abría en la lista de cuentas y obligaba a elegir entre "venta
   * directa" y "nueva cuenta" ANTES de poder tocar un producto. El 90% de las
   * veces la respuesta es "una venta normal", así que esa decisión sobraba:
   * ahora entras vendiendo y las cuentas abiertas (mesas) quedan a un clic,
   * para cuando de verdad hacen falta.
   */
  const [screen, setScreen] = React.useState<"list" | "sell">("sell")

  // Caja: toda la operación ocurre dentro de un turno abierto.
  const [caja, setCaja] = React.useState<CajaSession | null>(null)
  const [cajaLoading, setCajaLoading] = React.useState(true)
  const [openingBills, setOpeningBills] = React.useState<number | null>(null)
  const [openingCoins, setOpeningCoins] = React.useState<number | null>(null)
  const [openingBusy, setOpeningBusy] = React.useState(false)
  const [openCajaError, setOpenCajaError] = React.useState<string | null>(null)

  // Cuentas abiertas
  const [orders, setOrders] = React.useState<Order[]>([])
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null)
  /**
   * Cómo se cobra una cuenta de mesa: entera, escogiendo ítems, o dividida en
   * partes iguales. Solo aplica cuando hay una cuenta abierta; una venta
   * directa se cobra siempre completa.
   */
  const [splitMode, setSplitMode] = React.useState<"todo" | "items" | "partes">(
    "todo",
  )
  const [splitParts, setSplitParts] = React.useState("2")
  const [splitQty, setSplitQty] = React.useState<Record<string, string>>({})
  // ── Domicilio ──────────────────────────────────────────────────────────────
  // Cómo sale el pedido y, si es domicilio, a dónde. El cobro del domicilio va
  // ENCIMA del total y sin IVA, igual que la propina.
  const [orderType, setOrderType] = React.useState<OrderType>("mostrador")
  const [zones, setZones] = React.useState<DeliveryZone[]>([])
  const [zoneId, setZoneId] = React.useState("")
  /** Valor a mano, para el pedido que no cae en ninguna zona. */
  const [manualFee, setManualFee] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [deliveryPhone, setDeliveryPhone] = React.useState("")
  const [deliveryNotes, setDeliveryNotes] = React.useState("")
  const [courier, setCourier] = React.useState("")
  const [label, setLabel] = React.useState("")
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const [orderBusy, setOrderBusy] = React.useState(false)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = React.useRef(false)
  // Diálogo "Nueva cuenta" (nombre personalizado)
  const [newOrderOpen, setNewOrderOpen] = React.useState(false)
  const [newOrderName, setNewOrderName] = React.useState("")
  const newOrderRef = React.useRef<HTMLInputElement>(null)

  // Cobro
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  /**
   * Con cuánto paga el cliente, en pesos. Número y no texto: en una casilla
   * numérica del navegador, "75.400" escrito con el punto de miles se puede
   * leer como 75,4 pesos, y entonces el sistema decía que no alcanzaba en vez
   * de dar la devuelta.
   */
  const [received, setReceived] = React.useState<number | null>(null)
  /** Vencimiento del fiado (YYYY-MM-DD). Vacío = vence hoy. */
  const [creditDue, setCreditDue] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null)
  const [completedSale, setCompletedSale] = React.useState<Sale | null>(null)
  // La ayuda de "configurar impresión" solo se muestra hasta la primera
  // impresión; luego se recuerda en el navegador y deja de aparecer.
  const [printConfigured, setPrintConfigured] = React.useState(false)
  // Datos del cliente (factura)
  const [showCustomer, setShowCustomer] = React.useState(false)
  const [customer, setCustomer] = React.useState<Customer>({})
  /**
   * A quién se le vende: al consumidor final (el cliente de paso, el caso de
   * casi siempre) o a un cliente registrado. Consumidor final es el punto de
   * partida de cada venta.
   */
  const [clienteModo, setClienteModo] = React.useState<"final" | "registrado">(
    "final",
  )
  /**
   * Quién vendió. No se reinicia entre ventas a propósito: durante el turno
   * suele ser la misma persona, y elegirla en cada cobro cansa.
   */
  const [sellerKey, setSellerKey] = React.useState(QUIEN_COBRA)
  /**
   * Con qué empaque sale esta venta.
   *
   * Lo que se marque aquí es lo que baja del inventario: el empaque de la ficha
   * del producto ya NO se descuenta por su cuenta (el cobro manda
   * `packagingExplicit`). Por eso la lista empieza con la sugerencia ya puesta
   * —lo que se usó la vez anterior con estos mismos productos, o lo que dicen
   * las fichas— y no vacía: si arrancara vacía, "no tocar nada" sería "sin
   * empaques" y las bolsas dejarían de descontarse el día del despliegue.
   */
  const [empaqueAbierto, setEmpaqueAbierto] = React.useState(false)
  const [empaques, setEmpaques] = React.useState<InvProduct[]>([])
  /** Cuánto de cada empaque, por id de ítem de inventario. */
  const [empaqueSel, setEmpaqueSel] = React.useState<Record<string, number>>({})
  const [sugerencia, setSugerencia] = React.useState<SugerenciaEmpaque | null>(
    null,
  )
  /**
   * Factura electrónica DIAN. Es un interruptor explícito en el cobro, no un
   * trámite aparte: si el cliente la pide, se marca aquí y sale con la venta.
   */
  const [emitInvoice, setEmitInvoice] = React.useState(false)
  /** Si además hay que dejarlo en el directorio de clientes para la próxima. */
  const [saveCustomer, setSaveCustomer] = React.useState(false)
  const [invoiceState, setInvoiceState] = React.useState<
    "idle" | "emitting" | "done" | "error"
  >("idle")
  const [invoiceNumber, setInvoiceNumber] = React.useState<string | null>(null)
  const [invoiceError, setInvoiceError] = React.useState<string | null>(null)
  // Deudor del fiado: cliente registrado (→ CxC) o empleado (→ nómina)
  const [debtorType, setDebtorType] = React.useState<"customer" | "employee">("customer")
  const [custId, setCustId] = React.useState("")
  const [empId, setEmpId] = React.useState("")
  const [regCustomers, setRegCustomers] = React.useState<RegCustomer[]>([])
  const [empList, setEmpList] = React.useState<EmployeeLookup[]>([])
  const [ncOpen, setNcOpen] = React.useState(false)
  const [ncName, setNcName] = React.useState("")
  const [ncDoc, setNcDoc] = React.useState("")
  const [ncPhone, setNcPhone] = React.useState("")
  const [ncBusy, setNcBusy] = React.useState(false)

  // Listas de precios: mayorista, distribuidor… El terminal las carga para
  // MOSTRAR el precio correcto mientras se arma el carrito; el que se cobra lo
  // resuelve el backend, que es la regla que protege la caja.
  const [priceLists, setPriceLists] = React.useState<PriceList[]>([])
  /** Lista elegida a mano, para el cliente de paso que se lleva una caja. */
  const [manualListId, setManualListId] = React.useState("")

  // Carga clientes/empleados/listas al abrir el cobro. Los clientes ya no se
  // piden solo en el fiado: la tienda que compra por cajas paga de contado, y
  // sin elegirla su lista no se aplicaría.
  // Los empleados se piden siempre y no solo en el fiado: son también la lista
  // de vendedores.
  React.useEffect(() => {
    if (!checkoutOpen) return
    void listCustomers().then(setRegCustomers).catch(() => setRegCustomers([]))
    void listPriceLists().then(setPriceLists).catch(() => setPriceLists([]))
    void lookupEmployees().then(setEmpList).catch(() => setEmpList([]))
  }, [checkoutOpen])

  /**
   * Al abrir el cobro: los empaques disponibles y con cuál suele salir esto.
   *
   * Las dos cosas se piden a la vez y en cada cobro —ya no "solo si abres la
   * sección"—, porque ahora la sugerencia tiene que estar puesta ANTES de que
   * nadie mire: es lo que se va a descontar si se cobra sin abrir nada.
   *
   * Si cualquiera de las dos falla, el cobro sigue: se queda sin sugerencia y
   * quien cobra elige a mano. Nunca al revés.
   */
  React.useEffect(() => {
    if (!checkoutOpen || !sedeId || cart.length === 0) return
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      const lines = cart.map((i) => ({ productId: i.product._id, qty: i.qty }))
      const [items, sug] = await Promise.all([
        listInvItems(false, true).catch(() => [] as InvProduct[]),
        sugerirEmpaque(sedeId!, lines).catch(() => null),
      ])
      if (!vivo) return
      setEmpaques(
        items
          .filter((i) => i.active)
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSugerencia(sug)
      if (sug) {
        const inicial: Record<string, number> = {}
        for (const l of sug.lineas) inicial[l.productId] = l.qty
        setEmpaqueSel(inicial)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
    // `cart` a propósito fuera: la sugerencia se calcula al ABRIR el cobro. Si
    // se recalculara con cada cambio del carrito pisaría lo que quien cobra
    // acabe de ajustar a mano, que es exactamente lo que no debe pasar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, sedeId])

  /**
   * Elige (o suelta, con "") el cliente registrado. Sus datos pasan a la venta
   * para que el recibo y la factura digan a quién se le vendió: antes se
   * escogía de la lista y la venta quedaba sin nombre.
   */
  function elegirCliente(id: string, lista: RegCustomer[] = regCustomers) {
    setCustId(id)
    if (!id) {
      setCustomer({})
      return
    }
    // Al elegir cliente manda su lista de precios: la de a mano dejaría de
    // tener sentido y confundiría.
    setManualListId("")
    const c = lista.find((x) => x._id === id)
    if (c) setCustomer({ name: c.name, idNumber: c.docNumber, phone: c.phone })
  }

  async function quickAddCustomer() {
    if (!ncName.trim() || !ncDoc.trim()) return
    setNcBusy(true)
    setCheckoutError(null)
    try {
      const created = await createCustomer({
        name: ncName.trim(),
        docNumber: ncDoc.trim(),
        phone: ncPhone.trim() || undefined,
      })
      setRegCustomers((prev) => [created, ...prev])
      elegirCliente(created._id, [created])
      setNcOpen(false)
      setNcName("")
      setNcDoc("")
      setNcPhone("")
    } catch (err) {
      setCheckoutError(errorMessage(err))
    } finally {
      setNcBusy(false)
    }
  }

  const fetchProducts = React.useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      setProducts(await posProducts(sedeId))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  // Zonas de domicilio de la sede. Se cargan con el catálogo porque el cajero
  // las necesita en el momento de cobrar, no puede esperar a que carguen.
  React.useEffect(() => {
    let vivo = true
    async function cargar() {
      await Promise.resolve()
      if (!vivo || !sedeId) return
      try {
        const z = await listDeliveryZones(sedeId)
        if (vivo) setZones(z)
      } catch {
        // Sin zonas todavía se puede cobrar el domicilio a mano.
        if (vivo) setZones([])
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [sedeId])

  const refreshOrders = React.useCallback(async () => {
    if (!sedeId) return
    try {
      setOrders(await listOrders(sedeId, "open"))
    } catch {
      /* silencioso: las cuentas son secundarias al catálogo */
    }
  }, [sedeId])

  const fetchDiscounts = React.useCallback(async () => {
    if (!sedeId) {
      setDiscounts([])
      return
    }
    try {
      setDiscounts((await listDiscounts(sedeId)).filter((d) => d.active))
    } catch {
      setDiscounts([])
    }
  }, [sedeId])

  const refreshCaja = React.useCallback(async () => {
    if (!sedeId) {
      setCajaLoading(false)
      return
    }
    setCajaLoading(true)
    try {
      const cur = await getCurrentCaja(sedeId)
      setCaja(cur.session)
    } catch {
      setCaja(null)
    } finally {
      setCajaLoading(false)
    }
  }, [sedeId])

  // Al cambiar de sede se reinicia todo (cuenta, catálogo y cuentas abiertas).
  React.useEffect(() => {
    if (!canSell) return
    setCart([])
    setTip(null)
    setActiveOrderId(null)
    setLabel("")
    setSaveState("idle")
    setCategory(ALL)
    // A vender, no a la lista de cuentas: este efecto también corre al montar,
    // así que aquí es donde de verdad se decide con qué pantalla abre el POS.
    setScreen("sell")
    void fetchProducts()
    void refreshOrders()
    void refreshCaja()
    void fetchDiscounts()
  }, [canSell, fetchProducts, refreshOrders, refreshCaja, fetchDiscounts])

  async function handleOpenCaja() {
    if (!sedeId) return
    if (openingBills === null && openingCoins === null) {
      setOpenCajaError("Cuenta el efectivo base para abrir la caja")
      return
    }
    const base = (openingBills ?? 0) + (openingCoins ?? 0)
    setOpeningBusy(true)
    setOpenCajaError(null)
    try {
      const session = await openCaja(sedeId, base, undefined, {
        bills: openingBills ?? undefined,
        coins: openingCoins ?? undefined,
      })
      setCaja(session)
      setOpeningBills(null)
      setOpeningCoins(null)
      // El botón dice "Abrir caja y vender": cae directo en la pantalla de
      // venta, sin pasar por una lista de cuentas que además está vacía.
      setScreen("sell")
      void refreshOrders()
    } catch (err) {
      setOpenCajaError(errorMessage(err))
    } finally {
      setOpeningBusy(false)
    }
  }

  // Recuerda si ya se configuró la impresión (para ocultar la ayuda inicial).
  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem("pos.printConfigured") === "1"
    ) {
      setPrintConfigured(true)
    }
  }, [])

  // Imprime el recibo. La primera vez marca la impresión como configurada,
  // así la ayuda inicial deja de aparecer en las siguientes ventas.
  function handlePrintReceipt() {
    window.print()
    if (!printConfigured) {
      setPrintConfigured(true)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pos.printConfigured", "1")
      }
    }
  }

  // Mensaje efímero al agregar por escáner/SKU.
  React.useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1600)
    return () => clearTimeout(t)
  }, [flash])

  // Retail: el POS se opera con escáner. Mantén el foco en el buscador al
  // entrar y tras cada cobro (al cerrarse el modal), para escanear-escanear-
  // cobrar sin tocar el mouse. En restaurante no se fuerza el foco.
  React.useEffect(() => {
    if (!isRetail) return
    if (screen !== "sell" || checkoutOpen) return
    if (loading || cajaLoading || !caja) return
    const t = setTimeout(() => searchRef.current?.focus(), 40)
    return () => clearTimeout(t)
  }, [isRetail, screen, checkoutOpen, loading, cajaLoading, caja])

  // ── Auto-guardado de la cuenta activa (líneas + etiqueta) ──
  React.useEffect(() => {
    if (!activeOrderId) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState("saving")
    const id = activeOrderId
    const payload = {
      label: label.trim() || undefined,
      lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
    }
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null
      try {
        const updated = await updateOrder(id, payload)
        setOrders((prev) =>
          prev.map((o) => (o._id === updated._id ? updated : o)),
        )
        setSaveState("saved")
      } catch {
        setSaveState("error")
      }
    }, 700)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [cart, label, activeOrderId])

  /** Persiste de inmediato la cuenta activa (antes de cambiar de contexto). */
  const flushSave = React.useCallback(async () => {
    if (!activeOrderId) return
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    try {
      await updateOrder(activeOrderId, {
        label: label.trim() || undefined,
        lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
      })
    } catch {
      /* se reintenta en el próximo cambio */
    }
  }, [activeOrderId, label, cart])

  const stockSummary = React.useMemo(() => {
    let out = 0
    let low = 0
    for (const p of products) {
      if (p.stock <= 0) out++
      else if (p.stock < LOW_STOCK) low++
    }
    return { out, low }
  }, [products])

  const categories = React.useMemo(() => {
    const map = new Map<string, string>()
    let hasUncat = false
    for (const p of products) {
      if (p.categoryId && p.categoryName) map.set(p.categoryId, p.categoryName)
      else hasUncat = true
    }
    const list = [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (hasUncat) list.push({ id: UNCAT, name: "Otros" })
    return list
  }, [products])

  function addToCart(p: PosProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product._id === p._id)
      if (existing) {
        if (existing.qty >= p.stock) return prev
        return prev.map((i) =>
          i.product._id === p._id ? { ...i, qty: i.qty + 1 } : i,
        )
      }
      return [...prev, { product: p, qty: 1 }]
    })
  }

  function setQty(productId: string, next: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product._id !== productId) return i
          const clamped = Math.max(0, Math.min(next, i.product.stock))
          return { ...i, qty: clamped }
        })
        .filter((i) => i.qty > 0),
    )
  }

  function changeQty(productId: string, delta: number) {
    const item = cart.find((i) => i.product._id === productId)
    if (item) setQty(productId, item.qty + delta)
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product._id !== productId))
  }

  /** Aplica (o quita, con null) un descuento a una línea del carrito. */
  function setLineDiscount(productId: string, discountId: string | null) {
    setCart((prev) =>
      prev.map((i) =>
        i.product._id === productId
          ? { ...i, discountId: discountId ?? undefined }
          : i,
      ),
    )
  }

  function clearCart() {
    setCart([])
    setTip(null)
  }

  // ── Gestión de cuentas ──
  /** Entra a la venta directa (cobro inmediato, sin cuenta). */
  async function selectDirect() {
    await flushSave()
    setSplitMode("todo")
    setSplitQty({})
    setActiveOrderId(null)
    setLabel("")
    setSaveState("idle")
    setCart([])
    setTip(null)
    setScreen("sell")
  }

  async function selectOrder(o: Order) {
    await flushSave()
    skipSave.current = true
    // La forma de dividir es de la mesa que se estaba cobrando, no de esta.
    setSplitMode("todo")
    setSplitQty({})
    setActiveOrderId(o._id)
    setLabel(o.label ?? "")
    setCart(orderToCart(o, products))
    setTip(null)
    setSaveState("saved")
    setScreen("sell")
  }

  /** Vuelve al listado de cuentas activas (guardando la cuenta abierta). */
  async function backToList() {
    await flushSave()
    setActiveOrderId(null)
    setLabel("")
    setSaveState("idle")
    setCart([])
    setTip(null)
    setScreen("list")
    void refreshOrders()
  }

  async function newOrder(name: string) {
    if (!sedeId) return
    const trimmed = name.trim()
    setOrderBusy(true)
    try {
      await flushSave()
      const created = await createOrder({
        sedeId,
        label: trimmed || undefined,
      })
      setOrders((prev) => [created, ...prev])
      skipSave.current = true
      setActiveOrderId(created._id)
      setLabel(created.label ?? "")
      setCart([])
      setSaveState("saved")
      setNewOrderOpen(false)
      setNewOrderName("")
      setScreen("sell")
    } catch (err) {
      setFlash(errorMessage(err))
    } finally {
      setOrderBusy(false)
    }
  }

  // Enfoca el campo al abrir el diálogo de nueva cuenta.
  React.useEffect(() => {
    if (newOrderOpen) {
      const t = setTimeout(() => newOrderRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [newOrderOpen])

  /** Convierte el carrito actual (venta directa) en una cuenta abierta. */
  async function saveAsOrder() {
    if (!sedeId || cart.length === 0) return
    setOrderBusy(true)
    try {
      const created = await createOrder({
        sedeId,
        lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
      })
      setOrders((prev) => [created, ...prev])
      skipSave.current = true
      setActiveOrderId(created._id)
      setLabel(created.label ?? "")
      setSaveState("saved")
    } catch (err) {
      setFlash(errorMessage(err))
    } finally {
      setOrderBusy(false)
    }
  }

  async function closeActiveOrder() {
    if (!activeOrderId) return
    const ok = await confirm(
      cart.length === 0
        ? { title: "¿Cerrar esta cuenta vacía?", destructive: true }
        : {
            title: "¿Cerrar esta cuenta sin cobrar?",
            description: "Se descartarán sus ítems.",
            destructive: true,
          },
    )
    if (!ok) return
    setOrderBusy(true)
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      await voidOrder(activeOrderId)
      setOrders((prev) => prev.filter((o) => o._id !== activeOrderId))
      setActiveOrderId(null)
      setLabel("")
      setSaveState("idle")
      setCart([])
      setScreen("list")
    } catch (err) {
      setFlash(errorMessage(err))
    } finally {
      setOrderBusy(false)
    }
  }

  // Escáner de código de barras / SKU: al presionar Enter agrega la coincidencia.
  function handleScan() {
    const q = search.trim().toLowerCase()
    if (!q) return
    const exact = products.find(
      (p) =>
        p.sku.toLowerCase() === q ||
        (p.barcode ?? "").toLowerCase() === q,
    )
    const target = exact ?? (filtered.length === 1 ? filtered[0] : null)
    if (!target) {
      setFlash("Sin coincidencia exacta")
      return
    }
    if (target.stock <= 0) {
      setFlash(`${target.name} está agotado`)
      return
    }
    addToCart(target)
    setFlash(`Agregado: ${target.name}`)
    setSearch("")
    searchRef.current?.focus()
  }

  /**
   * Lista con la que se está cobrando este carrito.
   *
   * Manda la del cliente registrado que se eligió: ya estaba pactada y no la
   * decide el cajero. La elegida a mano es para el cliente de paso que se
   * lleva una caja, y por eso pide permiso de descuentos.
   *
   * Una lista desactivada no aparece en `priceLists`, así que deja de
   * aplicarse sola — igual que en el backend.
   */
  const listaActiva = React.useMemo(() => {
    const cliente = custId
      ? regCustomers.find((c) => c._id === custId)
      : undefined
    const id = cliente?.priceListId || manualListId
    if (!id) return null
    return priceLists.find((l) => l._id === id) ?? null
  }, [custId, regCustomers, manualListId, priceLists])

  /**
   * Precio unitario de una línea, ya con la lista aplicada.
   *
   * Depende de la CANTIDAD porque el precio por cantidad es un escalón:
   * llevando 12 gaseosas el precio baja, llevando 5 no.
   */
  const unitPrice = React.useCallback(
    (item: CartItem): number =>
      resolveUnitPrice({
        basePrice: item.product.salePrice,
        qty: item.qty,
        catalogProductId: item.product._id,
        list: listaActiva,
      }),
    [listaActiva],
  )

  const discountById = React.useMemo(
    () => new Map(discounts.map((d) => [d._id, d])),
    [discounts],
  )

  /** Descuento en pesos de una línea (0 si no tiene o si ya no existe). */
  const lineDiscount = React.useCallback(
    (item: CartItem): number => {
      const d = item.discountId ? discountById.get(item.discountId) : undefined
      if (!d) return 0
      // Sobre el precio ya con lista: el descuento se aplica encima de lo
      // pactado, no encima del de mostrador.
      const gross = item.qty * unitPrice(item)
      const raw =
        d.type === "percent" ? (gross * Math.min(d.value, 100)) / 100 : d.value
      return Math.round(Math.min(Math.max(raw, 0), gross) * 100) / 100
    },
    [discountById, unitPrice],
  )

  // Total = suma de líneas ya netas de su descuento (el descuento de venta se
  // aplica encima, en el cobro).
  const total = cart.reduce(
    (sum, i) => sum + i.qty * unitPrice(i) - lineDiscount(i),
    0,
  )
  const lineDiscountTotal = cart.reduce((s, i) => s + lineDiscount(i), 0)
  const itemCount = cart.reduce((s, i) => s + i.qty, 0)
  // Se mira el carrito y no el catálogo entero: un negocio puede tener foto en
  // la mitad de sus productos y en este pedido no haber ninguna.
  const cartShowImages = cart.some((i) => i.product.imageUrl)

  // Propina en pesos (0 si no hay). El 10% se sugiere sobre el total de bienes.
  const tipAmount = tip ?? 0
  const suggestedTip = Math.round(total * 0.1)

  const filtered = React.useMemo(() => {
    return products.filter((p) => {
      const inCat =
        category === ALL ||
        (category === UNCAT ? !p.categoryId : p.categoryId === category)
      if (!inCat) return false
      // Por palabras y sin tildes: "galleta chocolate" tiene que encontrar
      // "Galleta de chocolate". Con la frase entera no aparecía nada.
      return coincide(
        search,
        p.name,
        p.sku,
        p.barcode,
        p.categoryName,
        p.variantGroupName,
      )
    })
  }, [products, search, category])

  /**
   * La rejilla enseña fotos solo si al menos un producto a la vista tiene una.
   * Un negocio que no las usa conserva la rejilla compacta —más productos por
   * pantalla, que en caja es lo que importa— y uno que sí las usa no acaba con
   * unas tarjetas altas y otras bajas en la misma fila.
   */
  const showImages = filtered.some((p) => p.imageUrl)

  /**
   * La rejilla, ya agrupada: las variantes de un mismo producto (las tallas de
   * una camisa) se juntan en una sola entrada y el resto pasa tal cual.
   *
   * Sin esto, una tienda de ropa con diez modelos en cinco tallas veía
   * cincuenta tarjetas que solo se distinguen por la última letra del nombre.
   * El grupo conserva la posición del primer miembro, así que el catálogo sigue
   * saliendo en orden alfabético.
   */
  /** Unidades ya en la cuenta, por vendible. Lo lee el selector de talla. */
  const cartQtyById = React.useMemo(
    () => new Map(cart.map((i) => [i.product._id, i.qty])),
    [cart],
  )

  const gridEntries = buildGridEntries(filtered)

  /** Grupo de variantes abierto en el selector de talla (null = cerrado). */
  const [pickerGroup, setPickerGroup] = React.useState<VariantGroup | null>(
    null,
  )

  function openCheckout() {
    setMethod("cash")
    setReceived(null)
    setCreditDue("")
    setShowCustomer(false)
    // El cliente elegido se conserva —ya decide los precios del carrito— y
    // sus datos se vuelven a copiar, para que no quede elegido y sin nombre.
    const elegido = regCustomers.find((c) => c._id === custId)
    setCustomer(
      elegido
        ? { name: elegido.name, idNumber: elegido.docNumber, phone: elegido.phone }
        : {},
    )
    setClienteModo(custId ? "registrado" : "final")
    setNcOpen(false)
    setCheckoutError(null)
    setCompletedSale(null)
    // Cada cobro arranca limpio: si la venta anterior se facturó, esta no
    // hereda ni el interruptor ni el resultado de aquella.
    setEmitInvoice(false)
    setSaveCustomer(false)
    setInvoiceState("idle")
    setInvoiceNumber(null)
    setInvoiceError(null)
    setCheckoutOpen(true)
  }

  // El fiado exige identificar al cliente: abre esa sección automáticamente.
  React.useEffect(() => {
    if (method === "credit") setShowCustomer(true)
  }, [method])

  // Ojo: `activeOrder` se declara aquí porque de él salen los totales; más
  // abajo ya no se vuelve a declarar.
  const activeOrder = React.useMemo(
    () => orders.find((o) => o._id === activeOrderId) ?? null,
    [orders, activeOrderId],
  )

  /** Lo que ya pagaron de esta cuenta, para no volverlo a cobrar. */
  const pagadoAntes = React.useMemo(
    () =>
      (activeOrder?.lines ?? []).reduce(
        (s, l) => s + (l.paidQty ?? 0) * l.unitPrice,
        0,
      ),
    [activeOrder],
  )

  /** Lo que falta por cobrar de la cuenta, por producto. */
  const pendiente = React.useMemo(
    () => (activeOrder ? pendingOf(activeOrder) : new Map<string, number>()),
    [activeOrder],
  )

  /** Precio con el que quedó cada ítem en la comanda cuando se pidió. */
  const precioComanda = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const l of activeOrder?.lines ?? []) m.set(l.productId, l.unitPrice)
    return m
  }, [activeOrder])

  /**
   * Lo que se cobra en ESTE pago. `undefined` significa "todo lo que falte",
   * que es el cobro de siempre y también el último de una cuenta dividida —
   * así lo que no se repartió exacto lo absorbe quien paga de último en vez de
   * quedar un pedazo colgando.
   */
  const splitLines = React.useMemo(() => {
    if (!activeOrder || splitMode === "todo") return undefined

    if (splitMode === "partes") {
      const n = Number(splitParts)
      // Entre uno no se divide nada: se cobra todo lo que falta.
      if (!Number.isFinite(n) || n <= 1) return undefined
      const out: { productId: string; qty: number }[] = []
      for (const [productId, qty] of pendiente) {
        const parte = Math.floor((qty / n) * 1000) / 1000
        if (parte > 0.0005) out.push({ productId, qty: parte })
      }
      return out.length > 0 ? out : undefined
    }

    const out: { productId: string; qty: number }[] = []
    for (const [productId, qty] of pendiente) {
      const texto = splitQty[productId] ?? ""
      const n = Number(texto)
      if (texto.trim() === "" || !Number.isFinite(n) || n <= 0) continue
      out.push({ productId, qty: Math.min(n, qty) })
    }
    return out.length > 0 ? out : undefined
  }, [activeOrder, splitMode, splitParts, splitQty, pendiente])

  /**
   * Cuánto se cobra ahora, antes de la propina.
   *
   * En una cuenta de mesa siempre es lo que FALTA —no el total de la comanda—
   * porque puede que ya hayan pagado una parte. El precio sale de la comanda,
   * que es el que se pactó al pedir.
   */
  const chargeTotal = activeOrder
    ? splitLines
      ? splitLines.reduce(
          (s, l) => s + l.qty * (precioComanda.get(l.productId) ?? 0),
          0,
        )
      : pendingTotal(activeOrder)
    : total

  /**
   * Lo que se cobra por llevar el pedido.
   *
   * Con zona elegida manda la tarifa de la zona; el valor a mano es para el
   * pedido que no cae en ninguna. El servidor vuelve a resolverlo igual: esto
   * es solo para que el cajero vea el total antes de cobrar.
   */
  const zonaElegida = zones.find((z) => z._id === zoneId)
  const deliveryFee =
    orderType !== "domicilio"
      ? 0
      : zonaElegida
        ? zonaElegida.fee
        : Math.max(0, Math.round(Number(manualFee) || 0))

  // Total a cobrar. Los descuentos son solo los predefinidos por línea (ya
  // netos en `total`); en el POS no se permiten descuentos libres. La propina
  // (restaurante) y el domicilio se cobran ENCIMA del total y sin IVA.
  const netTotal = chargeTotal + tipAmount + deliveryFee

  const receivedNum = received ?? undefined
  /** La devuelta: lo que se le entrega al cliente. Exacta, en pesos. */
  const change =
    method === "cash" && receivedNum !== undefined && receivedNum >= netTotal
      ? receivedNum - netTotal
      : undefined
  const suggestions = React.useMemo(
    () => cashSuggestions(netTotal),
    [netTotal],
  )

  /** Limpia el cliente: descarta campos vacíos. */
  function cleanCustomer(): Customer | undefined {
    const entries = (["name", "idNumber", "phone", "email"] as const)
      .map((k) => [k, customer[k]?.trim()] as const)
      .filter(([, v]) => v)
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  /**
   * El cliente que viaja con la venta. Si no se escribió nada y es consumidor
   * final, la venta queda a nombre de "Consumidor final": así lo dice el
   * recibo y así puede salir la factura electrónica.
   */
  const customerToSend =
    cleanCustomer() ??
    (method !== "credit" && clienteModo === "final"
      ? CONSUMIDOR_FINAL
      : undefined)

  /**
   * `true` si se pidió factura electrónica pero faltan los datos mínimos que
   * la DIAN exige del adquiriente (nombre e identificación).
   */
  const invoiceDataMissing =
    emitInvoice && (!customerToSend?.name || !customerToSend?.idNumber)

  const vendedor = empList.find((e) => e._id === sellerKey)
  const sellerPayload = vendedor
    ? {
        employeeId: vendedor._id,
        name: `${vendedor.firstName} ${vendedor.lastName}`.trim(),
      }
    : undefined

  /**
   * El empaque de la venta, tal como está marcado en pantalla.
   *
   * Siempre viaja, junto con `packagingExplicit`, y una lista vacía es una
   * respuesta ("sin empaques"), no un hueco: lo que se ve marcado es
   * exactamente lo que va a bajar del inventario.
   */
  const packagingRows = Object.entries(empaqueSel)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }))

  /** Por qué no se puede confirmar todavía (o `false` si se puede). */
  const confirmBlocked =
    saving ||
    cart.length === 0 ||
    invoiceDataMissing ||
    (method === "cash" && receivedNum !== undefined && receivedNum < netTotal) ||
    (method === "credit" &&
      ((debtorType === "customer" && !custId) ||
        (debtorType === "employee" && !empId))) ||
    // Un domicilio sin dirección se cobraría igual y nadie sabría a dónde
    // llevarlo. El servidor también lo rechaza; aquí se evita el viaje.
    (orderType === "domicilio" && !address.trim())

  /**
   * Lo mismo, pero dicho en una frase para el pie del cobro.
   *
   * El botón apagado y sin explicación obligaba al cajero a repasar las tres
   * columnas buscando cuál era el campo que faltaba, con el cliente delante.
   * El orden es el de lo que más se olvida.
   */
  const motivoBloqueo =
    saving || cart.length === 0
      ? null
      : orderType === "domicilio" && !address.trim()
        ? "Escribe la dirección del domicilio para poder cobrar."
        : method === "credit" &&
            ((debtorType === "customer" && !custId) ||
              (debtorType === "employee" && !empId))
          ? "Elige a quién se le fía para poder cobrar."
          : invoiceDataMissing
            ? "Para la factura electrónica hace falta el nombre y la cédula o NIT del cliente."
            : method === "cash" &&
                receivedNum !== undefined &&
                receivedNum < netTotal
              ? `Con ${money(receivedNum)} no alcanza: faltan ${money(netTotal - receivedNum)}.`
              : null

  /**
   * Teclado del cobro: Escape cierra, Enter cobra.
   *
   * El modal está hecho a mano y no con el `Dialog` de Base UI porque necesita
   * tres columnas que scrollean por separado, así que los atajos hay que
   * ponerlos aquí. Antes Escape no hacía nada y salir del cobro pedía ratón.
   *
   * Enter solo cobra desde el campo del efectivo o con el foco fuera de todo
   * control: si cobrara desde cualquier campo, teclear el nombre de un cliente
   * nuevo y pulsar Enter registraría la venta a media faena.
   *
   * El cobro se llama a través de una referencia y no directamente: como
   * `handleConfirm` se vuelve a crear en cada render, ponerla en las
   * dependencias volvería a colgar y descolgar el escucha del teclado con cada
   * tecla que se escribe en el formulario. La referencia siempre apunta a la
   * última versión, y el efecto depende solo de las banderas que de verdad
   * deciden si el atajo está activo.
   */
  const confirmarRef = React.useRef<() => Promise<void>>(undefined)

  React.useEffect(() => {
    if (!checkoutOpen || completedSale) return
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!saving) setCheckoutOpen(false)
        return
      }
      if (e.key !== "Enter" || e.repeat || confirmBlocked) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      const enControl =
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        tag === "A" ||
        el?.isContentEditable === true
      if (enControl && el?.id !== "pos-received") return
      e.preventDefault()
      void confirmarRef.current?.()
    }
    document.addEventListener("keydown", alPulsar)
    return () => document.removeEventListener("keydown", alPulsar)
  }, [checkoutOpen, completedSale, saving, confirmBlocked])

  async function handleConfirm() {
    if (!sedeId) return
    setSaving(true)
    setCheckoutError(null)
    const payment = {
      method,
      received: method === "cash" ? receivedNum : undefined,
      dueDate: method === "credit" ? creditDue || undefined : undefined,
      debtorType: method === "credit" ? debtorType : undefined,
      customerId:
        method === "credit" && debtorType === "customer" ? custId : undefined,
      employeeId:
        method === "credit" && debtorType === "employee" ? empId : undefined,
    }
    const customerData = customerToSend
    /** Si tras este cobro la cuenta sigue con algo pendiente. */
    let quedaAbierta = false
    try {
      let sale: Sale
      if (activeOrderId) {
        // Persiste las líneas actuales antes de liquidar (checkout usa las
        // líneas guardadas de la cuenta, no el carrito).
        await updateOrder(activeOrderId, {
          label: label.trim() || undefined,
          lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
        })
        sale = await checkoutOrder(activeOrderId, {
          payment,
          customer: customerData,
          tip: tipAmount || undefined,
          // Sin líneas se cobra todo lo que falte, que es el cobro de siempre.
          lines: splitLines,
          seller: sellerPayload,
          packaging: packagingRows,
          packagingExplicit: true,
        })
        // Con un cobro parcial la cuenta puede seguir abierta con el resto, así
        // que hay que volver a preguntarle al servidor en vez de darla por
        // cerrada: quien cobra tiene que ver enseguida qué le falta a la mesa.
        const abiertas = splitLines
          ? await listOrders(sedeId, "open").catch(() => null)
          : null
        const sigueAbierta = abiertas?.find((o) => o._id === activeOrderId)
        if (abiertas) setOrders(abiertas)
        if (sigueAbierta) {
          // El carrito conserva la comanda COMPLETA: es el registro de lo que
          // se consumió. Lo que falta por cobrar sale de `paidQty`.
          quedaAbierta = true
          setCart(orderToCart(sigueAbierta, products))
          setSaveState("saved")
        } else {
          if (!abiertas) {
            setOrders((prev) => prev.filter((o) => o._id !== activeOrderId))
          }
          setActiveOrderId(null)
          setLabel("")
          setSaveState("idle")
        }
      } else {
        sale = await createSale({
          sedeId,
          lines: cart.map((i) => ({
            productId: i.product._id,
            qty: i.qty,
            discountId: i.discountId,
          })),
          payment,
          customer: customerData,
          seller: sellerPayload,
          packaging: packagingRows,
          packagingExplicit: true,
          tip: tipAmount || undefined,
          // El cliente registrado viaja aparte del deudor del fiado: su lista
          // de precios tiene que aplicarse pague como pague.
          customerId: custId || undefined,
          // Solo cuando no hay cliente: si lo hay, manda su lista y mandar las
          // dos haría que el backend pidiera permiso sin necesidad.
          priceListId: !custId ? manualListId || undefined : undefined,
          orderType,
          // La tarifa NO viaja cuando hay zona: se manda el id y el servidor
          // pone el precio. El valor a mano solo para el pedido suelto.
          delivery:
            orderType === "domicilio"
              ? {
                  address: address.trim(),
                  phone: deliveryPhone.trim() || undefined,
                  notes: deliveryNotes.trim() || undefined,
                  courier: courier.trim() || undefined,
                  zoneId: zoneId || undefined,
                  fee: zoneId ? undefined : deliveryFee,
                }
              : undefined,
        })
      }
      setCompletedSale(sale)
      // El carrito solo se vacía si la cuenta quedó saldada. Con un cobro
      // parcial se conserva la comanda completa para poder seguir cobrando lo
      // que falta sin volver a armarla.
      if (!quedaAbierta) setCart([])
      setTip(null)
      // Cobrado lo suyo, la parte dividida se reinicia: el siguiente que pague
      // empieza desde cero y no hereda lo que escribió el anterior.
      setSplitMode("todo")
      setSplitQty({})
      // El domicilio es de ESTE pedido: el siguiente arranca en mostrador y sin
      // dirección, para que nadie cobre un envío heredado del anterior.
      setOrderType("mostrador")
      setZoneId("")
      setManualFee("")
      setAddress("")
      setDeliveryPhone("")
      setDeliveryNotes("")
      setCourier("")
      // El pago, el cliente, la factura y el empaque también son de ESTE cobro:
      // antes el siguiente cliente heredaba el nombre y la lista de precios del
      // anterior. El vendedor no se toca (ver `sellerKey`).
      setReceived(null)
      setClienteModo("final")
      setCustId("")
      setManualListId("")
      setCustomer({})
      setShowCustomer(false)
      setEmitInvoice(false)
      setSaveCustomer(false)
      setEmpaqueSel({})
      setSugerencia(null)
      setEmpaqueAbierto(false)
      void fetchProducts()

      // La venta ya está registrada. Lo que sigue (factura DIAN y alta del
      // cliente) es adicional: si algo de esto falla NO se revierte la venta,
      // solo se avisa. Perder una venta cobrada porque la DIAN no respondió
      // sería mucho peor que quedarse sin la factura.
      if (emitInvoice) {
        setInvoiceState("emitting")
        setInvoiceError(null)
        try {
          const doc = await createInvoiceFromSale(sale._id)
          // `fullNumber` incluye el prefijo de la resolución (ej. "SETP-990").
          // Es el número que sale impreso y por el que pregunta el cliente.
          setInvoiceNumber(doc.fullNumber)
          setInvoiceState("done")
        } catch (err) {
          setInvoiceError(errorMessage(err))
          setInvoiceState("error")
        }
      }

      if (saveCustomer && customerData?.name && customerData?.idNumber) {
        try {
          await createCustomer({
            name: customerData.name,
            docNumber: customerData.idNumber,
            phone: customerData.phone,
          })
        } catch {
          // Alta en el directorio: no es crítica y no debe ensuciar la
          // pantalla de "venta registrada". Puede fallar simplemente porque
          // el documento ya existe.
        }
      }
    } catch (err) {
      setCheckoutError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Aquí y no junto al efecto del teclado: la referencia tiene que asignarse
  // DESPUÉS de que `handleConfirm` esté declarada, o el atajo se quedaría
  // agarrado a una versión vieja del cobro.
  React.useEffect(() => {
    confirmarRef.current = handleConfirm
  })

  // Lo que pidió el buscador de arriba: filtrar la rejilla, abrir una cuenta o
  // ir a la lista de cuentas abiertas.
  useBusquedaPendiente("/pos", (pedido) => {
    if (pedido.verCuentas) {
      void backToList()
      return
    }
    if (pedido.cuentaId) {
      const id = pedido.cuentaId
      void (async () => {
        // Recién llegado a la pantalla, las cuentas pueden no haber cargado.
        const cuenta =
          orders.find((o) => o._id === id) ??
          (sedeId
            ? (await listOrders(sedeId, "open").catch(() => [])).find(
                (o) => o._id === id,
              )
            : undefined)
        if (cuenta) void selectOrder(cuenta)
      })()
      return
    }
    setCategory(ALL)
    setScreen("sell")
    setSearch(pedido.termino)
  })

  // ── Sin permiso ──
  if (!canSell) {
    return (
      <Guard
        icon={ShieldOff}
        title="Sin acceso"
        text="No tienes permiso para vender en el punto de venta. Contacta al administrador."
      />
    )
  }

  // ── Sin sede asignada ──
  if (!sedesLoading && sedes.length === 0) {
    return (
      <Guard
        icon={MapPin}
        title="Sin sede asignada"
        text="Tu usuario no tiene sedes asignadas. Pide al administrador que te asigne una."
      />
    )
  }

  // ── Caja: gate de "abrir caja" antes de poder vender ──
  if (sedeId && cajaLoading) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verificando la caja…</p>
        </CardContent>
      </Card>
    )
  }

  if (sedeId && !caja) {
    return (
      <Card className="mx-auto max-w-md overflow-hidden p-0">
        {/* Barra violeta de estado: el cajero llega con prisa y necesita saber
            de un vistazo por qué no puede vender. Un icono ámbar centrado en
            medio de una tarjeta blanca no comunica "bloqueado". */}
        <div className="flex items-center gap-3 gradient-brand-r px-5 py-4 text-primary-foreground">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Lock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight">Caja cerrada</p>
            <p className="truncate text-sm text-primary-foreground/80">
              {sede ? sede.name : "Esta sede"} · aún no puedes vender
            </p>
          </div>
        </div>

        <CardContent className="flex flex-col items-center gap-4 px-5 pb-6 pt-5 text-center">
          <p className="text-sm text-muted-foreground">
            Cuenta la base con la que arrancas el turno y abre la caja para
            empezar a vender.
          </p>
          <div className="flex w-full flex-col gap-2 text-left">
            <p className="text-sm font-medium text-foreground">
              Base inicial en efectivo
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening-bills" className="gap-1.5">
                <Banknote className="size-4 text-muted-foreground" />
                Billetes
              </Label>
              <MoneyInput
                id="opening-bills"
                value={openingBills}
                onValueChange={setOpeningBills}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleOpenCaja()
                  }
                }}
                placeholder="$0"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening-coins" className="gap-1.5">
                <Coins className="size-4 text-muted-foreground" />
                Monedas
              </Label>
              <MoneyInput
                id="opening-coins"
                value={openingCoins}
                onValueChange={setOpeningCoins}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void handleOpenCaja()
                  }
                }}
                placeholder="$0"
              />
            </div>
            <div className="mt-1 flex items-center justify-between rounded-xl bg-accent px-4 py-3">
              <span className="text-sm font-medium text-accent-foreground">
                Total base
              </span>
              <span className="stat-figure text-xl text-primary">
                {money((openingBills ?? 0) + (openingCoins ?? 0))}
              </span>
            </div>
            {openCajaError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {openCajaError}
              </p>
            )}
            <Button
              size="lg"
              className="mt-1 h-13 gap-2 text-base font-semibold shadow-[0_10px_26px_-12px_var(--primary)]"
              disabled={
                openingBusy ||
                (openingBills === null && openingCoins === null)
              }
              onClick={() => void handleOpenCaja()}
            >
              {openingBusy ? "Abriendo…" : "Abrir caja y vender"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              El arqueo y el cierre se gestionan en la pestaña Caja.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isOrder = activeOrderId !== null

  return (
    <>
      {/* ── Lista de cuentas activas (vista inicial) ── */}
      {screen === "list" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl">Cuentas abiertas</h1>
              <p className="text-sm text-muted-foreground">
                {sede ? `${sede.name} · ` : ""}
                Consumos que quedaron pendientes de cobrar (mesas o clientes).
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="gap-2"
                disabled={!sedeId}
                onClick={() => void selectDirect()}
              >
                <ShoppingCart className="size-4" />
                Vender
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={orderBusy || !sedeId}
                onClick={() => {
                  setNewOrderName("")
                  setNewOrderOpen(true)
                }}
              >
                <Plus className="size-4" />
                Abrir cuenta
              </Button>
            </div>
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <ClipboardList className="size-10 text-muted-foreground" />
                <p className="font-display text-lg">No hay cuentas abiertas</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Todo está cobrado. Usa <strong>Vender</strong> para una venta
                  normal, o abre una cuenta si necesitas dejar el consumo de una
                  mesa pendiente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((o) => {
                const count = o.lines.reduce((a, l) => a + l.qty, 0)
                const oTotal = o.lines.reduce((a, l) => a + l.lineTotal, 0)
                return (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => void selectOrder(o)}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {o.label?.trim() || o.orderNumber}
                      </span>
                      <Badge variant="secondary">{count} ítem(s)</Badge>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {o.orderNumber}
                      </span>
                      <span className="font-display text-lg">
                        {money(oTotal)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Encabezado de la pantalla de venta ──
          "Venta" a secas cuando es una venta normal: llamarla "venta directa"
          solo tenía sentido frente a "cuenta", y esa oposición era justo lo
          que confundía. Las cuentas abiertas se ofrecen aquí, con su número,
          en vez de ser una pantalla previa obligatoria. */}
      {screen === "sell" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isOrder && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => void backToList()}
            >
              <ChevronLeft className="size-4" />
              Salir de la cuenta
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight">
              {isOrder
                ? label.trim() || activeOrder?.orderNumber || "Cuenta"
                : "Venta"}
            </p>
            {isOrder && activeOrder ? (
              <p className="font-mono text-xs text-muted-foreground">
                {activeOrder.orderNumber}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {sede ? `${sede.name} · ` : ""}Agrega productos y cobra.
              </p>
            )}
          </div>

          {/* Cuentas abiertas: visible pero opcional, con el número al lado
              para que se vea si hay mesas pendientes sin salir de la venta. */}
          {!isOrder && (
            <Button
              data-tour="pos-cuentas"
              variant="outline"
              className="gap-2"
              onClick={() => void backToList()}
            >
              <ClipboardList className="size-4" />
              Cuentas abiertas
              {orders.length > 0 && (
                <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {orders.length}
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {screen === "sell" && (
      // En un monitor ancho el carrito no necesita un tercio de la pantalla:
      // a partir de `2xl` se queda en un cuarto y el catálogo se lleva el resto,
      // que es donde de verdad hace falta el sitio. Con `lg:grid-cols-3` a secas
      // quedaban filas de tres productos y medio monitor en blanco.
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        {/* ── Catálogo ── */}
        <div className="flex flex-col gap-3 lg:col-span-2 2xl:col-span-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              data-tour="pos-buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleScan()
                }
              }}
              placeholder="Escanea un código o busca por nombre / SKU…"
              className="h-11 pl-9"
              aria-label="Buscar o escanear producto"
            />
            {flash && (
              <span
                role="status"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {flash}
              </span>
            )}
          </div>

          {/* Filtro por categoría, y a su derecha —donde antes solo había aire
              en un monitor ancho— los dos atajos que ya existen y que casi
              nadie descubre solo. */}
          <div className="flex items-center gap-3">
            {categories.length > 0 && (
              <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
                <CategoryChip
                  active={category === ALL}
                  onClick={() => setCategory(ALL)}
                >
                  Todos
                </CategoryChip>
                {categories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    active={category === c.id}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.name}
                  </CategoryChip>
                ))}
              </div>
            )}
            <p className="ml-auto hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground xl:flex">
              <Atajo tecla="Enter">agrega lo escaneado</Atajo>
              <Atajo tecla="Ctrl K">busca en todo el terminal</Atajo>
            </p>
          </div>

          {/* Aviso de existencias (agotados / pocas unidades) */}
          {!loading && !error && (stockSummary.out > 0 || stockSummary.low > 0) && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-ink">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {stockSummary.out > 0 &&
                  `${stockSummary.out} producto(s) sin stock`}
                {stockSummary.out > 0 && stockSummary.low > 0 && " · "}
                {stockSummary.low > 0 &&
                  `${stockSummary.low} con pocas unidades`}
              </span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <PackageX className="size-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {products.length === 0
                    ? "No hay productos con precio de venta en esta sede."
                    : "Sin resultados para esta búsqueda o categoría."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6">
              {gridEntries.map((entry) => {
                // Un grupo de variantes ocupa UNA casilla y abre el selector de
                // talla; el resto de productos se pintan como siempre.
                if (entry.kind === "group") {
                  return (
                    <VariantGroupCard
                      key={entry.group.groupId}
                      group={entry.group}
                      showImages={showImages}
                      inCart={entry.group.variants.reduce(
                        (n, v) =>
                          n +
                          (cart.find((i) => i.product._id === v._id)?.qty ?? 0),
                        0,
                      )}
                      onOpen={() => setPickerGroup(entry.group)}
                    />
                  )
                }
                const p = entry.product
                const inCart =
                  cart.find((i) => i.product._id === p._id)?.qty ?? 0
                const out = p.stock <= 0 || inCart >= p.stock
                return (
                  <button
                    key={p._id}
                    type="button"
                    disabled={out}
                    onClick={() => addToCart(p)}
                    className={cn(
                      "group relative flex flex-col items-start gap-0.5 rounded-xl border border-border bg-card p-2.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0",
                      out &&
                        "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-xs",
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {inCart}
                      </span>
                    )}
                    {showImages &&
                      (p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          loading="lazy"
                          className="mb-1 aspect-square w-full rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <span className="mb-1 flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                          <ImageOff className="size-6" aria-hidden />
                        </span>
                      ))}
                    {/* `text-balance` reparte el nombre entre los dos renglones
                        en vez de dejar la primera palabra sola arriba, que es
                        lo que pasaba con las tarjetas anchas. */}
                    <span className="line-clamp-2 w-full pr-5 text-[0.8125rem] font-medium leading-snug text-balance">
                      {p.name}
                    </span>
                    <span className="flex w-full min-w-0 items-baseline gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <span className="truncate">{p.sku}</span>
                      {/* Las existencias que no son aviso solo caben en pantalla
                          ancha; ahí es dato útil, en móvil sería ruido. */}
                      {p.stock >= LOW_STOCK && (
                        <span className="ml-auto hidden shrink-0 tabular-nums xl:inline">
                          {fmtQty(p.stock)} {p.unit}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex w-full flex-wrap items-center justify-between gap-1">
                      <span className="font-display text-lg">
                        {money(p.salePrice)}
                      </span>
                      {/* Solo se avisa el stock si quedan pocas unidades (<10). */}
                      {p.stock <= 0 ? (
                        <Badge variant="destructive">Agotado</Badge>
                      ) : p.stock < LOW_STOCK ? (
                        <Badge className="border-transparent bg-warning/15 text-warning-ink">
                          Quedan {fmtQty(p.stock)}
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Cuenta ──
            En PC ocupa todo el alto libre y es la LISTA la que scrollea: el
            total y el botón de cobrar quedan pegados abajo y siempre a la
            vista. Antes la tarjeta crecía con los ítems y a la décima línea
            había que bajar la página entera para encontrar el botón. */}
        <Card
          data-tour="pos-carrito"
          className="h-fit lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)]"
        >
          <CardContent className="flex flex-col gap-3 p-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            <div className="flex shrink-0 items-center gap-2">
              <ShoppingCart className="size-5 text-muted-foreground" />
              <p className="font-display text-lg">
                {isOrder ? "Cuenta" : "Venta"}
              </p>
              {isOrder && activeOrder && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {activeOrder.orderNumber}
                </Badge>
              )}
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {itemCount} ítem(s)
                </Badge>
              )}
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="size-3.5" />
                  Vaciar
                </Button>
              )}
            </div>

            {/* Cabecera de la cuenta abierta: etiqueta editable + estado */}
            {isOrder && (
              <div className="flex shrink-0 flex-col gap-2">
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nombre de la cuenta (mesa / cliente)"
                  className="h-9"
                  aria-label="Nombre de la cuenta"
                />
                <div className="flex items-center justify-between">
                  <SaveIndicator state={saveState} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                    disabled={orderBusy}
                    onClick={() => void closeActiveOrder()}
                  >
                    <X className="size-3.5" />
                    Cerrar cuenta
                  </Button>
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center lg:min-h-0 lg:flex-1 lg:justify-center">
                <ShoppingCart className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {isOrder
                    ? "Cuenta abierta sin ítems. Agrega productos; se guardan solos."
                    : "Toca un producto o escanea su código para agregarlo."}
                </p>
              </div>
            ) : (
              // El `-mr-1 pr-1` deja la barra de scroll fuera de las tarjetas,
              // que si no se comía el borde derecho de cada línea.
              <ul className="flex flex-col gap-2 lg:-mr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
                {cart.map((i) => {
                  const unit = unitPrice(i)
                  const gross = i.qty * unit
                  // Se tacha el de mostrador cuando la lista lo bajó: si no se
                  // ve la diferencia, nadie nota que se está cobrando pactado.
                  const conLista = unit !== Math.round(i.product.salePrice)
                  const lineDisc = lineDiscount(i)
                  const applied = i.discountId
                    ? discountById.get(i.discountId)
                    : undefined
                  return (
                  <li
                    key={i.product._id}
                    className="rounded-lg border border-border p-2"
                  >
                    {/* Dos renglones y no uno: con el nombre, el botón de
                        descuento y el contador peleando por la misma fila, la
                        columna del carrito se desbordaba en un portátil de
                        1366 px y el "+" se salía de la tarjeta. */}
                    <div className="flex items-start gap-2">
                      {/* Miniatura: a esta columna se le mira de reojo mientras
                          se atiende, y la foto se reconoce más rápido que el
                          nombre. Solo aparece si algún producto del carrito
                          tiene foto; si no, sería una fila de cuadros vacíos
                          comiéndose el ancho del nombre. */}
                      {cartShowImages &&
                        (i.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={i.product.imageUrl}
                            alt=""
                            loading="lazy"
                            className="size-9 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground"
                            aria-hidden
                          >
                            <ImageOff className="size-4" />
                          </span>
                        ))}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[0.8125rem] font-medium leading-snug">
                          {i.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {conLista && (
                            <span className="mr-1 line-through">
                              {money(i.product.salePrice)}
                            </span>
                          )}
                          {money(unit)} ·{" "}
                          {lineDisc > 0 ? (
                            <>
                              <span className="text-muted-foreground line-through">
                                {money(gross)}
                              </span>{" "}
                              <span className="font-medium text-foreground">
                                {money(gross - lineDisc)}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-foreground">
                              {money(gross)}
                            </span>
                          )}
                        </p>
                        {applied && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                            <Tag className="size-3" />
                            {applied.name} (−{money(lineDisc)})
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Quitar ${i.product.name}`}
                        onClick={() => removeFromCart(i.product._id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Restar uno"
                        onClick={() => changeQty(i.product._id, -1)}
                      >
                        <Minus />
                      </Button>
                      <QuantityInput
                        value={i.qty}
                        onValueChange={(v) => setQty(i.product._id, v ?? 0)}
                        aria-label={`Cantidad de ${i.product.name}`}
                        className="h-8 w-14 px-1 text-center text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Sumar uno"
                        disabled={i.qty >= i.product.stock}
                        onClick={() => changeQty(i.product._id, 1)}
                      >
                        <Plus />
                      </Button>
                      {discounts.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant={applied ? "default" : "outline"}
                                size="sm"
                                className="ml-auto gap-1"
                                aria-label={`Descuento para ${i.product.name}`}
                              />
                            }
                          >
                            <Tag />
                            {applied ? "Desc." : "Descuento"}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                              Descuento
                            </div>
                            <DropdownMenuItem
                              onClick={() =>
                                setLineDiscount(i.product._id, null)
                              }
                            >
                              Sin descuento
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {discounts.map((d) => (
                              <DropdownMenuItem
                                key={d._id}
                                onClick={() =>
                                  setLineDiscount(i.product._id, d._id)
                                }
                              >
                                <span className="flex-1 truncate">{d.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {d.type === "percent"
                                    ? `${d.value}%`
                                    : money(d.value)}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}

            {/* Pie de la cuenta: propina, total y cobrar. Va aparte y sin
                encoger para que la lista de arriba sea la única que se mueve:
                el botón de cobrar no puede salirse de la pantalla nunca. */}
            <div className="flex shrink-0 flex-col gap-3">
              <Separator />

              {/* Propina (restaurante): voluntaria, se cobra encima del total. Se
                  pone/quita con el 10% sugerido o un monto libre. Va arriba del
                  total para que el cliente decida antes de ver el total a pagar. */}
              {isRestaurant && cart.length > 0 && (
                <div className="rounded-xl border border-dashed border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <HandCoins className="size-4 text-muted-foreground" />
                      <Termino>Propina</Termino>
                      <span className="text-xs font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </span>
                    {tip !== null && (
                      <button
                        type="button"
                        onClick={() => setTip(null)}
                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  {tip === null ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={total <= 0}
                        onClick={() => setTip(suggestedTip)}
                      >
                        10% · {money(suggestedTip)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setTip(0)}
                      >
                        Otro monto
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <MoneyInput
                        value={tip}
                        onValueChange={(v) => setTip(v ?? 0)}
                        placeholder="$0"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={total <= 0}
                        onClick={() => setTip(suggestedTip)}
                      >
                        10%
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* El total es la cifra que el cajero canta en voz alta y que el
                  cliente mira: va en panel violeta y grande, no como una fila
                  más de la lista. Con propina, el grande es el total a pagar. */}
              <div className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-display text-lg text-accent-foreground">
                    {tipAmount > 0 ? "Total a pagar" : "Total"}
                  </span>
                  {tipAmount > 0 && (
                    <span className="text-xs text-accent-foreground/70">
                      Bienes {money(total)} · Propina {money(tipAmount)}
                    </span>
                  )}
                </div>
                <span className="stat-figure text-[1.75rem] leading-none text-primary">
                  {money(netTotal)}
                </span>
              </div>

              {/* 56px de alto: es el objetivo táctil que fija nuestro sistema de
                  diseño para la acción principal del POS, y se pulsa con prisa. */}
              <Button
                data-tour="pos-cobrar"
                size="lg"
                className="h-14 text-base font-semibold shadow-[0_10px_26px_-12px_var(--primary)]"
                disabled={cart.length === 0 || !sedeId}
                onClick={openCheckout}
              >
                Cobrar {netTotal > 0 ? money(netTotal) : ""}
              </Button>

              {/* En venta directa se puede aparcar el carrito como cuenta. */}
              {!isOrder && cart.length > 0 && (
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={orderBusy}
                  onClick={() => void saveAsOrder()}
                >
                  <ClipboardList className="size-4" />
                  Guardar como cuenta
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ── Cobro ──
          Tres columnas en PC, una sola apilada en móvil.

          Antes esto era una tarjeta de 512 px con catorce bloques puestos uno
          debajo de otro dentro de un velo que scrolleaba entero: al bajar a
          buscar la devuelta se iban de la pantalla el título y el botón de
          cobrar, y el detalle de lo que se estaba cobrando quedaba tapado por
          el velo — el cajero confirmaba a ciegas. Y como el terminal se usa en
          PC el 90 % del tiempo, había medio monitor en blanco a cada lado.

          Ahora cada columna responde a una pregunta distinta: qué estoy
          cobrando (izquierda), cómo paga (centro) y de quién es esta venta
          (derecha). Las dos de los lados scrollean solas, la del centro es la
          única que se mira con el cliente enfrente, y cabecera y pie no se
          mueven pase lo que pase con el scroll. */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/45 p-3 backdrop-blur-sm sm:p-6 dark:bg-navy-950/70"
          role="dialog"
          aria-modal="true"
          aria-label="Cobrar"
          onClick={() => {
            if (!saving) setCheckoutOpen(false)
          }}
        >
          <div
            className={cn(
              "flex w-full flex-col overflow-hidden rounded-2xl bg-card shadow-xl print:overflow-visible",
              // `svh` y no `vh`: con `vh` el modal se sale por abajo justo
              // cuando aparece el teclado del celular.
              "max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-3rem)]",
              completedSale ? "max-w-4xl" : "max-w-6xl",
            )}
            onClick={(e) => e.stopPropagation()}
          >
          {completedSale ? (
            <>
              <header className="no-print flex shrink-0 items-center gap-3 border-b border-border bg-success/10 px-5 py-4">
                <CheckCircle2 className="size-9 shrink-0 text-success-ink" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl leading-tight">
                    Venta registrada
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {completedSale.saleNumber}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={() => {
                    setCheckoutOpen(false)
                    void backToList()
                  }}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </header>

              {/* Recibo a un lado, lo que hay que hacer ya al otro. La devuelta
                  es lo urgente —el cliente está esperando su vuelto—, así que
                  va primero y en grande; el recibo se consulta, no se cuenta. */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-2 lg:overflow-hidden print:overflow-visible">
                <div className="flex flex-col gap-3 px-5 py-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain print:hidden">
                  {/* La devuelta, grande: es lo que el cajero tiene que contar
                      y entregar ya, con el cliente esperando. */}
                  {completedSale.payment.method === "cash" &&
                    completedSale.payment.change !== undefined && (
                      <div className="flex flex-col items-center gap-1 rounded-2xl bg-success/10 px-4 py-5 text-center text-success-ink">
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          Devuelta
                        </span>
                        <span className="stat-figure text-4xl leading-none sm:text-5xl">
                          {money(completedSale.payment.change)}
                        </span>
                        {completedSale.payment.received !== undefined && (
                          <span className="text-xs opacity-80">
                            Pagó con {money(completedSale.payment.received)}
                          </span>
                        )}
                      </div>
                    )}

                  {/* Estado de la factura electrónica. Se muestra aparte del
                      éxito de la venta a propósito: la venta está hecha aunque
                      la DIAN falle, y mezclarlo haría dudar al cajero de si
                      cobró o no. */}
                  {invoiceState !== "idle" && (
                    <div
                      className={cn(
                        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
                        invoiceState === "done" && "bg-success/10 text-success-ink",
                        invoiceState === "emitting" && "bg-accent text-accent-foreground",
                        invoiceState === "error" &&
                          "bg-destructive/10 text-destructive",
                      )}
                    >
                      {invoiceState === "emitting" && (
                        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                      )}
                      {invoiceState === "done" && (
                        <FileText className="mt-0.5 size-4 shrink-0" />
                      )}
                      {invoiceState === "error" && (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>
                        {invoiceState === "emitting" && "Emitiendo factura electrónica…"}
                        {invoiceState === "done" &&
                          `Factura electrónica emitida${invoiceNumber ? ` · ${invoiceNumber}` : ""}`}
                        {invoiceState === "error" && (
                          <>
                            La venta quedó registrada, pero la factura no se pudo
                            emitir: {invoiceError}. Puedes emitirla desde{" "}
                            <strong>Factura electrónica</strong>.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {!printConfigured && (
                    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs">
                      <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                        <Info className="size-3.5 text-primary" />
                        Configura la impresión (solo esta vez)
                      </p>
                      <p className="text-muted-foreground">
                        Al pulsar <span className="font-medium">Imprimir</span>,
                        elige tu impresora de recibos y márcala como
                        predeterminada. Para que las próximas ventas salgan sin
                        diálogo, activa la impresión automática (modo kiosco) del
                        navegador. Esta ayuda no volverá a aparecer.
                      </p>
                    </div>
                  )}

                  {completedSale.customer?.name && (
                    <p className="text-sm text-muted-foreground">
                      A nombre de{" "}
                      <span className="font-medium text-foreground">
                        {completedSale.customer.name}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col border-t border-border bg-muted/25 px-5 py-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0 print:overflow-visible print:border-0 print:bg-transparent print:p-0">
                  <Receipt sale={completedSale} sede={sede} />
                </div>
              </div>

              <footer className="no-print flex shrink-0 gap-2 border-t border-border bg-muted/40 px-5 py-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handlePrintReceipt}
                >
                  <Printer className="size-4" />
                  Imprimir
                </Button>
                <Button
                  className="h-12 flex-1 text-base font-semibold"
                  onClick={() => {
                    setCheckoutOpen(false)
                    void backToList()
                  }}
                >
                  Listo
                </Button>
              </footer>
            </>
          ) : (
            <>
              {/* Cabecera fija: el título y la cifra que se lee en voz alta y
                  que el cliente comprueba. No se mueve con el scroll. */}
              <header className="shrink-0 gradient-brand px-4 py-3.5 text-primary-foreground sm:px-5 sm:py-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-tight">Cobrar</p>
                    <p className="truncate text-xs text-primary-foreground/80 sm:text-sm">
                      {sede ? `${sede.name} · ` : ""}
                      {itemCount} ítem(s)
                      {lineDiscountTotal > 0 && (
                        <> · −{money(lineDiscountTotal)} de descuento</>
                      )}
                      {tipAmount > 0 && <> · Propina {money(tipAmount)}</>}
                      {deliveryFee > 0 && <> · Domicilio {money(deliveryFee)}</>}
                    </p>
                  </div>
                  <p className="stat-figure shrink-0 text-3xl leading-none sm:text-4xl">
                    {money(netTotal)}
                  </p>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    disabled={saving}
                    onClick={() => setCheckoutOpen(false)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground disabled:opacity-40"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </header>

              {/* En móvil el cuerpo entero scrollea y las columnas se apilan con
                  "Cómo paga" arriba; en PC no scrollea nada aquí, scrollea cada
                  columna por su cuenta. El orden del DOM es izquierda → centro →
                  derecha para que el Tab recorra la pantalla como se lee. */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.95fr)] lg:divide-x lg:divide-border lg:overflow-hidden">
                {/* ── Columna 1: qué se está cobrando ── */}
                <CheckoutColumn
                  title="Qué estás cobrando"
                  icon={ShoppingCart}
                  hint={`${itemCount} ítem(s)`}
                  className="max-lg:order-2 max-lg:border-t max-lg:border-border"
                  footer={
                    <div className="flex flex-col gap-1.5">
                      {activeOrder ? (
                        <>
                          <SummaryRow
                            label="Consumo de la cuenta"
                            value={money(total)}
                          />
                          {pagadoAntes > 0 && (
                            <SummaryRow
                              label="Ya pagaron"
                              value={`−${money(pagadoAntes)}`}
                              tone="positive"
                            />
                          )}
                          {splitLines && (
                            <SummaryRow
                              label="Falta por cobrar"
                              value={money(pendingTotal(activeOrder))}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <SummaryRow
                            label="Productos"
                            value={money(total + lineDiscountTotal)}
                          />
                          {lineDiscountTotal > 0 && (
                            <SummaryRow
                              label="Descuentos"
                              value={`−${money(lineDiscountTotal)}`}
                              tone="positive"
                            />
                          )}
                        </>
                      )}
                      {tipAmount > 0 && (
                        <SummaryRow label="Propina" value={money(tipAmount)} />
                      )}
                      {deliveryFee > 0 && (
                        <SummaryRow label="Domicilio" value={money(deliveryFee)} />
                      )}
                      <div className="mt-1 flex items-baseline justify-between gap-3 rounded-xl bg-accent px-3 py-2.5">
                        <span className="font-display text-[0.9375rem] text-accent-foreground">
                          Total a cobrar
                        </span>
                        <span className="stat-figure text-2xl leading-none text-primary">
                          {money(netTotal)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Los precios ya incluyen impuestos.
                      </p>
                    </div>
                  }
                >
                  {cart.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No hay nada en la cuenta.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {cart.map((i) => {
                        const unit = unitPrice(i)
                        const gross = i.qty * unit
                        const lineDisc = lineDiscount(i)
                        const applied = i.discountId
                          ? discountById.get(i.discountId)
                          : undefined
                        return (
                          <li
                            key={i.product._id}
                            className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-[0.8125rem] font-medium leading-snug text-foreground">
                                {i.product.name}
                              </span>
                              <span className="block text-xs tabular-nums text-muted-foreground">
                                {fmtQty(i.qty)} {i.product.unit} × {money(unit)}
                              </span>
                              {applied && (
                                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                                  <Tag className="size-3" />
                                  {applied.name} −{money(lineDisc)}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-[0.8125rem] font-medium tabular-nums text-foreground">
                              {money(gross - lineDisc)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CheckoutColumn>

                {/* ── Columna 2: cómo paga (lo único que se mira con el cliente
                    enfrente, así que es la más ancha y la más grande) ── */}
                <CheckoutColumn
                  title="Cómo paga"
                  icon={Banknote}
                  className="max-lg:order-1 lg:bg-muted/20"
                >
                  <OptionGroup
                    ariaLabel="Medio de pago"
                    value={method}
                    onChange={setMethod}
                    size="lg"
                    columns={2}
                    options={(
                      Object.entries(PAYMENT_METHOD_LABELS) as [
                        PaymentMethod,
                        string,
                      ][]
                    ).map(([key, lbl]) => ({
                      value: key,
                      label: lbl,
                      icon: PAYMENT_ICONS[key],
                    }))}
                  />

                  {/* ¿Con cuánto paga? Con la devuelta enorme: es la cuenta que
                      el cajero hace de cabeza con el cliente esperando, y antes
                      quedaba al fondo de un formulario de catorce bloques. */}
                  {method === "cash" && (
                    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
                      <Label htmlFor="pos-received" className="text-[0.8125rem]">
                        ¿Con cuánto paga?
                      </Label>
                      <MoneyInput
                        id="pos-received"
                        value={received}
                        onValueChange={setReceived}
                        placeholder={new Intl.NumberFormat("es-CO").format(netTotal)}
                        className="h-14 text-xl"
                        autoFocus
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant={receivedNum === netTotal ? "default" : "outline"}
                          size="sm"
                          onClick={() => setReceived(netTotal)}
                        >
                          Exacto
                        </Button>
                        {suggestions.map((s) => (
                          <Button
                            key={s}
                            type="button"
                            variant={receivedNum === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setReceived(s)}
                          >
                            {money(s)}
                          </Button>
                        ))}
                      </div>
                      <div
                        role="status"
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-5 text-center",
                          change !== undefined
                            ? "bg-success/10 text-success-ink"
                            : receivedNum !== undefined && receivedNum < netTotal
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {change !== undefined ? (
                          <>
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              Devuelta
                            </span>
                            <span className="stat-figure text-4xl leading-none sm:text-5xl">
                              {money(change)}
                            </span>
                          </>
                        ) : receivedNum !== undefined && receivedNum < netTotal ? (
                          <>
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              Faltan
                            </span>
                            <span className="stat-figure text-3xl leading-none">
                              {money(netTotal - receivedNum)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm">
                            Escribe con cuánto paga y aquí sale la devuelta.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(method === "card" || method === "transfer") && (
                    <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[0.8125rem] text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>
                        {method === "card"
                          ? "Pasa la tarjeta por el datáfono y confirma aquí cuando la transacción quede aprobada."
                          : "Confirma aquí cuando veas la transferencia recibida. No hay devuelta que entregar."}
                      </span>
                    </p>
                  )}

                  {/* Fiado: quién queda debiendo. Va en esta columna y no en la
                      de al lado porque es parte de CÓMO se paga, no un dato de
                      la venta: sin deudor no hay cobro. */}
                  {method === "credit" && (
                    <div className="flex flex-col gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 p-3">
                      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning-ink">
                        <HandCoins className="size-4" />
                        <Termino term="credito">Venta a crédito (fiado)</Termino>
                      </p>

                      <OptionGroup
                        ariaLabel="Quién queda debiendo"
                        value={debtorType}
                        onChange={setDebtorType}
                        columns={2}
                        className="bg-warning/15"
                        options={[
                          { value: "customer" as const, label: "Cliente" },
                          { value: "employee" as const, label: "Empleado (nómina)" },
                        ]}
                      />

                      {debtorType === "customer" ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-warning-ink">
                              Cliente registrado
                            </Label>
                            <button
                              type="button"
                              className="text-xs font-medium text-warning-ink underline"
                              onClick={() => setNcOpen((v) => !v)}
                            >
                              {ncOpen ? "Cancelar" : "+ Registrar"}
                            </button>
                          </div>
                          {!ncOpen ? (
                            <NativeSelect
                              value={custId}
                              onChange={(v) => elegirCliente(v)}
                              placeholder="Selecciona un cliente…"
                              aria-label="Cliente al que se le fía"
                              options={regCustomers.map((c) => ({
                                value: c._id,
                                label: `${c.name} · ${c.docType} ${c.docNumber}`,
                              }))}
                            />
                          ) : (
                            <div className="flex flex-col gap-1.5 rounded-xl border border-warning/30 bg-background p-2">
                              <Input
                                placeholder="Nombre"
                                aria-label="Nombre del cliente nuevo"
                                value={ncName}
                                onChange={(e) => setNcName(e.target.value)}
                              />
                              <div className="grid grid-cols-2 gap-1.5">
                                <Input
                                  placeholder="Cédula / NIT"
                                  aria-label="Documento del cliente nuevo"
                                  value={ncDoc}
                                  onChange={(e) => setNcDoc(e.target.value)}
                                />
                                <Input
                                  placeholder="Teléfono"
                                  aria-label="Teléfono del cliente nuevo"
                                  inputMode="tel"
                                  value={ncPhone}
                                  onChange={(e) => setNcPhone(e.target.value)}
                                />
                              </div>
                              <Button
                                size="sm"
                                disabled={ncBusy || !ncName.trim() || !ncDoc.trim()}
                                onClick={() => void quickAddCustomer()}
                              >
                                {ncBusy ? "Guardando…" : "Registrar y usar"}
                              </Button>
                            </div>
                          )}
                          <p className="text-[11px] text-warning-ink">
                            Queda como cuenta por cobrar (CxC) del cliente.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-warning-ink">Empleado</Label>
                          <NativeSelect
                            value={empId}
                            onChange={setEmpId}
                            placeholder="Selecciona un empleado…"
                            aria-label="Empleado al que se le fía"
                            options={empList.map((e) => ({
                              value: e._id,
                              label: `${e.firstName} ${e.lastName} · ${e.docNumber}`,
                            }))}
                          />
                          <p className="text-[11px] text-warning-ink">
                            Se descuenta por nómina (pendiente de aprobación) y
                            aparece en la colilla.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor="pos-credit-due"
                          className="gap-1.5 text-xs text-warning-ink"
                        >
                          <CalendarClock className="size-3.5" />
                          Vence (opcional)
                        </Label>
                        <Input
                          id="pos-credit-due"
                          type="date"
                          value={creditDue}
                          onChange={(e) => setCreditDue(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  )}
                </CheckoutColumn>

                {/* ── Columna 3: lo que no se toca en cada venta ──
                    Plegado por defecto y con el estado resumido en un renglón:
                    las opciones siguen estando todas, pero solo grita la que
                    esta venta necesita. */}
                <CheckoutColumn
                  title="De la venta"
                  icon={ClipboardList}
                  className="max-lg:order-3 max-lg:border-t max-lg:border-border"
                >
                  {method !== "credit" ? (
                    <CheckoutGroup
                      title="Cliente"
                      icon={UserRound}
                      defaultOpen={clienteModo === "registrado"}
                      summary={
                        clienteModo === "final"
                          ? "Consumidor final"
                          : customer.name
                            ? listaActiva
                              ? `${customer.name} · lista ${listaActiva.name}`
                              : customer.name
                            : "Sin elegir"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">A quién se le vende</Label>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          onClick={() => {
                            setClienteModo("registrado")
                            setNcOpen((v) => !v)
                          }}
                        >
                          {ncOpen ? (
                            "Cancelar"
                          ) : (
                            <>
                              <UserPlus className="size-3.5" />
                              Agregar cliente
                            </>
                          )}
                        </button>
                      </div>
                      <OptionGroup
                        ariaLabel="A quién se le vende"
                        value={clienteModo}
                        onChange={(v) => {
                          setClienteModo(v)
                          if (v === "final") {
                            setNcOpen(false)
                            elegirCliente("")
                          }
                        }}
                        columns={2}
                        options={[
                          { value: "final" as const, label: "Consumidor final" },
                          { value: "registrado" as const, label: "Cliente registrado" },
                        ]}
                      />

                      {ncOpen ? (
                        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-2">
                          <Input
                            placeholder="Nombre"
                            aria-label="Nombre del cliente nuevo"
                            value={ncName}
                            onChange={(e) => setNcName(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              placeholder="Cédula / NIT"
                              aria-label="Documento del cliente nuevo"
                              value={ncDoc}
                              onChange={(e) => setNcDoc(e.target.value)}
                            />
                            <Input
                              placeholder="Teléfono"
                              aria-label="Teléfono del cliente nuevo"
                              inputMode="tel"
                              value={ncPhone}
                              onChange={(e) => setNcPhone(e.target.value)}
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={ncBusy || !ncName.trim() || !ncDoc.trim()}
                            onClick={() => void quickAddCustomer()}
                          >
                            {ncBusy ? "Guardando…" : "Guardar y usar en esta venta"}
                          </Button>
                        </div>
                      ) : clienteModo === "registrado" ? (
                        <NativeSelect
                          value={custId}
                          onChange={(v) => elegirCliente(v)}
                          placeholder="Selecciona un cliente…"
                          aria-label="Cliente registrado"
                          options={regCustomers.map((c) => ({
                            value: c._id,
                            label: `${c.name} · ${c.docType} ${c.docNumber}`,
                          }))}
                        />
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Venta sin datos del cliente. El recibo y la factura
                          salen a nombre de consumidor final.
                        </p>
                      )}

                      {/* Sin cliente registrado, el cajero puede elegir la lista
                          a mano. Es decidir cobrar menos, así que va con el
                          mismo permiso que un descuento. */}
                      {!custId && canDiscount && priceLists.length > 0 && (
                        <NativeSelect
                          value={manualListId}
                          onChange={setManualListId}
                          placeholder="Precio de mostrador"
                          aria-label="Lista de precios"
                          options={priceLists.map((l) => ({
                            value: l._id,
                            label: `Lista: ${l.name}`,
                          }))}
                        />
                      )}

                      {listaActiva && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-success-ink">
                          <Tag className="size-3" />
                          Se cobra con la lista {listaActiva.name}.
                        </p>
                      )}
                    </CheckoutGroup>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                      En el fiado el cliente se elige junto al medio de pago: es
                      quien queda debiendo.
                    </p>
                  )}

                  {/* Quién vendió. Por omisión, quien cobra; si atendió otra
                      persona se escoge aquí y la venta queda a su nombre. */}
                  <CheckoutGroup
                    title="Vendedor"
                    icon={Users}
                    summary={
                      vendedor
                        ? `${vendedor.firstName} ${vendedor.lastName}`
                        : user?.name
                          ? `${user.name} (quien cobra)`
                          : "Quien cobra"
                    }
                  >
                    <NativeSelect
                      id="pos-seller"
                      value={vendedor ? sellerKey : QUIEN_COBRA}
                      onChange={setSellerKey}
                      aria-label="Vendedor"
                      options={[
                        {
                          value: QUIEN_COBRA,
                          label: user?.name
                            ? `${user.name} (quien cobra)`
                            : "Quien cobra",
                        },
                        ...empList.map((e) => ({
                          value: e._id,
                          label: `${e.firstName} ${e.lastName}`,
                        })),
                      ]}
                    />
                    {empList.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Para escoger a otra persona, regístrala primero como
                        empleado.
                      </p>
                    )}
                  </CheckoutGroup>

                  {/* Cómo sale el pedido. Con domicilio aparece a dónde va y
                      cuánto se cobra por llevarlo, que se suma ENCIMA del total
                      y sin IVA — igual que la propina. El bloque deja de
                      plegarse mientras falte la dirección: esconder el campo que
                      bloquea el botón de cobrar deja al cajero adivinando. */}
                  <CheckoutGroup
                    title="Tipo de pedido"
                    icon={Truck}
                    forceOpen={orderType === "domicilio" && !address.trim()}
                    requiredHint="Falta la dirección"
                    summary={
                      orderType === "domicilio"
                        ? `Domicilio · ${address.trim() || "sin dirección"}`
                        : ORDER_TYPE_LABELS[orderType]
                    }
                  >
                    <OptionGroup
                      ariaLabel="Tipo de pedido"
                      value={orderType}
                      onChange={setOrderType}
                      columns={4}
                      options={(
                        Object.entries(ORDER_TYPE_LABELS) as [OrderType, string][]
                      ).map(([key, lbl]) => ({ value: key, label: lbl }))}
                    />

                    {orderType === "domicilio" && (
                      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Dirección de entrega</Label>
                          <Input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Calle 33 #70-20, apto 302"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Teléfono</Label>
                            <Input
                              value={deliveryPhone}
                              onChange={(e) => setDeliveryPhone(e.target.value)}
                              placeholder="300 123 4567"
                              inputMode="tel"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Quién lo lleva</Label>
                            <Input
                              value={courier}
                              onChange={(e) => setCourier(e.target.value)}
                              placeholder="Nombre del repartidor"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Indicaciones</Label>
                          <Input
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            placeholder="Timbre dañado, llamar al llegar"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Zona</Label>
                          <NativeSelect
                            value={zoneId}
                            onChange={setZoneId}
                            aria-label="Zona del domicilio"
                            placeholder={
                              zones.length === 0
                                ? "No hay zonas configuradas"
                                : "Otra zona (escribo el valor)"
                            }
                            options={zones.map((z) => ({
                              value: z._id,
                              label: `${z.name} · ${money(z.fee)}`,
                            }))}
                          />
                          {/* El valor a mano es para el pedido que no cae en
                              ninguna zona: es lo que se acordó en vez de
                              calcular por kilómetros. */}
                          {!zoneId && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Cobro del domicilio
                              </span>
                              <MoneyInput
                                value={manualFee === "" ? null : Number(manualFee)}
                                onValueChange={(v) =>
                                  setManualFee(v === null ? "" : String(v))
                                }
                                aria-label="Valor del domicilio"
                                placeholder="0"
                                className="h-9 w-32 text-right"
                              />
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          {deliveryFee > 0
                            ? `Se cobran ${money(deliveryFee)} encima del total. El domicilio no lleva IVA.`
                            : "Domicilio sin costo para el cliente."}
                        </p>
                      </div>
                    )}
                  </CheckoutGroup>

                  {/* Dividir la cuenta de una mesa. Solo aparece con una cuenta
                      abierta: una venta directa se cobra completa siempre. */}
                  {activeOrder && (
                    <CheckoutGroup
                      title="Dividir la cuenta"
                      icon={Split}
                      summary={
                        splitMode === "todo"
                          ? pagadoAntes > 0
                            ? `Completa · ya pagaron ${money(pagadoAntes)}`
                            : "Completa"
                          : splitMode === "items"
                            ? "Por ítem"
                            : `Entre ${splitParts || "?"} partes`
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Cómo se paga la cuenta</Label>
                        {pagadoAntes > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ya pagaron {money(pagadoAntes)}
                          </span>
                        )}
                      </div>
                      <OptionGroup
                        ariaLabel="Cómo se paga la cuenta"
                        value={splitMode}
                        onChange={setSplitMode}
                        columns={3}
                        options={[
                          { value: "todo" as const, label: "Completa" },
                          { value: "items" as const, label: "Por ítem" },
                          { value: "partes" as const, label: "Partes iguales" },
                        ]}
                      />

                      {splitMode === "partes" && (
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">
                            ¿Entre cuántos se divide lo que falta?
                          </Label>
                          <QuantityInput
                            value={splitParts === "" ? null : Number(splitParts)}
                            onValueChange={(v) =>
                              setSplitParts(v === null ? "" : String(v))
                            }
                            decimales={0}
                            aria-label="Entre cuántos se divide la cuenta"
                            className="h-9 w-24 text-right"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {Number(splitParts) > 1
                              ? "Se cobra una parte y la cuenta queda abierta con el resto. Al último ponle 1: se lleva lo que sobre."
                              : "Con 1 se cobra todo lo que falta."}
                          </p>
                        </div>
                      )}

                      {splitMode === "items" && (
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Qué paga esta persona</Label>
                          {[...pendiente.entries()]
                            .filter(([, falta]) => falta > 0.0005)
                            .map(([productId, falta]) => {
                              const l = activeOrder.lines.find(
                                (x) => x.productId === productId,
                              )
                              const texto = splitQty[productId] ?? ""
                              return (
                                <div
                                  key={productId}
                                  className="flex items-center gap-2"
                                >
                                  <span className="min-w-0 flex-1 truncate text-xs">
                                    {l?.name ?? productId}
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · faltan {nfCantidad.format(falta)}
                                    </span>
                                  </span>
                                  <QuantityInput
                                    value={texto === "" ? null : Number(texto)}
                                    onValueChange={(v) =>
                                      setSplitQty((prev) => ({
                                        ...prev,
                                        [productId]: v === null ? "" : String(v),
                                      }))
                                    }
                                    aria-label={`Cuánto paga de ${l?.name ?? ""}`}
                                    placeholder="—"
                                    className="h-8 w-20 text-right"
                                  />
                                </div>
                              )
                            })}
                          <p className="text-[11px] text-muted-foreground">
                            Lo que dejes en blanco se queda pendiente para el
                            siguiente.
                          </p>
                        </div>
                      )}

                      {splitLines && (
                        <p className="text-[11px] font-medium text-success-ink">
                          Este pago cubre {money(chargeTotal)} de{" "}
                          {money(pendingTotal(activeOrder))} que faltan. La cuenta
                          queda abierta.
                        </p>
                      )}
                    </CheckoutGroup>
                  )}

                  {/* ── Factura electrónica ──
                      Interruptor explícito, no un trámite aparte: si el cliente
                      la pide, se marca aquí y sale con la venta. */}
                  <CheckoutGroup
                    title="Factura electrónica DIAN"
                    icon={FileText}
                    defaultOpen={emitInvoice}
                    summary={
                      emitInvoice
                        ? "Se emite al confirmar"
                        : "Sin factura electrónica"
                    }
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={emitInvoice}
                        onChange={(e) => {
                          setEmitInvoice(e.target.checked)
                          if (e.target.checked) setShowCustomer(true)
                        }}
                        className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 text-[0.8125rem]">
                        <span className="block font-medium text-foreground">
                          Emitir factura electrónica
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {emitInvoice
                            ? "Se emite al confirmar. Necesitamos nombre y documento del cliente."
                            : "Márcala si el cliente pide factura."}
                        </span>
                      </span>
                    </label>

                    {emitInvoice && (
                      <label className="flex cursor-pointer items-center gap-3 border-t border-border pt-2.5">
                        <input
                          type="checkbox"
                          checked={saveCustomer}
                          onChange={(e) => setSaveCustomer(e.target.checked)}
                          className="size-5 shrink-0 accent-[var(--primary)]"
                        />
                        <span className="text-[0.8125rem] text-foreground">
                          Guardar el cliente para próximas facturas
                        </span>
                      </label>
                    )}
                  </CheckoutGroup>

                  {/* Datos del cliente para el papel. Se abren solos al pedir
                      factura y dejan de plegarse mientras falten: descubrirlo
                      después de cobrar obligaría a anular la venta. */}
                  <CheckoutGroup
                    title="Datos para la factura"
                    icon={ReceiptText}
                    open={showCustomer}
                    onOpenChange={setShowCustomer}
                    forceOpen={invoiceDataMissing}
                    requiredHint="Faltan datos"
                    summary={
                      customer.name
                        ? `${customer.name}${customer.idNumber ? ` · ${customer.idNumber}` : ""}`
                        : "Sin datos del cliente"
                    }
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        value={customer.name ?? ""}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, name: e.target.value }))
                        }
                        placeholder="Nombre"
                        aria-label="Nombre del cliente"
                      />
                      <Input
                        value={customer.idNumber ?? ""}
                        onChange={(e) =>
                          setCustomer((c) => ({
                            ...c,
                            idNumber: e.target.value,
                          }))
                        }
                        placeholder="Cédula / NIT"
                        aria-label="Identificación del cliente"
                      />
                      <Input
                        value={customer.phone ?? ""}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, phone: e.target.value }))
                        }
                        placeholder="Teléfono"
                        aria-label="Teléfono del cliente"
                      />
                      <Input
                        value={customer.email ?? ""}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, email: e.target.value }))
                        }
                        placeholder="Correo"
                        aria-label="Correo del cliente"
                      />
                    </div>
                    {invoiceDataMissing && (
                      <p className="flex items-start gap-2 rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        Para la factura electrónica hace falta el nombre y la
                        cédula o NIT del cliente.
                      </p>
                    )}
                  </CheckoutGroup>

                  {/* Con qué empaque sale la venta. Lo que quede marcado aquí
                      es EXACTAMENTE lo que baja del inventario: la ficha del
                      producto ya no descuenta por su cuenta. Por eso abre con
                      la sugerencia puesta y no vacío. */}
                  <CheckoutGroup
                    title="Empaques"
                    icon={Package}
                    open={empaqueAbierto}
                    onOpenChange={setEmpaqueAbierto}
                    summary={
                      packagingRows.length > 0
                        ? packagingRows
                            .map((r) => {
                              const e = empaques.find(
                                (p) => p._id === r.productId,
                              )
                              return `${r.qty} ${e?.name ?? "empaque"}`
                            })
                            .join(" · ")
                        : "Sin empaques"
                    }
                  >
                    <p className="text-[11px] text-muted-foreground">
                      Lo que quede marcado sale del inventario y suma al costo
                      de la venta; al cliente no se le cobra.
                    </p>

                    {/* De dónde salió lo que está marcado. Importa decirlo: es
                        la diferencia entre "el sistema se acordó" y "el sistema
                        se lo inventó", y quien cobra decide distinto según
                        cuál de las dos sea. */}
                    {sugerencia && sugerencia.origen !== "ninguno" && (
                      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                        {sugerencia.origen === "historial"
                          ? `Como las últimas ${sugerencia.apoyo} ${
                              sugerencia.apoyo === 1 ? "vez" : "veces"
                            } que vendiste esto.`
                          : "Según el empaque de la ficha de cada producto."}
                      </p>
                    )}

                    {empaques.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Todavía no hay empaques registrados. Se cargan en
                        Inventario → Empaques.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {empaques.map((e) => {
                            const qty = empaqueSel[e._id] ?? 0
                            return (
                              <div
                                key={e._id}
                                className={cn(
                                  "flex flex-col gap-1.5 rounded-xl border p-2 transition-colors",
                                  qty > 0
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border",
                                )}
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 items-center gap-2 text-left"
                                  aria-label={`Agregar ${e.name}`}
                                  onClick={() =>
                                    setEmpaqueSel((s) => ({
                                      ...s,
                                      [e._id]: (s[e._id] ?? 0) + 1,
                                    }))
                                  }
                                >
                                  {e.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={e.imageUrl}
                                      alt=""
                                      loading="lazy"
                                      className="size-10 shrink-0 rounded-lg border border-border object-cover"
                                    />
                                  ) : (
                                    <span
                                      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"
                                      aria-hidden
                                    >
                                      <ImageOff className="size-4" />
                                    </span>
                                  )}
                                  <span className="line-clamp-2 min-w-0 text-[0.8125rem] leading-snug font-medium text-balance">
                                    {e.name}
                                  </span>
                                </button>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    disabled={qty === 0}
                                    aria-label={`Quitar uno de ${e.name}`}
                                    onClick={() =>
                                      setEmpaqueSel((s) => ({
                                        ...s,
                                        [e._id]: Math.max((s[e._id] ?? 0) - 1, 0),
                                      }))
                                    }
                                  >
                                    <Minus />
                                  </Button>
                                  <QuantityInput
                                    value={qty}
                                    decimales={0}
                                    aria-label={`Cantidad de ${e.name}`}
                                    className="h-8 flex-1 text-center"
                                    onValueChange={(v) =>
                                      setEmpaqueSel((s) => ({
                                        ...s,
                                        [e._id]: Math.max(v ?? 0, 0),
                                      }))
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label={`Agregar uno de ${e.name}`}
                                    onClick={() =>
                                      setEmpaqueSel((s) => ({
                                        ...s,
                                        [e._id]: (s[e._id] ?? 0) + 1,
                                      }))
                                    }
                                  >
                                    <Plus />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="self-start"
                          disabled={packagingRows.length === 0}
                          onClick={() => setEmpaqueSel({})}
                        >
                          <X className="size-4" />
                          Sin empaques
                        </Button>
                      </>
                    )}
                  </CheckoutGroup>
                </CheckoutColumn>
              </div>

              {/* Pie fijo. Además de los botones, dice por qué NO se puede
                  cobrar todavía: el botón apagado sin explicación era el motivo
                  número uno de llamada al soporte. */}
              <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1 text-xs sm:text-[0.8125rem]">
                  {checkoutError ? (
                    <p className="flex items-start gap-1.5 font-medium text-destructive">
                      <AlertTriangle className="mt-px size-4 shrink-0" />
                      {checkoutError}
                    </p>
                  ) : (
                    <p className="flex items-start gap-1.5 text-muted-foreground">
                      {motivoBloqueo ? (
                        <>
                          <Info className="mt-px size-4 shrink-0 text-primary" />
                          {motivoBloqueo}
                        </>
                      ) : (
                        <span className="hidden sm:inline">
                          Enter cobra · Esc cierra
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    disabled={saving}
                    className="flex-1 sm:min-w-28 sm:flex-none"
                    onClick={() => setCheckoutOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="h-12 flex-1 px-6 text-base font-semibold sm:flex-none"
                    disabled={confirmBlocked}
                    onClick={() => void handleConfirm()}
                  >
                    {saving
                      ? "Registrando…"
                      : method === "credit"
                        ? `Fiar ${money(netTotal)}`
                        : `Confirmar ${money(netTotal)}`}
                  </Button>
                </div>
              </footer>
            </>
          )}
          </div>
        </div>
      )}

      {/* ── Selector de talla / variante ──
          Se abre al pulsar una tarjeta de grupo y añade la variante elegida
          directo a la cuenta. */}
      <VariantPicker
        group={pickerGroup}
        open={pickerGroup !== null}
        onOpenChange={(v) => {
          if (!v) setPickerGroup(null)
        }}
        inCartByProduct={cartQtyById}
        onPick={(p) => addToCart(p)}
      />

      {/* ── Diálogo "Nueva cuenta" (nombre personalizado) ──
          Antes era un velo a mano con una `Card` dentro: sin scroll propio, sin
          Escape y sin atrapar el Tab. Al ser una ficha corriente de un solo
          campo, `FormDialog` lo resuelve entero y además deja el pie fijo. */}
      <FormDialog
        open={newOrderOpen}
        onOpenChange={(abierto) => {
          if (!abierto && orderBusy) return
          setNewOrderOpen(abierto)
        }}
        title="Nueva cuenta"
        description="Para dejar el consumo de una mesa o un cliente pendiente de cobrar."
        icon={ClipboardList}
        size="md"
        footer={
          <FormActions
            onCancel={() => setNewOrderOpen(false)}
            onSubmit={() => void newOrder(newOrderName)}
            submitLabel="Crear cuenta"
            busy={orderBusy}
            disabled={!sedeId}
          />
        }
      >
        <Field
          id="new-order-name"
          label="Nombre de la cuenta"
          hint="Puedes dejarlo en blanco y usar el número consecutivo."
        >
          <Input
            id="new-order-name"
            ref={newOrderRef}
            value={newOrderName}
            onChange={(e) => setNewOrderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void newOrder(newOrderName)
              }
            }}
            placeholder="Mesa 5, Juan, Terraza…"
          />
        </Field>
      </FormDialog>
    </>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Guardando
      </span>
    )
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-success-ink">
        <Check className="size-3.5" />
        Guardado
      </span>
    )
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="size-3.5" />
        Sin guardar
      </span>
    )
  }
  return null
}

/**
 * Atajo de teclado, escrito donde se usa.
 *
 * Los dos que hay —Enter para agregar lo escaneado y Ctrl K para buscar en todo
 * el terminal— ya existían y no los descubría nadie. En un monitor ancho sobra
 * sitio a la derecha del filtro de categorías, así que se dicen ahí en vez de
 * dejar el hueco en blanco.
 */
function Atajo({
  tecla,
  children,
}: {
  tecla: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground">
        {tecla}
      </kbd>
      {children}
    </span>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/**
 * Tarjeta de un producto con variantes (una camisa y sus tallas).
 *
 * Enseña de qué producto se trata, cuántas tallas quedan con existencias y
 * desde qué precio; el detalle se elige en el selector. Se distingue de una
 * tarjeta normal por el galón de "tallas" y el borde teñido: pulsarla NO
 * agrega nada a la cuenta todavía, y eso hay que verlo antes de tocarla.
 *
 * Comparte maquetación con las tarjetas sueltas de la rejilla a propósito: en
 * una caja, dos tarjetas que se comportan distinto pero se ven iguales son un
 * error esperando a pasar.
 */
function VariantGroupCard({
  group,
  inCart,
  showImages,
  onOpen,
}: {
  group: VariantGroup
  /** Unidades de cualquier talla de este grupo ya en la cuenta. */
  inCart: number
  showImages: boolean
  onOpen: () => void
}) {
  const ordenadas = sortVariants(group.variants)
  const disponibles = ordenadas.filter((v) => v.stock > 0)
  const agotado = disponibles.length === 0
  const desde = Math.min(...group.variants.map((v) => v.salePrice))
  const variosPrecios = new Set(group.variants.map((v) => v.salePrice)).size > 1
  const foto = group.variants.find((v) => v.imageUrl)?.imageUrl ?? null
  const ejes = axesOf(group.variants)
  const eje = ejes.length === 1 ? ejes[0] : "variante"

  return (
    <button
      type="button"
      disabled={agotado}
      onClick={onOpen}
      aria-label={`${group.name}: elegir ${eje.toLowerCase()}`}
      className={cn(
        "group relative flex flex-col items-start gap-0.5 rounded-xl border border-primary/30 bg-card p-2.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm active:translate-y-0",
        agotado &&
          "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-border hover:shadow-xs",
      )}
    >
      {inCart > 0 && (
        <span className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {inCart}
        </span>
      )}
      {showImages &&
        (foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt=""
            loading="lazy"
            className="mb-1 aspect-square w-full rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="mb-1 flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <Layers className="size-6" aria-hidden />
          </span>
        ))}
      <span className="flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-bold text-primary">
        <Layers className="size-3" aria-hidden />
        {group.variants.length} {axisLabel(eje, group.variants.length)}
      </span>
      <span className="line-clamp-2 w-full pr-5 text-[0.8125rem] font-medium leading-snug text-balance">
        {group.name}
      </span>
      <span className="line-clamp-1 w-full text-[11px] text-muted-foreground">
        {disponibles.length > 0
          ? disponibles.slice(0, 6).map(variantLabel).join(" · ")
          : "Sin existencias"}
      </span>
      <span className="mt-1 flex w-full flex-wrap items-center justify-between gap-1">
        <span className="font-display text-lg">
          {variosPrecios ? `desde ${money(desde)}` : money(desde)}
        </span>
        {agotado ? (
          <Badge variant="destructive">Agotado</Badge>
        ) : disponibles.length < group.variants.length ? (
          <Badge className="border-transparent bg-warning/15 text-warning-ink">
            {disponibles.length}/{group.variants.length}
          </Badge>
        ) : null}
      </span>
    </button>
  )
}

function Guard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType
  title: string
  text: string
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Icon className="size-10 text-muted-foreground" />
        <p className="font-display text-lg text-foreground">{title}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}
