/**
 * Cola local de ventas sin conexión (ítem 6.3).
 *
 * Sin internet el terminal sigue cobrando en EFECTIVO. Cada venta lleva:
 * - un UUID (`offlineId`) que la hace idempotente: reenviarla al servidor no
 *   la duplica;
 * - un consecutivo `FVC-` tomado del bloque que el servidor reservó por
 *   adelantado para este turno, así que el número impreso es el definitivo.
 *
 * Tomar el número y encolar la venta ocurren en UNA transacción de IndexedDB,
 * que el navegador serializa también entre pestañas: dos cobros simultáneos
 * nunca reciben el mismo número.
 *
 * Al volver la red, `sincronizar` las manda en orden. Lo que el servidor
 * rechaza con motivo (turno cerrado, sin stock, producto inactivo…) queda en
 * la bandeja de conflictos con ese motivo: NUNCA se borra sola una venta que
 * ya se cobró.
 */
import {
  STORES,
  borrar,
  escribir,
  leer,
  todos,
  transaccion,
  type Alcance,
} from "@/lib/offline/idb"

export const OFFLINE_PREFIX = "FVC"

export function formatearNumero(n: number): string {
  return `${OFFLINE_PREFIX}-${String(n).padStart(6, "0")}`
}

/** Bloque de consecutivos que el servidor entregó para este turno. */
export interface ReservaOffline {
  reservationId: string
  sedeId: string
  cajaSessionId: string
  prefix: string
  from: number
  to: number
  /** Siguiente número sin usar del bloque. */
  next: number
  createdAt?: string
}

export interface LineaOffline {
  productId: string
  name: string
  sku: string
  unit: string
  qty: number
  unitPrice: number
}

/** Lo que viaja a `POST /sales/offline/sync` como `sale`. */
export interface VentaOfflinePayload {
  sedeId: string
  lines: { productId: string; qty: number }[]
  payment: { method: "cash"; received?: number }
  tip?: number
  customer?: { name?: string; idNumber?: string; phone?: string; email?: string }
  seller?: { employeeId?: string; name?: string }
  orderType: "mostrador"
  packaging: { productId: string; qty: number }[]
  packagingExplicit: true
}

export type MotivoConflicto =
  | "TURNO_CERRADO"
  | "SIN_STOCK"
  | "PRODUCTO_INACTIVO"
  | "TOTAL_DISTINTO"
  | "NUMERO_INVALIDO"
  | "NUMERO_USADO"
  | "FECHA_INVALIDA"
  | "NO_PERMITIDA_OFFLINE"
  | "RECHAZADA"
  | "EN_PROCESO"

export const MOTIVO_LABEL: Record<MotivoConflicto, string> = {
  TURNO_CERRADO: "El turno en que se cobró ya se cerró",
  SIN_STOCK: "No hay stock suficiente",
  PRODUCTO_INACTIVO: "Un producto ya no se puede vender",
  TOTAL_DISTINTO: "El precio cambió desde el cobro",
  NUMERO_INVALIDO: "El consecutivo no es válido",
  NUMERO_USADO: "El consecutivo ya se usó",
  FECHA_INVALIDA: "La fecha del cobro no cuadra",
  NO_PERMITIDA_OFFLINE: "Esta venta no se permite sin conexión",
  RECHAZADA: "El servidor la rechazó",
  EN_PROCESO: "Se está registrando",
}

export interface VentaOffline {
  offlineId: string
  sedeId: string
  reservationId: string
  saleNumber: string
  /** Cuándo se cobró (ISO). */
  soldAt: string
  /** Lo que pagó el cliente: total + propina, en COP enteros. */
  expectedGrandTotal: number
  sale: VentaOfflinePayload
  /** Para el comprobante y la bandeja. */
  lineas: LineaOffline[]
  cashierEmail: string
  estado: "pendiente" | "conflicto"
  motivo?: { reason: MotivoConflicto; message: string }
  /** El usuario decidió registrarla en el turno abierto (turno cerrado). */
  useOpenShift?: boolean
  intentos: number
}

