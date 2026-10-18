"use client"

import * as React from "react"

/**
 * Registra el service worker mínimo (`public/sw.js`). Solo en producción: en
 * desarrollo un SW viejo se interpone con el HMR y confunde las pruebas.
 */
export function RegistroSw() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin SW la app funciona igual; solo se pierde la página sin conexión.
    })
  }, [])
  return null
}
