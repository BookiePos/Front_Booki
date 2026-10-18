/*
 * Service worker mínimo de BookiPos (ítem 7.10).
 *
 * Solo guarda el shell estático (/_next/static, iconos) y una página sin
 * conexión. NUNCA toca la API ni respuestas autenticadas: no intercepta
 * peticiones de otro origen, ni las que no son GET, ni las que llevan
 * Authorization. Los documentos HTML (que dependen de la sesión) siempre van a
 * la red; solo si la red falla se muestra /offline.html, que es estático.
 */
const VERSION = "v1"
const CACHE = `bookipos-shell-${VERSION}`
const OFFLINE = "/offline.html"

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
