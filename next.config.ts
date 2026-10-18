import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a esta app para evitar la advertencia por
  // múltiples lockfiles detectados en directorios superiores.
  turbopack: {
    root: path.join(__dirname),
  },

  /**
   * Fotos de producto: viven en el bucket PÚBLICO de Supabase Storage y se sirven
   * por `/_next/image`. Solo ese host y esa ruta; las facturas de compra (URL
   * firmada que vence, bucket privado) siguen como <img> y no pasan por aquí.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xiruqmsjyywrhqfmumjt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  experimental: {
    /**
     * 61 archivos importan del barril de `lucide-react`, que reexporta más de
     * mil iconos. Sin esto, el bundler recorre el barril entero en cada uno;
     * con esto reescribe cada import a su módulo concreto.
     *
     * `@base-ui/react` es el otro barril grande: lo usan todos los componentes
     * de shadcn del ERP y del POS.
     */
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },

  /**
   * Cabeceras de seguridad. Ahora que las tres zonas comparten origen, una
   * sola política cubre la web pública, el panel y el POS.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // El enlace de confirmación lleva un token de un solo uso en la URL: la
      // página no debe filtrarlo en el Referer de nada (4.11).
      {
        source: "/registro/confirmar/:token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      // Service worker de la PWA (7.10): el navegador debe revalidarlo siempre
      // para que una versión nueva no quede atascada en caché.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
