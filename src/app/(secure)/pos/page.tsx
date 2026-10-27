"use client"

import * as React from "react"

import {
  ShieldOff,
  MapPin,
  ClipboardList,
  Loader2,
  ChevronLeft,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useSede } from "@/lib/pos/sede-context"
import {
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
  type SugerenciaEmpaque,
  type PosProduct,
  type PaymentMethod,
  type Sale,
  type Order,
  type Customer,
  type Discount,
} from "@/lib/pos/api-sales"
import {
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
  type DeliveryZone,
  type OrderType,
} from "@/lib/pos/api-delivery"
import { createInvoiceFromSale } from "@/lib/pos/api-einvoicing"
import { money } from "@/lib/pos/format"

import { coincide, useBusquedaPendiente } from "@/lib/pos/busqueda"
import {
  listProducts as listInvItems,
  type InvProduct,
  getCobroDigital,
} from "@/lib/pos/api-inventory"

import { Button } from "@/components/ui/button"

import { Card, CardContent } from "@/components/ui/card"



import { useConfirm } from "@/components/ui/confirm-dialog"





import { METODOS_ATAJO, useAtajosPos } from "@/hooks/use-atajos-pos"
import { useLoadEffect } from "@/hooks/use-load-effect"
import { useResetOnChange } from "@/hooks/use-reset-on-change"
import {
  applyMethodShortcut,
  splitSummary,
  toPaymentsPayload,
  type SplitRow,
} from "@/lib/pos/split-payment"
import {
  detalleDigitalError,
  detalleParaEnviar,
  detalleVacio,
  type DigitalDetail,
} from "@/lib/pos/pago-digital"



import {
  VariantPicker,
  type VariantGroup,
} from "@/components/pos/variant-picker"
import { cn } from "@/lib/utils"
import {
  errorMessage,
  CartItem,
  ALL,
  UNCAT,
  LOW_STOCK,
  SaveState,
  buildGridEntries,
  orderToCart,
  cashSuggestions,
  CONSUMIDOR_FINAL,
  QUIEN_COBRA,
} from "@/components/pos/venta-helpers"
import { Guard } from "@/components/pos/venta-ui"


import { CuentasAbiertas } from "@/components/pos/cuentas-abiertas"
import { CajaCerrada } from "@/components/pos/caja-cerrada"
import { NuevaCuentaDialog } from "@/components/pos/nueva-cuenta-dialog"
import { CobroPie } from "@/components/pos/cobro-pie"
import { CobroColumnaVenta } from "@/components/pos/cobro-columna-venta"
import { CobroColumnaPago } from "@/components/pos/cobro-columna-pago"
import { CobroColumnaDetalle } from "@/components/pos/cobro-columna-detalle"
import { CobroCabecera } from "@/components/pos/cobro-cabecera"
import { CobroCompletado } from "@/components/pos/cobro-completado"
import { BarraResumenCuenta } from "@/components/pos/barra-resumen-cuenta"
import { CuentaVenta } from "@/components/pos/cuenta-venta"
import { CatalogoVenta } from "@/components/pos/catalogo-venta"
import { EstadoOffline } from "@/components/pos/estado-offline"
import { useModoOffline } from "@/hooks/use-modo-offline"
import { motivosNoOffline } from "@/lib/offline/cola"
import {
  cajaActualConRespaldo,
  esFallaDeRed,
  posProductsConRespaldo,
  ventaOfflineComoSale,
} from "@/lib/pos/api-offline"
import { imprimirComprobante } from "@/components/pos/impresora-termica"
import { ventaConEfectivo } from "@/lib/impresion/servicio"

