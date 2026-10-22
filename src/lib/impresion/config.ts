import type { AnchoPapel, PaginaCodigos } from "@/lib/impresion/escpos"

/**
 * Preferencias de impresión de ESTE navegador/equipo (no del usuario de
 * negocio): la impresora está cableada a la caja, no a la persona. Por eso
 * viven en `localStorage` y no en el backend.
 */
export type ModoImpresion = "navegador" | "termica"
export type TipoTransporte = "serial" | "usb"

export interface ConfigImpresion {
  modo: ModoImpresion
  ancho: AnchoPapel
  paginaCodigos: PaginaCodigos
  /** Pulso de cajón al imprimir una venta con efectivo. */
  cajonAlCobrar: boolean
  /** Baudios del puerto serial (ignorado en USB). */
  baudios: number
  /** Transporte y dispositivo recordado; ausente si nunca se vinculó. */
  transporte?: TipoTransporte
  vendorId?: number
  productId?: number
}

export const CONFIG_POR_DEFECTO: ConfigImpresion = {
  modo: "navegador",
  ancho: 80,
  paginaCodigos: "cp858",
  cajonAlCobrar: true,
  baudios: 9600,
}

const CLAVE = "bookipos.impresion"

export function leerConfig(): ConfigImpresion {
  try {
    const raw = window.localStorage.getItem(CLAVE)
    if (!raw) return CONFIG_POR_DEFECTO
    const p = JSON.parse(raw) as Partial<ConfigImpresion>
    const valida =
      (p.modo === "navegador" || p.modo === "termica") &&
      (p.ancho === 58 || p.ancho === 80)
    if (!valida) return CONFIG_POR_DEFECTO
    return {
      ...CONFIG_POR_DEFECTO,
      ...p,
      paginaCodigos: p.paginaCodigos === "cp850" ? "cp850" : "cp858",
      baudios:
        typeof p.baudios === "number" && p.baudios > 0
          ? p.baudios
          : CONFIG_POR_DEFECTO.baudios,
    }
  } catch {
    return CONFIG_POR_DEFECTO
  }
}

export function guardarConfig(c: ConfigImpresion): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(c))
  } catch {
    // Sin almacenamiento (modo privado): la config vale solo esta sesión.
  }
}
