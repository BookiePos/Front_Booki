import { JetBrains_Mono, Outfit } from "next/font/google";

/**
 * Letra de la portada: la de una caja registradora. Una térmica imprime en
 * ancho fijo, y la portada entera es una tirilla, así que los titulares van en
 * la misma monoespaciada que el papel, apretada y en negrita. Vive aquí y no
 * en el layout raíz: solo la portada la descarga.
 */
export const fuenteTirilla = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-portada-mono",
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
