import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/env";
import { AppToaster } from "@/components/ui/app-toaster";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-store";

// Un solo par de fuentes para las tres zonas: la marca no se parte en dos y
// el navegador las descarga una sola vez para toda la sesión.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Display: geométrica, no serif. La Fraunces anterior era una serif de
// contraste alto — elegante, pero leía como "editorial antiguo" y a tamaño
// grande no imponía. Outfit es geométrica pura, del mismo linaje que el
// wordmark del logo (círculos perfectos en la "o", terminaciones rectas), así
// que los titulares y la marca por fin hablan el mismo idioma. En 700/800
// llena mucho más el ancho, que es de donde sale la presencia.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Sin esto Next resuelve las imágenes de Open Graph como rutas relativas, y
  // WhatsApp, X o LinkedIn no pueden descargarlas: al compartir un enlace sale
  // la tarjeta sin imagen. Tiene que ser una URL absoluta y pública.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BookiPos — Punto de venta y sistema operacional para Colombia",
    template: "%s · BookiPos",
  },
  description:
    "POS para restaurante, bar y retail con inventario, caja, cartera, nómina y contabilidad automática. Factura electrónica DIAN y multi-sede. Desde $150.000 al mes.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "BookiPos",
    images: [
      {
        url: "/brand/bookipos-og.jpg",
        width: 1200,
        height: 630,
        alt: "BookiPos",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // La barra del navegador sigue al tema: lienzo claro en claro, marino del
  // logo en oscuro. Un solo color fijo dejaría una franja que no pega con
  // ninguno de los dos modos.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f5fd" },
    { media: "(prefers-color-scheme: dark)", color: "#00081c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${outfit.variable} h-full`}
      // El script de abajo le añade la clase `dark` y `data-theme-mode` al
      // <html> antes de hidratar, así que el marcado del cliente no coincide
      // con el del servidor a propósito. Sin esto React avisa en cada carga.
      suppressHydrationWarning
    >
      <head>
        {/*
          Anti-FOUC: aplica el tema guardado ANTES del primer paint. La app es
          estática, así que el HTML sale siempre claro; si la clase se pusiera
          en un efecto, quien usa el modo oscuro vería un fogonazo blanco en
          cada carga. Un script inline y bloqueante es la única forma de
          adelantarse al primer pintado — de ahí el `dangerouslySetInnerHTML`,
          que aquí no interpola nada del usuario (ver `lib/theme/theme-store`).
        */}
        <script
          id="bookipos-theme-init"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      {/* El layout raíz es deliberadamente delgado: solo fuentes, estilos y el
          tema. La sesión la monta `(secure)/layout.tsx`, para que la portada
          pública no cargue el contexto de auth ni el cliente de API. */}
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
