import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/env"

// Solo las rutas públicas. /panel, /pos y el resto de la zona con sesión
// quedan fuera a propósito (ver robots.ts y el noindex de (secure)/layout).
const RUTAS_PUBLICAS = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/comparativa", changeFrequency: "monthly", priority: 0.6 },
  { path: "/estado", changeFrequency: "daily", priority: 0.3 },
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return RUTAS_PUBLICAS.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }))
}