/** Lo que hace falta saber del cobro para decidir si va sin conexión. */
export interface CobroOfflineInput {
  method: string
  split: boolean
  hasDiscount: boolean
  customerId?: string
  priceListId?: string
  orderType: string
  emitInvoice: boolean
  activeOrder: boolean
}

/**
 * Por qué este cobro no puede hacerse sin conexión. Vacío = permitido. Es el
 * mismo criterio del servidor (`offlineSaleViolations`): solo efectivo, sin
 * fiado, tarjeta, transferencia, cobro mixto, descuentos, listas de precios,
 * cliente registrado, domicilio, factura electrónica ni cuentas abiertas.
 */
export function motivosNoOffline(c: CobroOfflineInput): string[] {
  const out: string[] = []
  if (c.split) out.push("el cobro dividido")
  if (c.method !== "cash") out.push("medios distintos al efectivo")
  if (c.hasDiscount) out.push("descuentos")
  if (c.priceListId) out.push("listas de precios")
  if (c.customerId) out.push("clientes registrados")
  if (c.orderType !== "mostrador") out.push("domicilios")
  if (c.emitInvoice) out.push("factura electrónica")
  if (c.activeOrder) out.push("cuentas abiertas")
  return out
}

/** Guarda un bloque recién reservado; reemplaza el anterior de la sede. */
export async function guardarReserva(
  a: Alcance,
  r: Omit<ReservaOffline, "next">,
): Promise<ReservaOffline> {
  const reserva: ReservaOffline = { ...r, next: r.from }
  await escribir(a, STORES.reservas, r.sedeId, reserva)
  return reserva
}

export function leerReserva(a: Alcance, sedeId: string) {
  return leer<ReservaOffline>(a, STORES.reservas, sedeId)
}

export function restantes(r: ReservaOffline | undefined): number {
  return r ? Math.max(0, r.to - r.next + 1) : 0
}

export class SinNumerosError extends Error {
  constructor() {
    super(
      "No quedan consecutivos reservados para vender sin conexión. Conéctate para pedir más.",
    )
    this.name = "SinNumerosError"
  }
}

export interface NuevaVentaOffline {
  sedeId: string
  /** Turno abierto según la última copia: el bloque tiene que ser de ese turno. */
  cajaSessionId?: string
  sale: VentaOfflinePayload
  lineas: LineaOffline[]
  expectedGrandTotal: number
  cashierEmail: string
  soldAt?: Date
}

/**
 * Toma el siguiente consecutivo del bloque y encola la venta, atómicamente.
 * Si el bloque se acabó o es de otro turno, falla y no se encola nada.
 */
export async function encolarVenta(a: Alcance, v: NuevaVentaOffline): Promise<VentaOffline> {
  if (!Number.isSafeInteger(v.expectedGrandTotal) || v.expectedGrandTotal < 0) {
    throw new Error("El total de la venta tiene que ser un entero en pesos")
  }
  return transaccion(a, [STORES.reservas, STORES.cola], async (tx, get) => {
    const r = await get<ReservaOffline>(STORES.reservas, v.sedeId)
    if (!r || r.next > r.to) throw new SinNumerosError()
    if (v.cajaSessionId && r.cajaSessionId !== v.cajaSessionId) throw new SinNumerosError()
    const venta: VentaOffline = {
      offlineId: crypto.randomUUID(),
      sedeId: v.sedeId,
      reservationId: r.reservationId,
      saleNumber: formatearNumero(r.next),
      soldAt: (v.soldAt ?? new Date()).toISOString(),
      expectedGrandTotal: v.expectedGrandTotal,
      sale: v.sale,
      lineas: v.lineas,
      cashierEmail: v.cashierEmail,
      estado: "pendiente",
      intentos: 0,
    }
    tx.objectStore(STORES.reservas).put({ ...r, next: r.next + 1 }, v.sedeId)
    tx.objectStore(STORES.cola).put(venta, venta.offlineId)
    return venta
  })
}

export async function ventasEnCola(a: Alcance): Promise<VentaOffline[]> {
  const all = await todos<VentaOffline>(a, STORES.cola)
  return all.sort((x, y) => x.saleNumber.localeCompare(y.saleNumber))
}

