import type { ConfigImpresion, TipoTransporte } from "@/lib/impresion/config"

/**
 * Transporte de bytes hacia la impresora, tras una interfaz para probar el
 * flujo con un falso. Dos implementaciones reales, ambas solo en Chrome/Edge
 * (Chromium) y en contexto seguro (HTTPS o localhost):
 *
 * - Web Serial: impresoras con puerto COM/virtual (USB-serial, Bluetooth SPP).
 * - WebUSB: impresoras USB clase 7 (impresora) con endpoint bulk OUT. En
 *   Windows el driver de impresión del sistema suele "ocupar" el dispositivo
 *   y WebUSB no puede reclamarlo; ahí se usa Web Serial o se cambia el driver
 *   (WinUSB, p. ej. con Zadig).
 *
 * El permiso lo da el usuario una sola vez en el selector del navegador;
 * Chrome lo recuerda por origen y `getPorts()`/`getDevices()` devuelven los
 * dispositivos ya autorizados sin volver a preguntar.
 */
export interface TransporteImpresora {
  readonly tipo: TipoTransporte
  abrir(): Promise<void>
  escribir(bytes: Uint8Array): Promise<void>
  cerrar(): Promise<void>
}

/** Abre, escribe y cierra siempre, aunque la escritura falle. */
export async function imprimirBytes(
  transporte: TransporteImpresora,
  bytes: Uint8Array,
): Promise<void> {
  await transporte.abrir()
  try {
    await transporte.escribir(bytes)
  } finally {
    try {
      await transporte.cerrar()
    } catch {
      // Cerrar un dispositivo ya desconectado no debe tapar el error real.
    }
  }
}

// ---- Tipos mínimos de las APIs (lib.dom no las trae todas) ----------------

interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  writable: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}
interface SerialLike {
  requestPort(o?: object): Promise<SerialPortLike>
  getPorts(): Promise<SerialPortLike[]>
}
interface UsbEndpointLike {
  endpointNumber: number
  direction: "in" | "out"
  type: "bulk" | "interrupt" | "isochronous"
}
interface UsbInterfaceLike {
  interfaceNumber: number
  alternate: { interfaceClass: number; endpoints: UsbEndpointLike[] }
}
interface UsbDeviceLike {
  vendorId: number
  productId: number
  productName?: string
  opened: boolean
  configuration: { interfaces: UsbInterfaceLike[] } | null
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(n: number): Promise<void>
  claimInterface(n: number): Promise<void>
  releaseInterface(n: number): Promise<void>
  transferOut(ep: number, data: BufferSource): Promise<unknown>
}
interface UsbLike {
  requestDevice(o: { filters: object[] }): Promise<UsbDeviceLike>
  getDevices(): Promise<UsbDeviceLike[]>
}

function nav(): { serial?: SerialLike; usb?: UsbLike } {
  return typeof navigator === "undefined"
    ? {}
    : (navigator as unknown as { serial?: SerialLike; usb?: UsbLike })
}

/** Qué APIs ofrece este navegador (en SSR, ninguna). */
export function soporteTermico(): { serial: boolean; usb: boolean } {
  const n = nav()
  return {
    serial: typeof window !== "undefined" && window.isSecureContext && !!n.serial,
    usb: typeof window !== "undefined" && window.isSecureContext && !!n.usb,
  }
}

export function hayTermica(): boolean {
  const s = soporteTermico()
  return s.serial || s.usb
}

// ---- Web Serial -------------------------------------------------------------

export class TransporteSerial implements TransporteImpresora {
  readonly tipo = "serial" as const
  constructor(
    private readonly puerto: SerialPortLike,
    private readonly baudios: number,
  ) {}

  async abrir() {
    await this.puerto.open({ baudRate: this.baudios })
  }

  async escribir(bytes: Uint8Array) {
    const w = this.puerto.writable?.getWriter()
    if (!w) throw new Error("El puerto de la impresora no es escribible.")
    try {
      await w.write(bytes)
    } finally {
      w.releaseLock()
    }
  }

