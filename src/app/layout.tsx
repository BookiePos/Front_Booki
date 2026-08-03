import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

// Un solo par de fuentes para las tres zonas: la marca no se parte en dos y
// el navegador las descarga una sola vez para toda la sesión.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GoCheck — Punto de venta y sistema operacional para Colombia",
    template: "%s · GoCheck",
  },
  description:
    "POS para restaurante, bar y retail con inventario, caja, cartera, nómina y contabilidad automática. Factura electrónica DIAN y multi-sede. Desde $150.000 al mes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6d28d9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable} h-full`}>
      {/* El layout raíz es deliberadamente delgado: solo fuentes y estilos.
          La sesión la monta `(secure)/layout.tsx`, para que la portada pública
          no cargue el contexto de auth ni el cliente de API. */}
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
