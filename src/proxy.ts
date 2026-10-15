import { NextResponse, type NextRequest } from "next/server"

/**
 * Content Security Policy con nonce (ítem 4.5).
 *
 * Lo que protege es `script-src`: solo corre JavaScript que lleve el nonce de
 * ESTA respuesta, y lo que esos scripts carguen después ('strict-dynamic'). Un
 * script inyectado por XSS no tiene el nonce y el navegador no lo ejecuta. El
 * widget de Wompi y los chunks de Next entran porque los carga código con
 * nonce.
 *
 * Imágenes, estilos, conexiones e iframes no se restringen a propósito: el POS
 * muestra fotos de Supabase con URL firmada, el mapa de la sede es un iframe de
 * Google y el pago abre el de Wompi. Cerrarlos rompe pantallas sin frenar el
 * XSS, que es lo que importa aquí.
 *
 * El nonce cambia en cada petición, así que las páginas se renderizan en cada
 * visita (no hay HTML estático): es el precio de no permitir 'unsafe-inline'.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const dev = process.env.NODE_ENV === "development"
  const politica = [
    // En desarrollo React usa eval para reconstruir las pilas de error.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // El lector de PDF (pdfjs) corre en un worker servido desde el propio sitio.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Igual que X-Frame-Options: SAMEORIGIN de next.config.
    "frame-ancestors 'self'",
  ].join("; ")

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  // Next lee el nonce de esta cabecera de la petición y lo pone en sus scripts.
  requestHeaders.set("Content-Security-Policy", politica)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", politica)
  return response
}

export const config = {
  matcher: [
    {
      // Solo páginas: los estáticos y las imágenes optimizadas no ejecutan nada.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