export default function VentaPage() {
  const { user, hasPermission, isRetail, isRestaurant } = useAuth()
  const canSell = hasPermission("pos.sell")
  // Elegir lista de precios a mano es decidir cobrar menos: mismo permiso que
  // aplicar un descuento. El backend lo vuelve a comprobar.
  const canDiscount = hasPermission("pos.discount.authorize")

  const { sedeId, sede, sedes, loading: sedesLoading } = useSede()
  const confirm = useConfirm()

  // QR de la sede (ítem 6.4): el listado de sedes no trae la imagen; se pide
  // aparte, una vez por sede, solo si la sede tiene una cargada.
  const [qrImagen, setQrImagen] = React.useState<{ sedeId: string; src: string } | null>(null)
  const conImagenQr = !!sede?.cobroDigital?.conImagen
  React.useEffect(() => {
    if (!sedeId || !conImagenQr) return
    let activo = true
    getCobroDigital(sedeId)
      .then((c) => {
        if (activo && c?.qrImagen) setQrImagen({ sedeId, src: c.qrImagen })
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [sedeId, conImagenQr])
  const cobro = sede?.cobroDigital
    ? {
        ...sede.cobroDigital,
        qrImagen: qrImagen?.sedeId === sedeId ? qrImagen.src : undefined,
      }
    : undefined

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
  // Por debajo de 1024px la cuenta es una hoja inferior, no una columna: aquí
  // se guarda si está desplegada. Ver el bloque "── Cuenta ──" más abajo.
  const [cuentaAbierta, setCuentaAbierta] = React.useState(false)

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
  // Atajos (6.7): ayuda abierta y línea sobre la que actúan + y −.
  const [ayudaAbierta, setAyudaAbierta] = React.useState(false)
  const [lineaSel, setLineaSel] = React.useState<string | null>(null)
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  /**
   * Con cuánto paga el cliente, en pesos. Número y no texto: en una casilla
   * numérica del navegador, "75.400" escrito con el punto de miles se puede
   * leer como 75,4 pesos, y entonces el sistema decía que no alcanzaba en vez
   * de dar la devuelta.
   */
  const [received, setReceived] = React.useState<number | null>(null)
  /**
   * «Dividir pago» (ítem 6.9): varios medios en un mismo tiquete, sin dividir
   * la cuenta. Apagado, se cobra con `method` como siempre.
   */
  const [splitOn, setSplitOn] = React.useState(false)
  /** Datáfono / Nequi / Daviplata / QR del medio único (ítem 6.4). */
  const [digital, setDigital] = React.useState<DigitalDetail>(detalleVacio())
  const [splitRows, setSplitRows] = React.useState<SplitRow[]>([])
  /** Hay fiado en este cobro: el de siempre o una parte del reparto. */
  const usesCredit = splitOn
    ? splitRows.some((r) => r.method === "credit")
    : method === "credit"
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
      // Con respaldo local: sin red, el catálogo guardado (ítem 6.3).
      setProducts(await posProductsConRespaldo(sedeId))
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
      const cur = await cajaActualConRespaldo(sedeId)
      setCaja(cur.session)
    } catch {
      setCaja(null)
    } finally {
      setCajaLoading(false)
    }
  }, [sedeId])

  // Al cambiar de sede se reinicia todo (cuenta, catálogo y cuentas abiertas).
  const reiniciarPorSede = React.useCallback(() => {
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
  }, [fetchProducts, refreshOrders, refreshCaja, fetchDiscounts])
  useLoadEffect(reiniciarPorSede, canSell)

  // Modo sin conexión (ítem 6.3): bloque de consecutivos del turno, cola local
  // y sincronización al volver la red.
  const modo = useModoOffline(sedeId, caja?._id, canSell)

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
  const leerImpresionConfigurada = React.useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem("pos.printConfigured") === "1"
    ) {
      setPrintConfigured(true)
    }
  }, [])
  useLoadEffect(leerImpresionConfigurada)

  // Imprime el recibo. La primera vez marca la impresión como configurada,
  // así la ayuda inicial deja de aparecer en las siguientes ventas.
  const cajonYaAbierto = React.useRef<string | null>(null)
  async function handlePrintReceipt() {
    // Térmica directa si está elegida; si no, el diálogo del navegador.
    // El cajón se abre solo en la primera impresión de esta venta.
    if (completedSale) {
      const primera = cajonYaAbierto.current !== completedSale._id
      cajonYaAbierto.current = completedSale._id
      await imprimirComprobante(completedSale, sede, {
        abrirCajon: primera && ventaConEfectivo(completedSale),
      })
    } else window.print()
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
    setLineaSel(p._id)
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
    setDigital(detalleVacio())
    setReceived(null)
    setSplitOn(false)
    setSplitRows([])
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
  useResetOnChange(() => {
    if (usesCredit) setShowCustomer(true)
  }, [usesCredit])

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
  /** Restante y devuelta del reparto. Lo fiado no cubre la propina. */
  const split = splitOn
    ? splitSummary(splitRows, netTotal, chargeTotal + deliveryFee)
    : null

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
    (!usesCredit && clienteModo === "final"
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

  /** Lo que falta del datáfono o la billetera, si el medio único es digital. */
  const digitalError = splitOn ? null : detalleDigitalError(method, digital)

  /** Por qué no se puede confirmar todavía (o `false` si se puede). */
  const confirmBlocked =
    saving ||
    digitalError !== null ||
    cart.length === 0 ||
    invoiceDataMissing ||
    (!splitOn &&
      method === "cash" &&
      receivedNum !== undefined &&
      receivedNum < netTotal) ||
    (split !== null && split.error !== null) ||
    (usesCredit &&
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
        : usesCredit &&
            ((debtorType === "customer" && !custId) ||
              (debtorType === "employee" && !empId))
          ? "Elige a quién se le fía para poder cobrar."
          : invoiceDataMissing
            ? "Para la factura electrónica hace falta el nombre y la cédula o NIT del cliente."
            : split?.error
              ? split.error
              : digitalError
                ? digitalError
                : !splitOn &&
                method === "cash" &&
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
  // Llave de idempotencia del cobro (ítem 6.3): la misma mientras se reintenta
  // el MISMO cobro (mismas líneas, propina y medio). Si la respuesta se perdió,
  // el reintento en línea devuelve la venta ya registrada, y si sale sin red la
  // cola usa esta llave como UUID y el servidor la reconoce al sincronizar.
  const llaveCobro = React.useRef<{ huella: string; llave: string } | null>(null)
  function llaveDelCobro(): string {
    const huella = JSON.stringify([
      sedeId,
      cart.map((i) => [i.product._id, i.qty, i.discountId ?? ""]),
      tipAmount,
      method,
    ])
    if (llaveCobro.current?.huella !== huella) {
      llaveCobro.current = { huella, llave: crypto.randomUUID() }
    }
    return llaveCobro.current.llave
  }

  // Atajos de teclado (6.7), ver `hooks/use-atajos-pos.ts`.
  const lineaActiva = cart.find((i) => i.product._id === lineaSel) ?? cart.at(-1)
  useAtajosPos({
    enabled: screen === "sell" && !pickerGroup && !newOrderOpen,
    cobroAbierto: checkoutOpen && !completedSale,
    ayudaAbierta,
    puedeCobrar: !checkoutOpen && cart.length > 0 && !!sedeId,
    onBuscar: () => searchRef.current?.focus(),
    onCobrar: openCheckout,
    onCantidad: (d) => {
      if (!lineaActiva) return
      setLineaSel(lineaActiva.product._id)
      changeQty(lineaActiva.product._id, d)
    },
    // Con «dividir pago» abierto, F6..F9 agregan ese medio con lo que falta.
    onMetodo: (i) =>
      splitOn
        ? setSplitRows((rows) =>
            applyMethodShortcut(rows, METODOS_ATAJO[i], netTotal),
          )
        : setMethod(METODOS_ATAJO[i]),
    onCerrar: () => setAyudaAbierta(false),
    onAyuda: () => setAyudaAbierta((a) => !a),
  })

  React.useEffect(() => {
    if (!checkoutOpen || completedSale) return
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!saving && !ayudaAbierta) setCheckoutOpen(false)
        return
      }
      if (e.key !== "Enter" || e.repeat || confirmBlocked || ayudaAbierta) return
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
  }, [checkoutOpen, completedSale, saving, confirmBlocked, ayudaAbierta])

  /**
   * Cobro sin red (ítem 6.3): solo efectivo de mostrador. La venta se encola
   * con un consecutivo `FVC-` reservado y su UUID, y se registra en el
   * servidor (inventario, libro, caja) al volver la conexión.
   */
  async function cobrarSinConexion(
    customerData: typeof customerToSend,
  ): Promise<Sale> {
    const no = motivosNoOffline({
      method,
      split: splitOn,
      hasDiscount: cart.some((i) => !!i.discountId),
      customerId: custId || undefined,
      priceListId: manualListId || undefined,
      orderType,
      emitInvoice,
      activeOrder: !!activeOrderId,
    })
    if (no.length > 0) {
      throw new Error(
        `Sin conexión solo se cobra en efectivo en mostrador. Quita: ${no.join(", ")}.`,
      )
    }
    if (receivedNum === undefined || receivedNum < netTotal) {
      throw new Error("Escribe el efectivo recibido para cobrar sin conexión.")
    }
    const venta = await modo.vender({
      offlineId: llaveDelCobro(),
      sedeId,
      cajaSessionId: caja?._id,
      sale: {
        sedeId,
        lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
        payment: { method: "cash", received: receivedNum },
        tip: tipAmount || undefined,
        customer: customerData,
        seller: sellerPayload,
        orderType: "mostrador",
        packaging: packagingRows,
        packagingExplicit: true,
      },
      lineas: cart.map((i) => ({
        productId: i.product._id,
        name: i.product.name,
        sku: i.product.sku,
        unit: i.product.unit,
        qty: i.qty,
        unitPrice: unitPrice(i),
      })),
      expectedGrandTotal: netTotal,
      cashierEmail: user?.email ?? "",
    })
    return ventaOfflineComoSale(venta, sede)
  }

  async function handleConfirm() {
    if (!sedeId) return
    setSaving(true)
    setCheckoutError(null)
    const payment = {
      method,
      ...detalleParaEnviar(method, digital),
      received: method === "cash" ? receivedNum : undefined,
      dueDate: method === "credit" ? creditDue || undefined : undefined,
      debtorType: method === "credit" ? debtorType : undefined,
      customerId:
        method === "credit" && debtorType === "customer" ? custId : undefined,
      employeeId:
        method === "credit" && debtorType === "employee" ? empId : undefined,
    }
    // Cobro mixto: viaja el reparto en vez del pago único, y la parte fiada
    // lleva el deudor de siempre.
    const payments = splitOn
      ? toPaymentsPayload(splitRows, {
          dueDate: creditDue || undefined,
          debtorType,
          customerId: debtorType === "customer" ? custId : undefined,
          employeeId: debtorType === "employee" ? empId : undefined,
        })
      : undefined
    const pago = splitOn ? { payments } : { payment }
    const customerData = customerToSend
    /** Si tras este cobro la cuenta sigue con algo pendiente. */
    let quedaAbierta = false
    try {
      let sale: Sale
      const sinRed =
        !modo.online || (typeof navigator !== "undefined" && !navigator.onLine)
      if (sinRed) {
        sale = await cobrarSinConexion(customerData)
      } else if (activeOrderId) {
        // Persiste las líneas actuales antes de liquidar (checkout usa las
        // líneas guardadas de la cuenta, no el carrito).
        await updateOrder(activeOrderId, {
          label: label.trim() || undefined,
          lines: cart.map((i) => ({ productId: i.product._id, qty: i.qty })),
        })
        sale = await checkoutOrder(activeOrderId, {
          ...pago,
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
          idempotencyKey: llaveDelCobro(),
          sedeId,
          lines: cart.map((i) => ({
            productId: i.product._id,
            qty: i.qty,
            discountId: i.discountId,
          })),
          ...pago,
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
      // Cobro cerrado: el siguiente lleva llave nueva.
      llaveCobro.current = null
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
      if (esFallaDeRed(err)) {
        // La petición pudo llegar al servidor aunque no volvió la respuesta:
        // NO se encola sola (sería cobrarla dos veces). Se pasa a modo sin
        // conexión y el cajero decide tras revisar.
        modo.marcarSinRed()
        setCheckoutError(
          "Se cayó la conexión y no se pudo confirmar la venta. Si no aparece en Ventas al volver la red, cóbrala de nuevo: ahora se guardará sin conexión.",
        )
      } else {
        setCheckoutError(errorMessage(err))
      }
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
      <CajaCerrada
        sede={sede}
        openingBills={openingBills}
        setOpeningBills={setOpeningBills}
        openingCoins={openingCoins}
        setOpeningCoins={setOpeningCoins}
        openingBusy={openingBusy}
        openCajaError={openCajaError}
        handleOpenCaja={handleOpenCaja}
      />
    )
  }

  const isOrder = activeOrderId !== null

  return (
    <>
      {/* ── Lista de cuentas activas (vista inicial) ── */}
      {screen === "list" && (
        <CuentasAbiertas
          sedeId={sedeId}
          sede={sede}
          orders={orders}
          orderBusy={orderBusy}
          setNewOrderOpen={setNewOrderOpen}
          setNewOrderName={setNewOrderName}
          selectDirect={selectDirect}
          selectOrder={selectOrder}
        />
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

          <EstadoOffline modo={modo} sedeId={sedeId} />

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
      // `max-lg:pb-16` reserva el alto de la barra resumen de la cuenta, que va
      // fija sobre la navegación inferior: sin esto tapa la última fila de
      // productos justo cuando el catálogo es más largo.
      <div className="grid grid-cols-1 gap-4 max-lg:pb-16 lg:grid-cols-3 2xl:grid-cols-4">
        {/* ── Catálogo ── */}
        <CatalogoVenta
          products={products}
          loading={loading}
          error={error}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          searchRef={searchRef}
          flash={flash}
          cart={cart}
          ayudaAbierta={ayudaAbierta}
          setAyudaAbierta={setAyudaAbierta}
          stockSummary={stockSummary}
          categories={categories}
          addToCart={addToCart}
          handleScan={handleScan}
          filtered={filtered}
          showImages={showImages}
          gridEntries={gridEntries}
          setPickerGroup={setPickerGroup}
        />

        {/* ── Cuenta ──
            En PC ocupa todo el alto libre y es la LISTA la que scrollea: el
            total y el botón de cobrar quedan pegados abajo y siempre a la
            vista. Antes la tarjeta crecía con los ítems y a la décima línea
            había que bajar la página entera para encontrar el botón. 

            Por debajo de `lg` el grid apila y la cuenta caía DEBAJO de toda la
            parrilla de productos: para ver el total o pulsar Cobrar había que
            recorrer decenas de artículos. Ahí pasa a ser una hoja inferior: una
            barra resumen siempre visible —artículos y total— que se despliega a
            la cuenta completa al tocarla. Es el mismo marcado y el mismo estado;
            solo cambia dónde vive. */}
        <CuentaVenta
          isRestaurant={isRestaurant}
          sedeId={sedeId}
          cart={cart}
          tip={tip}
          setTip={setTip}
          discounts={discounts}
          cuentaAbierta={cuentaAbierta}
          setCuentaAbierta={setCuentaAbierta}
          label={label}
          setLabel={setLabel}
          saveState={saveState}
          orderBusy={orderBusy}
          setQty={setQty}
          changeQty={changeQty}
          removeFromCart={removeFromCart}
          setLineDiscount={setLineDiscount}
          clearCart={clearCart}
          saveAsOrder={saveAsOrder}
          closeActiveOrder={closeActiveOrder}
          unitPrice={unitPrice}
          discountById={discountById}
          lineDiscount={lineDiscount}
          total={total}
          itemCount={itemCount}
          cartShowImages={cartShowImages}
          tipAmount={tipAmount}
          suggestedTip={suggestedTip}
          openCheckout={openCheckout}
          activeOrder={activeOrder}
          netTotal={netTotal}
          lineaActiva={lineaActiva}
          isOrder={isOrder}
        />

        {/* Barra resumen de la cuenta — solo por debajo de lg.
            Es el ancla que hace usable la hoja: el cajero ve siempre cuántos
            artículos lleva y cuánto suma, sin salir del catálogo, y cobra en un
            toque. Se apoya sobre la navegación inferior (`bottom-14`, que es su
            alto exacto). Se oculta con la hoja desplegada para no duplicar el
            total ni tapar el botón de Cobrar que ya está dentro. */}
        <BarraResumenCuenta
          sedeId={sedeId}
          cart={cart}
          cuentaAbierta={cuentaAbierta}
          setCuentaAbierta={setCuentaAbierta}
          openCheckout={openCheckout}
          netTotal={netTotal}
        />
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
              <CobroCompletado
                sede={sede}
                setCheckoutOpen={setCheckoutOpen}
                completedSale={completedSale}
                printConfigured={printConfigured}
                invoiceState={invoiceState}
                invoiceNumber={invoiceNumber}
                invoiceError={invoiceError}
                handlePrintReceipt={handlePrintReceipt}
                backToList={backToList}
              />
            </>
          ) : (
            <>
              {/* Cabecera fija: el título y la cifra que se lee en voz alta y
                  que el cliente comprueba. No se mueve con el scroll. */}
              <CobroCabecera
                sede={sede}
                setCheckoutOpen={setCheckoutOpen}
                saving={saving}
                lineDiscountTotal={lineDiscountTotal}
                itemCount={itemCount}
                tipAmount={tipAmount}
                deliveryFee={deliveryFee}
                netTotal={netTotal}
              />

              {/* En móvil el cuerpo entero scrollea y las columnas se apilan con
                  "Cómo paga" arriba; en PC no scrollea nada aquí, scrollea cada
                  columna por su cuenta. El orden del DOM es izquierda → centro →
                  derecha para que el Tab recorra la pantalla como se lee. */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.95fr)] lg:divide-x lg:divide-border lg:overflow-hidden">
                {/* ── Columna 1: qué se está cobrando ── */}
                <CobroColumnaDetalle
                  cart={cart}
                  unitPrice={unitPrice}
                  discountById={discountById}
                  lineDiscount={lineDiscount}
                  total={total}
                  lineDiscountTotal={lineDiscountTotal}
                  itemCount={itemCount}
                  tipAmount={tipAmount}
                  activeOrder={activeOrder}
                  pagadoAntes={pagadoAntes}
                  splitLines={splitLines}
                  deliveryFee={deliveryFee}
                  netTotal={netTotal}
                />

                {/* ── Columna 2: cómo paga (lo único que se mira con el cliente
                    enfrente, así que es la más ancha y la más grande) ── */}
                <CobroColumnaPago
                  method={method}
                  setMethod={setMethod}
                  received={received}
                  setReceived={setReceived}
                  splitOn={splitOn}
                  setSplitOn={setSplitOn}
                  splitRows={splitRows}
                  setSplitRows={setSplitRows}
                  usesCredit={usesCredit}
                  creditDue={creditDue}
                  setCreditDue={setCreditDue}
                  debtorType={debtorType}
                  setDebtorType={setDebtorType}
                  custId={custId}
                  empId={empId}
                  setEmpId={setEmpId}
                  regCustomers={regCustomers}
                  empList={empList}
                  ncOpen={ncOpen}
                  setNcOpen={setNcOpen}
                  ncName={ncName}
                  setNcName={setNcName}
                  ncDoc={ncDoc}
                  setNcDoc={setNcDoc}
                  ncPhone={ncPhone}
                  setNcPhone={setNcPhone}
                  ncBusy={ncBusy}
                  elegirCliente={elegirCliente}
                  quickAddCustomer={quickAddCustomer}
                  netTotal={netTotal}
                  receivedNum={receivedNum}
                  change={change}
                  suggestions={suggestions}
                  split={split}
                  digital={digital}
                  setDigital={setDigital}
                  cobro={cobro}
                />

                {/* ── Columna 3: lo que no se toca en cada venta ──
                    Plegado por defecto y con el estado resumido en un renglón:
                    las opciones siguen estando todas, pero solo grita la que
                    esta venta necesita. */}
                <CobroColumnaVenta
                  user={user}
                  canDiscount={canDiscount}
                  splitMode={splitMode}
                  setSplitMode={setSplitMode}
                  splitParts={splitParts}
                  setSplitParts={setSplitParts}
                  splitQty={splitQty}
                  setSplitQty={setSplitQty}
                  orderType={orderType}
                  setOrderType={setOrderType}
                  zones={zones}
                  zoneId={zoneId}
                  setZoneId={setZoneId}
                  manualFee={manualFee}
                  setManualFee={setManualFee}
                  address={address}
                  setAddress={setAddress}
                  deliveryPhone={deliveryPhone}
                  setDeliveryPhone={setDeliveryPhone}
                  deliveryNotes={deliveryNotes}
                  setDeliveryNotes={setDeliveryNotes}
                  courier={courier}
                  setCourier={setCourier}
                  usesCredit={usesCredit}
                  showCustomer={showCustomer}
                  setShowCustomer={setShowCustomer}
                  customer={customer}
                  setCustomer={setCustomer}
                  clienteModo={clienteModo}
                  setClienteModo={setClienteModo}
                  sellerKey={sellerKey}
                  setSellerKey={setSellerKey}
                  empaqueAbierto={empaqueAbierto}
                  setEmpaqueAbierto={setEmpaqueAbierto}
                  empaques={empaques}
                  empaqueSel={empaqueSel}
                  setEmpaqueSel={setEmpaqueSel}
                  sugerencia={sugerencia}
                  emitInvoice={emitInvoice}
                  setEmitInvoice={setEmitInvoice}
                  saveCustomer={saveCustomer}
                  setSaveCustomer={setSaveCustomer}
                  custId={custId}
                  regCustomers={regCustomers}
                  empList={empList}
                  ncOpen={ncOpen}
                  setNcOpen={setNcOpen}
                  ncName={ncName}
                  setNcName={setNcName}
                  ncDoc={ncDoc}
                  setNcDoc={setNcDoc}
                  ncPhone={ncPhone}
                  setNcPhone={setNcPhone}
                  ncBusy={ncBusy}
                  priceLists={priceLists}
                  manualListId={manualListId}
                  setManualListId={setManualListId}
                  elegirCliente={elegirCliente}
                  quickAddCustomer={quickAddCustomer}
                  listaActiva={listaActiva}
                  activeOrder={activeOrder}
                  pagadoAntes={pagadoAntes}
                  pendiente={pendiente}
                  splitLines={splitLines}
                  chargeTotal={chargeTotal}
                  deliveryFee={deliveryFee}
                  invoiceDataMissing={invoiceDataMissing}
                  vendedor={vendedor}
                  packagingRows={packagingRows}
                />
              </div>

              {/* Pie fijo. Además de los botones, dice por qué NO se puede
                  cobrar todavía: el botón apagado sin explicación era el motivo
                  número uno de llamada al soporte. */}
              <CobroPie
                setCheckoutOpen={setCheckoutOpen}
                method={method}
                splitOn={splitOn}
                saving={saving}
                checkoutError={checkoutError}
                netTotal={netTotal}
                confirmBlocked={confirmBlocked}
                motivoBloqueo={motivoBloqueo}
                handleConfirm={handleConfirm}
              />
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
      <NuevaCuentaDialog
        sedeId={sedeId}
        orderBusy={orderBusy}
        newOrderOpen={newOrderOpen}
        setNewOrderOpen={setNewOrderOpen}
        newOrderName={newOrderName}
        setNewOrderName={setNewOrderName}
        newOrderRef={newOrderRef}
        newOrder={newOrder}
      />
    </>
  )
}




