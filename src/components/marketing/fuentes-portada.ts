import { Geist, Outfit } from "next/font/google";

/**
 * Letra de los titulares de la portada: Geist, una grotesca de trazo limpio
 * que aguanta tamaños grandes con el espaciado apretado. Reemplaza a la
 * monoespaciada de caja registradora, que Paulo leyó como retro. Vive aquí y
 * no en el layout raíz: solo la portada la descarga. Se usa con la utilidad
 * `font-titular` (token en `globals.css`).
 */
export const fuenteTitular = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-portada",
  display: "swap",
});

/**
 * La letra del wordmark para el portal ("BookiPos" gigante). Es una instancia
 * propia de Outfit, sin la fuente de respaldo ajustada que Next genera por
 * defecto: el portal comprueba con `document.fonts.check` que cada familia
 * de la lista esté cargada, y el respaldo generado nunca lo está, así que lo
 * dejaba quieto para siempre.
 */
export const fuenteMarca = Outfit({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["sans-serif"],
});