  async cerrar() {
    await this.puerto.close()
  }
}

// ---- WebUSB ------------------------------------------------------------------

/** Tamaño de cada transferencia: las térmicas con buffer chico se atoran con paquetes grandes. */
const TROZO_USB = 4096

export class TransporteUsb implements TransporteImpresora {
  readonly tipo = "usb" as const
  private interfaz = -1
  private endpoint = -1
  constructor(private readonly dispositivo: UsbDeviceLike) {}

  async abrir() {
    const d = this.dispositivo
    if (!d.opened) await d.open()
    if (!d.configuration) await d.selectConfiguration(1)
    const ifaces = d.configuration?.interfaces ?? []
    // Preferimos la clase 7 (impresora); si no, cualquiera con bulk OUT.
    const candidatas = [...ifaces].sort(
      (a, b) =>
        Number(b.alternate.interfaceClass === 7) -
        Number(a.alternate.interfaceClass === 7),
    )
    for (const i of candidatas) {
      const ep = i.alternate.endpoints.find(
        (e) => e.direction === "out" && e.type === "bulk",
      )
      if (ep) {
        this.interfaz = i.interfaceNumber
        this.endpoint = ep.endpointNumber
        break
      }
    }
    if (this.endpoint < 0) {
      throw new Error("La impresora USB no expone un canal de escritura.")
    }
    await d.claimInterface(this.interfaz)
  }

  async escribir(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i += TROZO_USB) {
      await this.dispositivo.transferOut(this.endpoint, bytes.slice(i, i + TROZO_USB))
    }
  }

  async cerrar() {
    if (this.interfaz >= 0) await this.dispositivo.releaseInterface(this.interfaz)
    await this.dispositivo.close()
  }
}

// ---- Vinculación (requiere gesto del usuario) y reconexión -----------------------

export interface Vinculo {
  transporte: TransporteImpresora
  tipo: TipoTransporte
  vendorId?: number
  productId?: number
  nombre?: string
}

/** Abre el selector del navegador. Llamar SOLO desde un clic. */
export async function vincularImpresora(
  tipo: TipoTransporte,
  baudios: number,
): Promise<Vinculo> {
  const n = nav()
  if (tipo === "serial") {
    if (!n.serial) throw new Error("Este navegador no soporta Web Serial.")
    const puerto = await n.serial.requestPort()
    const info = puerto.getInfo()
    return {
      transporte: new TransporteSerial(puerto, baudios),
      tipo,
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
    }
  }
  if (!n.usb) throw new Error("Este navegador no soporta WebUSB.")
  const d = await n.usb.requestDevice({ filters: [{ classCode: 7 }, {}] })
  return {
    transporte: new TransporteUsb(d),
    tipo,
    vendorId: d.vendorId,
    productId: d.productId,
    nombre: d.productName,
  }
}

/**
 * Recupera la impresora ya autorizada, sin diálogo. Devuelve null si no hay
 * ninguna vinculada o el permiso se revocó (entonces hay que vincular de nuevo).
 */
export async function transporteGuardado(
  c: Pick<ConfigImpresion, "transporte" | "vendorId" | "productId" | "baudios">,
): Promise<TransporteImpresora | null> {
  if (!c.transporte) return null
  const n = nav()
  const coincide = (v?: number, p?: number) =>
    c.vendorId === undefined || (v === c.vendorId && p === c.productId)
  if (c.transporte === "serial" && n.serial) {
    const puertos = await n.serial.getPorts()
    const puerto = puertos.find((x) => {
      const i = x.getInfo()
      return coincide(i.usbVendorId, i.usbProductId)
    })
    return puerto ? new TransporteSerial(puerto, c.baudios) : null
  }
  if (c.transporte === "usb" && n.usb) {
    const ds = await n.usb.getDevices()
    const d = ds.find((x) => coincide(x.vendorId, x.productId))
    return d ? new TransporteUsb(d) : null
  }
  return null
}
