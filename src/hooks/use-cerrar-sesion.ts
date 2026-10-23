"use client"

import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { ventasSinSincronizar } from "@/lib/offline/idb"

/** Texto del aviso: las ventas NO se borran, pero solo se envían al volver a entrar. */
export function avisoVentasPendientes(n: number) {
  return {
    title:
      n === 1
        ? "Hay 1 venta cobrada sin conexión sin registrar"
        : `Hay ${n} ventas cobradas sin conexión sin registrar`,
    description:
      "No se borran: quedan guardadas en este equipo y se envían cuando la persona que las cobró vuelva a entrar con su usuario y haya internet. Hasta entonces no aparecen en la caja ni en los reportes. No borres los datos del navegador.",
    confirmLabel: "Cerrar sesión",
  }
}

/**
 * Cierre de sesión común a todos los puntos de salida (POS, panel y bloqueo
 * por suspensión). Si quedan ventas offline sin registrar en este equipo,
 * avisa antes de salir (ítem 6.3). Devuelve `false` si la persona se quedó.
 */
export function useCerrarSesion() {
  const { logout } = useAuth()
  const confirm = useConfirm()
  return React.useCallback(async (): Promise<boolean> => {
    const pendientes = await ventasSinSincronizar().catch(() => 0)
    if (pendientes > 0) {
      const ok = await confirm(avisoVentasPendientes(pendientes))
      if (!ok) return false
    }
    await logout()
    return true
  }, [confirm, logout])
}