/** Lo que se le manda al servidor por cada venta. */
export interface SyncDto {
  offlineId: string
  reservationId: string
  saleNumber: string
  soldAt: string
  expectedGrandTotal: number
  useOpenShift?: boolean
  sale: VentaOfflinePayload
}

/** El servidor rechazó la venta con un motivo (409 OFFLINE_CONFLICT o 400). */
export class ConflictoOffline extends Error {
  constructor(
    public readonly reason: MotivoConflicto,
    message: string,
  ) {
    super(message)
    this.name = "ConflictoOffline"
  }
}

export type Enviar = (dto: SyncDto) => Promise<{ status: "creada" | "duplicada" }>

export interface ResultadoSync {
  enviadas: number
  conflictos: number
  /** Falla de red o del servidor: lo pendiente sigue pendiente. */
  interrumpida: boolean
}

let enCurso: Promise<ResultadoSync> | null = null

/**
 * Manda las ventas pendientes, en orden de consecutivo. Una sola corrida a la
 * vez (en esta pestaña con una promesa compartida; entre pestañas con Web
 * Locks si el navegador los tiene). El servidor es idempotente por UUID, así
 * que aun dos corridas cruzadas no duplican nada.
 */
export function sincronizar(a: Alcance, enviar: Enviar): Promise<ResultadoSync> {
  if (enCurso) return enCurso
  const correr = () => sincronizarAhora(a, enviar)
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined
  enCurso = (locks
    ? (locks.request("bookipos-offline-sync", correr) as unknown as Promise<ResultadoSync>)
    : correr()
  ).finally(() => {
    enCurso = null
  })
  return enCurso
}

async function sincronizarAhora(a: Alcance, enviar: Enviar): Promise<ResultadoSync> {
  const res: ResultadoSync = { enviadas: 0, conflictos: 0, interrumpida: false }
  for (const v of await ventasEnCola(a)) {
    if (v.estado !== "pendiente") continue
    try {
      await enviar({
        offlineId: v.offlineId,
        reservationId: v.reservationId,
        saleNumber: v.saleNumber,
        soldAt: v.soldAt,
        expectedGrandTotal: v.expectedGrandTotal,
        useOpenShift: v.useOpenShift || undefined,
        sale: v.sale,
      })
      // Registrada (o ya lo estaba): sale de la cola.
      await borrar(a, STORES.cola, v.offlineId)
      res.enviadas++
    } catch (err) {
      if (err instanceof ConflictoOffline) {
        // Otra petición con el mismo UUID está corriendo: se reintenta luego.
        if (err.reason === "EN_PROCESO") continue
        await escribir(a, STORES.cola, v.offlineId, {
          ...v,
          estado: "conflicto",
          motivo: { reason: err.reason, message: err.message },
          intentos: v.intentos + 1,
        } satisfies VentaOffline)
        res.conflictos++
        continue
      }
      // Red caída, sesión vencida o 5xx: se para y se reintenta más tarde.
      res.interrumpida = true
      break
    }
  }
  return res
}

/**
 * Devuelve una venta de la bandeja a la cola para reintentarla con el MISMO
 * UUID y número. `useOpenShift` la manda al turno abierto si el suyo se cerró.
 */
export async function reintentar(
  a: Alcance,
  offlineId: string,
  opts: { useOpenShift?: boolean } = {},
): Promise<void> {
  const v = await leer<VentaOffline>(a, STORES.cola, offlineId)
  if (!v) return
  await escribir(a, STORES.cola, offlineId, {
    ...v,
    estado: "pendiente",
    motivo: undefined,
    useOpenShift: opts.useOpenShift ?? v.useOpenShift,
  } satisfies VentaOffline)
}

// ─── Copias de lectura (catálogo, turno, sedes) ───────────────────────────────

export interface Copia<T> {
  data: T
  /** Cuándo se trajo del servidor (ISO). */
  at: string
}

export function guardarCopia<T>(a: Alcance, tipo: string, clave: string, data: T) {
  return escribir<Copia<T>>(a, STORES.snapshots, `${tipo}:${clave}`, {
    data,
    at: new Date().toISOString(),
  })
}

export function leerCopia<T>(a: Alcance, tipo: string, clave: string) {
  return leer<Copia<T>>(a, STORES.snapshots, `${tipo}:${clave}`)
}
