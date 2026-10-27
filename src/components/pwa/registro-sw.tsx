"use client"

import * as React from "react"

/**
 * Registra el service worker (`public/sw.js`). Solo en producción: en
 * desarrollo un SW viejo se interpone con el HMR y confunde las pruebas.
 *
 * Al quedar listo le pasa los chunks que ya cargó esta página: en la primera
 * visita se pidieron antes de que el SW existiera y sin ellos /pos no abriría
 * sin conexión (ítem 6.3).
 */
export function RegistroSw() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(`${location.origin}/_next/static/`))
        reg.active?.postMessage({ type: "precache", urls })
      })
      .catch(() => {
        // Sin SW la app funciona igual; solo se pierde el modo sin conexión.
      })
  }, [])
  return null
}
