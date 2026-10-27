/*
 * Service worker mínimo de BookiPos (ítems 7.10 y 6.3).
 *
 * Guarda el shell estático (/_next/static, iconos), una página sin conexión
 * y el documento de /pos. NUNCA toca la API ni respuestas autenticadas: no
 * intercepta peticiones de otro origen, ni las que no son GET, ni las que
 * llevan Authorization.
 *
 * /pos (modo sin conexión, 6.3): su HTML es solo el armazón del cliente
 * (`"use client"`, sin datos: catálogo, turno y sesión se piden después por
 * la API y se guardan en IndexedDB por empresa y usuario). Se sirve primero de
 * la red y, si la red falla, de la última copia; así el POS abre sin internet
 * una vez visitado. El resto de documentos sigue yendo siempre a la red.
 */
const VERSION = "v2"
const CACHE = `bookipos-shell-${VERSION}`
const OFFLINE = "/offline.html"
/** Documentos que se pueden abrir sin red: solo el armazón del POS. */
const SHELLS = new Set(["/pos", "/pos/"])

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(OFFLINE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("bookipos-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function esEstatico(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET" || req.headers.has("Authorization")) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate" && SHELLS.has(url.pathname) && !url.search) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(req)
          .then((res) => {
            // Solo un 200 del propio documento; nunca una redirección.
            if (res.ok && !res.redirected && res.type === "basic") {
              cache.put("/pos", res.clone())
            }
            return res
          })
          .catch(() =>
            cache
              .match("/pos")
              .then((hit) => hit || caches.match(OFFLINE))
              .then((r) => r || Response.error()),
          ),
      ),
    )
    return
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE).then((r) => r || Response.error()),
      ),
    )
    return
  }

  if (esEstatico(url)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const red = fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          return hit || red
        }),
      ),
    )
  }
})

// La primera visita carga los chunks ANTES de que el SW controle la página, así
// que no pasan por el fetch de arriba. La página manda la lista de lo que cargó
// y aquí se guarda (solo /_next/static y los iconos, nunca otra cosa).
self.addEventListener("message", (event) => {
  const data = event.data
  if (!data || data.type !== "precache" || !Array.isArray(data.urls)) return
  const urls = data.urls
    .slice(0, 300)
    .map((u) => {
      try {
        return new URL(u, self.location.origin)
      } catch {
        return null
      }
    })
    .filter((u) => u && u.origin === self.location.origin && esEstatico(u))
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        urls.map((u) =>
          cache.match(u.href).then((hit) => hit || cache.add(u.href).catch(() => undefined)),
        ),
      ),
    ),
  )
})
