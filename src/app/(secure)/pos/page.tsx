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
  ChevronDown,
  ChevronLeft,
  Lock,
  Coins,
  Info,
  Tag,
  HandCoins,
  CalendarClock,
  ImageOff,
  Layers,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
  posProducts,
  createSale,
  listOrders,
  createOrder,
  updateOrder,
  checkoutOrder,
  voidOrder,
  listDiscounts,
  PAYMENT_METHOD_LABELS,
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
import { createInvoiceFromSale } from "@/lib/pos/api-einvoicing"
import { money, qty as fmtQty } from "@/lib/pos/format"
import { Receipt } from "@/components/pos/receipt"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Separator } from "@/components/ui/separator"
import { MoneyInput } from "@/components/ui/money-input"
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

export default function VentaPage() {
  const { hasPermission, isRetail, isRestaurant } = useAuth()
  const canSell = hasPermission("pos.sell")

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
  const [received, setReceived] = React.useState("")
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

  // Carga clientes/empleados cuando el fiado está activo.
  React.useEffect(() => {
    if (!checkoutOpen || method !== "credit") return
    void listCustomers().then(setRegCustomers).catch(() => setRegCustomers([]))
    void lookupEmployees().then(setEmpList).catch(() => setEmpList([]))
  }, [checkoutOpen, method])

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
      setCustId(created._id)
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

  const discountById = React.useMemo(
    () => new Map(discounts.map((d) => [d._id, d])),
    [discounts],
  )

  /** Descuento en pesos de una línea (0 si no tiene o si ya no existe). */
  const lineDiscount = React.useCallback(
    (item: CartItem): number => {
      const d = item.discountId ? discountById.get(item.discountId) : undefined
      if (!d) return 0
      const gross = item.qty * item.product.salePrice
      const raw =
        d.type === "percent" ? (gross * Math.min(d.value, 100)) / 100 : d.value
      return Math.round(Math.min(Math.max(raw, 0), gross) * 100) / 100
    },
    [discountById],
  )

  // Total = suma de líneas ya netas de su descuento (el descuento de venta se
  // aplica encima, en el cobro).
  const total = cart.reduce(
    (sum, i) => sum + i.qty * i.product.salePrice - lineDiscount(i),
    0,
  )
  const lineDiscountTotal = cart.reduce((s, i) => s + lineDiscount(i), 0)
  const itemCount = cart.reduce((s, i) => s + i.qty, 0)

  // Propina en pesos (0 si no hay). El 10% se sugiere sobre el total de bienes.
  const tipAmount = tip ?? 0
  const suggestedTip = Math.round(total * 0.1)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const inCat =
        category === ALL ||
        (category === UNCAT ? !p.categoryId : p.categoryId === category)
      if (!inCat) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
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
    setReceived("")
    setCreditDue("")
    setShowCustomer(false)
    setCustomer({})
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

  // Total a cobrar. Los descuentos son solo los predefinidos por línea (ya
  // netos en `total`); en el POS no se permiten descuentos libres. La propina
  // (restaurante) se cobra ENCIMA del total de bienes.
  const netTotal = total + tipAmount

  const receivedNum = received ? Number(received) : undefined
  const change =
    method === "cash" && receivedNum !== undefined && receivedNum >= netTotal
      ? receivedNum - netTotal
      : undefined
  const suggestions = React.useMemo(
    () => cashSuggestions(netTotal),
    [netTotal],
  )

  /**
   * `true` si se pidió factura electrónica pero faltan los datos mínimos que
   * la DIAN exige del adquiriente (nombre e identificación).
   */
  const invoiceDataMissing =
    emitInvoice &&
    (!customer.name?.trim() || !customer.idNumber?.trim())

  /** Limpia el cliente: descarta campos vacíos. */
  function cleanCustomer(): Customer | undefined {
    const entries = (["name", "idNumber", "phone", "email"] as const)
      .map((k) => [k, customer[k]?.trim()] as const)
      .filter(([, v]) => v)
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

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
    const customerData = cleanCustomer()
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
        })
        setOrders((prev) => prev.filter((o) => o._id !== activeOrderId))
        setActiveOrderId(null)
        setLabel("")
        setSaveState("idle")
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
          tip: tipAmount || undefined,
        })
      }
      setCompletedSale(sale)
      setCart([])
      setTip(null)
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
  const activeOrder = orders.find((o) => o._id === activeOrderId)

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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Catálogo ── */}
        <div className="flex flex-col gap-3 lg:col-span-2">
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

          {/* Filtro por categoría */}
          {categories.length > 0 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                      "group relative flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0",
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
                    <span className="line-clamp-2 pr-6 font-medium leading-snug">
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.sku}
                    </span>
                    <span className="mt-1 flex w-full items-center justify-between">
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

        {/* ── Cuenta ── */}
        <Card data-tour="pos-carrito" className="h-fit lg:sticky lg:top-20">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
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
              <div className="flex flex-col gap-2">
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
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ShoppingCart className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {isOrder
                    ? "Cuenta abierta sin ítems. Agrega productos; se guardan solos."
                    : "Toca un producto o escanea su código para agregarlo."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((i) => {
                  const gross = i.qty * i.product.salePrice
                  const lineDisc = lineDiscount(i)
                  const applied = i.discountId
                    ? discountById.get(i.discountId)
                    : undefined
                  return (
                  <li
                    key={i.product._id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {i.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(i.product.salePrice)} ·{" "}
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
                    <div className="flex items-center gap-1">
                      {discounts.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant={applied ? "default" : "outline"}
                                size="sm"
                                className="gap-1"
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
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Restar uno"
                        onClick={() => changeQty(i.product._id, -1)}
                      >
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={i.product.stock}
                        value={i.qty}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setQty(i.product._id, Number.isFinite(v) ? v : 0)
                        }}
                        aria-label={`Cantidad de ${i.product.name}`}
                        className="h-8 w-12 px-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Quitar ${i.product.name}`}
                        onClick={() => removeFromCart(i.product._id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                  )
                })}
              </ul>
            )}

            <Separator />

            {/* Propina (restaurante): voluntaria, se cobra encima del total. Se
                pone/quita con el 10% sugerido o un monto libre. Va arriba del
                total para que el cliente decida antes de ver el total a pagar. */}
            {isRestaurant && cart.length > 0 && (
              <div className="rounded-xl border border-dashed border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <HandCoins className="size-4 text-muted-foreground" />
                    Propina
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
          </CardContent>
        </Card>
      </div>
      )}

      {/* ── Cobro ──
          Modal centrado, no panel pegado al borde derecho. Cobrar es el
          momento en que cajero y cliente miran la misma cifra: un cajón
          lateral estrecho lo empuja a una esquina y deja media pantalla
          muerta. Centrado, la atención va donde debe. */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/45 dark:bg-navy-950/70 p-4 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Cobrar"
          onClick={() => {
            if (!saving) setCheckoutOpen(false)
          }}
        >
          <div
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
          {completedSale ? (
            <div className="flex flex-col gap-4 px-4 py-2">
              <div className="flex flex-col items-center gap-2 pt-4 text-center">
                <CheckCircle2 className="size-12 text-success-ink" />
                <p className="font-display text-2xl">Venta registrada</p>
                <p className="text-sm text-muted-foreground">
                  {completedSale.saleNumber}
                </p>
              </div>

              {/* Estado de la factura electrónica. Se muestra aparte del éxito
                  de la venta a propósito: la venta está hecha aunque la DIAN
                  falle, y mezclarlo haría dudar al cajero de si cobró o no. */}
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
                <div className="no-print rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs">
                  <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                    <Info className="size-3.5 text-primary" />
                    Configura la impresión (solo esta vez)
                  </p>
                  <p className="text-muted-foreground">
                    Al pulsar <span className="font-medium">Imprimir</span>,
                    elige tu impresora de recibos y márcala como predeterminada.
                    Para que las próximas ventas salgan sin diálogo, activa la
                    impresión automática (modo kiosco) del navegador. Esta ayuda
                    no volverá a aparecer.
                  </p>
                </div>
              )}

              <Receipt sale={completedSale} sede={sede} />

              <div className="no-print flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handlePrintReceipt}
                >
                  <Printer className="size-4" />
                  Imprimir
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setCheckoutOpen(false)
                    void backToList()
                  }}
                >
                  Listo
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Cabecera violeta con la cifra grande: es el dato que se lee
                  en voz alta y el que el cliente comprueba. */}
              <div className="gradient-brand px-6 py-5 text-primary-foreground">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg">Cobrar</p>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    disabled={saving}
                    onClick={() => setCheckoutOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground disabled:opacity-40"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <p className="stat-figure mt-2 text-4xl leading-none">
                  {money(netTotal)}
                </p>
                <p className="mt-2 text-sm text-primary-foreground/80">
                  {sede ? `${sede.name} · ` : ""}
                  {itemCount} ítem(s)
                  {lineDiscountTotal > 0 && (
                    <>
                      {" · "}
                      <span className="line-through opacity-70">
                        {money(total + lineDiscountTotal)}
                      </span>{" "}
                      −{money(lineDiscountTotal)}
                    </>
                  )}
                  {tipAmount > 0 && (
                    <> · Bienes {money(total)} + Propina {money(tipAmount)}</>
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-4 px-6 py-5">
                <div className="flex flex-col gap-1.5">
                  <Label>Medio de pago</Label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
                    {(
                      Object.entries(PAYMENT_METHOD_LABELS) as [
                        PaymentMethod,
                        string,
                      ][]
                    ).map(([key, lbl]) => {
                      const Icon = PAYMENT_ICONS[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMethod(key)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                            method === key
                              ? "bg-background text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                          {lbl}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Fiado (crédito): deudor obligatorio (cliente o empleado) */}
                {method === "credit" && (
                  <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-warning-ink">
                      <HandCoins className="size-4" />
                      Venta a crédito (fiado)
                    </p>

                    {/* Segmento cliente / empleado */}
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-warning/15 p-1">
                      <button
                        type="button"
                        onClick={() => setDebtorType("customer")}
                        className={cn(
                          "rounded-md py-1.5 text-xs font-medium transition-colors",
                          debtorType === "customer"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-warning-ink",
                        )}
                      >
                        Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setDebtorType("employee")}
                        className={cn(
                          "rounded-md py-1.5 text-xs font-medium transition-colors",
                          debtorType === "employee"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-warning-ink",
                        )}
                      >
                        Empleado (nómina)
                      </button>
                    </div>

                    {debtorType === "customer" ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-warning-ink">Cliente registrado</Label>
                          <button
                            type="button"
                            className="text-xs font-medium text-warning-ink underline"
                            onClick={() => setNcOpen((v) => !v)}
                          >
                            {ncOpen ? "Cancelar" : "+ Registrar"}
                          </button>
                        </div>
                        {!ncOpen ? (
                          <select
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                            value={custId}
                            onChange={(e) => setCustId(e.target.value)}
                          >
                            <option value="">Selecciona un cliente…</option>
                            {regCustomers.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name} · {c.docType} {c.docNumber}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-background p-2">
                            <Input placeholder="Nombre" value={ncName} onChange={(e) => setNcName(e.target.value)} />
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input placeholder="Cédula / NIT" value={ncDoc} onChange={(e) => setNcDoc(e.target.value)} />
                              <Input placeholder="Teléfono" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
                            </div>
                            <Button size="sm" disabled={ncBusy || !ncName.trim() || !ncDoc.trim()} onClick={() => void quickAddCustomer()}>
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
                        <select
                          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
                          value={empId}
                          onChange={(e) => setEmpId(e.target.value)}
                        >
                          <option value="">Selecciona un empleado…</option>
                          {empList.map((e) => (
                            <option key={e._id} value={e._id}>
                              {e.firstName} {e.lastName} · {e.docNumber}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-warning-ink">
                          Se descuenta por nómina (pendiente de aprobación) y aparece en la colilla.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="pos-credit-due" className="gap-1.5 text-xs text-warning-ink">
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

                {method === "cash" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="pos-received">Recibido</Label>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant={
                          receivedNum === total ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setReceived(String(total))}
                      >
                        Exacto
                      </Button>
                      {suggestions.map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant={receivedNum === s ? "default" : "outline"}
                          size="sm"
                          onClick={() => setReceived(String(s))}
                        >
                          {money(s)}
                        </Button>
                      ))}
                    </div>
                    <Input
                      id="pos-received"
                      type="number"
                      min="0"
                      step="any"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      placeholder={String(netTotal)}
                    />
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                        change !== undefined
                          ? "bg-success/10 text-success-ink"
                          : receivedNum !== undefined && receivedNum < netTotal
                            ? "bg-destructive/10 text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {change !== undefined ? (
                        <>
                          <span>Cambio</span>
                          <span className="stat-figure text-base">
                            {money(change)}
                          </span>
                        </>
                      ) : receivedNum !== undefined && receivedNum < netTotal ? (
                        <span>El monto recibido no alcanza</span>
                      ) : (
                        <span>Ingresa cuánto entrega el cliente (opcional)</span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Factura electrónica ──
                    Interruptor grande y explícito. Antes los datos del cliente
                    estaban en un desplegable gris llamado "Datos del cliente
                    (factura)" que no decía si se emitía factura ni cómo; con
                    esto el cajero solo tiene que preguntar "¿con factura?". */}
                <div
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
                    emitInvoice
                      ? "border-primary/40 bg-accent/60"
                      : "border-border",
                  )}
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
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <FileText className="size-4 text-primary" />
                        Factura electrónica DIAN
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {emitInvoice
                          ? "Se emite al confirmar. Necesitamos nombre y documento del cliente."
                          : "Márcala si el cliente pide factura."}
                      </span>
                    </span>
                  </label>

                  {emitInvoice && (
                    <label className="flex cursor-pointer items-center gap-3 border-t border-primary/20 pt-3">
                      <input
                        type="checkbox"
                        checked={saveCustomer}
                        onChange={(e) => setSaveCustomer(e.target.checked)}
                        className="size-5 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="text-sm text-foreground">
                        Guardar el cliente para próximas facturas
                      </span>
                    </label>
                  )}
                </div>

                {/* Datos del cliente. Se despliegan solos al pedir factura. */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomer((v) => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <UserRound className="size-4" />
                    Datos del cliente
                    {emitInvoice && (
                      <span className="text-xs font-normal text-primary">
                        (obligatorios)
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        showCustomer && "rotate-180",
                      )}
                    />
                  </button>
                  {showCustomer && (
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
                  )}
                </div>

                {/* Falta de datos para la factura: se avisa ANTES de cobrar.
                    Descubrirlo después de registrar la venta obligaría a
                    anularla o a emitir la factura a mano. */}
                {invoiceDataMissing && (
                  <p className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    Para la factura electrónica hace falta el nombre y la cédula
                    o NIT del cliente.
                  </p>
                )}

                {checkoutError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {checkoutError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setCheckoutOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="h-12 px-6 text-base font-semibold"
                    disabled={
                      saving ||
                      cart.length === 0 ||
                      invoiceDataMissing ||
                      (method === "cash" &&
                        receivedNum !== undefined &&
                        receivedNum < netTotal) ||
                      (method === "credit" &&
                        ((debtorType === "customer" && !custId) ||
                          (debtorType === "employee" && !empId)))
                    }
                    onClick={() => void handleConfirm()}
                  >
                    {saving
                      ? "Registrando…"
                      : method === "credit"
                        ? `Fiar ${money(netTotal)}`
                        : `Confirmar ${money(netTotal)}`}
                  </Button>
                </div>
              </div>
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

      {/* ── Diálogo "Nueva cuenta" (nombre personalizado) ── */}
      {newOrderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nueva cuenta"
          onClick={() => {
            if (!orderBusy) setNewOrderOpen(false)
          }}
        >
          <Card
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5 text-muted-foreground" />
                <p className="font-display text-lg">Nueva cuenta</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-order-name">Nombre de la cuenta</Label>
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
                <p className="text-xs text-muted-foreground">
                  Puedes dejarlo en blanco y usar el número consecutivo.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={orderBusy}
                  onClick={() => setNewOrderOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={orderBusy || !sedeId}
                  onClick={() => void newOrder(newOrderName)}
                >
                  {orderBusy ? "Creando…" : "Crear cuenta"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
        "group relative flex flex-col items-start gap-1 rounded-xl border border-primary/30 bg-card p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm active:translate-y-0",
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
      <span className="line-clamp-2 pr-6 font-medium leading-snug">
        {group.name}
      </span>
      <span className="line-clamp-1 text-xs text-muted-foreground">
        {disponibles.length > 0
          ? disponibles.slice(0, 6).map(variantLabel).join(" · ")
          : "Sin existencias"}
      </span>
      <span className="mt-1 flex w-full items-center justify-between">
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
