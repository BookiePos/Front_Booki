import type { MetadataRoute } from "next"

/**
 * Manifiesto de la PWA del dueño (ítem 7.10). Al instalarla abre directo la
 * vista compacta `/panel/hoy`; si no hay sesión, el panel la manda al login.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BookiPos",
    short_name: "BookiPos",
    description: "Ventas del día, caja y alertas de tu negocio.",
    id: "/panel/hoy",
    start_url: "/panel/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es-CO",
    background_color: "#00081c",
    theme_color: "#00081c",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoy", url: "/panel/hoy" },
      { name: "Caja", url: "/panel/caja" },
    ],
  }
}
