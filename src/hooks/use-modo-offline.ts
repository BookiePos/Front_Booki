import * as React from "react"

import { alcanceDeSesion } from "@/lib/offline/alcance"
import {
  encolarVenta,
  leerReserva,
  reintentar as reintentarEnCola,
  restantes,
  sincronizar,
  ventasEnCola,
  type NuevaVentaOffline,
  type VentaOffline,
} from "@/lib/offline/cola"
import { hayIndexedDb } from "@/lib/offline/idb"
import {
  COPIA_EVENT,
  enviarVentaOffline,
  reservarConsecutivos,
  ultimaSincronizacion,
} from "@/lib/pos/api-offline"

/** Con menos de esto, al tener red se pide un bloque nuevo. */
const MINIMO_RESERVA = 10
const REINTENTO_MS = 30_000

export interface ModoOffline {
  /** Hay red (según el navegador y la última petición). */
  online: boolean
  /** Ventas cobradas sin red que faltan por registrar. */
  pendientes: VentaOffline[]
  /** Ventas que el servidor rechazó con motivo (bandeja). */
  conflictos: VentaOffline[]
  /** Última vez que el catálogo se trajo del servidor (ISO). */
  ultimaSync: string | null
  /** Consecutivos sin usar del bloque de este turno. */
  numerosLibres: number
  /** ¿Se puede cobrar sin red ahora mismo? */
  disponible: boolean
  marcarSinRed: () => void
  vender: (v: NuevaVentaOffline) => Promise<VentaOffline>
  sincronizarYa: () => Promise<void>
  reintentar: (offlineId: string, opts?: { useOpenShift?: boolean }) => Promise<void>
}

function useOnline(): [boolean, () => void, () => void] {
  const [online, setOnline] = React.useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  )
  React.useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])
  const off = React.useCallback(() => setOnline(false), [])
  const on = React.useCallback(() => setOnline(true), [])
  return [online, off, on]
}

/**
 * Estado del modo sin conexión para la sede y el turno abiertos.
 *
 * Con red: pide un bloque de consecutivos si quedan pocos o es de otro turno,
 * y manda lo pendiente. Sin red: la venta se encola con un número del bloque.
 */
export function useModoOffline(
  sedeId: string,
  cajaSessionId: string | undefined,
  habilitado: boolean,
): ModoOffline {
  const [online, marcarSinRed, marcarConRed] = useOnline()
  const [cola, setCola] = React.useState<VentaOffline[]>([])
  const [ultimaSync, setUltimaSync] = React.useState<string | null>(null)
  const [numerosLibres, setNumerosLibres] = React.useState(0)
  const activo = habilitado && !!sedeId && hayIndexedDb()

  const refrescar = React.useCallback(async () => {
    const a = alcanceDeSesion()
    if (!activo || !a) return
    const [c, r, u] = await Promise.all([
      ventasEnCola(a),
      leerReserva(a, sedeId),
      ultimaSincronizacion(sedeId),
    ]).catch(() => [[], undefined, null] as const)
    setCola([...c])
    setUltimaSync(u)
    setNumerosLibres(
      r && (!cajaSessionId || r.cajaSessionId === cajaSessionId) ? restantes(r) : 0,
    )
  }, [activo, sedeId, cajaSessionId])

  const sincronizarYa = React.useCallback(async () => {
    const a = alcanceDeSesion()
    if (!activo || !a) return
    const res = await sincronizar(a, enviarVentaOffline).catch(() => null)
    // Solo una respuesta real del servidor prueba que volvió la red.
    if (res && !res.interrumpida && res.enviadas + res.conflictos > 0) marcarConRed()
    await refrescar()
  }, [activo, refrescar, marcarConRed])

  /** Con red y turno abierto: que haya un bloque vigente para este turno. */
  const asegurarReserva = React.useCallback(async () => {
    const a = alcanceDeSesion()
    if (!activo || !a || !cajaSessionId) return
    const r = await leerReserva(a, sedeId).catch(() => undefined)
    if (r && r.cajaSessionId === cajaSessionId && restantes(r) >= MINIMO_RESERVA) return
    try {
      await reservarConsecutivos(sedeId)
    } catch {
      /* sin red o sin permiso: se reintenta en la próxima carga */
    }
    await refrescar()
  }, [activo, sedeId, cajaSessionId, refrescar])

  // Al entrar, al cambiar de turno y al volver la red.
  React.useEffect(() => {
    if (!activo) return
    let vivo = true
    async function correr() {
      await Promise.resolve()
      if (!vivo) return
      await refrescar()
      if (online) {
        await sincronizarYa()
        await asegurarReserva()
      }
    }
    void correr()
    return () => {
      vivo = false
    }
  }, [activo, online, refrescar, sincronizarYa, asegurarReserva])

  // Copia nueva del catálogo = fecha de última sincronización nueva.
  React.useEffect(() => {
    if (!activo) return
    const alCopiar = () => void refrescar()
    window.addEventListener(COPIA_EVENT, alCopiar)
    return () => window.removeEventListener(COPIA_EVENT, alCopiar)
  }, [activo, refrescar])

  const pendientes = React.useMemo(() => cola.filter((v) => v.estado === "pendiente"), [cola])
  const conflictos = React.useMemo(() => cola.filter((v) => v.estado === "conflicto"), [cola])

  // Con ventas pendientes se reintenta cada tanto: `online` del navegador no
  // siempre se entera de que volvió el internet (wifi conectado sin salida).
  React.useEffect(() => {
    if (!activo || pendientes.length === 0) return
    const t = window.setInterval(() => void sincronizarYa(), REINTENTO_MS)
    return () => window.clearInterval(t)
  }, [activo, pendientes.length, sincronizarYa])

  const vender = React.useCallback(
    async (v: NuevaVentaOffline) => {
      const a = alcanceDeSesion()
      if (!a) throw new Error("Sin sesión no se puede vender sin conexión")
      const venta = await encolarVenta(a, v)
      await refrescar()
      return venta
    },
    [refrescar],
  )

  const reintentar = React.useCallback(
    async (offlineId: string, opts?: { useOpenShift?: boolean }) => {
      const a = alcanceDeSesion()
      if (!a) return
      await reintentarEnCola(a, offlineId, opts)
      await sincronizarYa()
    },
    [sincronizarYa],
  )

  return {
    online,
    pendientes,
    conflictos,
    ultimaSync,
    numerosLibres,
    disponible: activo && numerosLibres > 0,
    marcarSinRed,
    vender,
    sincronizarYa,
    reintentar,
  }
}
